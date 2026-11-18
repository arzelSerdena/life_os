"""Metrics, their entries and their targets."""

import re
from collections.abc import Sequence
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import clock
from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import Metric, MetricEntry, MetricTarget, RoutineStep
from app.models.base import utc_now
from app.schemas.metric import (
    EntryCreate,
    EntryUpdate,
    MetricCreate,
    MetricMove,
    MetricUpdate,
    TargetCreate,
    TargetReplace,
)
from app.services.history import ChangeRecorder
from app.services.metric_entries import Entry, entries_of
from app.services.ownership import ensure_owner_open, resolve_owner

DEFAULT_CURRENCY = "PHP"
CURRENCY_CODE = re.compile(r"[A-Z]{3}")

# ---------- Metrics ----------


def list_metrics(
    session: Session,
    *,
    life_area_id: int | None = None,
    project_id: int | None = None,
    include_archived: bool = False,
) -> Sequence[Metric]:
    query = select(Metric).options(selectinload(Metric.entries), selectinload(Metric.targets))
    if life_area_id is not None:
        query = query.where(Metric.life_area_id == life_area_id)
    if project_id is not None:
        query = query.where(Metric.project_id == project_id)
    if not include_archived:
        query = query.where(Metric.archived_at.is_(None))
    return session.scalars(query.order_by(Metric.sort_order, Metric.id)).all()


def get_metric(session: Session, metric_id: int) -> Metric:
    metric = session.get(Metric, metric_id)
    if metric is None:
        raise NotFoundError(f"Metric {metric_id} not found")
    return metric


def create_metric(session: Session, data: MetricCreate) -> Metric:
    """A new metric. A manual one may log its current value as today's first entry."""
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=None,
        allow_inbox=False,
    )
    assert owner.life_area_id is not None
    if data.source == "routine_step":
        step = _source_step(session, data.routine_step_id)
        if data.current_value is not None:
            raise UnprocessableError(
                "A routine-step metric counts the step's days, so it takes no current value."
            )
        given = data.model_dump(include={"format", "unit"}, exclude_unset=True)
        display_format, unit = _step_display(data.aggregation, given)
        routine_step_id: int | None = step.id
    else:
        if data.routine_step_id is not None:
            raise UnprocessableError("Only a routine-step metric has a routine step.")
        display_format, unit = _display(data.format, data.unit)
        routine_step_id = None

    last_position = session.scalar(select(func.max(Metric.sort_order)))
    metric = Metric(
        title=data.title,
        notes=data.notes,
        format=display_format,
        unit=unit,
        aggregation=data.aggregation,
        direction=data.direction,
        source=data.source,
        routine_step_id=routine_step_id,
        life_area_id=owner.life_area_id,
        project_id=owner.project_id,
        sort_order=0 if last_position is None else last_position + 1,
    )
    if data.current_value is not None:
        metric.entries.append(MetricEntry(date=clock.today(), value=data.current_value))
    session.add(metric)
    return _save(session, metric)


def update_metric(session: Session, metric_id: int, data: MetricUpdate) -> Metric:
    """Changing aggregation or direction changes how every target is judged, past ones too.

    Changing format without a unit resets the unit to the format's default. Stored values
    are never converted. A routine-step metric's format follows its aggregation.
    """
    metric = get_metric(session, metric_id)
    changes = data.model_dump(exclude_unset=True)
    display = {field: changes.pop(field) for field in ("format", "unit") if field in changes}
    aggregation = changes.get("aggregation", metric.aggregation)

    if metric.source == "routine_step":
        metric.format, metric.unit = _step_display(aggregation, display)
    elif display:
        display_format = display.get("format", metric.format)
        if "unit" in display:
            unit = display["unit"]
        elif display_format == metric.format:
            unit = metric.unit
        else:
            unit = None
        metric.format, metric.unit = _display(display_format, unit)

    for field, value in changes.items():
        setattr(metric, field, value)
    return _save(session, metric)


def move_metric(session: Session, metric_id: int, data: MetricMove) -> tuple[Metric, str | None]:
    metric = get_metric(session, metric_id)
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=None,
        allow_inbox=False,
    )
    history = ChangeRecorder(session)
    history.set(metric, "life_area_id", owner.life_area_id)
    history.set(metric, "project_id", owner.project_id)
    return _save(session, metric), history.batch_id


