from datetime import date
from typing import Any

from fastapi import APIRouter, status

from app.db import SessionDep
from app.schemas.common import ErrorResponse
from app.schemas.task import (
    SubtaskCreate,
    SubtaskRead,
    SubtaskUpdate,
    TaskChange,
    TaskCreate,
    TaskMove,
    TaskRead,
    TaskReorder,
    TaskUpdate,
)
from app.schemas.task_template import SeriesCancel, SeriesCancelResult, SeriesEdit, TaskTemplateRead
from app.services import tasks as service
from app.services import templates

router = APIRouter(prefix="/api", tags=["tasks"])

NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
CONFLICT: dict[int | str, dict[str, Any]] = {409: {"model": ErrorResponse}}


def _change(change: service.TaskChange) -> TaskChange:
    return TaskChange(task=TaskRead.model_validate(change.task), batch_id=change.batch_id)


@router.get("/tasks")
def list_tasks(
    session: SessionDep,
    life_area_id: int | None = None,
    project_id: int | None = None,
    inbox: bool = False,
    scheduled_from: date | None = None,
    scheduled_to: date | None = None,
    unscheduled: bool = False,
    include_cancelled: bool = False,
    include_archived: bool = False,
) -> list[TaskRead]:
    filters = service.TaskFilters(
        life_area_id=life_area_id,
        project_id=project_id,
        inbox=inbox,
        scheduled_from=scheduled_from,
        scheduled_to=scheduled_to,
        unscheduled=unscheduled,
        include_cancelled=include_cancelled,
        include_archived=include_archived,
    )
    return [TaskRead.model_validate(task) for task in service.list_tasks(session, filters)]


@router.post("/tasks", status_code=status.HTTP_201_CREATED, responses=CONFLICT)
def create_task(session: SessionDep, data: TaskCreate) -> TaskRead:
    return TaskRead.model_validate(service.create_task(session, data))


@router.post("/tasks/reorder", responses=NOT_FOUND)
def reorder_tasks(session: SessionDep, data: TaskReorder) -> list[TaskRead]:
    """Set the order of a day's tasks, or of the unscheduled list. Returns the listed tasks."""
    return [TaskRead.model_validate(task) for task in service.reorder_tasks(session, data)]


@router.get("/tasks/{task_id}", responses=NOT_FOUND)
def get_task(session: SessionDep, task_id: int) -> TaskRead:
    return TaskRead.model_validate(service.get_task(session, task_id))


@router.patch("/tasks/{task_id}", responses=NOT_FOUND)
def update_task(session: SessionDep, task_id: int, data: TaskUpdate) -> TaskRead:
    return TaskRead.model_validate(service.update_task(session, task_id, data))


@router.post("/tasks/{task_id}/move", responses={**NOT_FOUND, **CONFLICT})
def move_task(session: SessionDep, task_id: int, data: TaskMove) -> TaskChange:
    return _change(service.move_task(session, task_id, data))


@router.post("/tasks/{task_id}/complete", responses={**NOT_FOUND, **CONFLICT})
def complete_task(session: SessionDep, task_id: int) -> TaskChange:
    return _change(service.complete_task(session, task_id))


@router.post("/tasks/{task_id}/cancel", responses={**NOT_FOUND, **CONFLICT})
def cancel_task(session: SessionDep, task_id: int) -> TaskChange:
    return _change(service.cancel_task(session, task_id))


@router.post("/tasks/{task_id}/reopen", responses={**NOT_FOUND, **CONFLICT})
def reopen_task(session: SessionDep, task_id: int) -> TaskChange:
    return _change(service.reopen_task(session, task_id))


@router.post("/tasks/{task_id}/archive", responses=NOT_FOUND)
def archive_task(session: SessionDep, task_id: int) -> TaskChange:
    return _change(service.archive_task(session, task_id))


@router.post("/tasks/{task_id}/unarchive", responses={**NOT_FOUND, **CONFLICT})
def unarchive_task(session: SessionDep, task_id: int) -> TaskChange:
    return _change(service.unarchive_task(session, task_id))


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
)
def delete_task(session: SessionDep, task_id: int) -> None:
    service.delete_task(session, task_id)


@router.post("/tasks/{task_id}/subtasks", status_code=status.HTTP_201_CREATED, responses=NOT_FOUND)
def create_subtask(session: SessionDep, task_id: int, data: SubtaskCreate) -> SubtaskRead:
    return SubtaskRead.model_validate(service.create_subtask(session, task_id, data))


@router.patch("/subtasks/{subtask_id}", responses=NOT_FOUND)
def update_subtask(session: SessionDep, subtask_id: int, data: SubtaskUpdate) -> SubtaskRead:
    return SubtaskRead.model_validate(service.update_subtask(session, subtask_id, data))


@router.delete(
    "/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND
)
def delete_subtask(session: SessionDep, subtask_id: int) -> None:
    service.delete_subtask(session, subtask_id)


@router.post("/tasks/{task_id}/series-edit", responses={**NOT_FOUND, **CONFLICT})
def edit_task_series(session: SessionDep, task_id: int, data: SeriesEdit) -> TaskTemplateRead:
    """Change a recurring task from this occurrence: this and following, or all.

    To change only this occurrence, edit the task itself."""
    return TaskTemplateRead.model_validate(templates.edit_series(session, task_id, data))


@router.post("/tasks/{task_id}/series-cancel", responses={**NOT_FOUND, **CONFLICT})
def cancel_task_series(session: SessionDep, task_id: int, data: SeriesCancel) -> SeriesCancelResult:
    """Cancel a recurring task from this occurrence: this and following, or all.

    To cancel only this occurrence, cancel the task itself."""
    template, batch_id = templates.cancel_series(session, task_id, data.scope)
    return SeriesCancelResult(template=TaskTemplateRead.model_validate(template), batch_id=batch_id)
