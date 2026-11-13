"""Routines: steps due on the days a schedule says, checked off day by day."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import clock, rrules
from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import Routine, RoutineLog, RoutinePause, RoutineSchedule, RoutineStep
from app.models.base import utc_now
from app.schemas.routine import (
    RoutineCreate,
    RoutineStepCreate,
    RoutineStepMove,
    RoutineStepUpdate,
    RoutineUpdate,
    ScheduleChange,
)
from app.services.history import ChangeRecorder
from app.services.ownership import ensure_owner_open, resolve_owner


@dataclass(frozen=True)
class StepDay:
    step: RoutineStep
    routine: Routine
    day: date
    status: str


@dataclass(frozen=True)
class Streaks:
    current: int
    best: int


# ---------- Which days are due ----------


def due_days(routine: Routine, step: RoutineStep, first: date, last: date) -> list[date]:
    """The days from first to last when the step is due.

    Each schedule row applies from its starts_on until the next row starts. Nothing is
    due before the step's own start date, or on a day the routine or step was paused.
    """
    first = max(first, step.starts_on)
    rows = routine.schedules
    days: list[date] = []
    for index, row in enumerate(rows):
        row_last = last
        if index + 1 < len(rows):
            row_last = min(last, rows[index + 1].starts_on - timedelta(days=1))
        row_first = max(first, row.starts_on)
        if row_first <= row_last:
            days.extend(rrules.dates_between(row.rrule, row.starts_on, None, row_first, row_last))
    pauses = [*routine.pauses, *step.pauses]
    return [day for day in days if not any(pause.covers(day) for pause in pauses)]


def is_due(routine: Routine, step: RoutineStep, day: date) -> bool:
    return due_days(routine, step, day, day) == [day]


def day_status(step: RoutineStep, day: date) -> str:
    """done or skipped from the log; otherwise to-do, or missed once the day is over."""
    log = next((log for log in step.logs if log.date == day), None)
    if log is not None:
        return log.status
    return "missed" if day < clock.today() else "todo"


def streaks(routine: Routine, step: RoutineStep) -> Streaks:
    """Done due days in a row. A missed day resets the count; skipped days and today
    (still to do) neither count nor break it."""
    today = clock.today()
    statuses = {log.date: log.status for log in step.logs}
    run = best = 0
    for day in due_days(routine, step, step.starts_on, today):
        status = statuses.get(day) or ("missed" if day < today else "todo")
        if status == "done":
            run += 1
            best = max(best, run)
        elif status == "missed":
            run = 0
    return Streaks(current=run, best=best)


def is_paused(item: Routine | RoutineStep) -> bool:
    return any(pause.ends_on is None for pause in item.pauses)


def steps_for_day(
    session: Session,
    day: date,
    *,
    life_area_id: int | None = None,
    project_id: int | None = None,
) -> list[StepDay]:
    """Every active step due on `day`, in routine then step order."""
    routines = session.scalars(
        select(Routine)
        .options(
            selectinload(Routine.schedules),
            selectinload(Routine.pauses),
            selectinload(Routine.steps).selectinload(RoutineStep.pauses),
            selectinload(Routine.steps).selectinload(RoutineStep.logs),
        )
        .where(Routine.archived_at.is_(None))
        .order_by(Routine.sort_order, Routine.id)
    ).all()
    found = []
    for routine in routines:
        for step in routine.steps:
            if step.archived_at is not None:
                continue
            if life_area_id is not None and step.life_area_id != life_area_id:
                continue
            if project_id is not None and step.project_id != project_id:
                continue
            if is_due(routine, step, day):
                found.append(StepDay(step, routine, day, day_status(step, day)))
    return found


# ---------- Routines ----------


def list_routines(session: Session, *, include_archived: bool = False) -> Sequence[Routine]:
    query = select(Routine)
    if not include_archived:
        query = query.where(Routine.archived_at.is_(None))
    return session.scalars(query.order_by(Routine.sort_order, Routine.id)).all()


def get_routine(session: Session, routine_id: int) -> Routine:
    routine = session.get(Routine, routine_id)
    if routine is None:
        raise NotFoundError(f"Routine {routine_id} not found")
    return routine


def create_routine(session: Session, data: RoutineCreate) -> Routine:
    last_position = session.scalar(select(Routine.sort_order).order_by(Routine.sort_order.desc()))
    routine = Routine(
        title=data.title,
        notes=data.notes,
        sort_order=0 if last_position is None else last_position + 1,
        schedules=[RoutineSchedule(rrule=data.rrule, starts_on=data.starts_on or clock.today())],
    )
    session.add(routine)
    return _save(session, routine)


def update_routine(session: Session, routine_id: int, data: RoutineUpdate) -> Routine:
    routine = get_routine(session, routine_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(routine, field, value)
    return _save(session, routine)


def change_schedule(session: Session, routine_id: int, data: ScheduleChange) -> Routine:
    """Change which days are due, keeping the past ("following") or not ("all")."""
    routine = get_routine(session, routine_id)
    first_start = routine.schedules[0].starts_on
    if data.scope == "all":
        _replace_schedules(session, routine, [], data.rrule, data.starts_on or first_start)
        return _save(session, routine)

    day = data.starts_on or clock.today()
    kept = [] if day <= first_start else [row for row in routine.schedules if row.starts_on < day]
    _replace_schedules(session, routine, kept, data.rrule, day)
    return _save(session, routine)


def pause_routine(session: Session, routine_id: int) -> Routine:
    """Pause from today: no step is due until it resumes. Pausing twice changes nothing."""
    routine = _get_active_routine(session, routine_id)
    if not is_paused(routine):
        routine.pauses.append(RoutinePause(starts_on=clock.today()))
    return _save(session, routine)


def resume_routine(session: Session, routine_id: int) -> Routine:
    """Resume from today, along with every step, including steps paused on their own."""
    routine = _get_active_routine(session, routine_id)
    today = clock.today()
    for pause in [*routine.pauses, *(p for step in routine.steps for p in step.pauses)]:
        if pause.ends_on is None:
            pause.ends_on = max(today, pause.starts_on)
    return _save(session, routine)


def skip_day(session: Session, routine_id: int, day: date) -> list[StepDay]:
    """Skip the whole routine on one day: every due step not already checked is skipped."""
    routine = _get_active_routine(session, routine_id)
    for step in routine.steps:
        already_checked = any(log.date == day for log in step.logs)
        if step.archived_at is None and not already_checked and is_due(routine, step, day):
            step.logs.append(RoutineLog(date=day, status="skipped"))
    session.commit()
    return [
        StepDay(step, routine, day, day_status(step, day))
        for step in routine.steps
        if step.archived_at is None and is_due(routine, step, day)
    ]


def archive_routine(session: Session, routine_id: int) -> tuple[Routine, str | None]:
    routine = get_routine(session, routine_id)
    history = ChangeRecorder(session)
    if routine.archived_at is None:
        history.set(routine, "archived_at", utc_now())
    return _save(session, routine), history.batch_id


def unarchive_routine(session: Session, routine_id: int) -> tuple[Routine, str | None]:
    routine = get_routine(session, routine_id)
    history = ChangeRecorder(session)
    history.set(routine, "archived_at", None)
    return _save(session, routine), history.batch_id


def delete_routine(session: Session, routine_id: int) -> None:
    session.delete(get_routine(session, routine_id))
    session.commit()


# ---------- Steps ----------


def get_step(session: Session, step_id: int) -> RoutineStep:
    step = session.get(RoutineStep, step_id)
    if step is None:
        raise NotFoundError(f"Routine step {step_id} not found")
    return step


def create_step(session: Session, routine_id: int, data: RoutineStepCreate) -> RoutineStep:
    routine = _get_active_routine(session, routine_id)
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=None,
        allow_inbox=False,
    )
    assert owner.life_area_id is not None
    step = RoutineStep(
        title=data.title,
        notes=data.notes,
        life_area_id=owner.life_area_id,
        project_id=owner.project_id,
        starts_on=data.starts_on or clock.today(),
        sort_order=len(routine.steps),
    )
    routine.steps.append(step)
    session.commit()
    session.refresh(step)
    return step


def update_step(session: Session, step_id: int, data: RoutineStepUpdate) -> RoutineStep:
    step = get_step(session, step_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(step, field, value)
    return _save_step(session, step)


def move_step(session: Session, step_id: int, data: RoutineStepMove) -> RoutineStep:
    step = get_step(session, step_id)
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=None,
        allow_inbox=False,
    )
    assert owner.life_area_id is not None
    step.life_area_id = owner.life_area_id
    step.project_id = owner.project_id
    return _save_step(session, step)


def pause_step(session: Session, step_id: int) -> RoutineStep:
    step = _get_active_step(session, step_id)
    if not is_paused(step):
        step.pauses.append(RoutinePause(starts_on=clock.today()))
    return _save_step(session, step)


def resume_step(session: Session, step_id: int) -> RoutineStep:
    """Resume the step. While its routine is paused, the step still isn't due."""
    step = _get_active_step(session, step_id)
    for pause in step.pauses:
        if pause.ends_on is None:
            pause.ends_on = max(clock.today(), pause.starts_on)
    return _save_step(session, step)


