from typing import Any, Literal

from fastapi import APIRouter, status

from app.db import SessionDep
from app.models import Project
from app.schemas.cascade import CascadePreview
from app.schemas.common import ErrorResponse
from app.schemas.project import (
    ProjectChange,
    ProjectCreate,
    ProjectMove,
    ProjectProgress,
    ProjectRead,
    ProjectUpdate,
    SectionCreate,
    SectionRead,
    SectionUpdate,
)
from app.services import cascades
from app.services import projects as service

router = APIRouter(prefix="/api", tags=["projects"])

NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
CONFLICT: dict[int | str, dict[str, Any]] = {409: {"model": ErrorResponse}}


def _read(session: SessionDep, project: Project) -> ProjectRead:
    progress = service.progress_of(session, project)
    return ProjectRead(
        id=project.id,
        life_area_id=project.life_area_id,
        title=project.title,
        notes=project.notes,
        due_date=project.due_date,
        status=project.status,  # type: ignore[arg-type]
        completed_at=project.completed_at,
        cancelled_at=project.cancelled_at,
        archived_at=project.archived_at,
        sort_order=project.sort_order,
        created_at=project.created_at,
        updated_at=project.updated_at,
        sections=[SectionRead.model_validate(s) for s in service.sections_of(session, project)],
        progress=ProjectProgress(done=progress.done, total=progress.total),
    )


@router.get("/projects")
def list_projects(
    session: SessionDep, life_area_id: int | None = None, include_archived: bool = False
) -> list[ProjectRead]:
    found = service.list_projects(
        session, life_area_id=life_area_id, include_archived=include_archived
    )
    return [_read(session, project) for project in found]


@router.post("/projects", status_code=status.HTTP_201_CREATED, responses=CONFLICT)
def create_project(session: SessionDep, data: ProjectCreate) -> ProjectRead:
    return _read(session, service.create_project(session, data))


@router.get("/projects/{project_id}", responses=NOT_FOUND)
def get_project(session: SessionDep, project_id: int) -> ProjectRead:
    return _read(session, service.get_project(session, project_id))


@router.patch("/projects/{project_id}", responses=NOT_FOUND)
def update_project(session: SessionDep, project_id: int, data: ProjectUpdate) -> ProjectRead:
    return _read(session, service.update_project(session, project_id, data))


@router.post("/projects/{project_id}/move", responses={**NOT_FOUND, **CONFLICT})
def move_project(session: SessionDep, project_id: int, data: ProjectMove) -> ProjectChange:
    """Move the project, and everything in it, to another life area. Undoable."""
    project, batch_id = service.move_project(session, project_id, data)
    return ProjectChange(project=_read(session, project), batch_id=batch_id)


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
)
def delete_project(session: SessionDep, project_id: int) -> None:
    """Delete an empty project and its sections. Refused while anything belongs to it."""
    service.delete_project(session, project_id)


@router.post(
    "/projects/{project_id}/sections",
    status_code=status.HTTP_201_CREATED,
    responses={**NOT_FOUND, **CONFLICT},
)
def create_section(session: SessionDep, project_id: int, data: SectionCreate) -> SectionRead:
    return SectionRead.model_validate(service.create_section(session, project_id, data))


@router.patch("/sections/{section_id}", responses=NOT_FOUND)
def update_section(session: SessionDep, section_id: int, data: SectionUpdate) -> SectionRead:
    return SectionRead.model_validate(service.update_section(session, section_id, data))


@router.delete(
    "/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND
)
def delete_section(session: SessionDep, section_id: int) -> None:
    """Delete a section. Its tasks and templates stay in the project, unsectioned."""
    service.delete_section(session, section_id)


# ---------- Status and archiving (cascades) ----------


@router.get("/projects/{project_id}/preview", responses=NOT_FOUND)
def preview_project_change(
    session: SessionDep, project_id: int, action: Literal["complete", "cancel", "archive"]
) -> CascadePreview:
    """What completing, cancelling or archiving the project would do to its items."""
    return CascadePreview.from_plan(cascades.plan_project(session, project_id, action))


def _change(session: SessionDep, result: cascades.CascadeResult) -> ProjectChange:
    return ProjectChange(project=_read(session, result.item), batch_id=result.batch_id)  # type: ignore[arg-type]


@router.post("/projects/{project_id}/complete", responses={**NOT_FOUND, **CONFLICT})
def complete_project(session: SessionDep, project_id: int) -> ProjectChange:
    """Done: cancels open tasks and upcoming events, ends repeating events from today, and
    archives templates, routine steps and metrics. One change, undoable."""
    return _change(session, cascades.finish_project(session, project_id, "done"))


@router.post("/projects/{project_id}/cancel", responses={**NOT_FOUND, **CONFLICT})
def cancel_project(session: SessionDep, project_id: int) -> ProjectChange:
    """Cancelled, with the same effects on the project's items as completing it."""
    return _change(session, cascades.finish_project(session, project_id, "cancelled"))


@router.post("/projects/{project_id}/reopen", responses={**NOT_FOUND, **CONFLICT})
def reopen_project(session: SessionDep, project_id: int) -> ProjectChange:
    return _change(session, cascades.reopen_project(session, project_id))


@router.post("/projects/{project_id}/archive", responses=NOT_FOUND)
def archive_project(session: SessionDep, project_id: int) -> ProjectChange:
    """Archive the project and everything in it."""
    return _change(session, cascades.archive_project(session, project_id))


@router.post("/projects/{project_id}/unarchive", responses={**NOT_FOUND, **CONFLICT})
def unarchive_project(session: SessionDep, project_id: int) -> ProjectChange:
    """Restore the project and the items its last archive took with it."""
    return _change(session, cascades.restore_project(session, project_id))
