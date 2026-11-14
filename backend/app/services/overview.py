"""The life areas overview: compares the active areas over one calendar period.

Everything here is derived on read and never stored. Only area-owned metrics count as
outcomes; a project's metrics belong to the project's page.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import clock
from app.models import (
    LifeArea,
    Metric,
    MetricEntry,
    MetricTarget,
    Project,
    Routine,
    RoutineStep,
    Task,
)
from app.services import metric_targets as targets
from app.services.life_areas import list_life_areas
from app.services.projects import progress_of
from app.services.routines import due_days

PERIODS = ("week", "month", "quarter", "year")

# A project area within this many points of its pace counts as on pace.
ON_PACE_POINTS = 5


# ---------- Periods ----------


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date

    def __contains__(self, day: date) -> bool:
        return self.start <= day <= self.end


def period_range(period: str, day: date) -> DateRange:
    """The calendar period containing `day`. Weeks start on Monday."""
    if period == "week":
        start = day - timedelta(days=day.weekday())
        return DateRange(start, start + timedelta(days=6))
    months = {"month": 1, "quarter": 3, "year": 12}[period]
    first_month = (day.month - 1) // months * months + 1
    start = date(day.year, first_month, 1)
    return DateRange(start, _add_months(start, months) - timedelta(days=1))


def previous_range(period: str, current: DateRange) -> DateRange:
    return period_range(period, current.start - timedelta(days=1))


def buckets(period: str, view: DateRange) -> list[DateRange]:
    """The chart steps for metrics without per-period targets: days in a week, weeks in a
    month, months in a quarter or year. Steps are clipped to the view."""
    step = {"week": "day", "month": "week", "quarter": "month", "year": "month"}[period]
    found: list[DateRange] = []
    start = targets.period_start(view.start, step)
    while start <= view.end:
        end = targets.period_end(start, step)
        found.append(DateRange(max(start, view.start), min(end, view.end)))
        start = end + timedelta(days=1)
    return found


def _add_months(day: date, months: int) -> date:
    index = day.month - 1 + months
    return date(day.year + index // 12, index % 12 + 1, 1)


def local_date(moment: datetime) -> date:
    """The local calendar date of a naive UTC timestamp."""
    return moment.replace(tzinfo=UTC).astimezone().date()


# ---------- Results ----------


@dataclass(frozen=True)
class EffortArea:
    life_area_id: int
    done: int
    previous_done: int


@dataclass(frozen=True)
class ChartPoint:
    start: date
    end: date
    value: float | None
    status: str | None  # met, missed or in_progress for per-period targets
    is_current: bool


@dataclass(frozen=True)
class Outcome:
    metric: Metric
    target: MetricTarget | None
    chart: str  # per_period, reach_by or none
    points: list[ChartPoint]
    value: float | None
    previous_value: float | None
    status: str | None  # met, on_track, behind, missed, improving, worsening, steady
    met_periods: int
    finished_periods: int


@dataclass(frozen=True)
class ProjectsArea:
    life_area_id: int
    active_projects: int
    done: int
    total: int
    pace: float | None  # share of the projects' time that has passed, 0 to 1
    pace_status: str | None  # ahead, behind or on_pace


@dataclass(frozen=True)
class RoutineWeek:
    start: date
    end: date
    due: int
    done: int
    is_current: bool
    is_upcoming: bool


@dataclass(frozen=True)
class RoutinesArea:
    life_area_id: int
    steps: int
    routines: int
    due: int
    done: int
    weeks: list[RoutineWeek]


@dataclass(frozen=True)
class Win:
    kind: str  # project_finished, target_periods_met or target_reached
    life_area_id: int
    title: str
    day: date
    project_id: int | None = None
    metric_id: int | None = None
    target_value: float | None = None
    unit: str | None = None
    direction: str | None = None
    period: str | None = None
    times: int = 1


@dataclass
class Overview:
    period: str
    range: DateRange
    previous: DateRange
    today: date
    life_areas: Sequence[LifeArea]
    effort: list[EffortArea] = field(default_factory=list)
    outcomes: list[Outcome] = field(default_factory=list)
    projects: list[ProjectsArea] = field(default_factory=list)
    routines: list[RoutinesArea] = field(default_factory=list)
    wins: list[Win] = field(default_factory=list)


def get_overview(session: Session, period: str, day: date) -> Overview:
    view = period_range(period, day)
    overview = Overview(
        period=period,
        range=view,
        previous=previous_range(period, view),
        today=clock.today(),
        life_areas=list_life_areas(session),
    )
    area_ids = [area.id for area in overview.life_areas]
    overview.effort = _effort(session, area_ids, view, overview.previous)
    metrics = _area_metrics(session, area_ids)
    overview.outcomes = [_outcome(metric, period, view, overview.today) for metric in metrics]
    overview.projects = _projects(session, area_ids, overview.today)
    overview.routines = _routines(session, area_ids, view, overview.today)
    overview.wins = _wins(session, area_ids, metrics, view, overview.today)
    return overview


# ---------- Effort ----------


def _effort(
    session: Session, area_ids: list[int], view: DateRange, previous: DateRange
) -> list[EffortArea]:
    """Done tasks per area by the local date they were completed. Archived tasks and
    Inbox tasks don't count."""
    # A day of margin either side covers any time zone; local_date does the exact cut.
    first = datetime.combine(previous.start - timedelta(days=1), datetime.min.time())
    last = datetime.combine(view.end + timedelta(days=2), datetime.min.time())
    rows = session.execute(
        select(Task.life_area_id, Task.completed_at).where(
            Task.status == "done",
            Task.archived_at.is_(None),
            Task.life_area_id.in_(area_ids),
            Task.completed_at >= first,
            Task.completed_at < last,
        )
    ).all()
    done = dict.fromkeys(area_ids, 0)
    previous_done = dict.fromkeys(area_ids, 0)
    for life_area_id, completed_at in rows:
        if life_area_id is None or completed_at is None:  # excluded by the query
            continue
        day = local_date(completed_at)
        if day in view:
            done[life_area_id] += 1
        elif day in previous:
            previous_done[life_area_id] += 1
    return [EffortArea(area_id, done[area_id], previous_done[area_id]) for area_id in area_ids]