def archive_step(session: Session, step_id: int) -> tuple[RoutineStep, str | None]:
    step = get_step(session, step_id)
    history = ChangeRecorder(session)
    if step.archived_at is None:
        history.set(step, "archived_at", utc_now())
    return _save_step(session, step), history.batch_id


def unarchive_step(session: Session, step_id: int) -> tuple[RoutineStep, str | None]:
    step = get_step(session, step_id)
    history = ChangeRecorder(session)
    if step.archived_at is not None:
        ensure_owner_open(session, step.life_area_id, step.project_id)
        history.set(step, "archived_at", None)
    return _save_step(session, step), history.batch_id


def delete_step(session: Session, step_id: int) -> None:
    session.delete(get_step(session, step_id))
    session.commit()


def set_log(session: Session, step_id: int, day: date, status: str) -> StepDay:
    """Mark the step done or skipped on a due day. Done can't be in the future."""
    step = _get_active_step(session, step_id)
    routine = get_routine(session, step.routine_id)
    if not is_due(routine, step, day):
        raise UnprocessableError(f"Routine step {step_id} isn't due on {day}.")
    if status == "done" and day > clock.today():
        raise UnprocessableError("A step can't be done on a day that hasn't come yet.")
    log = next((log for log in step.logs if log.date == day), None)
    if log is None:
        step.logs.append(RoutineLog(date=day, status=status))
    else:
        log.status = status
    session.commit()
    return StepDay(step, routine, day, day_status(step, day))


