from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AUTOINCREMENT, Base, BaseMixin


class Project(BaseMixin, Base):
    """Only the table for now; the API and screens come in Phase 4."""

    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
        CheckConstraint("status IN ('active', 'done', 'cancelled')", name="status_values"),
        CheckConstraint("(status = 'done') = (completed_at IS NOT NULL)", name="done_timestamp"),
        CheckConstraint(
            "(status = 'cancelled') = (cancelled_at IS NOT NULL)", name="cancelled_timestamp"
        ),
        # Target of the composite keys that keep items in their project's life area
        UniqueConstraint("id", "life_area_id"),
        Index("idx_projects_life_area", "life_area_id"),
        AUTOINCREMENT,
    )

    life_area_id: Mapped[int] = mapped_column(ForeignKey("life_areas.id"))
    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, default="active", server_default="active")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")

    @property
    def is_open(self) -> bool:
        return self.status == "active" and self.archived_at is None


class ProjectSection(BaseMixin, Base):
    """A plain grouping of tasks inside a project. Sections never move between projects."""

    __tablename__ = "project_sections"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        # Target of the composite keys that keep a task's section inside its project
        UniqueConstraint("id", "project_id"),
        Index("idx_project_sections_project", "project_id"),
        AUTOINCREMENT,
    )

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
