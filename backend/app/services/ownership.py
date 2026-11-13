"""Who owns an item: a project, a life area, or nobody (the Inbox)."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.errors import ConflictError, UnprocessableError
from app.models import LifeArea, Project, ProjectSection


@dataclass(frozen=True)
class Owner:
    life_area_id: int | None
    project_id: int | None
    section_id: int | None


INBOX = Owner(life_area_id=None, project_id=None, section_id=None)


def resolve_owner(
    session: Session,
    *,
    life_area_id: int | None,
    project_id: int | None,
    section_id: int | None,
    allow_inbox: bool,
) -> Owner:
    """Validate a requested owner and fill in the life area a project-owned item inherits.

    The database enforces the same rules; checking here first gives a clear error.
    """
    if section_id is not None and project_id is None:
        raise UnprocessableError("A section needs a project.")

    if project_id is not None:
        project = session.get(Project, project_id)
        if project is None:
            raise UnprocessableError(f"Project {project_id} not found")
        if life_area_id is not None and life_area_id != project.life_area_id:
            raise UnprocessableError(
                "An item in a project belongs to the project's life area. Send only project_id."
            )
        _ensure_open(session, project.life_area_id, project)
        if section_id is not None:
            section = session.get(ProjectSection, section_id)
            if section is None or section.project_id != project_id:
                raise UnprocessableError(f"Section {section_id} is not in project {project_id}")
        return Owner(project.life_area_id, project_id, section_id)

    if life_area_id is not None:
        if session.get(LifeArea, life_area_id) is None:
            raise UnprocessableError(f"Life area {life_area_id} not found")
        _ensure_open(session, life_area_id, None)
        return Owner(life_area_id, None, None)

    if not allow_inbox:
        raise UnprocessableError("Choose a life area or a project.")
    return INBOX


def ensure_owner_open(session: Session, life_area_id: int | None, project_id: int | None) -> None:
    """Refuse to bring an item back to life under an archived or finished parent."""
    if life_area_id is None:
        return
    project = session.get(Project, project_id) if project_id is not None else None
    _ensure_open(session, life_area_id, project)


def _ensure_open(session: Session, life_area_id: int, project: Project | None) -> None:
    if project is not None and not project.is_open:
        raise ConflictError(f"Project {project.id} isn't active. Reopen or restore it first.")
    life_area = session.get(LifeArea, life_area_id)
    if life_area is not None and life_area.archived_at is not None:
        raise ConflictError(f"Life area {life_area_id} is archived. Restore it first.")
