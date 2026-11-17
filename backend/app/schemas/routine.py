from datetime import date
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app import rrules
from app.schemas.common import Notes, Title, UtcDatetime

LogStatus = Literal["done", "skipped"]
DayStatus = Literal["todo", "done", "skipped", "missed"]
ScheduleScope = Literal["following", "all"]


def _normalize_rule(value: str) -> str:
    return rrules.normalize(value)


def _reject_null(value: object) -> object:
    if value is None:
        raise ValueError("This field can't be null")
    return value


class ScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rrule: str
    starts_on: date


class RoutineStepRead(BaseModel):
    id: int
    routine_id: int
    life_area_id: int
    project_id: int | None
    title: str
    notes: str | None
    starts_on: date
    sort_order: int
    is_paused: bool
    current_streak: int
    best_streak: int
    archived_at: UtcDatetime | None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class RoutineRead(BaseModel):
    id: int
    title: str
    notes: str | None
    sort_order: int
    is_paused: bool
    archived_at: UtcDatetime | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    schedules: list[ScheduleRead]
    steps: list[RoutineStepRead]


class NewRoutineStep(BaseModel):
    """A step created with its routine: owned by a life area or a project, due from the
    routine's start."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    life_area_id: int | None = None
    project_id: int | None = None


class RoutineCreate(BaseModel):
    """A routine, due on the days its rule says from starts_on (default: today, daily),
    with its first steps in order."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    notes: Notes | None = None
    rrule: str = "FREQ=DAILY"
    starts_on: date | None = None
    steps: Annotated[list[NewRoutineStep], Field(max_length=100)] = []

    _rule = field_validator("rrule")(_normalize_rule)


class RoutineReorder(BaseModel):
    """The new order of the routines. Routines not listed keep their order, after these."""

    model_config = ConfigDict(extra="forbid")

    routine_ids: Annotated[list[int], Field(min_length=1, max_length=500)]


class RoutineUpdate(BaseModel):
    """Only the fields sent are changed. The schedule has its own endpoint."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    notes: Notes | None = None
    sort_order: Annotated[int, Field(ge=0)] | None = None

    _no_nulls = field_validator("title", "sort_order", mode="before")(_reject_null)


class ScheduleChange(BaseModel):
    """Change which days the routine is due.

    "following" uses the new rule from starts_on (default: today) and keeps the past.
    "all" replaces the whole schedule; starts_on then moves the routine's start."""

    model_config = ConfigDict(extra="forbid")

    scope: ScheduleScope
    rrule: str
    starts_on: date | None = None

    _rule = field_validator("rrule")(_normalize_rule)


class RoutineStepCreate(BaseModel):
    """A step owned by a life area or a project. Due from starts_on (default: today)."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    notes: Notes | None = None
    life_area_id: int | None = None
    project_id: int | None = None
    starts_on: date | None = None


class RoutineStepUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    notes: Notes | None = None
    sort_order: Annotated[int, Field(ge=0)] | None = None
    starts_on: date | None = None

    _no_nulls = field_validator("title", "sort_order", "starts_on", mode="before")(_reject_null)


class RoutineStepMove(BaseModel):
    """The step's new owner: a project, or a life area. Steps can't be in the Inbox."""

    model_config = ConfigDict(extra="forbid")

    life_area_id: int | None = None
    project_id: int | None = None


class RoutineLogSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: LogStatus


class RoutineStepDay(BaseModel):
    """A step due on a given day, and how it went."""

    step_id: int
    routine_id: int
    routine_title: str
    title: str
    life_area_id: int
    project_id: int | None
    day: date
    status: DayStatus

    @classmethod
    def from_step_day(cls, found: Any) -> Self:
        """From a routines service StepDay."""
        return cls(
            step_id=found.step.id,
            routine_id=found.routine.id,
            routine_title=found.routine.title,
            title=found.step.title,
            life_area_id=found.step.life_area_id,
            project_id=found.step.project_id,
            day=found.day,
            status=found.status,
        )


class RoutineStepDayChange(BaseModel):
    """The step's day after checking it, and the batch to pass to undo (None if unchanged)."""

    step_day: RoutineStepDay
    batch_id: str | None


class RoutineDayChange(BaseModel):
    """Every step due that day after skipping it, and the batch to pass to undo."""

    steps: list[RoutineStepDay]
    batch_id: str | None


class RoutineChange(BaseModel):
    """The routine after the change, and the batch to pass to undo (None if nothing changed)."""

    routine: RoutineRead
    batch_id: str | None


class RoutineStepChange(BaseModel):
    step: RoutineStepRead
    batch_id: str | None


class MetricRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str


HistoryState = Literal["done", "skipped", "missed", "todo", "upcoming", "paused", "not_due", "none"]


class StepDayState(BaseModel):
    """How one day went for a step. todo is today still open; upcoming is a later due day;
    not_due is a day the schedule leaves out; none is a day before the step started."""

    day: date
    state: HistoryState


class StepHistoryRead(BaseModel):
    id: int
    title: str
    life_area_id: int
    project_id: int | None
    # The first due day from today on (today when it is due); None while paused.
    next_due: date | None
    paused_since: date | None
    days: list[StepDayState]


class RoutineHistoryRead(BaseModel):
    id: int
    title: str
    # The schedule in force today.
    rrule: str
    paused_since: date | None
    steps: list[StepHistoryRead]


class RoutinesHistoryRead(BaseModel):
    """Every active routine and how its active steps went on each day from start to end."""

    start: date
    end: date
    today: date
    routines: list[RoutineHistoryRead]


class PauseRead(BaseModel):
    """A paused stretch: from starts_on up to, not including, ends_on (None: still paused)."""

    model_config = ConfigDict(from_attributes=True)

    starts_on: date
    ends_on: date | None


class RoutineTotalsRead(BaseModel):
    """Counts over a stretch of days up to today. completion_rate is done ÷ (done + missed)
    as a whole percent, None when neither happened. due_days are days with a step done,
    missed or still to do; full_days those on which every due step was done."""

    done: int
    missed: int
    skipped: int
    due_days: int
    full_days: int
    completion_rate: int | None


class RunRead(BaseModel):
    """Full days in a row, with the first and last of them (None while the run is 0)."""

    length: int
    start: date | None
    end: date | None


class RoutineBucketRead(BaseModel):
    """One point of the tiles' lines: a day (week), a week (month, quarter) or a month (year),
    with the current run at its end."""

    start: date
    end: date
    totals: RoutineTotalsRead
    run: int


class RoutinePageStepRead(BaseModel):
    step: RoutineStepRead
    metric: MetricRef | None
    next_due: date | None
    paused_since: date | None
    days: list[StepDayState]
    # Done and missed days in the period, up to today.
    done: int
    missed: int


class RoutinePageRead(BaseModel):
    """One routine over a calendar period (docs/DOMAIN.md, section 8)."""

    routine: RoutineRead
    rrule: str
    paused_since: date | None
    pauses: list[PauseRead]
    period: str
    start: date
    end: date
    today: date
    totals: RoutineTotalsRead
    previous: RoutineTotalsRead | None
    current_run: RunRead
    best_run: RunRead
    buckets: list[RoutineBucketRead]
    steps: list[RoutinePageStepRead]
