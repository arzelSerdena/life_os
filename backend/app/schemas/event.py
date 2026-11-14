from datetime import date, time
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from app import rrules
from app.schemas.common import Notes, Title, UtcDatetime

Location = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
OccurrenceScope = Literal["this", "following", "all"]


def _normalize_rule(value: str | None) -> str | None:
    return None if value is None else rrules.normalize(value)


def _reject_null(value: object) -> object:
    if value is None:
        raise ValueError("This field can't be null")
    return value


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    life_area_id: int
    project_id: int | None
    title: str
    notes: str | None
    start_date: date
    end_date: date | None
    start_time: time | None
    end_time: time | None
    location: str | None
    rrule: str | None
    repeat_ends_on: date | None
    cancelled_at: UtcDatetime | None
    archived_at: UtcDatetime | None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class EventCreate(BaseModel):
    """An event in a life area or a project (it inherits the project's life area).

    No start_time means all-day. end_date is the last day, inclusive. Add rrule to repeat
    from start_date, until repeat_ends_on if set; the rule may not contain DTSTART, UNTIL
    or COUNT."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    notes: Notes | None = None
    start_date: date
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: Location | None = None
    rrule: str | None = None
    repeat_ends_on: date | None = None
    life_area_id: int | None = None
    project_id: int | None = None

    _rule = field_validator("rrule")(_normalize_rule)


class EventUpdate(BaseModel):
    """Only the fields sent are changed. On a repeating event this changes the whole
    series; changing its timing or rule removes one-off changes to occurrences."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    notes: Notes | None = None
    start_date: date | None = None
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: Location | None = None
    rrule: str | None = None
    repeat_ends_on: date | None = None

    _rule = field_validator("rrule")(_normalize_rule)
    _no_nulls = field_validator("title", "start_date", mode="before")(_reject_null)


class EventMove(BaseModel):
    """The event's new owner: a project, or a life area. Events can't be in the Inbox."""

    model_config = ConfigDict(extra="forbid")

    life_area_id: int | None = None
    project_id: int | None = None


class EventChange(BaseModel):
    """The event after the change, and the batch to pass to undo (None if nothing changed)."""

    event: EventRead
    batch_id: str | None


class OccurrenceRead(BaseModel):
    """One occurrence of an event, with any one-off changes applied."""

    event_id: int
    occurrence_date: date
    life_area_id: int
    project_id: int | None
    title: str
    notes: str | None
    start_date: date
    end_date: date
    start_time: time | None
    end_time: time | None
    location: str | None
    is_repeating: bool
    is_cancelled: bool
    is_changed: bool
    is_past: bool

    @classmethod
    def from_occurrence(cls, occurrence: Any) -> Self:
        """From an events service occurrence: the series' row plus any one-off changes."""
        event = occurrence.event
        return cls(
            event_id=event.id,
            occurrence_date=occurrence.occurrence_date,
            life_area_id=event.life_area_id,
            project_id=event.project_id,
            title=occurrence.title,
            notes=occurrence.notes,
            start_date=occurrence.start_date,
            end_date=occurrence.end_date,
            start_time=occurrence.start_time,
            end_time=occurrence.end_time,
            location=occurrence.location,
            is_repeating=event.is_repeating,
            is_cancelled=occurrence.is_cancelled,
            is_changed=occurrence.is_changed,
            is_past=occurrence.is_past,
        )


class OccurrenceEdit(BaseModel):
    """Change an occurrence of a repeating event.

    "this" changes only this occurrence and may move it to other dates. "following" and
    "all" change the series and can't move dates; use the event itself for that."""

    model_config = ConfigDict(extra="forbid")

    scope: OccurrenceScope
    title: Title | None = None
    notes: Notes | None = None
    start_date: date | None = None
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    location: Location | None = None
    rrule: str | None = None
    repeat_ends_on: date | None = None

    _rule = field_validator("rrule")(_normalize_rule)
    _no_nulls = field_validator("title", "rrule", mode="before")(_reject_null)


class OccurrenceCancel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: OccurrenceScope
