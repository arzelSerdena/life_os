from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AUTOINCREMENT, Base, BaseMixin
from app.models.ownership import project_owner_keys
from app.models.routine import RoutineStep

# What unit means depends on format: a free-text suffix for a number ("km"), an ISO 4217
# code for currency, and nothing for percent or duration (stored in minutes).
UNIT_FOR_FORMAT = (
    "(format = 'number' AND (unit IS NULL OR length(unit) BETWEEN 1 AND 20))"
    " OR (format = 'currency' AND unit IS NOT NULL AND unit GLOB '[A-Z][A-Z][A-Z]')"
    " OR (format IN ('percent', 'duration') AND unit IS NULL)"
)
# A routine-step metric counts days done (sum) or its completion rate (average).
ROUTINE_STEP_DISPLAY = (
    "source = 'manual'"
    " OR (aggregation = 'sum' AND format = 'number' AND unit = 'days')"
    " OR (aggregation = 'average' AND format = 'percent')"
)


class Metric(BaseMixin, Base):
    """Something measured over time, owned by a life area or a project.

    aggregation says how a period's entries combine ('sum' for distance, 'average' for
    sleep, 'latest' for body weight); direction says whether higher or lower is better.
    format and unit say how values are shown; the screen formats them.
    source 'manual' takes typed entries; 'routine_step' derives one entry per due day
    from the step's logs and stores none.
    """

    __tablename__ = "metrics"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
        CheckConstraint(
            "format IN ('number', 'currency', 'percent', 'duration')", name="format_values"
        ),
        CheckConstraint(UNIT_FOR_FORMAT, name="unit_for_format"),
        CheckConstraint("aggregation IN ('sum', 'average', 'latest')", name="aggregation_values"),
        CheckConstraint("direction IN ('higher', 'lower')", name="direction_values"),
        CheckConstraint("source IN ('manual', 'routine_step')", name="source_values"),
        CheckConstraint(
            "(source = 'routine_step') = (routine_step_id IS NOT NULL)", name="step_for_source"
        ),
        CheckConstraint(ROUTINE_STEP_DISPLAY, name="routine_step_display"),
        *project_owner_keys(),
        Index("idx_metrics_life_area", "life_area_id"),
        Index("idx_metrics_project", "project_id", "life_area_id"),
        Index("idx_metrics_routine_step", "routine_step_id"),
        AUTOINCREMENT,
    )

    life_area_id: Mapped[int] = mapped_column(ForeignKey("life_areas.id"))
    project_id: Mapped[int | None]
    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    format: Mapped[str] = mapped_column(Text, default="number", server_default="number")
    unit: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text, default="manual", server_default="manual")
    # Deleting a step is refused while a metric uses it.
    routine_step_id: Mapped[int | None] = mapped_column(ForeignKey("routine_steps.id"))
    aggregation: Mapped[str] = mapped_column(Text)
    direction: Mapped[str] = mapped_column(Text, default="higher", server_default="higher")
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)

    routine_step: Mapped[RoutineStep | None] = relationship()
    entries: Mapped[list[MetricEntry]] = relationship(
        order_by="(MetricEntry.date, MetricEntry.id)",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    targets: Mapped[list[MetricTarget]] = relationship(
        order_by="(MetricTarget.start_date, MetricTarget.id)",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class MetricEntry(BaseMixin, Base):
    """One logged value. Several per day are allowed."""

    __tablename__ = "metric_entries"
    __table_args__ = (
        CheckConstraint("note IS NULL OR length(note) <= 500", name="note_length"),
        Index("idx_metric_entries_metric_date", "metric_id", "date"),
        AUTOINCREMENT,
    )

    metric_id: Mapped[int] = mapped_column(ForeignKey("metrics.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    value: Mapped[float] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)


class MetricTarget(BaseMixin, Base):
    """What a metric aims for.

    'reach_by': reach target_value by end_date ("70 kg by June 1").
    'per_period': reach target_value every day, week or month ("20 km per week");
    end_date NULL means ongoing. Met or missed is calculated, never stored.
    """

    __tablename__ = "metric_targets"
    __table_args__ = (
        CheckConstraint("kind IN ('reach_by', 'per_period')", name="kind_values"),
        CheckConstraint("period IN ('day', 'week', 'month')", name="period_values"),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="ends_after_start"),
        CheckConstraint("(kind = 'per_period') = (period IS NOT NULL)", name="period_for_kind"),
        CheckConstraint("kind <> 'reach_by' OR end_date IS NOT NULL", name="deadline_for_kind"),
        Index("idx_metric_targets_metric", "metric_id"),
        AUTOINCREMENT,
    )

    metric_id: Mapped[int] = mapped_column(ForeignKey("metrics.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(Text)
    target_value: Mapped[float] = mapped_column(Float)
    period: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
