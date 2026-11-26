"""Events, and repeating events expanded into occurrences with one-off exceptions."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session, selectinload

from app import clock, rrules
from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import Event, EventException
from app.models.base import utc_now
from app.schemas.event import (
    EventCreate,
    EventMove,
    EventReschedule,
    EventUpdate,
    OccurrenceEdit,
)
from app.services.history import ChangeRecorder
from app.services.ownership import ensure_owner_open, resolve_owner

MAX_RANGE_DAYS = 371
TIMING_FIELDS = {"rrule", "start_date", "end_date", "start_time", "end_time"}
DATE_FIELDS = {"start_date", "end_date"}
SERIES_ONLY_FIELDS = {"rrule", "repeat_ends_on"}
SPLIT_COPY_FIELDS = (
    "life_area_id",
    "project_id",
    "title",
    "notes",
    "start_time",
    "end_time",
    "location",
    "rrule",
)


@dataclass(frozen=True)
class Occurrence:
    event: Event
    occurrence_date: date
    title: str
    notes: str | None
    start_date: date
    end_date: date
    start_time: time | None
    end_time: time | None
    location: str | None
    is_cancelled: bool
    is_changed: bool
    is_past: bool


@dataclass(frozen=True)
class EventChange:
    event: Event
    batch_id: str | None


@dataclass(frozen=True)
class OccurrenceFilters:
    life_area_id: int | None = None
    project_id: int | None = None
    include_cancelled: bool = False


# ---------- Reading ----------


def list_events(
    session: Session,
    *,
    life_area_id: int | None = None,
    project_id: int | None = None,
    include_cancelled: bool = False,
    include_archived: bool = False,
) -> Sequence[Event]:
    """Events and series themselves, not their occurrences."""
    query = select(Event)
    if life_area_id is not None:
        query = query.where(Event.life_area_id == life_area_id)
    if project_id is not None:
        query = query.where(Event.project_id == project_id)
    if not include_cancelled:
        query = query.where(Event.cancelled_at.is_(None))
    if not include_archived:
        query = query.where(Event.archived_at.is_(None))
    return session.scalars(query.order_by(Event.start_date, Event.start_time, Event.id)).all()


def get_event(session: Session, event_id: int) -> Event:
    event = session.get(Event, event_id)
    if event is None:
        raise NotFoundError(f"Event {event_id} not found")
    return event


def list_occurrences(
    session: Session, first: date, last: date, filters: OccurrenceFilters
) -> list[Occurrence]:
    """Every occurrence that overlaps first..last, including multi-day ones that started
    earlier and single occurrences moved into the range."""
    if last < first:
        raise UnprocessableError("The range ends before it starts.")
    if (last - first).days + 1 > MAX_RANGE_DAYS:
        raise UnprocessableError(f"Ask for at most {MAX_RANGE_DAYS} days at a time.")

    query = select(Event).options(selectinload(Event.exceptions)).where(Event.archived_at.is_(None))
    if filters.life_area_id is not None:
        query = query.where(Event.life_area_id == filters.life_area_id)
    if filters.project_id is not None:
        query = query.where(Event.project_id == filters.project_id)
    if not filters.include_cancelled:
        query = query.where(Event.cancelled_at.is_(None))

    occurrences = []
    for event in session.scalars(query):
        for occurrence in _occurrences_near(event, first, last):
            overlaps = occurrence.start_date <= last and occurrence.end_date >= first
            if overlaps and (filters.include_cancelled or not occurrence.is_cancelled):
                occurrences.append(occurrence)
    occurrences.sort(key=lambda o: (o.start_date, o.start_time or time.min, o.title, o.event.id))
    return occurrences


# ---------- Events and whole series ----------


def create_event(session: Session, data: EventCreate) -> Event:
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=None,
        allow_inbox=False,
    )
    fields = data.model_dump(exclude={"life_area_id", "project_id"})
    _check_timing(fields)
    assert owner.life_area_id is not None
    event = Event(**fields, life_area_id=owner.life_area_id, project_id=owner.project_id)
    session.add(event)
    return _save(session, event)


def update_event(session: Session, event_id: int, data: EventUpdate) -> Event:
    """Change an event, or a whole series. Changing a series' timing or rule removes
    one-off changes to its occurrences; cancelled occurrences stay cancelled."""
    event = get_event(session, event_id)
    _change_series(event, data.model_dump(exclude_unset=True))
    return _save(session, event)


def get_occurrence(session: Session, event_id: int, day: date) -> Occurrence:
    """Return one occurrence of a repeating event by its original date."""
    event = _repeating_event(session, event_id, day)
    return _build(event, day, _exception(event, day))


def reschedule_event(session: Session, event_id: int, data: EventReschedule) -> EventChange:
    """Give a one-off event new dates (and optionally times). Recorded, so it can be undone.

    A repeating event's occurrences are moved one at a time (`edit_occurrence`), since moving
    the series would drop its one-off changes, which undo can't bring back."""
    event = _get_unarchived(session, event_id)
    if event.rrule is not None:
        raise UnprocessableError("A repeating event moves one occurrence at a time.")
    end_date = None if data.end_date == data.start_date else data.end_date
    current = {field: getattr(event, field) for field in (*TIMING_FIELDS, "repeat_ends_on")}
    updated: dict[str, Any] = {"start_date": data.start_date, "end_date": end_date}
    if "start_time" in data.model_fields_set:
        updated["start_time"] = data.start_time
    if "end_time" in data.model_fields_set:
        updated["end_time"] = data.end_time
    _check_timing(current | updated)
    history = ChangeRecorder(session)
    for field, value in updated.items():
        history.set(event, field, value)
    return EventChange(_save(session, event), history.batch_id)


