from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import Notes, Title, UtcDatetime

ProjectStatus = Literal["active", "done", "cancelled"]


def _reject_null(value: object) -> object:
    if value is None:
        raise ValueError("This field can't be null")
    return value


class SectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    sort_order: int


class ProjectProgress(BaseModel):
    """Done one-off tasks out of those not cancelled or archived. Calculated, never stored."""

    done: int
    total: int


class ProjectRead(BaseModel):
    id: int
    life_area_id: int
    title: str
    notes: str | None
    due_date: date | None
    status: ProjectStatus
    completed_at: UtcDatetime | None
    cancelled_at: UtcDatetime | None
    archived_at: UtcDatetime | None
    sort_order: int
    created_at: UtcDatetime
    updated_at: UtcDatetime
    sections: list[SectionRead]
    progress: ProjectProgress


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    life_area_id: int
    title: Title
    notes: Notes | None = None
    due_date: date | None = None


class ProjectUpdate(BaseModel):
    """Only the fields sent are changed. Moving and status changes have their own endpoints."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    notes: Notes | None = None
    due_date: date | None = None
    sort_order: Annotated[int, Field(ge=0)] | None = None

    _no_nulls = field_validator("title", "sort_order", mode="before")(_reject_null)


class ProjectMove(BaseModel):
    """Move the project to another life area. Everything in it moves too."""

    model_config = ConfigDict(extra="forbid")

    life_area_id: int


class ProjectChange(BaseModel):
    project: ProjectRead
    batch_id: str | None


class SectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title


class SectionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    sort_order: Annotated[int, Field(ge=0)] | None = None

    _no_nulls = field_validator("title", "sort_order", mode="before")(_reject_null)
