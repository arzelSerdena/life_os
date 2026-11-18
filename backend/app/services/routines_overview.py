"""The Routines overview: every active routine over one calendar period. Totals across
routines, each routine's step days, the most-missed steps and Pick up. Derived on read;
nothing is stored (docs/DOMAIN.md, section 8)."""

from dataclasses import dataclass
from datetime import date, timedelta
from functools import reduce

from sqlalchemy.orm import Session

from app import clock
from app.models import Routine, RoutineStep
from app.schemas.routine import HistoryState
from app.services.overview import DateRange, period_range, previous_range
from app.services.routine_page import (
    NO_TOTALS,
    Totals,
    Tracked,
    bucket_ranges,
    days_in,
    routine_start,
    track,
)
from app.services.routines import active_routines, current_rule, paused_since

# A step's run of done days that a miss this week ended shows in Pick up from this length.
PICK_UP_RUN = 4
MOST_MISSED = 3


@dataclass(frozen=True)
class OverviewStep:
    step: RoutineStep
    days: list[tuple[date, HistoryState]]  # one per day of the period


@dataclass(frozen=True)
class OverviewRoutine:
    routine: Routine
    rrule: str
    schedule_starts_on: date  # when the schedule in force today began
    paused_since: date | None
    totals: Totals
    # Today's due steps (skipped ones left out) and how many are done.
    today_done: int
    today_due: int
    steps: list[OverviewStep]


@dataclass(frozen=True)
class LongestRun:
    length: int
    routine: Routine


@dataclass(frozen=True)
class OverviewBucket:
    start: date
    end: date
    totals: Totals
    run: int  # the longest current run across routines at the bucket's end


@dataclass(frozen=True)
class MissedStep:
    step: RoutineStep
    routine: Routine
    missed: int


@dataclass(frozen=True)
class PickUpStep:
    step: RoutineStep
    routine: Routine
    run: int  # done days in a row before the miss
    ended_on: date  # the day of the miss


@dataclass(frozen=True)
class RoutinesOverview:
    period: str
    view: DateRange
    today: date
    totals: Totals
    # None for a year, or when no routine had started by the end of the previous period.
    previous: Totals | None
    longest_run: LongestRun | None
    # The earliest routine's first day; None with no routines.
    started: date | None
    buckets: list[OverviewBucket]
    routines: list[OverviewRoutine]
    most_missed: list[MissedStep]
    pick_up: list[PickUpStep]


def get_overview(session: Session, period: str, day: date) -> RoutinesOverview:
    today = clock.today()
    view = period_range(period, day)
    routines = active_routines(session)
    started = min((routine_start(routine) for routine in routines), default=None)

    before = previous_range(period, view) if period != "year" else None
    if before is not None and (started is None or before.end < started):
        before = None
    # This week reaches back to Monday, for Pick up.
    monday = today - timedelta(days=today.weekday())
    first = min(before.start if before else view.start, view.start, monday)
    tracked = [track(routine, first, view.end) for routine in routines]

    def total(span: DateRange) -> Totals:
        return reduce(lambda a, b: a + b, (found.totals(span) for found in tracked), NO_TOTALS)

    longest = None
    for found in tracked:
        length = found.run_on(view.end).length
        if length > 0 and (longest is None or length > longest.length):
            longest = LongestRun(length, found.routine)

    buckets = []
    if started is not None:
        for span in bucket_ranges(period, view):
            if span.start > today or span.end < started:
                continue
            run = max((found.run_on(span.end).length for found in tracked), default=0)
            buckets.append(OverviewBucket(span.start, span.end, total(span), run))

    return RoutinesOverview(
        period=period,
        view=view,
        today=today,
        totals=total(view),
        previous=total(before) if before else None,
        longest_run=longest,
        started=started,
        buckets=buckets,
        routines=[_routine(found, view, today) for found in tracked],
        most_missed=_most_missed(tracked, view),
        pick_up=_pick_up(tracked, monday, today),
    )


def _routine(found: Tracked, view: DateRange, today: date) -> OverviewRoutine:
    days = days_in(view)
    on_today = [found.states[step.id].get(today) for step in found.steps]
    return OverviewRoutine(
        routine=found.routine,
        rrule=current_rule(found.routine),
        schedule_starts_on=_schedule_start(found.routine, today),
        paused_since=paused_since(found.routine),
        totals=found.totals(view),
        today_done=on_today.count("done"),
        today_due=sum(state in ("done", "todo") for state in on_today),
        steps=[
            OverviewStep(step, [(d, found.states[step.id][d]) for d in days])
            for step in found.steps
        ],
    )


def _schedule_start(routine: Routine, today: date) -> date:
    """The start of the schedule in force today (the first one, before the routine starts)."""
    started = [row for row in routine.schedules if row.starts_on <= today]
    return (started[-1] if started else routine.schedules[0]).starts_on


def _most_missed(tracked: list[Tracked], view: DateRange) -> list[MissedStep]:
    """The steps missed most often in the period, up to three, in routine and step order
    among equals."""
    found = []
    for item in tracked:
        for step in item.steps:
            missed = sum(
                1 for d in days_in(view) if d <= item.last and item.states[step.id][d] == "missed"
            )
            if missed:
                found.append(MissedStep(step, item.routine, missed))
    found.sort(key=lambda row: -row.missed)  # stable: keeps routine and step order
    return found[:MOST_MISSED]


def _pick_up(tracked: list[Tracked], monday: date, today: date) -> list[PickUpStep]:
    """Steps whose run of PICK_UP_RUN or more done days ended with a miss this week. Skipped,
    paused and not-due days don't break a run. A step shows once, for its latest such miss."""
    found = []
    for item in tracked:
        last = min(today, item.last)
        for step in item.steps:
            states = item.states[step.id]
            misses = [d for d in _days(monday, last) if d in states and states[d] == "missed"]
            for miss in reversed(misses):
                run = 0
                d = miss - timedelta(days=1)
                while d >= item.started and states.get(d) != "missed":
                    run += states.get(d) == "done"
                    d -= timedelta(days=1)
                if run >= PICK_UP_RUN:
                    found.append(PickUpStep(step, item.routine, run, miss))
                    break
    return found


def _days(first: date, last: date) -> list[date]:
    return days_in(DateRange(first, last)) if first <= last else []