def move_event(session: Session, event_id: int, data: EventMove) -> EventChange:
    event = get_event(session, event_id)
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=None,
        allow_inbox=False,
    )
    history = ChangeRecorder(session)
    history.set(event, "life_area_id", owner.life_area_id)
    history.set(event, "project_id", owner.project_id)
    return EventChange(_save(session, event), history.batch_id)


def cancel_event(session: Session, event_id: int) -> EventChange:
    """Cancel an event, or every occurrence of a series."""
    event = _get_unarchived(session, event_id)
    if event.cancelled_at is not None:
        raise ConflictError(f"Event {event_id} is already cancelled.")
    history = ChangeRecorder(session)
    history.set(event, "cancelled_at", utc_now())
    return EventChange(_save(session, event), history.batch_id)


def uncancel_event(session: Session, event_id: int) -> EventChange:
    event = _get_unarchived(session, event_id)
    if event.cancelled_at is None:
        raise ConflictError(f"Event {event_id} isn't cancelled.")
    ensure_owner_open(session, event.life_area_id, event.project_id)
    history = ChangeRecorder(session)
    history.set(event, "cancelled_at", None)
    return EventChange(_save(session, event), history.batch_id)


def archive_event(session: Session, event_id: int) -> EventChange:
    event = get_event(session, event_id)
    history = ChangeRecorder(session)
    if event.archived_at is None:
        history.set(event, "archived_at", utc_now())
    return EventChange(_save(session, event), history.batch_id)


def unarchive_event(session: Session, event_id: int) -> EventChange:
    event = get_event(session, event_id)
    history = ChangeRecorder(session)
    if event.archived_at is not None:
        ensure_owner_open(session, event.life_area_id, event.project_id)
        history.set(event, "archived_at", None)
    return EventChange(_save(session, event), history.batch_id)


def delete_event(session: Session, event_id: int) -> None:
    """Delete the event, or a whole series, with its exceptions. This can't be undone."""
    session.delete(get_event(session, event_id))
    session.commit()