def archive_metric(session: Session, metric_id: int) -> tuple[Metric, str | None]:
    """Hide the metric. Its entries and targets are kept."""
    metric = get_metric(session, metric_id)
    history = ChangeRecorder(session)
    if metric.archived_at is None:
        history.set(metric, "archived_at", utc_now())
    return _save(session, metric), history.batch_id


def unarchive_metric(session: Session, metric_id: int) -> tuple[Metric, str | None]:
    metric = get_metric(session, metric_id)
    history = ChangeRecorder(session)
    if metric.archived_at is not None:
        ensure_owner_open(session, metric.life_area_id, metric.project_id)
        history.set(metric, "archived_at", None)
    return _save(session, metric), history.batch_id


def delete_metric(session: Session, metric_id: int) -> None:
    """Delete the metric with all its entries and targets. This can't be undone."""
    session.delete(get_metric(session, metric_id))
    session.commit()


# ---------- Entries ----------


def list_entries(
    session: Session, metric_id: int, first: date | None, last: date | None
) -> list[Entry]:
    """The metric's entries, typed in or, for a routine-step metric, derived."""
    metric = get_metric(session, metric_id)
    return [
        entry
        for entry in entries_of(metric)
        if (first is None or entry.date >= first) and (last is None or entry.date <= last)
    ]


def add_entry(
    session: Session, metric_id: int, data: EntryCreate
) -> tuple[MetricEntry, str | None]:
    """Logs a value. Recorded for undo, which removes the entry if it is unchanged since."""
    metric = _get_active(session, metric_id)
    if metric.source != "manual":
        raise ConflictError(
            f"Metric {metric_id} counts its routine step's days. Check off the step instead."
        )
    day = data.date or clock.today()
    _check_entry_day(day)
    entry = MetricEntry(metric_id=metric.id, date=day, value=data.value, note=data.note)
    session.add(entry)
    history = ChangeRecorder(session)
    history.created(entry)
    return _save_entry(session, entry), history.batch_id


def update_entry(session: Session, entry_id: int, data: EntryUpdate) -> MetricEntry:
    entry = _get_entry(session, entry_id)
    _get_active(session, entry.metric_id)
    changes = data.model_dump(exclude_unset=True)
    if "date" in changes:
        _check_entry_day(changes["date"])
    for field, value in changes.items():
        setattr(entry, field, value)
    return _save_entry(session, entry)


def delete_entry(session: Session, entry_id: int) -> None:
    session.delete(_get_entry(session, entry_id))
    session.commit()


# ---------- Targets ----------


def add_target(session: Session, metric_id: int, data: TargetCreate) -> MetricTarget:
    metric = _get_active(session, metric_id)
    target = MetricTarget(
        metric_id=metric.id,
        kind=data.kind,
        target_value=data.target_value,
        period=data.period,
        start_date=data.start_date or clock.today(),
        end_date=data.end_date,
    )
    _check_target(session, target)
    session.add(target)
    session.commit()
    session.refresh(target)
    return target


def replace_target(session: Session, target_id: int, data: TargetReplace) -> MetricTarget:
    """End the target yesterday and start a changed copy today, keeping its history.

    A target that started today, or hasn't started yet, is simply changed instead.
    """
    target = _get_target(session, target_id)
    _get_active(session, target.metric_id)
    today = clock.today()
    if target.end_date is not None and target.end_date < today:
        raise ConflictError(f"Target {target_id} has already ended.")

    changes = data.model_dump(exclude_unset=True)
    if "period" in changes and target.kind != "per_period":
        raise UnprocessableError("Only a per-period target has a period.")

    if target.start_date >= today:
        for field, value in changes.items():
            setattr(target, field, value)
        _check_target(session, target)
        session.commit()
        session.refresh(target)
        return target

    replacement = MetricTarget(
        metric_id=target.metric_id,
        kind=target.kind,
        target_value=changes.get("target_value", target.target_value),
        period=changes.get("period", target.period),
        start_date=today,
        end_date=changes.get("end_date", target.end_date),
    )
    target.end_date = today - timedelta(days=1)
    _check_target(session, replacement, ignore=target)
    session.add(replacement)
    session.commit()
    session.refresh(replacement)
    return replacement


