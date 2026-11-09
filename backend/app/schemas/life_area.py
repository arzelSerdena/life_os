from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.common import Notes, Title, UtcDatetime

Vision = Annotated[str, StringConstraints(max_length=2000)]
ShortLabel = Annotated[str, StringConstraints(max_length=50)]


class LifeAreaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    vision: Vision | None = None
    notes: Notes | None = None
    color: ShortLabel | None = None
    icon: ShortLabel | None = None


class LifeAreaUpdate(BaseModel):
    """Only the fields sent are changed. Sending null clears an optional field."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    vision: Vision | None = None
    notes: Notes | None = None
    color: ShortLabel | None = None
    icon: ShortLabel | None = None
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
    icon: str | None
    sort_order: int
    archived_at: UtcDatetime | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
