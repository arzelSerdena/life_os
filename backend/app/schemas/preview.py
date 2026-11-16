"""Previews for the confirm dialog: what a cascade or a delete does to the items it reaches.

Rows are grouped by effect. Each row carries its data as fields, and the client words it,
so dates and times are formatted in one place.
"""

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.routine import MetricRef

GroupEffect = Literal["cancelled", "ends_from_today", "archived", "deleted", "kept"]

RowKind = Literal[
    "project",
    "section",
    "task",
    "subtask",
    "task_template",
    "event",
    "metric",
    "routine_step",
    # One-off changes to a repeating event's occurrences.
    "moved_occurrence",
    "skipped_occurrence",
    "changed_occurrence",
    # What a row stands for as a whole, without a name of its own.
    "history",
    "schedules",
    "pauses",
    "entries",
    "targets",
]

CountOf = Literal[
    "tasks",
    "events",
    "recurring_tasks",
    "templates",
    "routine_steps",
    "metrics",
    "entries",
    "targets",
    "logs",
    "days",
    "schedules",
    "pauses",
    "done",
    "cancelled",
]


class PreviewCount(BaseModel):
    of: CountOf
    count: int


class PreviewRow(BaseModel):
    """One item. Only the fields that apply to its kind are set."""

    kind: RowKind
    id: int | None = None
    # None for rows named by their kind (history, schedules, pauses, entries, targets).
    title: str | None = None
    # The owner's life area palette key, for the icon. None for an Inbox item.
    color: str | None = None
    # A task's placement date, an event's start (or the day a series is cut from), or the
    # original date of a changed occurrence.
    date: dt.date | None = None
    # A moved occurrence's new date.
    moved_to: dt.date | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    rrule: str | None = None
    # A repeating event: from which date it is deleted ("Every Sun · from Oct 4").
    from_date: dt.date | None = None
    # A series cut from `date`: everything from that day on goes ("Sun, Nov 15 and later").
    and_later: bool = False
    # A series that ends from today: its last occurrence before today.
    last_date: dt.date | None = None
    overdue: bool = False
    # A done or cancelled task.
    finished: bool = False
    # A routine step's routine, or, inside a routine, the step's owner.
    context: str | None = None
    counts: list[PreviewCount] = Field(default_factory=list)


class PreviewGroup(BaseModel):
    effect: GroupEffect
    rows: list[PreviewRow]


class ConfirmPreview(BaseModel):
    """What the change also does, grouped by effect, for the user to confirm. Empty groups
    are left out; no groups means nothing goes with it."""

    groups: list[PreviewGroup]


class RoutineDeletePreview(ConfirmPreview):
    """Deleting is refused while `metrics` is not empty: those metrics count a step's days."""

    metrics: list[MetricRef]


class EventDeletePreview(ConfirmPreview):
    """For a repeating event's choice: how many occurrences are past, and whether any are
    still to come."""

    past_occurrences: int
    has_upcoming: bool