def delete_occurrence(session: Session, event_id: int, day: date, scope: str) -> Event | None:
    """Delete one occurrence of a repeating event, the series from it on, or all of it.

    "this" cancels the occurrence, as cancel_occurrence does. "following" ends the series
    the day before and drops later one-off changes; from the first occurrence it deletes
    the series, like "all". Returns the event, or None once it is gone. Deletes aren't
    recorded for undo.
    """
    event = get_event(session, event_id)
    if event.rrule is None:
        raise UnprocessableError(f"Event {event_id} doesn't repeat. Delete the event itself.")
    if rrules.dates_between(event.rrule, event.start_date, event.repeat_ends_on, day, day) != [day]:
        raise NotFoundError(f"Event {event_id} has no occurrence on {day}.")

    if scope == "this":
        exception = _exception(event, day) or _add_exception(event, day)
        exception.is_cancelled = True
        return _save(session, event)
    if scope == "following" and day > event.start_date:
        event.repeat_ends_on = day - timedelta(days=1)
        session.execute(
            delete(EventException).where(
                EventException.event_id == event.id, EventException.occurrence_date >= day
            )
        )
        session.expire(event, ["exceptions"])
        return _save(session, event)
    session.delete(event)
    session.commit()
    return None


# ---------- One occurrence: this / this and following / all ----------


def edit_occurrence(
    session: Session, event_id: int, day: date, data: OccurrenceEdit
) -> EventChange:
    """Change one occurrence ("this"), the series from it on ("following"), or all of it.

    Returns the event that now holds the change: the new series after a split. Changing one
    occurrence is recorded (all but its notes), so it can be undone; series edits aren't.
    """
    event = _repeating_event(session, event_id, day)
    changes = data.model_dump(exclude_unset=True, exclude={"scope"})

    if data.scope == "this":
        if series_only := SERIES_ONLY_FIELDS & changes.keys():
            raise UnprocessableError(
                f"{', '.join(sorted(series_only))} can only change for the series."
            )
        history = ChangeRecorder(session)
        _change_one(event, day, changes, history)
        return EventChange(_save(session, event), history.batch_id)

    if data.scope == "following" and day > event.start_date:
        target = _split(session, event, day)
        if DATE_FIELDS & changes.keys():
            if "start_date" in changes:
                delta = changes["start_date"] - day
                changes["start_date"] = target.start_date + delta
            if (
                "end_date" in changes
                and changes["end_date"] is not None
                and changes["end_date"] == changes.get("start_date", target.start_date)
            ):
                changes["end_date"] = None
        _change_series(target, changes)
        return EventChange(_save(session, target), None)
    if DATE_FIELDS & changes.keys():
        if "start_date" in changes:
            delta = changes["start_date"] - day
            new_start = event.start_date + delta
            if "end_date" not in changes and event.end_date is not None:
                changes["end_date"] = event.end_date + delta
            changes["start_date"] = new_start
        if (
            "end_date" in changes
            and changes["end_date"] is not None
            and changes["end_date"] == changes.get("start_date", event.start_date)
        ):
            changes["end_date"] = None
    _change_series(event, changes)
    return EventChange(_save(session, event), None)


def cancel_occurrence(
    session: Session, event_id: int, day: date, scope: str
) -> tuple[Event, str | None]:
    """Cancel one occurrence, the series from it on, or all of it.

    Each is one undoable batch: undoing "this" removes an exception the cancel created, or
    clears is_cancelled on one that held other one-off changes. restore_occurrence still
    removes every one-off change at once.
    """
    event = _repeating_event(session, event_id, day)
    history = ChangeRecorder(session)

    if scope == "this":
        exception = _exception(event, day)
        if exception is None:
            exception = _add_exception(event, day)
            exception.is_cancelled = True
            history.created(exception)
        else:
            history.set(exception, "is_cancelled", True)
    elif scope == "following" and day > event.start_date:
        new_end = day - timedelta(days=1)
        if event.repeat_ends_on is None or event.repeat_ends_on > new_end:
            history.set(event, "repeat_ends_on", new_end)
    else:
        history.set(event, "cancelled_at", utc_now())
    return _save(session, event), history.batch_id


