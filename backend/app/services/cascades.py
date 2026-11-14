"""Cascades: status changes and archiving that change a life area's or project's items too.

Every cascade is planned first, so it can be previewed; applying runs the same plan in one
transaction and records every field change under one batch id, so undo restores it all.
"""

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import clock
from app.errors import ConflictError, NotFoundError
from app.models import (
    Base,
    Event,
    LifeArea,
    Metric,
    Project,
    RoutineStep,
    StatusChange,
    Task,
    TaskTemplate,
)
from app.models.base import utc_now
from app.services.history import ENTITY_MODELS, ENTITY_TYPES, ChangeRecorder
from app.services.ownership import ensure_owner_open
from app.services.task_rules import cancel_open_subtasks

# What happens to an item: archive it, cancel it, or end its repeating series from today.
ARCHIVE, CANCEL, END_SERIES = "archive", "cancel", "end_series"


@dataclass(frozen=True)
class Effect:
    item: Base
    effect: str

    @property
    def kind(self) -> str:
        return ENTITY_TYPES[type(self.item)]

    @property
    def title(self) -> str:
        return self.item.title  # type: ignore[attr-defined]


@dataclass
class Plan:
    effects: list[Effect] = field(default_factory=list)

    def add(self, items: Any, effect: str) -> None:
        self.effects.extend(Effect(item, effect) for item in items)


@dataclass(frozen=True)
class CascadeResult:
    item: Base
    batch_id: str | None


# ---------- Life areas ----------


def plan_area_archive(session: Session, life_area_id: int) -> Plan:
    """Archiving an area archives everything it owns."""
    area = _area(session, life_area_id)
    return _archive_everything(session, area.id, None)


def archive_area(session: Session, life_area_id: int) -> CascadeResult:
    area = _area(session, life_area_id)
    history = ChangeRecorder(session)
    if area.archived_at is None:
        _apply(plan_area_archive(session, life_area_id), history)
        history.set(area, "archived_at", utc_now())
    session.commit()
    return CascadeResult(area, history.batch_id)


def restore_area(session: Session, life_area_id: int) -> CascadeResult:
    """Restore the area and the items its last archive took with it. Items archived on
    their own before that stay archived."""
    area = _area(session, life_area_id)
    history = ChangeRecorder(session)
    if area.archived_at is not None:
        _restore_with_batch(session, area, history)
    session.commit()
    return CascadeResult(area, history.batch_id)


# ---------- Projects ----------


def plan_project(session: Session, project_id: int, action: str) -> Plan:
    """complete or cancel: cancel open tasks and upcoming events, end repeating events from
    today, and archive templates, routine steps and metrics. archive: archive everything."""
    project = _project(session, project_id)
    if action == "archive":
        return _archive_everything(session, project.life_area_id, project.id)
    if action not in ("complete", "cancel"):
        raise NotFoundError(f"Unknown project action {action}")

    today = clock.today()
    plan = Plan()
    open_tasks = _open(Task, project.id).where(Task.status == "todo")
    plan.add(session.scalars(open_tasks.options(selectinload(Task.subtasks))), CANCEL)
    events = _open(Event, project.id).where(Event.cancelled_at.is_(None))
    for event in session.scalars(events):
        # Upcoming events are cancelled; a series already under way ends yesterday, so
        # its past occurrences stay as history.
        if event.start_date >= today:
            plan.add([event], CANCEL)
        elif event.rrule is not None and (event.repeat_ends_on or today) >= today:
            plan.add([event], END_SERIES)
    for model in (TaskTemplate, RoutineStep, Metric):
        plan.add(session.scalars(_open(model, project.id)), ARCHIVE)
    return plan


def finish_project(session: Session, project_id: int, status: str) -> CascadeResult:
    """Mark a project done or cancelled, with its cascade."""
    project = _project(session, project_id)
    if project.archived_at is not None:
        raise ConflictError(f"Project {project_id} is archived. Restore it first.")
    if project.status == status:
        return CascadeResult(project, None)
    history = ChangeRecorder(session)
    _apply(plan_project(session, project_id, "complete"), history)
    now = utc_now()
    # Status and its timestamp change together, so the CHECK constraints hold.
    history.set(project, "completed_at", now if status == "done" else None)
    history.set(project, "cancelled_at", now if status == "cancelled" else None)
    history.set(project, "status", status)
    session.commit()
    return CascadeResult(project, history.batch_id)