# ---------- Outcomes ----------


def _area_metrics(session: Session, area_ids: list[int]) -> Sequence[Metric]:
    return session.scalars(
        select(Metric)
        .options(selectinload(Metric.entries), selectinload(Metric.targets))
        .where(
            Metric.life_area_id.in_(area_ids),
            Metric.project_id.is_(None),
            Metric.archived_at.is_(None),
        )
        .order_by(Metric.sort_order, Metric.id)
    ).all()


def target_for(metric: Metric, view: DateRange) -> MetricTarget | None:
    """The latest target that covers part of the view."""
    covering = [
        target
        for target in metric.targets
        if target.start_date <= view.end
        and (target.end_date is None or target.end_date >= view.start)
    ]
    return max(covering, key=lambda target: target.start_date, default=None)


def _outcome(metric: Metric, period: str, view: DateRange, today: date) -> Outcome:
    target = target_for(metric, view)
    if target is not None and target.kind == "per_period":
        return _per_period_outcome(metric, target, view, today)
    if target is not None:
        return _reach_by_outcome(metric, target, period, view, today)
    return _untargeted_outcome(metric, period, view, today)


def _entries(metric: Metric, first: date, last: date) -> list[MetricEntry]:
    return [entry for entry in metric.entries if first <= entry.date <= last]


def _per_period_outcome(
    metric: Metric, target: MetricTarget, view: DateRange, today: date
) -> Outcome:
    """One point per target period in the view that has started."""
    assert target.period is not None
    points: list[ChartPoint] = []
    start = targets.period_start(max(view.start, target.start_date), target.period)
    while start <= min(view.end, today):
        end = targets.period_end(start, target.period)
        if target.end_date is not None and start > target.end_date:
            break
        first = max(start, target.start_date)
        last = end if target.end_date is None else min(end, target.end_date)
        value = targets.combine(metric, _entries(metric, first, last))
        if targets.reaches(metric, value, target.target_value) and (
            end < today or metric.direction == "higher"
        ):
            status = "met"
        elif end < today:
            status = "missed"
        else:
            status = "in_progress"
        points.append(ChartPoint(start, end, value, status, start <= today <= end))
        start = end + timedelta(days=1)

    finished = [point for point in points if not point.is_current]
    current = next((point for point in points if point.is_current), None)
    shown = current or (points[-1] if points else None)
    return Outcome(
        metric=metric,
        target=target,
        chart="per_period",
        points=points,
        value=shown.value if shown else None,
        previous_value=finished[-1].value if finished and current else None,
        status=_per_period_status(metric, target, current, finished, today),
        met_periods=sum(point.status == "met" for point in finished),
        finished_periods=len(finished),
    )


def _per_period_status(
    metric: Metric,
    target: MetricTarget,
    current: ChartPoint | None,
    finished: list[ChartPoint],
    today: date,
) -> str | None:
    if current is None:
        # A past view: how its last period went.
        if not finished:
            return None
        return "met" if finished[-1].status == "met" else "behind"
    if current.status == "met":
        return "met"
    if metric.direction == "lower":
        under = targets.reaches(metric, current.value, target.target_value)
        return "on_track" if under or current.value is None else "behind"
    if metric.aggregation == "sum":
        days = (current.end - current.start).days + 1
        elapsed = (today - current.start).days + 1
        expected = target.target_value * elapsed / days
        return "on_track" if (current.value or 0) >= expected else "behind"
    return "behind"


