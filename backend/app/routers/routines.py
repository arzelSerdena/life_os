from datetime import date
from typing import Any

from fastapi import APIRouter, status

from app import clock
from app.db import SessionDep
from app.models import Routine, RoutineStep
from app.schemas.common import ErrorResponse
from app.schemas.routine import (
    RoutineChange,
    RoutineCreate,
    RoutineLogSet,
    RoutineRead,
    RoutineStepChange,
    RoutineStepCreate,
    RoutineStepDay,
    RoutineStepMove,
    RoutineStepRead,
    RoutineStepUpdate,
    RoutineUpdate,
    ScheduleChange,
    ScheduleRead,
)
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


@router.post("/routines", status_code=status.HTTP_201_CREATED)
def create_routine(session: SessionDep, data: RoutineCreate) -> RoutineRead:
    return _read(service.create_routine(session, data))


@router.get("/routines/{routine_id}", responses=NOT_FOUND)
def get_routine(session: SessionDep, routine_id: int) -> RoutineRead:
    return _read(service.get_routine(session, routine_id))


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
def skip_routine_day(session: SessionDep, routine_id: int, day: date) -> list[RoutineStepDay]:
    """Skip the whole routine on one day. Steps already checked keep their state."""
    return [
        RoutineStepDay.from_step_day(item) for item in service.skip_day(session, routine_id, day)
    ]


@router.post("/routines/{routine_id}/archive", responses=NOT_FOUND)
def archive_routine(session: SessionDep, routine_id: int) -> RoutineChange:
    routine, batch_id = service.archive_routine(session, routine_id)
    return RoutineChange(routine=_read(routine), batch_id=batch_id)


@router.post("/routines/{routine_id}/unarchive", responses=NOT_FOUND)
def unarchive_routine(session: SessionDep, routine_id: int) -> RoutineChange:
    routine, batch_id = service.unarchive_routine(session, routine_id)
    return RoutineChange(routine=_read(routine), batch_id=batch_id)


@router.delete(
    "/routines/{routine_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND
)
def delete_routine(session: SessionDep, routine_id: int) -> None:
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
def move_routine_step(session: SessionDep, step_id: int, data: RoutineStepMove) -> RoutineStepRead:
    return _step(session, service.move_step(session, step_id, data))


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


@router.delete(
    "/routine-steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND
)
def delete_routine_step(session: SessionDep, step_id: int) -> None:
    service.delete_step(session, step_id)


@router.put("/routine-steps/{step_id}/days/{day}", responses={**NOT_FOUND, **CONFLICT})
def set_routine_step_day(
    session: SessionDep, step_id: int, day: date, data: RoutineLogSet
) -> RoutineStepDay:
    """Mark the step done or skipped on a due day."""
    return RoutineStepDay.from_step_day(service.set_log(session, step_id, day, data.status))


@router.delete("/routine-steps/{step_id}/days/{day}", responses=NOT_FOUND)
def clear_routine_step_day(session: SessionDep, step_id: int, day: date) -> RoutineStepDay:
    """Uncheck the step: back to to-do, or missed for a day that's over."""
    return RoutineStepDay.from_step_day(service.clear_log(session, step_id, day))
