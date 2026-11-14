"""Small helpers that insert rows directly, for items without an API yet."""

from typing import Any

from sqlalchemy.orm import Session

from app.models import LifeArea, Project, ProjectSection


def make_life_area(session: Session, title: str = "Health", **fields: Any) -> LifeArea:
    life_area = LifeArea(title=title, **fields)
    session.add(life_area)
    session.commit()
    return life_area


def make_project(
    session: Session, life_area: LifeArea, title: str = "Marathon", **fields: Any
) -> Project:
    project = Project(life_area_id=life_area.id, title=title, **fields)
    session.add(project)
    session.commit()
    return project


def make_section(session: Session, project: Project, title: str = "Training") -> ProjectSection:
    section = ProjectSection(project_id=project.id, title=title)
    session.add(section)
    session.commit()
    return section