def reopen_project(session: Session, project_id: int) -> CascadeResult:
    """Back to active. Items the cascade changed stay as they are; undo brings them back."""
    project = _project(session, project_id)
    if project.archived_at is not None:
        raise ConflictError(f"Project {project_id} is archived. Restore it first.")
    ensure_owner_open(session, project.life_area_id, None)
    history = ChangeRecorder(session)
    history.set(project, "status", "active")
    history.set(project, "completed_at", None)
    history.set(project, "cancelled_at", None)
    session.commit()
    return CascadeResult(project, history.batch_id)


def archive_project(session: Session, project_id: int) -> CascadeResult:
    project = _project(session, project_id)
    history = ChangeRecorder(session)
    if project.archived_at is None:
        _apply(plan_project(session, project_id, "archive"), history)
        history.set(project, "archived_at", utc_now())
    session.commit()
    return CascadeResult(project, history.batch_id)


def restore_project(session: Session, project_id: int) -> CascadeResult:
    project = _project(session, project_id)
    history = ChangeRecorder(session)
    if project.archived_at is not None:
        ensure_owner_open(session, project.life_area_id, None)
        _restore_with_batch(session, project, history)
    session.commit()
    return CascadeResult(project, history.batch_id)


# ---------- Shared ----------


def _archive_everything(session: Session, life_area_id: int, project_id: int | None) -> Plan:
    plan = Plan()
    for model in (Project, Task, TaskTemplate, Event, Metric, RoutineStep):
        if model is Project and project_id is not None:
            continue
        query = select(model).where(model.archived_at.is_(None))  # type: ignore[attr-defined]
        if project_id is None:
            query = query.where(model.life_area_id == life_area_id)  # type: ignore[attr-defined]
        else:
            query = query.where(model.project_id == project_id)  # type: ignore[attr-defined]
        if model is Task:
            query = query.options(selectinload(Task.subtasks))
        plan.add(session.scalars(query.order_by(model.id)), ARCHIVE)  # type: ignore[attr-defined]
    return plan


def _open(model: Any, project_id: int) -> Any:
    return select(model).where(model.project_id == project_id, model.archived_at.is_(None))


def _apply(plan: Plan, history: ChangeRecorder) -> None:
    now = utc_now()
    yesterday = clock.today() - timedelta(days=1)
    for effect in plan.effects:
        item = effect.item
        if effect.effect == ARCHIVE:
            history.set(item, "archived_at", now)
            if isinstance(item, Task):
                cancel_open_subtasks(item, history)
        elif effect.effect == CANCEL:
            history.set(item, "cancelled_at", now)
            if isinstance(item, Task):
                history.set(item, "status", "cancelled")
                cancel_open_subtasks(item, history)
        else:
            history.set(item, "repeat_ends_on", yesterday)


def _restore_with_batch(
    session: Session, owner: LifeArea | Project, history: ChangeRecorder
) -> None:
    """Un-archive the owner and every item archived in the same batch that is still
    archived from it."""
    archived = session.scalars(
        select(StatusChange)
        .where(
            StatusChange.entity_type == ENTITY_TYPES[type(owner)],
            StatusChange.entity_id == owner.id,
            StatusChange.field == "archived_at",
            StatusChange.new_value.is_not(None),
        )
        .order_by(StatusChange.id.desc())
    ).first()
    if archived is not None:
        rows = session.scalars(
            select(StatusChange).where(
                StatusChange.batch_id == archived.batch_id,
                StatusChange.field == "archived_at",
                StatusChange.new_value.is_not(None),
            )
        ).all()
        for row in rows:
            item = session.get(ENTITY_MODELS[row.entity_type], row.entity_id)
            if item is None or item is owner:
                continue
            stamp = item.archived_at  # type: ignore[attr-defined]
            if stamp is not None and stamp.isoformat() == row.new_value:
                history.set(item, "archived_at", None)
    history.set(owner, "archived_at", None)


def _area(session: Session, life_area_id: int) -> LifeArea:
    area = session.get(LifeArea, life_area_id)
    if area is None:
        raise NotFoundError(f"Life area {life_area_id} not found")
    return area


def _project(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise NotFoundError(f"Project {project_id} not found")
    return project
