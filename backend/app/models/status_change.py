from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AUTOINCREMENT, Base

ENTITY_TYPES = (
    "life_area",
    "project",
    "task_template",
    "task",
    "subtask",
    "event",
    "metric",
    "routine",
    "routine_step",
)


class StatusChange(Base):
    """One field change, so a whole batch can be undone.

    No foreign keys on purpose: it records rows from many tables. Has only changed_at.
    """

    __tablename__ = "status_changes"
    __table_args__ = (
        CheckConstraint(
            "entity_type IN (" + ", ".join(f"'{name}'" for name in ENTITY_TYPES) + ")",
            name="entity_type_values",
        ),
        Index("idx_status_changes_batch", "batch_id"),
        Index("idx_status_changes_entity", "entity_type", "entity_id"),
        AUTOINCREMENT,
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str] = mapped_column(Text)
    entity_id: Mapped[int]
    field: Mapped[str] = mapped_column(Text)
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
