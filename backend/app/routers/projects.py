import datetime as dt
from typing import Any, Literal

from fastapi import APIRouter, status

from app import clock
from app.db import SessionDep
from app.models import Project
from app.schemas.area_page import ProjectPageRead
from app.schemas.common import ErrorResponse
from app.schemas.overview import DateRangeRead, OverviewPeriod
from app.schemas.preview import ConfirmPreview
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
from app.schemas.projects_overview import (
    NoNextStepRead,
    OverviewProjectRead,
    ProjectsBucketRead,
    ProjectsOverviewRead,
    ProjectTotalsRead,
    StalledProjectRead,
)
from app.services import area_page, cascades, previews
from app.services import projects as service
from app.services import projects_overview as overview_service

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
        start_date=project.start_date,
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
        has_items=service.has_items(session, project),
    )


@router.get("/projects")
def list_projects(
    session: SessionDep, life_area_id: int | None = None, include_archived: bool = False
) -> list[ProjectRead]:
    found = service.list_projects(
        session, life_area_id=life_area_id, include_archived=include_archived
    )
    return [_read(session, project) for project in found]


@router.get("/projects/overview")
def get_projects_overview(
    session: SessionDep, period: OverviewPeriod = "quarter", date: dt.date | None = None
) -> ProjectsOverviewRead:
    """Every project over the week, month, quarter or year containing `date` (default:
    today): execution stats from project tasks, the active projects and those finished in
    the period, and the ones due next, stalled or without a next step."""
    found = overview_service.get_overview(session, period, date or clock.today())

    def totals(found_totals: overview_service.Totals) -> ProjectTotalsRead:
        return ProjectTotalsRead(**vars(found_totals))

    return ProjectsOverviewRead(
        period=found.period,  # type: ignore[arg-type]
        range=DateRangeRead(start=found.view.start, end=found.view.end),
        previous_range=DateRangeRead(start=found.previous_view.start, end=found.previous_view.end),
        today=found.today,
        has_projects=found.has_projects,
        totals=totals(found.totals),
        previous=totals(found.previous),
        open=found.open,
        open_projects=found.open_projects,
        overdue=found.overdue,
        overdue_projects=found.overdue_projects,
        buckets=[
            ProjectsBucketRead(
                start=bucket.start,
                end=bucket.end,
                totals=totals(bucket.totals),
                open=bucket.open,
                overdue=bucket.overdue,
            )
            for bucket in found.buckets
        ],
        projects=[
            OverviewProjectRead(
                id=row.project.id,
                life_area_id=row.project.life_area_id,
                title=row.project.title,
                status=row.project.status,  # type: ignore[arg-type]
                start=row.start,
                due_date=row.project.due_date,
                completed_on=row.completed_on,
                done=row.done,
                total=row.total,
                open=row.open,
                overdue=row.overdue,
                pace_status=row.pace_status,  # type: ignore[arg-type]
            )
            for row in found.projects
        ],
        due_next=[row.project.id for row in found.due_next],
        stalled=[
            StalledProjectRead(project_id=item.project.id, days=item.days) for item in found.stalled
        ],
        no_next_step=[
            NoNextStepRead(project_id=item.project.id, open=item.open)
            for item in found.no_next_step
        ],
    )


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


@router.get("/projects/{project_id}/page", responses=NOT_FOUND)
def get_project_page(
    session: SessionDep,
    project_id: int,
    period: OverviewPeriod = "quarter",
    date: dt.date | None = None,
) -> ProjectPageRead:
    """One project over the week, month, quarter or year containing `date` (default:
    today): its metrics, timeline, routine steps, task lists, agenda and pace."""
    page = area_page.get_project_page(session, project_id, period, date or clock.today())
    assert page.project is not None
    return ProjectPageRead.from_page(  # type: ignore[return-value]
        page,
        project=_read(session, page.project),
        pace=page.pace,
        pace_status=page.pace_status,
    )


@router.get("/projects/{project_id}/preview", responses=NOT_FOUND)
def preview_project_change(
    session: SessionDep, project_id: int, action: Literal["complete", "cancel", "archive"]
) -> ConfirmPreview:
    """What completing, cancelling or archiving the project would do to its items."""
    plan = cascades.plan_project(session, project_id, action)
    return ConfirmPreview(groups=previews.cascade(session, plan))


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