def restore_occurrence(session: Session, event_id: int, day: date) -> Event:
    """Undo every one-off change to an occurrence, including cancelling it."""
    event = get_event(session, event_id)
    exception = _exception(event, day)
    if exception is None:
        raise NotFoundError(f"The occurrence on {day} has no changes to undo.")
    event.exceptions.remove(exception)
    return _save(session, event)


# ---------- Helpers ----------


def _occurrences_near(event: Event, first: date, last: date) -> list[Occurrence]:
    if event.rrule is None:
        return [_build(event, event.start_date, None)]
    length = _length(event)
    exceptions = {exception.occurrence_date: exception for exception in event.exceptions}
    days = set(
        rrules.dates_between(
            event.rrule, event.start_date, event.repeat_ends_on, first - length, last
        )
    )
    # A single occurrence moved into the range from a date outside it
    days |= {
        day
        for day, exception in exceptions.items()
        if exception.start_date is not None
        and day >= event.start_date
        and (event.repeat_ends_on is None or day <= event.repeat_ends_on)
    }
    return [_build(event, day, exceptions.get(day)) for day in days]


def _build(event: Event, day: date, exception: EventException | None) -> Occurrence:
    def pick(field: str) -> Any:
        value = getattr(exception, field) if exception is not None else None
        return value if value is not None else getattr(event, field)

    start = exception.start_date if exception and exception.start_date else day
    end = exception.end_date if exception and exception.end_date else start + _length(event)
    if exception is not None and exception.is_all_day:
        start_time, end_time = None, None
    else:
        start_time, end_time = pick("start_time"), pick("end_time")
    return Occurrence(
        event=event,
        occurrence_date=day,
        title=pick("title"),
        notes=pick("notes"),
        start_date=start,
        end_date=end,
        start_time=start_time,
        end_time=end_time,
        location=pick("location"),
        is_cancelled=event.cancelled_at is not None
        or (exception is not None and exception.is_cancelled),
        is_changed=exception is not None and exception.has_changes,
        is_past=_is_past(end, end_time or start_time),
    )


def _is_past(end_date: date, end_time: time | None) -> bool:
    if end_time is not None:
        return datetime.combine(end_date, end_time) <= clock.now()
    return end_date < clock.today()


def _length(event: Event) -> timedelta:
    return (event.end_date - event.start_date) if event.end_date else timedelta(0)


def _check_timing(state: dict[str, Any]) -> None:
    """The date and time rules, checked before anything changes."""
    start_date, end_date = state.get("start_date"), state.get("end_date")
    start_time, end_time = state.get("start_time"), state.get("end_time")
    if start_date is None:
        raise UnprocessableError("An event needs a start date.")
    if end_date is not None and end_date < start_date:
        raise UnprocessableError("The end date can't be before the start date.")
    if end_time is not None and start_time is None:
        raise UnprocessableError("An end time needs a start time.")
    one_day = end_date is None or end_date == start_date
    if one_day and end_time is not None and start_time is not None and end_time < start_time:
        raise UnprocessableError("The end time can't be before the start time.")
    if state.get("repeat_ends_on") is not None:
        if state.get("rrule") is None:
            raise UnprocessableError("Only a repeating event can have a repeat end date.")
        if state["repeat_ends_on"] < start_date:
            raise UnprocessableError("The repeat end date can't be before the start date.")


