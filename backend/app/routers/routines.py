from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Query, status

from app import clock
from app.db import SessionDep
from app.models import Routine, RoutineStep
from app.schemas.common import ErrorResponse
from app.schemas.overview import OverviewPeriod
from app.schemas.preview import RoutineDeletePreview
from app.schemas.routine import (
    MetricRef,
    PauseRead,
    RoutineBucketRead,
    RoutineChange,
    RoutineCreate,
    RoutineDayChange,
    RoutineHistoryRead,
    RoutineLogSet,
    RoutinePageRead,
    RoutinePageStepRead,
    RoutineRead,
    RoutinesHistoryRead,
    RoutineStepChange,
    RoutineStepCreate,
    RoutineStepDay,
    RoutineStepDayChange,
    RoutineStepMove,
    RoutineStepRead,
    RoutineStepUpdate,
    RoutineTotalsRead,
    RoutineUpdate,
    RunRead,
    ScheduleChange,
    ScheduleRead,
    StepDayState,
    StepHistoryRead,
)
from app.services import previews
from app.services import routine_page as page_service
from app.services import routines as service

router = APIRouter(prefix="/api", tags=["routines"])

NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
CONFLICT: dict[int | str, dict[str, Any]] = {409: {"model": ErrorResponse}}


def _step_read(routine: Routine, step: RoutineStep) -> RoutineStepRead:
    streaks = service.streaks(routine, step)
    return RoutineStepRead(
        id=step.id,
        routine_id=step.routine_id,
        life_area_id=step.life_area_id,
        project_id=step.project_id,
        title=step.title,
        notes=step.notes,
        starts_on=step.starts_on,
        sort_order=step.sort_order,
        is_paused=service.is_paused(step),
        current_streak=streaks.current,
        best_streak=streaks.best,
        archived_at=step.archived_at,
        created_at=step.created_at,
        updated_at=step.updated_at,
    )


def _read(routine: Routine) -> RoutineRead:
    return RoutineRead(
        id=routine.id,
        title=routine.title,
        notes=routine.notes,
        sort_order=routine.sort_order,
        is_paused=service.is_paused(routine),
        archived_at=routine.archived_at,
        created_at=routine.created_at,
        updated_at=routine.updated_at,
        schedules=[ScheduleRead.model_validate(row) for row in routine.schedules],
        steps=[_step_read(routine, step) for step in routine.steps],
    )


def _step(session: SessionDep, step: RoutineStep) -> RoutineStepRead:
    return _step_read(service.get_routine(session, step.routine_id), step)


# ---------- Routines ----------


@router.get("/routines")
def list_routines(session: SessionDep, include_archived: bool = False) -> list[RoutineRead]:
    """Routines with their schedule history and steps (archived steps included, marked)."""
    return [_read(r) for r in service.list_routines(session, include_archived=include_archived)]


@router.get("/routines/day")
def list_routine_steps_for_day(
    session: SessionDep,
    day: date | None = None,
    life_area_id: int | None = None,
    project_id: int | None = None,
) -> list[RoutineStepDay]:
    """Every step due on `day` (default: today) and whether it is to-do, done, skipped or
    missed."""
    found = service.steps_for_day(
        session, day or clock.today(), life_area_id=life_area_id, project_id=project_id
    )
    return [RoutineStepDay.from_step_day(item) for item in found]


@router.get("/routines/history")
def get_routines_history(
    session: SessionDep,
    end: date | None = None,
    count: Annotated[int, Query(ge=1, le=371)] = 7,
) -> RoutinesHistoryRead:
    """Every active routine and its active steps, with each step's state on each of the
    `count` days up to `end` (default: the last 7 days, today included)."""
    last = end or clock.today()
    first = last - timedelta(days=count - 1)
    return RoutinesHistoryRead(
        start=first,
        end=last,
        today=clock.today(),
        routines=[
            RoutineHistoryRead(
                id=found.routine.id,
                title=found.routine.title,
                rrule=found.rrule,
                paused_since=found.paused_since,
                steps=[
                    StepHistoryRead(
                        id=item.step.id,
                        title=item.step.title,
                        life_area_id=item.step.life_area_id,
                        project_id=item.step.project_id,
                        next_due=item.next_due,
                        paused_since=item.paused_since,
                        days=[StepDayState(day=day, state=state) for day, state in item.days],
                    )
                    for item in found.steps
                ],
            )
            for found in service.history(session, first, last)
        ],
    )