def delete_target(session: Session, target_id: int) -> None:
    session.delete(_get_target(session, target_id))
    session.commit()


# ---------- Helpers ----------


def _display(display_format: str, unit: str | None) -> tuple[str, str | None]:
    """A manual metric's format and unit, checked: a number's unit is an optional suffix,
    a currency's is an ISO 4217 code (default PHP), and percent and duration have none."""
    if display_format == "currency":
        code = (unit or DEFAULT_CURRENCY).upper()
        if not CURRENCY_CODE.fullmatch(code):
            raise UnprocessableError("A currency needs a three-letter ISO 4217 code, like PHP.")
        return display_format, code
    if display_format in ("percent", "duration") and unit is not None:
        raise UnprocessableError(f"A {display_format} metric has no unit.")
    return display_format, unit


def _step_display(aggregation: str, given: dict[str, str | None]) -> tuple[str, str | None]:
    """A routine-step metric counts days done (sum) or its completion rate (average)."""
    if aggregation == "sum":
        display_format, unit = "number", "days"
    elif aggregation == "average":
        display_format, unit = "percent", None
    else:
        raise UnprocessableError(
            "A routine-step metric adds up days done (sum) or shows its completion rate (average)."
        )
    expected = {"format": display_format, "unit": unit}
    if any(expected[field] != value for field, value in given.items()):
        raise UnprocessableError(
            "A routine-step metric's format and unit follow from its aggregation."
        )
    return display_format, unit


def _source_step(session: Session, step_id: int | None) -> RoutineStep:
    if step_id is None:
        raise UnprocessableError("A routine-step metric needs routine_step_id.")
    step = session.get(RoutineStep, step_id)
    if step is None:
        raise UnprocessableError(f"Routine step {step_id} not found")
    if step.archived_at is not None or step.routine.archived_at is not None:
        raise ConflictError(f"Routine step {step_id} is archived. Restore it first.")
    return step


def _check_entry_day(day: date) -> None:
    if day > clock.today():
        raise UnprocessableError("An entry can't be for a day that hasn't come yet.")


def _check_target(
    session: Session, target: MetricTarget, *, ignore: MetricTarget | None = None
) -> None:
    """The target rules, checked before saving so the API gives a clear error."""
    if target.kind == "reach_by":
        if target.end_date is None:
            raise UnprocessableError("A reach-by target needs an end date: its deadline.")
        if target.period is not None:
            raise UnprocessableError("Only a per-period target has a period.")
    elif target.period is None:
        raise UnprocessableError("A per-period target needs a period: day, week or month.")
    if target.end_date is not None and target.end_date < target.start_date:
        raise UnprocessableError("The end date can't be before the start date.")

    others = session.scalars(
        select(MetricTarget).where(
            MetricTarget.metric_id == target.metric_id, MetricTarget.kind == target.kind
        )
    ).all()
    for other in others:
        if other is target or other is ignore:
            continue
        if _overlaps(target, other):
            raise ConflictError(
                f"Target {other.id} of the same kind already covers some of these dates. "
                "Change that one instead."
            )


def _overlaps(a: MetricTarget, b: MetricTarget) -> bool:
    a_end = a.end_date or date.max
    b_end = b.end_date or date.max
    return a.start_date <= b_end and b.start_date <= a_end


def _get_active(session: Session, metric_id: int) -> Metric:
    metric = get_metric(session, metric_id)
    if metric.archived_at is not None:
        raise ConflictError(f"Metric {metric_id} is archived. Restore it first.")
    return metric


def _get_entry(session: Session, entry_id: int) -> MetricEntry:
    entry = session.get(MetricEntry, entry_id)
    if entry is None:
        raise NotFoundError(f"Entry {entry_id} not found")
    return entry


def _get_target(session: Session, target_id: int) -> MetricTarget:
    target = session.get(MetricTarget, target_id)
    if target is None:
        raise NotFoundError(f"Target {target_id} not found")
    return target


def _save(session: Session, metric: Metric) -> Metric:
    session.commit()
    session.refresh(metric)
    return metric


def _save_entry(session: Session, entry: MetricEntry) -> MetricEntry:
    session.commit()
    session.refresh(entry)
    return entry
