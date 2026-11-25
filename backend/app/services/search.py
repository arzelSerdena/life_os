"""Search for the Ctrl K palette: life areas, projects, routines and tasks whose title
contains the query, case-insensitively. Archived items are left out (they are found in
Finished & archived), and so are cancelled tasks, which are hidden by default."""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import ColumnElement, case, or_, select, text
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


def _fts_query(query: str) -> str:
    words = query.split()
    if not words:
        return ""
    escaped = [w.replace('"', '""') for w in words]
    return " ".join(f'"{w}"*' for w in escaped)


def _fts_match_ids(session: Session, query: str) -> dict[SearchKind, set[int]]:
    match_expr = _fts_query(query)
    hits: dict[SearchKind, set[int]] = {
        "life_area": set(),
        "project": set(),
        "routine": set(),
        "task": set(),
    }
    if not match_expr:
        return hits

    try:
        session.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS temp.search_fts USING fts5("
                "kind UNINDEXED, item_id UNINDEXED, title, tokenize='unicode61')"
            )
        )
        session.execute(text("DELETE FROM temp.search_fts"))
        session.execute(
            text(
                "INSERT INTO temp.search_fts(kind, item_id, title) "
                "SELECT 'life_area', id, title FROM life_areas WHERE archived_at IS NULL "
                "UNION ALL "
                "SELECT 'project', id, title FROM projects WHERE archived_at IS NULL "
                "UNION ALL "
                "SELECT 'routine', id, title FROM routines WHERE archived_at IS NULL "
                "UNION ALL "
                "SELECT 'task', id, title FROM tasks "
                "WHERE archived_at IS NULL AND status != 'cancelled'"
            )
        )
        rows = session.execute(
            text("SELECT kind, item_id FROM temp.search_fts WHERE search_fts MATCH :query"),
            {"query": match_expr},
        ).all()
        for kind, item_id in rows:
            if kind in hits:
                hits[kind].add(int(item_id))
    except Exception:
        # FTS5 fallback
        pass
    return hits


def search(session: Session, query: str, limit: int) -> list[SearchHit]:
    """Up to `limit` hits of each kind, areas first, then projects, routines and tasks. Within
    a kind, titles that start with the query come first, then those with a word that does;
    open tasks come before done ones, and the rest follow the app's own order."""
    query = query.strip()
    if not query:
        return []
    hits: list[SearchHit] = []
    fts_hits = _fts_match_ids(session, query)

    area_cond = (
        or_(
            LifeArea.id.in_(fts_hits["life_area"]),
            LifeArea.title.icontains(query, autoescape=True),
        )
        if fts_hits["life_area"]
        else LifeArea.title.icontains(query, autoescape=True)
    )
    areas = session.scalars(
        select(LifeArea)
        .where(LifeArea.archived_at.is_(None), area_cond)
        .order_by(_rank(LifeArea.title, query), LifeArea.sort_order, LifeArea.id)
        .limit(limit)
    )
    hits += [
        SearchHit("life_area", a.id, a.title, None, a.id, a.title, a.color, None, None)
        for a in areas
    ]

    project_cond = (
        or_(Project.id.in_(fts_hits["project"]), Project.title.icontains(query, autoescape=True))
        if fts_hits["project"]
        else Project.title.icontains(query, autoescape=True)
    )
    projects = session.execute(
        select(Project, LifeArea)
        .join(LifeArea, LifeArea.id == Project.life_area_id)
        .where(Project.archived_at.is_(None), project_cond)
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

    routine_cond = (
        or_(Routine.id.in_(fts_hits["routine"]), Routine.title.icontains(query, autoescape=True))
        if fts_hits["routine"]
        else Routine.title.icontains(query, autoescape=True)
    )
    routines = session.scalars(
        select(Routine)
        .where(Routine.archived_at.is_(None), routine_cond)
        .order_by(_rank(Routine.title, query), Routine.sort_order, Routine.id)
        .limit(limit)
    )
    hits += [
        SearchHit("routine", r.id, r.title, None, None, None, None, None, None) for r in routines
    ]

    owner = aliased(Project)
    task_cond = (
        or_(Task.id.in_(fts_hits["task"]), Task.title.icontains(query, autoescape=True))
        if fts_hits["task"]
        else Task.title.icontains(query, autoescape=True)
    )
    tasks = session.execute(
        select(Task, LifeArea, owner)
        .outerjoin(LifeArea, LifeArea.id == Task.life_area_id)
        .outerjoin(owner, owner.id == Task.project_id)
        .where(
            Task.archived_at.is_(None),
            Task.status != "cancelled",
            task_cond,
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