@router.post("/routines", status_code=status.HTTP_201_CREATED)
def create_routine(session: SessionDep, data: RoutineCreate) -> RoutineRead:
    return _read(service.create_routine(session, data))


@router.get("/routines/{routine_id}", responses=NOT_FOUND)
def get_routine(session: SessionDep, routine_id: int) -> RoutineRead:
    return _read(service.get_routine(session, routine_id))


@router.get("/routines/{routine_id}/page", responses=NOT_FOUND)
def get_routine_page(
    session: SessionDep,
    routine_id: int,
    period: OverviewPeriod = "quarter",
    date: date | None = None,
) -> RoutinePageRead:
    """One routine over the week, month, quarter or year containing `date` (default: today):
    totals and runs, each step's state per day, and the schedules and pauses."""
    page = page_service.get_routine_page(session, routine_id, period, date or clock.today())
    routine = page.routine
    return RoutinePageRead(
        routine=_read(routine),
        rrule=page.rrule,
        paused_since=page.paused_since,
        pauses=[PauseRead.model_validate(pause) for pause in routine.pauses],
        period=page.period,
        start=page.view.start,
        end=page.view.end,
        today=page.today,
        totals=_totals(page.totals),
        previous=_totals(page.previous) if page.previous else None,
        current_run=RunRead(**vars(page.current_run)),
        best_run=RunRead(**vars(page.best_run)),
        buckets=[
            RoutineBucketRead(
                start=bucket.start, end=bucket.end, totals=_totals(bucket.totals), run=bucket.run
            )
            for bucket in page.buckets
        ],
        steps=[
            RoutinePageStepRead(
                step=_step_read(routine, row.step),
                metric=MetricRef.model_validate(row.metric) if row.metric else None,
                next_due=row.next_due,
                paused_since=row.paused_since,
                days=[StepDayState(day=day, state=state) for day, state in row.days],
                done=row.done,
                missed=row.missed,
            )
            for row in page.steps
        ],
    )


def _totals(totals: page_service.Totals) -> RoutineTotalsRead:
    return RoutineTotalsRead(
        done=totals.done,
        missed=totals.missed,
        skipped=totals.skipped,
        due_days=totals.due_days,
        full_days=totals.full_days,
        completion_rate=totals.completion_rate,
    )


@router.patch("/routines/{routine_id}", responses=NOT_FOUND)
def update_routine(session: SessionDep, routine_id: int, data: RoutineUpdate) -> RoutineRead:
    return _read(service.update_routine(session, routine_id, data))


@router.post("/routines/{routine_id}/schedule", responses=NOT_FOUND)
def change_routine_schedule(
    session: SessionDep, routine_id: int, data: ScheduleChange
) -> RoutineRead:
    return _read(service.change_schedule(session, routine_id, data))


@router.post("/routines/{routine_id}/pause", responses={**NOT_FOUND, **CONFLICT})
def pause_routine(session: SessionDep, routine_id: int) -> RoutineRead:
    return _read(service.pause_routine(session, routine_id))


@router.post("/routines/{routine_id}/resume", responses={**NOT_FOUND, **CONFLICT})
def resume_routine(session: SessionDep, routine_id: int) -> RoutineRead:
    return _read(service.resume_routine(session, routine_id))


@router.post("/routines/{routine_id}/days/{day}/skip", responses={**NOT_FOUND, **CONFLICT})
def skip_routine_day(session: SessionDep, routine_id: int, day: date) -> RoutineDayChange:
    """Skip the whole routine on one day, recorded for undo. Steps already checked keep their
    state."""
    found, batch_id = service.skip_day(session, routine_id, day)
    return RoutineDayChange(
        steps=[RoutineStepDay.from_step_day(item) for item in found], batch_id=batch_id
    )


@router.post("/routines/{routine_id}/archive", responses=NOT_FOUND)
def archive_routine(session: SessionDep, routine_id: int) -> RoutineChange:
    routine, batch_id = service.archive_routine(session, routine_id)
    return RoutineChange(routine=_read(routine), batch_id=batch_id)


@router.post("/routines/{routine_id}/unarchive", responses=NOT_FOUND)
def unarchive_routine(session: SessionDep, routine_id: int) -> RoutineChange:
    routine, batch_id = service.unarchive_routine(session, routine_id)
    return RoutineChange(routine=_read(routine), batch_id=batch_id)


