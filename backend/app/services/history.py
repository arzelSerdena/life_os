"""Field-level change history in status_changes, and undo by batch."""

from collections import defaultdict
from datetime import date, datetime, time
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ConflictError, NotFoundError
from app.models import Base, LifeArea, Project, StatusChange, Subtask, Task, TaskTemplate

ENTITY_MODELS: dict[str, type[Base]] = {
    "life_area": LifeArea,
    "project": Project,
    "task_template": TaskTemplate,
    "task": Task,
    "subtask": Subtask,
}
ENTITY_TYPES = {model: name for name, model in ENTITY_MODELS.items()}


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
        self._session.add(
            StatusChange(
                batch_id=self._batch_id,
                entity_type=ENTITY_TYPES[type(entity)],
                entity_id=entity.id,  # type: ignore[attr-defined]
                field=field,
                old_value=_dump(old_value),
                new_value=_dump(value),
            )
        )
        setattr(entity, field, value)
        self._count += 1


def undo_batch(session: Session, batch_id: str) -> int:
    """Restore every field the batch changed. Returns how many items were restored.

    Refused when an item has been deleted or edited since, so undo never overwrites
    newer changes.
    """
    rows = session.scalars(
        select(StatusChange).where(StatusChange.batch_id == batch_id).order_by(StatusChange.id)
    ).all()
    if not rows:
        raise NotFoundError(f"Nothing to undo for batch {batch_id}")

    # Per item and field: the value before the batch, and the value it left behind.
    changes: dict[tuple[str, int], dict[str, list[str | None]]] = defaultdict(dict)
    for row in rows:
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

    for entity, fields in entities:
        columns = type(entity).__table__.columns  # type: ignore[attr-defined]
        for field, (before, _) in fields.items():
            setattr(entity, field, _load(before, columns[field].type.python_type))

    for row in rows:
        session.delete(row)
    session.commit()
    return len(entities)
