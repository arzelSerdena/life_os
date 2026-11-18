"""Search for the Ctrl K palette: life areas, projects, routines and tasks whose title
contains the query, case-insensitively. Archived items are left out (they are found in
Finished & archived), and so are cancelled tasks, which are hidden by default."""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import ColumnElement, case, select
from sqlalchemy.orm import InstrumentedAttribute, Session, aliased

from app.models import LifeArea, Project, Routine, Task

SearchKind = Literal["life_area", "project", "routine", "task"]


@dataclass(frozen=True)
class SearchHit:
    kind: SearchKind
    id: int
    title: str
    status: str | None
    life_area_id: int | None
    life_area_title: str | None
    life_area_color: str | None
    project_id: int | None
    project_title: str | None


def _rank(title: InstrumentedAttribute[str], query: str) -> ColumnElement[int]:
    """0 when the title starts with the query, 1 when a word in it does, 2 otherwise."""
    return case(
        (title.istartswith(query, autoescape=True), 0),
        (title.icontains(" " + query, autoescape=True), 1),
        else_=2,
    )


def search(session: Session, query: str, limit: int) -> list[SearchHit]:
    """Up to `limit` hits of each kind, areas first, then projects, routines and tasks. Within
    a kind, titles that start with the query come first, then those with a word that does;
    open tasks come before done ones, and the rest follow the app's own order."""
    query = query.strip()
    if not query:
        return []
    hits: list[SearchHit] = []

    areas = session.scalars(
        select(LifeArea)
        .where(LifeArea.archived_at.is_(None), LifeArea.title.icontains(query, autoescape=True))
        .order_by(_rank(LifeArea.title, query), LifeArea.sort_order, LifeArea.id)
        .limit(limit)
    )
    hits += [
        SearchHit("life_area", a.id, a.title, None, a.id, a.title, a.color, None, None)
        for a in areas
    ]

    projects = session.execute(
        select(Project, LifeArea)
        .join(LifeArea, LifeArea.id == Project.life_area_id)
        .where(Project.archived_at.is_(None), Project.title.icontains(query, autoescape=True))
        .order_by(
            _rank(Project.title, query),
            (Project.status != "active"),
            Project.sort_order,
            Project.id,
        )
        .limit(limit)
    )
    hits += [
        SearchHit("project", p.id, p.title, p.status, a.id, a.title, a.color, None, None)
        for p, a in projects
    ]

    routines = session.scalars(
        select(Routine)
        .where(Routine.archived_at.is_(None), Routine.title.icontains(query, autoescape=True))
        .order_by(_rank(Routine.title, query), Routine.sort_order, Routine.id)
        .limit(limit)
    )
    hits += [
        SearchHit("routine", r.id, r.title, None, None, None, None, None, None) for r in routines
    ]

    owner = aliased(Project)
    tasks = session.execute(
        select(Task, LifeArea, owner)
        .outerjoin(LifeArea, LifeArea.id == Task.life_area_id)
        .outerjoin(owner, owner.id == Task.project_id)
        .where(
            Task.archived_at.is_(None),
            Task.status != "cancelled",
            Task.title.icontains(query, autoescape=True),
        )
        .order_by(
            _rank(Task.title, query),
            (Task.status != "todo"),
            Task.updated_at.desc(),
            Task.id.desc(),
        )
        .limit(limit)
    )
    hits += [
        SearchHit(
            "task",
            t.id,
            t.title,
            t.status,
            t.life_area_id,
            a.title if a else None,
            a.color if a else None,
            t.project_id,
            p.title if p else None,
        )
        for t, a, p in tasks
    ]
    return hits
