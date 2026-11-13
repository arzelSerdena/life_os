from datetime import date, datetime, time

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AUTOINCREMENT, Base, BaseMixin
from app.models.ownership import PRIORITY_CHECK, optional_owner_checks, project_owner_keys

STATUS_CHECKS = (
    CheckConstraint("status IN ('todo', 'done', 'cancelled')", name="status_values"),
    CheckConstraint("(status = 'done') = (completed_at IS NOT NULL)", name="done_timestamp"),
    CheckConstraint(
        "(status = 'cancelled') = (cancelled_at IS NOT NULL)", name="cancelled_timestamp"
    ),
)


class Task(BaseMixin, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
        CheckConstraint(PRIORITY_CHECK, name="priority_values"),
        CheckConstraint("due_time IS NULL OR due_date IS NOT NULL", name="due_time_needs_date"),
        CheckConstraint("rollover_count >= 0", name="rollover_count"),
        # Only occurrences of a repeating template have an occurrence date
        CheckConstraint(
            "occurrence_date IS NULL OR template_id IS NOT NULL", name="occurrence_needs_template"
        ),
        *STATUS_CHECKS,
        *optional_owner_checks(),
        *project_owner_keys(with_section=True),
        Index("idx_tasks_life_area", "life_area_id"),
        Index("idx_tasks_project", "project_id", "life_area_id"),
        Index("idx_tasks_section", "section_id", "project_id"),
        Index("idx_tasks_scheduled_date", "scheduled_date"),
        Index("idx_tasks_due_date", "due_date"),
        Index("uq_tasks_occurrence", "template_id", "occurrence_date", unique=True),
        AUTOINCREMENT,
    )

    life_area_id: Mapped[int | None] = mapped_column(ForeignKey("life_areas.id"))
    project_id: Mapped[int | None]
    section_id: Mapped[int | None]
    template_id: Mapped[int | None] = mapped_column(ForeignKey("task_templates.id"))
    occurrence_date: Mapped[date | None] = mapped_column(Date)
    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="todo", server_default="todo")
    priority: Mapped[str] = mapped_column(Text, default="none", server_default="none")
    scheduled_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    due_time: Mapped[time | None] = mapped_column(Time)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    rollover_count: Mapped[int] = mapped_column(default=0, server_default="0")

    subtasks: Mapped[list[Subtask]] = relationship(
        order_by="(Subtask.sort_order, Subtask.id)",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Subtask(BaseMixin, Base):
    """A checklist item on a task. One level deep and never scheduled."""

    __tablename__ = "subtasks"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        *STATUS_CHECKS,
        Index("idx_subtasks_task", "task_id"),
        AUTOINCREMENT,
    )

    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="todo", server_default="todo")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
