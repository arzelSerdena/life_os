"""Projects and their sections. Status changes and archiving come with the cascade engine,
because they change the project's tasks and events too."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import case, delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import LifeArea, Project, ProjectSection, Task, TaskTemplate
from app.schemas.project import (
    ProjectCreate,
    ProjectMove,
    ProjectUpdate,
    SectionCreate,
    SectionUpdate,
)
from app.services.history import ChangeRecorder
from app.services.ownership import ensure_owner_open


@dataclass(frozen=True)
class Progress:
    done: int
    total: int


# ---------- Projects ----------


def list_projects(
    session: Session, *, life_area_id: int | None = None, include_archived: bool = False
) -> Sequence[Project]:
    query = select(Project)
    if life_area_id is not None:
        query = query.where(Project.life_area_id == life_area_id)
    if not include_archived:
        query = query.where(Project.archived_at.is_(None))
    return session.scalars(query.order_by(Project.sort_order, Project.id)).all()


def get_project(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise NotFoundError(f"Project {project_id} not found")
    return project


def sections_of(session: Session, project: Project) -> Sequence[ProjectSection]:
    return session.scalars(
        select(ProjectSection)
        .where(ProjectSection.project_id == project.id)
        .order_by(ProjectSection.sort_order, ProjectSection.id)
    ).all()


def progress_of(session: Session, project: Project) -> Progress:
    """Done one-off tasks out of all that aren't cancelled or archived.

    Recurring occurrences don't count: they are created a week at a time and would keep
    moving the total.
    """
    done, total = session.execute(
        select(
            func.count(case((Task.status == "done", 1))),
            func.count(Task.id),
        ).where(
            Task.project_id == project.id,
            Task.occurrence_date.is_(None),
            Task.archived_at.is_(None),
            Task.status != "cancelled",
        )
    ).one()
    return Progress(done=done, total=total)


def create_project(session: Session, data: ProjectCreate) -> Project:
    _open_life_area(session, data.life_area_id)
    last_position = session.scalar(
        select(func.max(Project.sort_order)).where(Project.life_area_id == data.life_area_id)
    )
    project = Project(
        **data.model_dump(), sort_order=0 if last_position is None else last_position + 1
    )
    session.add(project)
    return _save(session, project)


def update_project(session: Session, project_id: int, data: ProjectUpdate) -> Project:
    project = get_project(session, project_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    return _save(session, project)


def move_project(
    session: Session, project_id: int, data: ProjectMove
) -> tuple[Project, str | None]:
    """Move the project to another life area. The database moves every item in it too,
    through the (project_id, life_area_id) keys. Undo moves them all back."""
    project = get_project(session, project_id)
    _open_life_area(session, data.life_area_id)
    history = ChangeRecorder(session)
    history.set(project, "life_area_id", data.life_area_id)
    return _save(session, project), history.batch_id


def delete_project(session: Session, project_id: int) -> None:
    """Delete an empty project and its sections. Refused while anything belongs to it."""
    project = get_project(session, project_id)
    try:
        # Either statement can hit a foreign key: sections used by tasks, or the project
        # still owning items. Both mean the project isn't empty.
        session.execute(delete(ProjectSection).where(ProjectSection.project_id == project.id))
        session.delete(project)
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise ConflictError(
            f"Project {project_id} still has items in it. Move or delete them first."
        ) from error


# ---------- Sections ----------


def get_section(session: Session, section_id: int) -> ProjectSection:
    section = session.get(ProjectSection, section_id)
    if section is None:
        raise NotFoundError(f"Section {section_id} not found")
    return section


def create_section(session: Session, project_id: int, data: SectionCreate) -> ProjectSection:
    project = get_project(session, project_id)
    ensure_owner_open(session, project.life_area_id, project.id)
    last_position = session.scalar(
        select(func.max(ProjectSection.sort_order)).where(ProjectSection.project_id == project.id)
    )
    section = ProjectSection(
        project_id=project.id,
        title=data.title,
        sort_order=0 if last_position is None else last_position + 1,
    )
    session.add(section)
    return _save_section(session, section)


def update_section(session: Session, section_id: int, data: SectionUpdate) -> ProjectSection:
    section = get_section(session, section_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    return _save_section(session, section)


def delete_section(session: Session, section_id: int) -> None:
    """Delete a section. Its tasks and templates stay in the project, unsectioned.

    Clearing only section_id keeps project_id; SQLite's ON DELETE SET NULL on the
    composite key would have cleared both.
    """
    section = get_section(session, section_id)
    for model in (Task, TaskTemplate):
        session.execute(update(model).where(model.section_id == section.id).values(section_id=None))
    session.delete(section)
    session.commit()


# ---------- Helpers ----------


def _open_life_area(session: Session, life_area_id: int) -> None:
    life_area = session.get(LifeArea, life_area_id)
    if life_area is None:
        raise UnprocessableError(f"Life area {life_area_id} not found")
    if life_area.archived_at is not None:
        raise ConflictError(f"Life area {life_area_id} is archived. Restore it first.")


def _save(session: Session, project: Project) -> Project:
    session.commit()
    session.refresh(project)
    return project


def _save_section(session: Session, section: ProjectSection) -> ProjectSection:
    session.commit()
    session.refresh(section)
    return section
