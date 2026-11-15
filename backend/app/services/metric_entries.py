"""A metric's entries: typed in (manual) or derived from a routine step's logs.

A routine-step metric stores no entries. Each of the step's due days becomes one entry,
on read: done counts, missed counts as nothing, and skipped days, paused days, days
that aren't due and today (until it's done) are left out.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from app import clock
from app.models import Metric, MetricEntry
from app.services.routines import due_days


@dataclass(frozen=True)
class DerivedEntry:
    date: date
    value: float


# Both have a date and a value, which is all a target or chart needs.
type Entry = MetricEntry | DerivedEntry


def entries_of(metric: Metric) -> Sequence[Entry]:
    """The metric's entries in date order, then logging order."""
    if metric.source == "routine_step":
        return step_entries(metric)
    return metric.entries


def step_entries(metric: Metric) -> list[DerivedEntry]:
    """One entry per due day of the metric's routine step.

    A done day is worth 1 for a sum (days done) and 100 for an average, so the average
    reads as a completion rate from 0 to 100. Once the step or its routine is archived,
    no new days are added; the earlier ones stay as history. The day it was archived is
    treated like today: it counts only if it was done.
    """
    step = metric.routine_step
    assert step is not None
    routine = step.routine
    last = clock.today()
    for archived_at in (step.archived_at, routine.archived_at):
        if archived_at is not None:
            last = min(last, clock.local_date(archived_at))

    done_value = 100.0 if metric.aggregation == "average" else 1.0
    statuses = {log.date: log.status for log in step.logs}
    entries: list[DerivedEntry] = []
    for day in due_days(routine, step, step.starts_on, last):
        status = statuses.get(day)
        if status == "done":
            entries.append(DerivedEntry(day, done_value))
        elif status is None and day < last:
            entries.append(DerivedEntry(day, 0.0))
    return entries