def _change_series(event: Event, changes: dict[str, Any]) -> None:
    current = {field: getattr(event, field) for field in (*TIMING_FIELDS, "repeat_ends_on")}
    if "rrule" in changes and changes["rrule"] is None:
        changes = {**changes, "repeat_ends_on": None}  # a one-off event has no repeat end
    _check_timing(current | changes)

    timing_changed = any(
        field in changes and changes[field] != current[field] for field in TIMING_FIELDS
    )
    for field, value in changes.items():
        setattr(event, field, value)

    if event.rrule is None:
        event.exceptions.clear()
    elif timing_changed:
        # One-off changes no longer line up with the new timing, so they go, with a
        # warning in the UI first. Cancelled occurrences stay cancelled.
        event.exceptions[:] = [
            exception for exception in event.exceptions if exception.is_cancelled
        ]
        for exception in event.exceptions:
            for field in EventException.OVERRIDES:
                setattr(exception, field, None)


def _change_one(event: Event, day: date, changes: dict[str, Any], history: ChangeRecorder) -> None:
    """Apply one occurrence's changes to its exception. Notes aren't recorded, as for tasks;
    an exception the change creates is recorded as created, so undo removes it again."""
    exception = _exception(event, day)
    current = _build(event, day, exception)
    effective = {
        "start_date": current.start_date,
        "end_date": current.end_date,
        "start_time": current.start_time,
        "end_time": current.end_time,
    } | {field: value for field, value in changes.items() if field in TIMING_FIELDS}
    if "start_date" in changes and "end_date" not in changes:
        effective["end_date"] = changes["start_date"] + (current.end_date - current.start_date)
        if (
            current.end_date > current.start_date
            or event.end_date is not None
            or (exception is not None and exception.end_date is not None)
        ):
            changes = {**changes, "end_date": effective["end_date"]}
    if "start_time" in changes:
        if changes["start_time"] is None:
            changes = {**changes, "is_all_day": True, "end_time": None}
            effective["end_time"] = None
        else:
            changes = {**changes, "is_all_day": False}
    _check_timing(effective)

    recorded = {field: value for field, value in changes.items() if field != "notes"}
    if exception is None:
        exception = _add_exception(event, day)
        for field, value in changes.items():
            setattr(exception, field, value)
        if any(value is not None for value in recorded.values()):
            history.created(exception)
        return
    if "notes" in changes:
        exception.notes = changes["notes"]
    for field, value in recorded.items():
        history.set(exception, field, value)


def _split(session: Session, event: Event, day: date) -> Event:
    """End the series the day before `day` and continue it as a new series from `day`.

    Changes to occurrences from `day` on move to the new series.
    """
    continuation = Event(
        **{field: getattr(event, field) for field in SPLIT_COPY_FIELDS},
        start_date=day,
        end_date=day + _length(event) if event.end_date else None,
        repeat_ends_on=event.repeat_ends_on,
    )
    event.repeat_ends_on = day - timedelta(days=1)
    session.add(continuation)
    session.flush()
    session.execute(
        update(EventException)
        .where(EventException.event_id == event.id, EventException.occurrence_date >= day)
        .values(event_id=continuation.id)
    )
    session.expire_all()
    return continuation


def _repeating_event(session: Session, event_id: int, day: date) -> Event:
    event = _get_unarchived(session, event_id)
    if event.rrule is None:
        raise UnprocessableError(f"Event {event_id} doesn't repeat. Edit the event itself.")
    if event.cancelled_at is not None:
        raise ConflictError(f"Event {event_id} is cancelled. Uncancel it first.")
    if rrules.dates_between(event.rrule, event.start_date, event.repeat_ends_on, day, day) != [day]:
        raise NotFoundError(f"Event {event_id} has no occurrence on {day}.")
    return event


def _exception(event: Event, day: date) -> EventException | None:
    return next((e for e in event.exceptions if e.occurrence_date == day), None)


def _add_exception(event: Event, day: date) -> EventException:
    exception = EventException(occurrence_date=day)
    event.exceptions.append(exception)
    return exception


def _get_unarchived(session: Session, event_id: int) -> Event:
    event = get_event(session, event_id)
    if event.archived_at is not None:
        raise ConflictError(f"Event {event_id} is archived. Restore it first.")
    return event


def _save(session: Session, event: Event) -> Event:
    session.commit()
    session.refresh(event)
    return event
