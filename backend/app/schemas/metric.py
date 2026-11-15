import datetime as dt
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.common import Notes, Title, UtcDatetime

Aggregation = Literal["sum", "average", "latest"]
Format = Literal["number", "currency", "percent", "duration"]
Source = Literal["manual", "routine_step"]
Direction = Literal["higher", "lower"]
TargetKind = Literal["reach_by", "per_period"]
Period = Literal["day", "week", "month"]
TargetStateName = Literal["upcoming", "in_progress", "met", "missed", "ended"]
PeriodStatus = Literal["in_progress", "met", "missed"]
Unit = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
EntryNote = Annotated[str, StringConstraints(max_length=500)]
Value = Annotated[float, Field(allow_inf_nan=False)]


def _reject_null(value: object) -> object:
    if value is None:
        raise ValueError("This field can't be null")
    return value


class PeriodRead(BaseModel):
    start: dt.date
    end: dt.date
    value: float | None
    status: PeriodStatus


class TargetRead(BaseModel):
    """A target and how it's going, calculated from the entries."""

    id: int
    metric_id: int
    kind: TargetKind
    target_value: float
    period: Period | None
    start_date: dt.date
    end_date: dt.date | None
    state: TargetStateName
    value: float | None
    current_period: PeriodRead | None
    recent_periods: list[PeriodRead]
    met_periods: int
    missed_periods: int


class MetricRead(BaseModel):
    """Values are raw numbers; the screen formats them by format and unit. A duration is
    in minutes, a percent from 0 to 100, and a currency's unit is its ISO 4217 code."""

    id: int
    life_area_id: int
    project_id: int | None
    title: str
    notes: str | None
    format: Format
    unit: str | None
    source: Source
    routine_step_id: int | None
    aggregation: Aggregation
    direction: Direction
    sort_order: int
    archived_at: UtcDatetime | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    targets: list[TargetRead]


class MetricCreate(BaseModel):
    """A metric in a life area or a project (it inherits the project's life area).

    unit depends on format: an optional suffix for a number ("km"), an ISO 4217 code for
    currency (default PHP), and none for percent or duration.

    source 'routine_step' counts a routine step's days instead of typed entries: it needs
    routine_step_id and aggregation 'sum' (days done) or 'average' (completion rate), and
    its format and unit follow from that. The step's owner may differ from the metric's.

    current_value (manual only) logs the first entry, dated today.
    """

    model_config = ConfigDict(extra="forbid")

    title: Title
    notes: Notes | None = None
    format: Format = "number"
    unit: Unit | None = None
    aggregation: Aggregation
    direction: Direction = "higher"
    source: Source = "manual"
    routine_step_id: int | None = None
    current_value: Value | None = None
    life_area_id: int | None = None
    project_id: int | None = None


class MetricUpdate(BaseModel):
    """Changing format without a unit resets the unit to the new format's default.
    Stored values are never converted. The source can't change."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    notes: Notes | None = None
    format: Format | None = None
    unit: Unit | None = None
    aggregation: Aggregation | None = None
    direction: Direction | None = None
    sort_order: Annotated[int, Field(ge=0)] | None = None

    _no_nulls = field_validator(
        "title", "format", "aggregation", "direction", "sort_order", mode="before"
    )(_reject_null)


class MetricMove(BaseModel):
    """The metric's new owner: a project, or a life area."""

    model_config = ConfigDict(extra="forbid")

    life_area_id: int | None = None
    project_id: int | None = None


class MetricChange(BaseModel):
    metric: MetricRead
    batch_id: str | None


class EntryRead(BaseModel):
    """A routine-step metric's entries are derived from the step's days: they have no
    id, note or timestamps, and can't be changed."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None
    metric_id: int
    date: dt.date
    value: float
    note: str | None
    created_at: UtcDatetime | None
    updated_at: UtcDatetime | None


class MetricDeletePreview(BaseModel):
    """What deleting the metric removes with it."""

    entries: int
    targets: int


class EntryCreate(BaseModel):
    """A value for a day up to today (default: today)."""

    model_config = ConfigDict(extra="forbid")

    value: Value
    date: dt.date | None = None
    note: EntryNote | None = None


class EntryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: Value | None = None
    date: dt.date | None = None
    note: EntryNote | None = None

    _no_nulls = field_validator("value", "date", mode="before")(_reject_null)


class TargetCreate(BaseModel):
    """'reach_by' needs end_date (the deadline). 'per_period' needs period; without
    end_date it is ongoing. start_date defaults to today."""

    model_config = ConfigDict(extra="forbid")

    kind: TargetKind
    target_value: Value
    period: Period | None = None
    start_date: dt.date | None = None
    end_date: dt.date | None = None


class TargetReplace(BaseModel):
    """Change a target: the current one ends yesterday and a new one starts today, so its
    history stays. Fields left out keep the current values."""

    model_config = ConfigDict(extra="forbid")

    target_value: Value | None = None
    period: Period | None = None
    end_date: dt.date | None = None

    _no_nulls = field_validator("target_value", "period", mode="before")(_reject_null)