def clear_log(session: Session, step_id: int, day: date) -> StepDay:
    """Back to to-do (or missed, for a day that's over)."""
    step = get_step(session, step_id)
    log = next((log for log in step.logs if log.date == day), None)
    if log is None:
        raise NotFoundError(f"Routine step {step_id} has nothing checked on {day}.")
    step.logs.remove(log)
    session.commit()
    return StepDay(step, get_routine(session, step.routine_id), day, day_status(step, day))


# ---------- Helpers ----------


def _replace_schedules(
    session: Session, routine: Routine, kept: list[RoutineSchedule], rule: str, starts_on: date
) -> None:
    """Keep `kept` and add the new rule from starts_on.

    Removed rows are deleted before the new one is added, since a new row may reuse a
    removed row's start date and the start dates are unique per routine.
    """
    for row in [row for row in routine.schedules if row not in kept]:
        routine.schedules.remove(row)
    session.flush()
    routine.schedules.append(RoutineSchedule(rrule=rule, starts_on=starts_on))


def _get_active_routine(session: Session, routine_id: int) -> Routine:
    routine = get_routine(session, routine_id)
    if routine.archived_at is not None:
        raise ConflictError(f"Routine {routine_id} is archived. Restore it first.")
    return routine


def _get_active_step(session: Session, step_id: int) -> RoutineStep:
    step = get_step(session, step_id)
    if step.archived_at is not None:
        raise ConflictError(f"Routine step {step_id} is archived. Restore it first.")
    _get_active_routine(session, step.routine_id)
    return step


def _save(session: Session, routine: Routine) -> Routine:
    session.commit()
    session.refresh(routine)
    return routine


def _save_step(session: Session, step: RoutineStep) -> RoutineStep:
    session.commit()
    session.refresh(step)
    return step
