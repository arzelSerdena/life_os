from datetime import date, datetime, time

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AUTOINCREMENT, Base, BaseMixin
from app.models.ownership import project_owner_keys

TIME_CHECKS = (
    CheckConstraint("end_date IS NULL OR end_date >= start_date", name="ends_after_start"),
    CheckConstraint("end_time IS NULL OR start_time IS NOT NULL", name="end_time_needs_start"),
    # On a one-day event the end time can't be before the start time
    CheckConstraint(
        "end_time IS NULL OR (end_date IS NOT NULL AND end_date > start_date) "
        "OR end_time >= start_time",
        name="end_time_after_start",
    ),
)


class Event(BaseMixin, Base):
    """Something happening on a date or date range. All-day when it has no start time.

    With an rrule it repeats from start_date until repeat_ends_on (if set). Occurrences
    are calculated when a range is viewed; changes to single ones live in exceptions.
    Times are floating local times; end_date is the last day (inclusive).
    """

    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
        CheckConstraint("location IS NULL OR length(location) <= 300", name="location_length"),
        CheckConstraint(
            "repeat_ends_on IS NULL OR rrule IS NOT NULL", name="repeat_end_needs_rule"
        ),
        CheckConstraint(
            "repeat_ends_on IS NULL OR repeat_ends_on >= start_date", name="repeat_end_after_start"
        ),
        *TIME_CHECKS,
        *project_owner_keys(),
        Index("idx_events_life_area", "life_area_id"),
        Index("idx_events_project", "project_id", "life_area_id"),
        Index("idx_events_start_date", "start_date"),
        AUTOINCREMENT,
    )

    life_area_id: Mapped[int] = mapped_column(ForeignKey("life_areas.id"))
    project_id: Mapped[int | None]
    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    location: Mapped[str | None] = mapped_column(Text)
    rrule: Mapped[str | None] = mapped_column(Text)
    repeat_ends_on: Mapped[date | None] = mapped_column(Date)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)

    exceptions: Mapped[list[EventException]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def is_repeating(self) -> bool:
        return self.rrule is not None


class EventException(BaseMixin, Base):
    """A change to, or cancellation of, one occurrence of a repeating event.

    Keyed by the date the occurrence would normally fall on (iCalendar's RECURRENCE-ID).
    Each non-NULL column replaces the series' value for that occurrence.
    """

    __tablename__ = "event_exceptions"
    __table_args__ = (
        CheckConstraint("is_cancelled IN (0, 1)", name="is_cancelled_values"),
        CheckConstraint("title IS NULL OR length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
        CheckConstraint("location IS NULL OR length(location) <= 300", name="location_length"),
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="ends_after_start",
        ),
        Index("uq_event_exceptions_occurrence", "event_id", "occurrence_date", unique=True),
        AUTOINCREMENT,
    )

    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    occurrence_date: Mapped[date] = mapped_column(Date)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    title: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    location: Mapped[str | None] = mapped_column(Text)

    OVERRIDES = ("title", "notes", "start_date", "end_date", "start_time", "end_time", "location")

    @property
    def has_changes(self) -> bool:
        return any(getattr(self, field) is not None for field in self.OVERRIDES)
