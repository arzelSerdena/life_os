"""Target state, calculated from entries and never stored.

Periods are calendar periods: a day, a Monday-to-Sunday week, or a calendar month.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from statistics import fmean

from app import clock
from app.models import Metric, MetricEntry, MetricTarget

RECENT_PERIODS = 12


@dataclass(frozen=True)
class PeriodResult:
    start: date
    end: date
    value: float | None
    status: str  # met, missed or in_progress


@dataclass(frozen=True)
class TargetState:
    """state: upcoming, in_progress, met, missed, or ended (a finished per-period target)."""

    state: str
    value: float | None
    current_period: PeriodResult | None
    recent_periods: list[PeriodResult]
    met_periods: int
    missed_periods: int


def period_start(day: date, period: str) -> date:
    if period == "week":
        return day - timedelta(days=day.weekday())
    if period == "month":
        return day.replace(day=1)
    return day


def period_end(start: date, period: str) -> date:
    if period == "week":
        return start + timedelta(days=6)
    if period == "month":
        next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        return next_month - timedelta(days=1)
    return start


def combine(metric: Metric, entries: list[MetricEntry]) -> float | None:
    """The entries combined the metric's way. None when there are none."""
    if not entries:
        return None
    if metric.aggregation == "sum":
        return sum(entry.value for entry in entries)
    if metric.aggregation == "average":
        return fmean(entry.value for entry in entries)
    return entries[-1].value  # latest: entries are in date, then logging, order


def reaches(metric: Metric, value: float | None, target: float) -> bool:
    if value is None:
        return False
    return value >= target if metric.direction == "higher" else value <= target


def evaluate(metric: Metric, target: MetricTarget) -> TargetState:
    today = clock.today()
    if target.start_date > today:
        return TargetState("upcoming", None, None, [], 0, 0)
    if target.kind == "reach_by":
        return _reach_by(metric, target, today)
    return _per_period(metric, target, today)


def _between(metric: Metric, first: date, last: date) -> list[MetricEntry]:
    return [entry for entry in metric.entries if first <= entry.date <= last]


def _reach_by(metric: Metric, target: MetricTarget, today: date) -> TargetState:
    """Met once the value counted from the start date reaches the target; missed when
    the deadline passes without it. After the deadline only entries up to it count."""
    assert target.end_date is not None
    last = min(today, target.end_date)
    value = combine(metric, _between(metric, target.start_date, last))
    if reaches(metric, value, target.target_value):
        state = "met"
    elif today > target.end_date:
        state = "missed"
    else:
        state = "in_progress"
    return TargetState(state, value, None, [], 0, 0)


def _per_period(metric: Metric, target: MetricTarget, today: date) -> TargetState:
    """Each period is met or missed once over; the current one is met or in progress."""
    assert target.period is not None
    last_day = today if target.end_date is None else min(today, target.end_date)
    results: list[PeriodResult] = []
    start = period_start(target.start_date, target.period)
    while start <= last_day:
        end = period_end(start, target.period)
        first = max(start, target.start_date)
        last = end if target.end_date is None else min(end, target.end_date)
        value = combine(metric, _between(metric, first, last))
        if reaches(metric, value, target.target_value):
            status = "met"
        elif end < today:
            status = "missed"
        else:
            status = "in_progress"
        results.append(PeriodResult(start, end, value, status))
        start = end + timedelta(days=1)

    current = results[-1] if results and results[-1].end >= today else None
    finished = [result for result in results if result is not current]
    ended = target.end_date is not None and target.end_date < today
    return TargetState(
        state="ended" if ended else (current.status if current else "in_progress"),
        value=current.value if current else None,
        current_period=current,
        recent_periods=list(reversed(finished))[:RECENT_PERIODS],
        met_periods=sum(result.status == "met" for result in finished),
        missed_periods=sum(result.status == "missed" for result in finished),
    )
