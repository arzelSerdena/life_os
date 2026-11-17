"""One routine's page over a calendar period: totals, runs, each step's days, schedules and
pauses. Derived on read; nothing is stored (docs/DOMAIN.md, section 8)."""

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app import clock
from app.models import Metric, Routine, RoutineStep
from app.schemas.routine import HistoryState
from app.services import metric_targets as targets
from app.services.overview import DateRange, period_range, previous_range
from app.services.routines import (
    current_rule,
    get_routine,
    metrics_using,
    next_due,
    paused_since,
    step_states,
)

# States of a day a step was due on and that has come (upcoming days haven't).
_COUNTED: frozenset[HistoryState] = frozenset({"done", "skipped", "missed", "todo"})


@dataclass(frozen=True)
class Totals:
    done: int
    missed: int
    skipped: int
    # Days with a step done, missed or still to do (today), and those with every one done.
    due_days: int
    full_days: int

    @property
    def completion_rate(self) -> int | None:
        """Done out of done and missed, as a whole percent; None when neither happened."""
        counted = self.done + self.missed
        return round(100 * self.done / counted) if counted else None


@dataclass(frozen=True)
class Run:
    length: int
    start: date | None
    end: date | None


NO_RUN = Run(0, None, None)


@dataclass(frozen=True)
class Bucket:
    """One point of a tile's line: a day of a week, a week of a month or quarter, a month
    of a year."""

    start: date
    end: date
    totals: Totals
    run: int  # the current run at the bucket's end (or today, for the bucket holding it)


@dataclass(frozen=True)
class StepRow:
    step: RoutineStep
    metric: Metric | None
    next_due: date | None
    paused_since: date | None
    days: list[tuple[date, HistoryState]]  # one per day of the period
    done: int
    missed: int


@dataclass(frozen=True)
class RoutinePage:
    routine: Routine
    rrule: str
    paused_since: date | None
    period: str
    view: DateRange
    today: date
    totals: Totals
    # None when the routine hadn't started by the end of the previous period (or for a year).
    previous: Totals | None
    current_run: Run
    best_run: Run  # the longest run reached in the period
    buckets: list[Bucket]
    steps: list[StepRow]


def get_routine_page(session: Session, routine_id: int, period: str, day: date) -> RoutinePage:
    routine = get_routine(session, routine_id)
    today = clock.today()
    view = period_range(period, day)
    steps = [step for step in routine.steps if step.archived_at is None]
    # An archived routine stops on its archive day: its current run is its final run.
    last = today
    if routine.archived_at is not None:
        last = min(today, clock.local_date(routine.archived_at))
    started = min([routine.schedules[0].starts_on, *(step.starts_on for step in steps)])

    # The previous period, for the comparisons; none for a year, or before the start.
    before = previous_range(period, view) if period != "year" else None
    if before is not None and before.end < started:
        before = None

    # Each step's state on every day from the routine's start (or the earliest day shown,
    # if earlier) to the later of the view's end and the last counted day: runs reach back
    # to the start.
    first = min(started, before.start if before else view.start, view.start)
    end = max(view.end, last)
    states = {step.id: dict(step_states(routine, step, first, end)) for step in steps}
    verdicts = _verdicts(steps, states, started, last)
    runs = _runs(verdicts)

    def totals(span: DateRange) -> Totals:
        return _totals(steps, states, verdicts, span, last)

    previous = totals(before) if before else None

    used = metrics_using(session, [step.id for step in steps])
    feeding = {metric.routine_step_id: metric for metric in used}
    rows = []
    for step in steps:
        days: list[tuple[date, HistoryState]] = [(d, states[step.id][d]) for d in _days(view)]
        rows.append(
            StepRow(
                step=step,
                metric=feeding.get(step.id),
                next_due=next_due(routine, step),
                paused_since=paused_since(step),
                days=days,
                done=sum(1 for d, state in days if state == "done" and d <= last),
                missed=sum(1 for d, state in days if state == "missed" and d <= last),
            )
        )

    return RoutinePage(
        routine=routine,
        rrule=current_rule(routine),
        paused_since=paused_since(routine),
        period=period,
        view=view,
        today=today,
        totals=totals(view),
        previous=previous,
        current_run=runs.get(last, NO_RUN),
        best_run=_best(runs, view),
        buckets=[
            Bucket(span.start, span.end, totals(span), runs.get(min(span.end, last), NO_RUN).length)
            for span in _buckets(period, view)
            if span.start <= last and span.end >= started
        ],
        steps=rows,
    )


def _days(span: DateRange) -> list[date]:
    count = (span.end - span.start).days + 1
    return [span.start + timedelta(days=offset) for offset in range(count)]


def _verdicts(
    steps: list[RoutineStep],
    states: dict[int, dict[date, HistoryState]],
    started: date,
    last: date,
) -> dict[date, bool | None]:
    """Each day from the start to the last counted day: True for a full day (every due step
    done), False for a day with a missed step, None for a neutral day. Skipped steps are
    left out, so a day with every step skipped is neutral, and so are paused days, days
    nothing was due and today while a step is still to do. Today counts once it is full."""
    found: dict[date, bool | None] = {}
    day = started
    while day <= last:
        due = [states[step.id][day] for step in steps]
        due = [state for state in due if state in _COUNTED and state != "skipped"]
        if not due or "todo" in due:
            found[day] = None
        elif "missed" in due:
            found[day] = False
        else:
            found[day] = True
        day += timedelta(days=1)
    return found


def _runs(verdicts: dict[date, bool | None]) -> dict[date, Run]:
    """The current run as of each day: full days in a row, kept through neutral days."""
    found: dict[date, Run] = {}
    run = NO_RUN
    for day in sorted(verdicts):
        verdict = verdicts[day]
        if verdict is False:
            run = NO_RUN
        elif verdict:
            run = Run(run.length + 1, run.start or day, day)
        found[day] = run
    return found


def _best(runs: dict[date, Run], view: DateRange) -> Run:
    best = NO_RUN
    for day, run in runs.items():
        if day in view and run.length > best.length:
            best = run
    return best


def _totals(
    steps: list[RoutineStep],
    states: dict[int, dict[date, HistoryState]],
    verdicts: dict[date, bool | None],
    span: DateRange,
    last: date,
) -> Totals:
    done = missed = skipped = due_days = full_days = 0
    for day in _days(span):
        if day > last:
            break
        day_states = [states[step.id][day] for step in steps]
        done += day_states.count("done")
        missed += day_states.count("missed")
        skipped += day_states.count("skipped")
        if any(state in ("done", "missed", "todo") for state in day_states):
            due_days += 1
        full_days += verdicts.get(day) is True
    return Totals(done, missed, skipped, due_days, full_days)


def _buckets(period: str, view: DateRange) -> list[DateRange]:
    """Days in a week, Monday-to-Sunday weeks in a month or quarter (clipped to it), months
    in a year."""
    if period == "week":
        return [DateRange(day, day) for day in _days(view)]
    step = "month" if period == "year" else "week"
    found: list[DateRange] = []
    start = targets.period_start(view.start, step)
    while start <= view.end:
        end = targets.period_end(start, step)
        found.append(DateRange(max(start, view.start), min(end, view.end)))
        start = end + timedelta(days=1)
    return found
