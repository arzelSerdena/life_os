from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.common import Notes, Title, UtcDatetime

Vision = Annotated[str, StringConstraints(max_length=2000)]
Color = Annotated[str, StringConstraints(max_length=50)]


class LifeAreaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    vision: Vision | None = None
    notes: Notes | None = None
    color: Color | None = None


class LifeAreaUpdate(BaseModel):
    """Only the fields sent are changed. Sending null clears an optional field."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    vision: Vision | None = None
    notes: Notes | None = None
    color: Color | None = None
    sort_order: Annotated[int, Field(ge=0)] | None = None

    @field_validator("title", "sort_order", mode="before")
    @classmethod
    def _reject_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("This field can't be null")
        return value


class LifeAreaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    vision: str | None
    notes: str | None
    color: str | None
    sort_order: int
    archived_at: UtcDatetime | None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class LifeAreaReorder(BaseModel):
    """The new order of the life areas. Areas not listed keep their order, after these."""

    model_config = ConfigDict(extra="forbid")

    life_area_ids: Annotated[list[int], Field(min_length=1, max_length=500)]
