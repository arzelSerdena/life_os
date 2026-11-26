"""Field-level change history in status_changes, and undo by batch."""

import json
from collections import defaultdict
from datetime import date, datetime, time
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ConflictError, NotFoundError
from app.models import (
    Base,
    Event,
    EventException,
    LifeArea,
    Metric,
    MetricEntry,
    Project,
    ProjectSection,
    Routine,
    RoutineLog,
    RoutineStep,
    StatusChange,
    Subtask,
    Task,
    TaskTemplate,
)

ENTITY_MODELS: dict[str, type[Base]] = {
    "life_area": LifeArea,
    "project": Project,
    "task_template": TaskTemplate,
    "task": Task,
    "subtask": Subtask,
    "event": Event,
    "event_exception": EventException,
    "metric": Metric,
    "metric_entry": MetricEntry,
    "routine": Routine,
    "routine_step": RoutineStep,
    "routine_log": RoutineLog,
}
ENTITY_TYPES = {model: name for name, model in ENTITY_MODELS.items()}

# A status_changes row with this field means "the batch created this row" (a task, an event
# exception, a routine step's log for a day, or a metric entry). Its new_value holds a
# snapshot, so undo only removes the row if nobody has changed it since.
CREATED = "_created"
SNAPSHOT_SKIP = {"id", "created_at", "updated_at"}


def _dump(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime | date | time):
        return value.isoformat()
    return str(value)


def _load(text: str | None, python_type: type) -> Any:
    if text is None:
        return None
    if python_type is datetime:
        return datetime.fromisoformat(text)
    if python_type is date:
        return date.fromisoformat(text)
    if python_type is time:
        return time.fromisoformat(text)
    if python_type is bool:
        return text == "True"
    if python_type is int:
        return int(text)
    return text


def _snapshot(entity: Base) -> str:
    fields: dict[str, Any] = {
        column.key: _dump(getattr(entity, column.key))
        for column in type(entity).__table__.columns  # type: ignore[attr-defined]
        if column.key not in SNAPSHOT_SKIP
    }
    if isinstance(entity, Task):
        fields["subtasks"] = [[subtask.title, subtask.status] for subtask in entity.subtasks]
    return json.dumps(fields, sort_keys=True)


class ChangeRecorder:
    """Sets fields and records each change under one batch id, so the batch can be undone.

    The ORM writes all of an entity's changed fields in one UPDATE, which keeps a status
    and its timestamp consistent for the database's CHECK constraints.
    """

    def __init__(self, session: Session) -> None:
        self._session = session
        self._batch_id = uuid4().hex
        self._count = 0

    @property
    def batch_id(self) -> str | None:
        """None when nothing changed, so there is nothing to undo."""
        return self._batch_id if self._count else None

    def set(self, entity: Base, field: str, value: Any) -> None:
        old_value = getattr(entity, field)
        if old_value == value:
            return
        self._record(entity, field, _dump(old_value), _dump(value))
        setattr(entity, field, value)

    def created(self, entity: Task | EventException | RoutineLog | MetricEntry) -> None:
        """Record a row the change created, so undo can remove it."""
        self._session.flush()  # assigns the id
        self._record(entity, CREATED, None, _snapshot(entity))

    def _record(self, entity: Base, field: str, old: str | None, new: str | None) -> None:
        self._session.add(
            StatusChange(
                batch_id=self._batch_id,
                entity_type=ENTITY_TYPES[type(entity)],
                entity_id=entity.id,  # type: ignore[attr-defined]
                field=field,
                old_value=old,
                new_value=new,
            )
        )
        self._count += 1


# Fields that a later change may alter without blocking undo.
POSITION_FIELDS = frozenset({"sort_order"})


