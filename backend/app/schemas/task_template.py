from datetime import date, time
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app import rrules
from app.schemas.common import Notes, Title, UtcDatetime
from app.schemas.task import Priority

RepeatFrom = Literal["schedule", "completion"]
SeriesScope = Literal["following", "all"]
DueOffset = Annotated[int, Field(ge=0, le=3650)]
Checklist = Annotated[list[Title], Field(max_length=100)]


def _normalize_rule(value: str | None) -> str | None:
    return None if value is None else rrules.normalize(value)


def _reject_null(value: object) -> object:
    if value is None:
        raise ValueError("This field can't be null")
    return value


class TemplateSubtaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    sort_order: int


class TaskTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    life_area_id: int | None
    project_id: int | None
    section_id: int | None
    title: str
    notes: str | None
    priority: Priority
    due_offset_days: int | None
    due_time: time | None
    rrule: str | None
    repeat_from: RepeatFrom
    starts_on: date | None
    ends_on: date | None
    paused_at: UtcDatetime | None
    archived_at: UtcDatetime | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    subtasks: list[TemplateSubtaskRead]


class TaskTemplateCreate(BaseModel):
    """A template. Add rrule and starts_on to make it a recurring task.

    rrule is an iCalendar RRULE without DTSTART, UNTIL or COUNT, such as
    "FREQ=WEEKLY;BYDAY=MO". The series ends on ends_on, if set.
    """

    model_config = ConfigDict(extra="forbid")

    title: Title
    notes: Notes | None = None
    priority: Priority = "none"
    due_offset_days: DueOffset | None = None
    due_time: time | None = None
    rrule: str | None = None
    repeat_from: RepeatFrom = "schedule"
    starts_on: date | None = None
    ends_on: date | None = None
    life_area_id: int | None = None
    project_id: int | None = None
    section_id: int | None = None
    subtasks: Checklist = []

    _rule = field_validator("rrule")(_normalize_rule)


class TaskTemplateUpdate(BaseModel):
    """Only the fields sent are changed. Tasks already created don't change; to update a
    recurring task's occurrences too, edit the series from one of them.

    Setting rrule to null turns a recurring task into a plain template."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    notes: Notes | None = None
    priority: Priority | None = None
    due_offset_days: DueOffset | None = None
    due_time: time | None = None
    rrule: str | None = None
    repeat_from: RepeatFrom | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    subtasks: Checklist | None = None

    _rule = field_validator("rrule")(_normalize_rule)
    _no_nulls = field_validator("title", "priority", "repeat_from", "subtasks", mode="before")(
        _reject_null
    )


class TaskFromTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scheduled_date: date | None = None


class SeriesEdit(BaseModel):
    """Change a recurring task from one occurrence: "following" (this and following) or
    "all". Unfinished occurrences in range get the changed title, notes, priority and due
    date; checklist changes apply to occurrences created from now on."""

    model_config = ConfigDict(extra="forbid")

    scope: SeriesScope
    title: Title | None = None
    notes: Notes | None = None
    priority: Priority | None = None
    due_offset_days: DueOffset | None = None
    due_time: time | None = None
    rrule: str | None = None
    subtasks: Checklist | None = None

    _rule = field_validator("rrule")(_normalize_rule)
    _no_nulls = field_validator("title", "priority", "rrule", "subtasks", mode="before")(
        _reject_null
    )


class SeriesCancel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: SeriesScope


class SeriesCancelResult(BaseModel):
    """The recurring task after the change, and the batch to pass to undo."""

    template: TaskTemplateRead
    batch_id: str | None