@router.get("/routines/{routine_id}/delete-preview", responses=NOT_FOUND)
def preview_routine_delete(session: SessionDep, routine_id: int) -> RoutineDeletePreview:
    """What the delete removes, for its confirmation, and the metrics that block it."""
    return previews.routine_delete(session, service.get_routine(session, routine_id))


@router.delete(
    "/routines/{routine_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
)
def delete_routine(session: SessionDep, routine_id: int) -> None:
    """Delete the routine with its schedules, pauses, steps and logs. Refused while one of
    its steps feeds a metric. This can't be undone."""
    service.delete_routine(session, routine_id)


# ---------- Steps ----------


@router.post(
    "/routines/{routine_id}/steps",
    status_code=status.HTTP_201_CREATED,
    responses={**NOT_FOUND, **CONFLICT},
)
def create_routine_step(
    session: SessionDep, routine_id: int, data: RoutineStepCreate
) -> RoutineStepRead:
    return _step(session, service.create_step(session, routine_id, data))


@router.patch("/routine-steps/{step_id}", responses=NOT_FOUND)
def update_routine_step(
    session: SessionDep, step_id: int, data: RoutineStepUpdate
) -> RoutineStepRead:
    return _step(session, service.update_step(session, step_id, data))


@router.post("/routine-steps/{step_id}/move", responses={**NOT_FOUND, **CONFLICT})
def move_routine_step(
    session: SessionDep, step_id: int, data: RoutineStepMove
) -> RoutineStepChange:
    step, batch_id = service.move_step(session, step_id, data)
    return RoutineStepChange(step=_step(session, step), batch_id=batch_id)


@router.post("/routine-steps/{step_id}/pause", responses={**NOT_FOUND, **CONFLICT})
def pause_routine_step(session: SessionDep, step_id: int) -> RoutineStepRead:
    return _step(session, service.pause_step(session, step_id))


@router.post("/routine-steps/{step_id}/resume", responses={**NOT_FOUND, **CONFLICT})
def resume_routine_step(session: SessionDep, step_id: int) -> RoutineStepRead:
    return _step(session, service.resume_step(session, step_id))


@router.post("/routine-steps/{step_id}/archive", responses=NOT_FOUND)
def archive_routine_step(session: SessionDep, step_id: int) -> RoutineStepChange:
    step, batch_id = service.archive_step(session, step_id)
    return RoutineStepChange(step=_step(session, step), batch_id=batch_id)


@router.post("/routine-steps/{step_id}/unarchive", responses={**NOT_FOUND, **CONFLICT})
def unarchive_routine_step(session: SessionDep, step_id: int) -> RoutineStepChange:
    step, batch_id = service.unarchive_step(session, step_id)
    return RoutineStepChange(step=_step(session, step), batch_id=batch_id)


@router.get("/routine-steps/{step_id}/delete-preview", responses=NOT_FOUND)
def preview_routine_step_delete(session: SessionDep, step_id: int) -> RoutineDeletePreview:
    """What the delete removes, for its confirmation, and the metrics that block it."""
    return previews.step_delete(session, service.get_step(session, step_id))


@router.delete(
    "/routine-steps/{step_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
)
def delete_routine_step(session: SessionDep, step_id: int) -> None:
    """Delete the step with its logs and pauses. Refused while it feeds a metric. This
    can't be undone."""
    service.delete_step(session, step_id)


@router.put("/routine-steps/{step_id}/days/{day}", responses={**NOT_FOUND, **CONFLICT})
def set_routine_step_day(
    session: SessionDep, step_id: int, day: date, data: RoutineLogSet
) -> RoutineStepDayChange:
    """Mark the step done or skipped on a due day, recorded for undo."""
    found, batch_id = service.set_log(session, step_id, day, data.status)
    return RoutineStepDayChange(step_day=RoutineStepDay.from_step_day(found), batch_id=batch_id)


@router.delete("/routine-steps/{step_id}/days/{day}", responses=NOT_FOUND)
def clear_routine_step_day(session: SessionDep, step_id: int, day: date) -> RoutineStepDay:
    """Uncheck the step: back to to-do, or missed for a day that's over."""
    return RoutineStepDay.from_step_day(service.clear_log(session, step_id, day))
