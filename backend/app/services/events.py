"""Events, and repeating events expanded into occurrences with one-off exceptions."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, time, timedelta
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app import clock, rrules
from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import Event, EventException
from app.models.base import utc_now
from app.schemas.event import EventCreate, EventMove, EventUpdate, OccurrenceEdit
from app.services.history import ChangeRecorder
from app.services.ownership import ensure_owner_open, resolve_owner

MAX_RANGE_DAYS = 366
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
    if (last - first).days >= MAX_RANGE_DAYS:
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
    session.delete(get_event(session, event_id))
    session.commit()


# ---------- One occurrence: this / this and following / all ----------


def edit_occurrence(session: Session, event_id: int, day: date, data: OccurrenceEdit) -> Event:
    """Change one occurrence ("this"), the series from it on ("following"), or all of it.

    Returns the event that now holds the change: the new series after a split.
    """
    event = _repeating_event(session, event_id, day)
    changes = data.model_dump(exclude_unset=True, exclude={"scope"})

    if data.scope == "this":
        if series_only := SERIES_ONLY_FIELDS & changes.keys():
            raise UnprocessableError(
                f"{', '.join(sorted(series_only))} can only change for the series."
            )
        _change_one(session, event, day, changes)
        return _save(session, event)

    if moved := DATE_FIELDS & changes.keys():
        raise UnprocessableError(
            f"{', '.join(sorted(moved))} can't change from an occurrence. "
            "Edit one occurrence with scope 'this', or the event itself to move the series."
        )
    if data.scope == "following" and day > event.start_date:
        target = _split(session, event, day)
        _change_series(target, changes)
        return _save(session, target)
    _change_series(event, changes)
    return _save(session, event)


def cancel_occurrence(
    session: Session, event_id: int, day: date, scope: str
) -> tuple[Event, str | None]:
    """Cancel one occurrence, the series from it on, or all of it.

    Cancelling the series ("following" or "all") is one undoable batch. A single
    cancelled occurrence comes back with restore_occurrence instead.
    """
    event = _repeating_event(session, event_id, day)
    history = ChangeRecorder(session)

    if scope == "this":
        exception = _exception(event, day) or _add_exception(event, day)
        exception.is_cancelled = True
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
    days |= {day for day, exception in exceptions.items() if exception.start_date is not None}
    return [_build(event, day, exceptions.get(day)) for day in days]


def _build(event: Event, day: date, exception: EventException | None) -> Occurrence:
    def pick(field: str) -> Any:
        value = getattr(exception, field) if exception is not None else None
        return value if value is not None else getattr(event, field)

    start = exception.start_date if exception and exception.start_date else day
    end = exception.end_date if exception and exception.end_date else start + _length(event)
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
    today = clock.today()
    if end_date != today:
        return end_date < today
    return end_time is not None and end_time <= clock.now().time()


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


def _change_one(session: Session, event: Event, day: date, changes: dict[str, Any]) -> None:
    exception = _exception(event, day)
    current = _build(event, day, exception)
    effective = {
        "start_date": current.start_date,
        "end_date": current.end_date,
        "start_time": current.start_time,
        "end_time": current.end_time,
    } | {field: value for field, value in changes.items() if field in TIMING_FIELDS}
    if "start_date" in changes and "end_date" not in changes:
        effective["end_date"] = changes["start_date"] + _length(event)  # keep its length
    _check_timing(effective)

    exception = exception or _add_exception(event, day)
    for field, value in changes.items():
        setattr(exception, field, value)
    if "start_date" in changes and "end_date" not in changes and event.end_date is not None:
        exception.end_date = effective["end_date"]


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
