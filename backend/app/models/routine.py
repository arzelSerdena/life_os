from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AUTOINCREMENT, Base, BaseMixin
from app.models.ownership import project_owner_keys


class Routine(BaseMixin, Base):
    """A set of steps due on the days its schedule says. Has no owner of its own."""

    __tablename__ = "routines"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
        AUTOINCREMENT,
    )

    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)

    schedules: Mapped[list[RoutineSchedule]] = relationship(
        order_by="RoutineSchedule.starts_on", cascade="all, delete-orphan", passive_deletes=True
    )
    steps: Mapped[list[RoutineStep]] = relationship(
        order_by="(RoutineStep.sort_order, RoutineStep.id)",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    pauses: Mapped[list[RoutinePause]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )


class RoutineSchedule(BaseMixin, Base):
    """The routine's repeat rule from starts_on until the next row's starts_on.

    Changing the schedule adds or replaces rows, so past due days never change.
    """

    __tablename__ = "routine_schedules"
    __table_args__ = (
        Index("uq_routine_schedules_start", "routine_id", "starts_on", unique=True),
        AUTOINCREMENT,
    )

    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"))
    rrule: Mapped[str] = mapped_column(Text, default="FREQ=DAILY", server_default="FREQ=DAILY")
    starts_on: Mapped[date] = mapped_column(Date)


class RoutineStep(BaseMixin, Base):
    """One action in a routine, owned by a life area or a project.

    Due from starts_on, so a step added later has no missed days before it existed.
    """

    __tablename__ = "routine_steps"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
        *project_owner_keys(),
        Index("idx_routine_steps_routine", "routine_id"),
        Index("idx_routine_steps_life_area", "life_area_id"),
        Index("idx_routine_steps_project", "project_id", "life_area_id"),
        AUTOINCREMENT,
    )

    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"))
    life_area_id: Mapped[int] = mapped_column(ForeignKey("life_areas.id"))
    project_id: Mapped[int | None]
    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    starts_on: Mapped[date] = mapped_column(Date)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)

    pauses: Mapped[list[RoutinePause]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )
    logs: Mapped[list[RoutineLog]] = relationship(
        order_by="RoutineLog.date", cascade="all, delete-orphan", passive_deletes=True
    )


class RoutinePause(BaseMixin, Base):
    """A paused stretch of a routine or one step: starts_on up to, not including, ends_on.

    ends_on NULL means still paused. Paused days are never due, so never missed.
    """

    __tablename__ = "routine_pauses"
    __table_args__ = (
        CheckConstraint("ends_on IS NULL OR ends_on >= starts_on", name="ends_after_start"),
        CheckConstraint("(routine_id IS NULL) <> (routine_step_id IS NULL)", name="one_target"),
        Index("idx_routine_pauses_routine", "routine_id"),
        Index("idx_routine_pauses_step", "routine_step_id"),
        # At most one open pause per routine and per step
        Index(
            "uq_routine_pauses_open_routine",
            "routine_id",
            unique=True,
            sqlite_where=text("ends_on IS NULL AND routine_id IS NOT NULL"),
        ),
        Index(
            "uq_routine_pauses_open_step",
            "routine_step_id",
            unique=True,
            sqlite_where=text("ends_on IS NULL AND routine_step_id IS NOT NULL"),
        ),
        AUTOINCREMENT,
    )

    routine_id: Mapped[int | None] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"))
    routine_step_id: Mapped[int | None] = mapped_column(
        ForeignKey("routine_steps.id", ondelete="CASCADE")
    )
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)

    def covers(self, day: date) -> bool:
        return self.starts_on <= day and (self.ends_on is None or day < self.ends_on)


class RoutineLog(Base):
    """A step's state on one day: done or skipped. No row means to-do, or missed later.

    Has only created_at, on purpose.
    """

    __tablename__ = "routine_logs"
    __table_args__ = (
        CheckConstraint("status IN ('done', 'skipped')", name="status_values"),
        Index("uq_routine_logs_step_date", "routine_step_id", "date", unique=True),
        AUTOINCREMENT,
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    routine_step_id: Mapped[int] = mapped_column(ForeignKey("routine_steps.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
