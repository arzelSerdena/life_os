from typing import Any

from fastapi import APIRouter, status

from app.db import SessionDep
from app.schemas.common import ErrorResponse
from app.schemas.preview import ConfirmPreview
from app.schemas.task import TaskMove, TaskRead
from app.schemas.task_template import (
    TaskFromTemplate,
    TaskTemplateChange,
    TaskTemplateCreate,
    TaskTemplateRead,
    TaskTemplateUpdate,
)
from app.services import previews
from app.services import templates as service

router = APIRouter(prefix="/api/task-templates", tags=["task-templates"])

NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
CONFLICT: dict[int | str, dict[str, Any]] = {409: {"model": ErrorResponse}}


def _read(template: Any) -> TaskTemplateRead:
    return TaskTemplateRead.model_validate(template)


@router.get("")
def list_task_templates(
    session: SessionDep, include_archived: bool = False, repeating: bool | None = None
) -> list[TaskTemplateRead]:
    """All templates, or only recurring (repeating=true) or plain ones (repeating=false)."""
    return [
        _read(template)
        for template in service.list_templates(
            session, include_archived=include_archived, repeating=repeating
        )
    ]


@router.post("", status_code=status.HTTP_201_CREATED, responses=CONFLICT)
def create_task_template(session: SessionDep, data: TaskTemplateCreate) -> TaskTemplateRead:
    return _read(service.create_template(session, data))


@router.get("/{template_id}", responses=NOT_FOUND)
def get_task_template(session: SessionDep, template_id: int) -> TaskTemplateRead:
    return _read(service.get_template(session, template_id))


@router.patch("/{template_id}", responses=NOT_FOUND)
def update_task_template(
    session: SessionDep, template_id: int, data: TaskTemplateUpdate
) -> TaskTemplateRead:
    return _read(service.update_template(session, template_id, data))


@router.post("/{template_id}/move", responses={**NOT_FOUND, **CONFLICT})
def move_task_template(session: SessionDep, template_id: int, data: TaskMove) -> TaskTemplateChange:
    template, batch_id = service.move_template(session, template_id, data)
    return TaskTemplateChange(template=_read(template), batch_id=batch_id)


@router.post("/{template_id}/pause", responses=NOT_FOUND)
def pause_task_template(session: SessionDep, template_id: int) -> TaskTemplateRead:
    return _read(service.pause_template(session, template_id))


@router.post("/{template_id}/resume", responses=NOT_FOUND)
def resume_task_template(session: SessionDep, template_id: int) -> TaskTemplateRead:
    return _read(service.resume_template(session, template_id))


@router.post("/{template_id}/archive", responses=NOT_FOUND)
def archive_task_template(session: SessionDep, template_id: int) -> TaskTemplateRead:
    return _read(service.archive_template(session, template_id))


@router.post("/{template_id}/unarchive", responses={**NOT_FOUND, **CONFLICT})
def unarchive_task_template(session: SessionDep, template_id: int) -> TaskTemplateRead:
    return _read(service.unarchive_template(session, template_id))


@router.get("/{template_id}/delete-preview", responses=NOT_FOUND)
def preview_task_template_delete(session: SessionDep, template_id: int) -> ConfirmPreview:
    """What the delete removes and keeps, for its confirmation."""
    template = service.get_template(session, template_id)
    return ConfirmPreview(groups=previews.template_delete(session, template))


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
)
def delete_task_template(session: SessionDep, template_id: int) -> None:
    """Delete the template, its checklist and its open occurrences. Done and cancelled
    occurrences and tasks made by hand stay, without the link. This can't be undone."""
    service.delete_template(session, template_id)


@router.post(
    "/{template_id}/tasks",
    status_code=status.HTTP_201_CREATED,
    responses={**NOT_FOUND, **CONFLICT},
)
def create_task_from_template(
    session: SessionDep, template_id: int, data: TaskFromTemplate
) -> TaskRead:
    """A new task copied from the template, checklist included."""
    return TaskRead.model_validate(service.create_task_from_template(session, template_id, data))
