from datetime import date
from typing import Annotated, Literal

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


class RoutineCreate(BaseModel):
    """A routine, due on the days its rule says from starts_on (default: today, daily)."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    notes: Notes | None = None
    rrule: str = "FREQ=DAILY"
    starts_on: date | None = None

    _rule = field_validator("rrule")(_normalize_rule)


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


class RoutineChange(BaseModel):
    """The routine after the change, and the batch to pass to undo (None if nothing changed)."""

    routine: RoutineRead
    batch_id: str | None


class RoutineStepChange(BaseModel):
    step: RoutineStepRead
    batch_id: str | None
