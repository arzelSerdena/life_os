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
    LifeArea,
    Metric,
    Project,
    Routine,
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
    "metric": Metric,
    "routine": Routine,
    "routine_step": RoutineStep,
}
ENTITY_TYPES = {model: name for name, model in ENTITY_MODELS.items()}

# A status_changes row with this field means "the batch created this task". Its new_value
# holds a snapshot, so undo only removes the task if nobody has changed it since.
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
    if python_type is int:
        return int(text)
    return text


def _snapshot(task: Task) -> str:
    fields = {
        column.key: _dump(getattr(task, column.key))
        for column in Task.__table__.columns
        if column.key not in SNAPSHOT_SKIP
    }
    fields["subtasks"] = [[subtask.title, subtask.status] for subtask in task.subtasks]  # type: ignore[assignment]
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

    def created(self, task: Task) -> None:
        """Record a task the change created, so undo can remove it again."""
        self._session.flush()  # assigns the id
        self._record(task, CREATED, None, _snapshot(task))

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


def undo_batch(session: Session, batch_id: str) -> int:
    """Restore every field the batch changed and remove the tasks it created.

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
            if _dump(getattr(entity, field)) != left_behind:
                raise ConflictError("This was changed again since, so it can't be undone.")
        entities.append((entity, fields))

    to_remove: list[Task] = []
    for row in created:
        task = session.get(Task, row.entity_id)
        if task is None:
            continue  # already gone
        if _snapshot(task) != row.new_value:
            raise ConflictError(
                "A task this change created was changed since, so it can't be undone."
            )
        to_remove.append(task)

    for entity, fields in entities:
        columns = type(entity).__table__.columns  # type: ignore[attr-defined]
        for field, (before, _) in fields.items():
            setattr(entity, field, _load(before, columns[field].type.python_type))
    for task in to_remove:
        session.delete(task)
    for row in rows:
        session.delete(row)
    session.commit()
    return len(entities) + len(to_remove)
