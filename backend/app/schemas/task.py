from datetime import date, time
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import Notes, Title, UtcDatetime

Priority = Literal["high", "medium", "low", "none"]
TaskStatus = Literal["todo", "done", "cancelled"]


def _reject_null(value: object) -> object:
    if value is None:
        raise ValueError("This field can't be null")
    return value


class SubtaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    title: str
    status: TaskStatus
    completed_at: UtcDatetime | None
    cancelled_at: UtcDatetime | None
    sort_order: int
    created_at: UtcDatetime
    updated_at: UtcDatetime


class SubtaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title


class SubtaskUpdate(BaseModel):
    """Only the fields sent are changed. Setting status also sets its timestamp."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    status: TaskStatus | None = None
    sort_order: Annotated[int, Field(ge=0)] | None = None

    _no_nulls = field_validator("title", "status", "sort_order", mode="before")(_reject_null)


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    life_area_id: int | None
    project_id: int | None
    section_id: int | None
    template_id: int | None
    occurrence_date: date | None
    title: str
    notes: str | None
    status: TaskStatus
    priority: Priority
    scheduled_date: date | None
    due_date: date | None
    due_time: time | None
    completed_at: UtcDatetime | None
    cancelled_at: UtcDatetime | None
    archived_at: UtcDatetime | None
    sort_order: int
    rollover_count: int
    created_at: UtcDatetime
    updated_at: UtcDatetime
    subtasks: list[SubtaskRead]


class TaskCreate(BaseModel):
    """Send project_id for a project's task, life_area_id for a life area's, or neither for
    the Inbox. A project's task inherits the project's life area."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    notes: Notes | None = None
    priority: Priority = "none"
    scheduled_date: date | None = None
    due_date: date | None = None
    due_time: time | None = None
    life_area_id: int | None = None
    project_id: int | None = None
    section_id: int | None = None
    subtasks: Annotated[list[Title], Field(max_length=100)] = []

    @model_validator(mode="after")
    def _due_time_needs_date(self) -> Self:
        if self.due_time is not None and self.due_date is None:
            raise ValueError("A due time needs a due date.")
        return self


class TaskUpdate(BaseModel):
    """Only the fields sent are changed. Owner and status have their own endpoints."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    notes: Notes | None = None
    priority: Priority | None = None
    scheduled_date: date | None = None
    due_date: date | None = None
    due_time: time | None = None
    sort_order: Annotated[int, Field(ge=0)] | None = None

    _no_nulls = field_validator("title", "priority", "sort_order", mode="before")(_reject_null)


class TaskMove(BaseModel):
    """The task's whole new owner: a project (and optional section), a life area, or
    nothing for the Inbox. Fields left out mean none."""

    model_config = ConfigDict(extra="forbid")

    life_area_id: int | None = None
    project_id: int | None = None
    section_id: int | None = None


class TaskChange(BaseModel):
    """The task after the change, and the batch to pass to undo (None if nothing changed)."""

    task: TaskRead
    batch_id: str | None


class UndoResult(BaseModel):
    restored_items: int
