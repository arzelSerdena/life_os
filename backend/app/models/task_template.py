from datetime import date, datetime, time

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AUTOINCREMENT, Base, BaseMixin
from app.models.ownership import PRIORITY_CHECK, optional_owner_checks, project_owner_keys


class TaskTemplate(BaseMixin, Base):
    """Reusable task content, as in Notion. With an rrule it is a recurring task."""

    __tablename__ = "task_templates"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
        CheckConstraint(PRIORITY_CHECK, name="priority_values"),
        CheckConstraint("due_offset_days IS NULL OR due_offset_days >= 0", name="due_offset"),
        CheckConstraint(
            "due_time IS NULL OR due_offset_days IS NOT NULL", name="due_time_needs_offset"
        ),
        CheckConstraint("repeat_from IN ('schedule', 'completion')", name="repeat_from_values"),
        CheckConstraint("ends_on IS NULL OR ends_on >= starts_on", name="ends_after_start"),
        CheckConstraint("(rrule IS NULL) = (starts_on IS NULL)", name="rule_has_start"),
        CheckConstraint(
            "rrule IS NOT NULL OR "
            "(ends_on IS NULL AND paused_at IS NULL AND repeat_from = 'schedule')",
            name="schedule_needs_rule",
        ),
        *optional_owner_checks(),
        *project_owner_keys(with_section=True),
        Index("idx_task_templates_life_area", "life_area_id"),
        Index("idx_task_templates_project", "project_id", "life_area_id"),
        Index("idx_task_templates_section", "section_id", "project_id"),
        AUTOINCREMENT,
    )

    life_area_id: Mapped[int | None] = mapped_column(ForeignKey("life_areas.id"))
    project_id: Mapped[int | None]
    section_id: Mapped[int | None]
    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(Text, default="none", server_default="none")
    due_offset_days: Mapped[int | None]
    due_time: Mapped[time | None] = mapped_column(Time)
    rrule: Mapped[str | None] = mapped_column(Text)
    repeat_from: Mapped[str] = mapped_column(Text, default="schedule", server_default="schedule")
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)

    subtasks: Mapped[list[TaskTemplateSubtask]] = relationship(
        order_by="(TaskTemplateSubtask.sort_order, TaskTemplateSubtask.id)",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def is_repeating(self) -> bool:
        return self.rrule is not None

    @property
    def generates(self) -> bool:
        """Whether the template creates occurrences right now."""
        return self.is_repeating and self.paused_at is None and self.archived_at is None


class TaskTemplateSubtask(BaseMixin, Base):
    """The checklist copied onto every task created from the template."""

    __tablename__ = "task_template_subtasks"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        Index("idx_task_template_subtasks_template", "template_id"),
        AUTOINCREMENT,
    )

    template_id: Mapped[int] = mapped_column(ForeignKey("task_templates.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