def _reach_by_outcome(
    metric: Metric, target: MetricTarget, period: str, view: DateRange, today: date
) -> Outcome:
    """The value counted from the target's start, at the end of each step up to today."""
    assert target.end_date is not None
    points: list[ChartPoint] = []
    for step in buckets(period, view):
        if step.start > today:
            break
        last = min(step.end, today, target.end_date)
        if last < target.start_date:
            continue
        value = targets.combine(metric, _entries(metric, target.start_date, last))
        points.append(ChartPoint(step.start, step.end, value, None, today in step))

    state = targets.evaluate(metric, target)
    return Outcome(
        metric=metric,
        target=target,
        chart="reach_by",
        points=points,
        value=points[-1].value if points else None,
        previous_value=None,
        status=_reach_by_status(metric, target, state.state, today),
        met_periods=0,
        finished_periods=0,
    )


def _reach_by_status(metric: Metric, target: MetricTarget, state: str, today: date) -> str | None:
    if state in ("met", "missed"):
        return state
    if state == "upcoming":
        return None
    assert target.end_date is not None
    entries = _entries(metric, target.start_date, today)
    value = targets.combine(metric, entries)
    if value is None:
        return "behind"
    # Progress from where the target started: zero for a sum, the first entry otherwise.
    baseline = 0.0 if metric.aggregation == "sum" else entries[0].value
    if target.target_value == baseline:
        return "on_track"
    progress = (value - baseline) / (target.target_value - baseline)
    total_days = max((target.end_date - target.start_date).days, 1)
    elapsed = (today - target.start_date).days / total_days
    return "on_track" if progress >= elapsed else "behind"


def _untargeted_outcome(metric: Metric, period: str, view: DateRange, today: date) -> Outcome:
    """The value of each step, and whether the latest is better than the one before."""
    points = [
        ChartPoint(
            step.start,
            step.end,
            targets.combine(metric, _entries(metric, step.start, min(step.end, today))),
            None,
            today in step,
        )
        for step in buckets(period, view)
        if step.start <= today
    ]
    value = points[-1].value if points else None
    previous_value = points[-2].value if len(points) > 1 else None
    if value is None or previous_value is None:
        status = None
    elif value == previous_value:
        status = "steady"
    else:
        better = value > previous_value if metric.direction == "higher" else value < previous_value
        status = "improving" if better else "worsening"
    return Outcome(
        metric=metric,
        target=None,
        chart="none",
        points=points,
        value=value,
        previous_value=previous_value,
        status=status,
        met_periods=0,
        finished_periods=0,
    )


# ---------- Projects ----------


def _projects(session: Session, area_ids: list[int], today: date) -> list[ProjectsArea]:
    """Task progress of each area's active projects, against how much of their time has
    passed. A project's time runs from its creation to its due date; projects with no due
    date count toward progress but not pace."""
    projects = session.scalars(
        select(Project).where(
            Project.life_area_id.in_(area_ids),
            Project.status == "active",
            Project.archived_at.is_(None),
        )
    ).all()
    results: list[ProjectsArea] = []
    for area_id in area_ids:
        own = [project for project in projects if project.life_area_id == area_id]
        done = total = 0
        elapsed_days = planned_days = 0
        for project in own:
            progress = progress_of(session, project)
            done += progress.done
            total += progress.total
            if project.due_date is not None:
                start = local_date(project.created_at)
                length = (project.due_date - start).days
                if length > 0:
                    planned_days += length
                    elapsed_days += min(max((today - start).days, 0), length)
        pace = elapsed_days / planned_days if planned_days else None
        results.append(
            ProjectsArea(
                life_area_id=area_id,
                active_projects=len(own),
                done=done,
                total=total,
                pace=pace,
                pace_status=_pace_status(done, total, pace),
            )
        )
    return results


def _pace_status(done: int, total: int, pace: float | None) -> str | None:
    if pace is None or total == 0:
        return None
    points = (done / total - pace) * 100
    if abs(points) < ON_PACE_POINTS:
        return "on_pace"
    return "ahead" if points > 0 else "behind"


# ---------- Routines ----------