def undo_batch(session: Session, batch_id: str) -> int:
    """Restore every field the batch changed and remove the rows it created.

    Returns how many items were restored or removed. Refused when an item has been
    deleted or changed since, so undo never overwrites newer work.
    """
    rows = session.scalars(
        select(StatusChange).where(StatusChange.batch_id == batch_id).order_by(StatusChange.id)
    ).all()
    if not rows:
        raise NotFoundError(f"Nothing to undo for batch {batch_id}")

    # Per item and field: the value before the batch, and the value it left behind.
    changes: dict[tuple[str, int], dict[str, list[str | None]]] = defaultdict(dict)
    created: list[StatusChange] = []
    for row in rows:
        if row.field == CREATED:
            created.append(row)
            continue
        field_change = changes[(row.entity_type, row.entity_id)].setdefault(
            row.field, [row.old_value, row.new_value]
        )
        field_change[1] = row.new_value

    entities: list[tuple[Base, dict[str, list[str | None]]]] = []
    for (entity_type, entity_id), fields in changes.items():
        entity = session.get(ENTITY_MODELS[entity_type], entity_id)
        if entity is None:
            raise ConflictError("An item in this change was deleted, so it can't be undone.")
        for field, (_, left_behind) in fields.items():
            # A day's order is only position: reordering after a move isn't newer work, so it
            # doesn't block undoing the move (the old position is still restored).
            if field in POSITION_FIELDS:
                continue
            if _dump(getattr(entity, field)) != left_behind:
                raise ConflictError("This was changed again since, so it can't be undone.")
        entities.append((entity, fields))

    to_remove: list[Base] = []
    for row in created:
        made = session.get(ENTITY_MODELS[row.entity_type], row.entity_id)
        if made is None:
            continue  # already gone
        if _snapshot(made) != row.new_value:
            raise ConflictError(
                "Something this change created was changed since, so it can't be undone."
            )
        to_remove.append(made)

    restored_values: dict[tuple[str, int], dict[str, Any]] = {}
    for entity, fields in entities:
        columns = type(entity).__table__.columns  # type: ignore[attr-defined]
        restored_values[(entity.__tablename__, entity.id)] = {  # type: ignore[attr-defined]
            field: _load(before, columns[field].type.python_type)
            for field, (before, _) in fields.items()
        }

    for entity, _fields in entities:
        key = (entity.__tablename__, entity.id)  # type: ignore[attr-defined]
        vals = restored_values[key]
        if "life_area_id" in vals or "project_id" in vals or "section_id" in vals:
            area_id = vals.get("life_area_id", getattr(entity, "life_area_id", None))
            proj_id = vals.get("project_id", getattr(entity, "project_id", None))
            sec_id = vals.get("section_id", getattr(entity, "section_id", None))
            if area_id is not None and session.get(LifeArea, area_id) is None:
                raise ConflictError("The original life area was deleted, so it can't be undone.")
            if proj_id is not None:
                proj = session.get(Project, proj_id)
                if proj is None:
                    raise ConflictError("The original project was deleted, so it can't be undone.")
                proj_area = restored_values.get(("projects", proj_id), {}).get(
                    "life_area_id", proj.life_area_id
                )
                if proj_area != area_id:
                    raise ConflictError("The original project moved, so it can't be undone.")
            if sec_id is not None:
                sec = session.get(ProjectSection, sec_id)
                if sec is None or sec.project_id != proj_id:
                    raise ConflictError("The original section was deleted, so it can't be undone.")
        if (
            "routine_step_id" in vals
            and vals["routine_step_id"] is not None
            and session.get(RoutineStep, vals["routine_step_id"]) is None
        ):
            raise ConflictError("The original routine step was deleted, so it can't be undone.")
        reopening = ("archived_at" in vals and vals["archived_at"] is None) or (
            "status" in vals and vals["status"] in ("todo", "open", "active")
        )
        if reopening:
            area_id = vals.get("life_area_id", getattr(entity, "life_area_id", None))
            proj_id = vals.get("project_id", getattr(entity, "project_id", None))
            if area_id is not None:
                area = session.get(LifeArea, area_id)
                area_arch = restored_values.get(("life_areas", area_id), {}).get(
                    "archived_at", area.archived_at if area else None
                )
                if area is None or area_arch is not None:
                    raise ConflictError("The life area is archived, so this can't be undone.")
            if proj_id is not None and entity.__tablename__ != "projects":  # type: ignore[attr-defined]
                proj = session.get(Project, proj_id)
                proj_arch = restored_values.get(("projects", proj_id), {}).get(
                    "archived_at", proj.archived_at if proj else None
                )
                proj_stat = restored_values.get(("projects", proj_id), {}).get(
                    "status", proj.status if proj else None
                )
                if proj is None or proj_arch is not None or proj_stat != "active":
                    raise ConflictError(
                        "The project is closed or archived, so this can't be undone."
                    )

    for entity, _fields in entities:
        key = (entity.__tablename__, entity.id)  # type: ignore[attr-defined]
        for field, value in restored_values[key].items():
            setattr(entity, field, value)
    for made in to_remove:
        session.delete(made)
    for row in rows:
        session.delete(row)
    session.commit()
    return len(entities) + len(to_remove)