def _routines(
    session: Session, area_ids: list[int], view: DateRange, today: date
) -> list[RoutinesArea]:
    """Each week's share of due steps done, per area. Skipped days aren't due; days after
    today aren't counted yet."""
    routines = session.scalars(
        select(Routine)
        .options(
            selectinload(Routine.schedules),
            selectinload(Routine.pauses),
            selectinload(Routine.steps).selectinload(RoutineStep.pauses),
            selectinload(Routine.steps).selectinload(RoutineStep.logs),
        )
        .where(Routine.archived_at.is_(None))
    ).all()
    weeks = _weeks(view)
    results: list[RoutinesArea] = []
    for area_id in area_ids:
        due_by_week = [0] * len(weeks)
        done_by_week = [0] * len(weeks)
        steps = 0
        routine_ids: set[int] = set()
        for routine in routines:
            for step in routine.steps:
                if step.archived_at is not None or step.life_area_id != area_id:
                    continue
                steps += 1
                routine_ids.add(routine.id)
                statuses = {log.date: log.status for log in step.logs}
                for day in due_days(routine, step, view.start, min(view.end, today)):
                    status = statuses.get(day)
                    if status == "skipped":
                        continue
                    index = next(i for i, week in enumerate(weeks) if day in week)
                    due_by_week[index] += 1
                    if status == "done":
                        done_by_week[index] += 1
        results.append(
            RoutinesArea(
                life_area_id=area_id,
                steps=steps,
                routines=len(routine_ids),
                due=sum(due_by_week),
                done=sum(done_by_week),
                weeks=[
                    RoutineWeek(
                        start=week.start,
                        end=week.end,
                        due=due_by_week[index],
                        done=done_by_week[index],
                        is_current=today in week,
                        is_upcoming=week.start > today,
                    )
                    for index, week in enumerate(weeks)
                ],
            )
        )
    return results


def _weeks(view: DateRange) -> list[DateRange]:
    """Monday-to-Sunday weeks, clipped to the view."""
    found: list[DateRange] = []
    start = view.start - timedelta(days=view.start.weekday())
    while start <= view.end:
        end = start + timedelta(days=6)
        found.append(DateRange(max(start, view.start), min(end, view.end)))
        start = end + timedelta(days=1)
    return found


# ---------- Wins ----------


def _wins(
    session: Session,
    area_ids: list[int],
    metrics: Sequence[Metric],
    view: DateRange,
    today: date,
) -> list[Win]:
    """Projects finished, per-period targets met in finished periods, and reach-by
    targets reached, in the view. Newest first."""
    wins: list[Win] = []
    finished = session.scalars(
        select(Project).where(
            Project.life_area_id.in_(area_ids),
            Project.status == "done",
            Project.archived_at.is_(None),
        )
    ).all()
    for project in finished:
        assert project.completed_at is not None
        day = local_date(project.completed_at)
        if day in view:
            wins.append(
                Win("project_finished", project.life_area_id, project.title, day, project.id)
            )

    for metric in metrics:
        for target in metric.targets:
            if target.kind == "per_period":
                win = _periods_met(metric, target, view, today)
            else:
                win = _target_reached(metric, target, view)
            if win is not None:
                wins.append(win)
    return sorted(wins, key=lambda win: win.day, reverse=True)


def _periods_met(metric: Metric, target: MetricTarget, view: DateRange, today: date) -> Win | None:
    assert target.period is not None
    met: list[date] = []
    start = targets.period_start(max(view.start, target.start_date), target.period)
    while start <= view.end:
        end = targets.period_end(start, target.period)
        if end >= today or (target.end_date is not None and start > target.end_date):
            break
        if end in view:
            first = max(start, target.start_date)
            last = end if target.end_date is None else min(end, target.end_date)
            value = targets.combine(metric, _entries(metric, first, last))
            if targets.reaches(metric, value, target.target_value):
                met.append(end)
        start = end + timedelta(days=1)
    if not met:
        return None
    return Win(
        "target_periods_met",
        metric.life_area_id,
        metric.title,
        met[-1],
        metric_id=metric.id,
        target_value=target.target_value,
        unit=metric.unit,
        direction=metric.direction,
        period=target.period,
        times=len(met),
    )


def _target_reached(metric: Metric, target: MetricTarget, view: DateRange) -> Win | None:
    """The first day the value counted from the start reached the target, by the deadline."""
    assert target.end_date is not None
    entries = _entries(metric, target.start_date, target.end_date)
    for index, entry in enumerate(entries):
        if targets.reaches(
            metric, targets.combine(metric, entries[: index + 1]), target.target_value
        ):
            if entry.date not in view:
                return None
            return Win(
                "target_reached",
                metric.life_area_id,
                metric.title,
                entry.date,
                metric_id=metric.id,
                target_value=target.target_value,
                unit=metric.unit,
                direction=metric.direction,
            )
    return None
