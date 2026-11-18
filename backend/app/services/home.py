"""Home: today, right now. What is on today, the routine steps due, the metrics to log,
what needs a push and the next 7 days' fixed-date items. Derived on read; nothing is
stored (docs/DOMAIN.md, section 8)."""

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import clock
from app.clock import local_date
from app.models import LifeArea, Metric, MetricTarget, Project, Routine, Task
from app.services import metric_targets as targets
from app.services import projects_overview, rollover, routines, templates
from app.services.events import Occurrence, OccurrenceFilters, list_occurrences
from app.services.metric_entries import entries_of
from app.services.overview import DateRange, outcome_for, target_for
from app.services.task_rules import in_inbox

# Needs a push lists projects due within this many days (overdue ones included), and
# Coming up covers this many days after today.
DUE_SOON_DAYS = 7
COMING_UP_DAYS = 7


@dataclass(frozen=True)
class Setup:
    """The first life area, routine and task by name, for the first-run message."""

    life_area: str | None
    routine: str | None
    task: str | None


@dataclass(frozen=True)
class HomeStep:
    step_day: routines.StepDay
    streak: int
    metric: Metric | None


@dataclass(frozen=True)
class HomeRoutine:
    routine: Routine
    steps: list[HomeStep]


@dataclass(frozen=True)
class LogMetric:
    """A manual metric with a per-day or per-week target and no entry today. value is the
    week's so far (per-week targets); days_met of days_counted are this week's days before
    today that met a per-day target."""

    metric: Metric
    target: MetricTarget
    value: float | None
    days_met: int
    days_counted: int


@dataclass(frozen=True)
class PushProject:
    project: Project
    reason: str  # due, stalled or no_next_step
    open: int
    days: int  # stalled: days since a task was last done


@dataclass(frozen=True)
class PushMetric:
    metric: Metric
    target: MetricTarget
    value: float | None
    ends_on: date | None  # the current target period's end, or the reach-by deadline


@dataclass(frozen=True)
class Deadline:
    metric: Metric
    target: MetricTarget


@dataclass
class Home:
    today: date
    setup: Setup
    overdue: Sequence[Task] = field(default_factory=list)
    tasks: Sequence[Task] = field(default_factory=list)
    completed: Sequence[Task] = field(default_factory=list)
    events: list[Occurrence] = field(default_factory=list)
    projects_due: list[Project] = field(default_factory=list)
    deadlines: list[Deadline] = field(default_factory=list)
    routines: list[HomeRoutine] = field(default_factory=list)
    log: list[LogMetric] = field(default_factory=list)
    inbox: int = 0
    push_projects: list[PushProject] = field(default_factory=list)
    push_metrics: list[PushMetric] = field(default_factory=list)
    coming_up: DateRange | None = None
    coming_events: list[Occurrence] = field(default_factory=list)
    coming_projects: list[Project] = field(default_factory=list)
    coming_deadlines: list[Deadline] = field(default_factory=list)


def get_home(session: Session) -> Home:
    """Rolls unfinished tasks over to today and creates today's recurring tasks first, as
    the day boards do; both are safe to repeat."""
    today = clock.today()
    rollover.roll_over(session)
    templates.generate_occurrences(session, today, today)

    home = Home(today=today, setup=_setup(session))
    open_tasks = select(Task).where(Task.status == "todo", Task.archived_at.is_(None))
    home.overdue = session.scalars(
        open_tasks.where(Task.due_date < today).order_by(Task.due_date, Task.sort_order, Task.id)
    ).all()
    home.tasks = session.scalars(
        open_tasks.where(
            Task.placement_date == today, (Task.due_date.is_(None)) | (Task.due_date >= today)
        ).order_by(Task.sort_order, Task.id)
    ).all()
    home.completed = _completed_today(session, today)
    home.inbox = (
        session.scalar(select(func.count()).select_from(open_tasks.where(in_inbox()).subquery()))
        or 0
    )

    home.coming_up = DateRange(today + timedelta(days=1), today + timedelta(days=COMING_UP_DAYS))
    home.events = list_occurrences(session, today, today, OccurrenceFilters())
    home.coming_events = list_occurrences(
        session, home.coming_up.start, home.coming_up.end, OccurrenceFilters()
    )
    projects = _active_projects(session)
    home.projects_due = [project for project in projects if project.due_date == today]
    home.coming_projects = sorted(
        (
            project
            for project in projects
            if project.due_date is not None and project.due_date in home.coming_up
        ),
        key=lambda project: (project.due_date, project.id),
    )

    metrics = _metrics(session)
    deadlines = _deadlines(metrics, DateRange(today, home.coming_up.end))
    home.deadlines = [item for item in deadlines if item.target.end_date == today]
    home.coming_deadlines = [item for item in deadlines if item.target.end_date != today]

    home.routines = _routines(session, today)
    home.log = [found for metric in metrics if (found := _to_log(metric, today))]
    logged = {item.metric.id for item in home.log}
    home.push_metrics = [
        found for metric in metrics if metric.id not in logged and (found := _behind(metric, today))
    ]
    home.push_projects = _push_projects(session, today)
    return home


def _setup(session: Session) -> Setup:
    area = session.scalars(
        select(LifeArea.title)
        .where(LifeArea.archived_at.is_(None))
        .order_by(LifeArea.sort_order, LifeArea.id)
    ).first()
    routine = session.scalars(
        select(Routine.title)
        .where(Routine.archived_at.is_(None))
        .order_by(Routine.sort_order, Routine.id)
    ).first()
    task = session.scalars(
        select(Task.title).where(Task.archived_at.is_(None)).order_by(Task.id)
    ).first()
    return Setup(area, routine, task)


def _completed_today(session: Session, today: date) -> list[Task]:
    """Tasks done today, newest first."""
    found = session.scalars(
        select(Task)
        .where(
            Task.status == "done",
            Task.archived_at.is_(None),
            # A day of margin covers any time zone; local_date does the exact cut.
            Task.completed_at >= datetime.combine(today - timedelta(days=1), time.min),
            Task.completed_at < datetime.combine(today + timedelta(days=2), time.min),
        )
        .order_by(Task.completed_at.desc(), Task.id.desc())
    ).all()
    return [task for task in found if task.completed_at and local_date(task.completed_at) == today]


def _active_projects(session: Session) -> Sequence[Project]:
    return session.scalars(
        select(Project)
        .join(LifeArea, LifeArea.id == Project.life_area_id)
        .where(
            Project.status == "active",
            Project.archived_at.is_(None),
            LifeArea.archived_at.is_(None),
        )
        .order_by(LifeArea.sort_order, Project.sort_order, Project.id)
    ).all()


def _metrics(session: Session) -> Sequence[Metric]:
    """Every metric from any owner that isn't archived, in an active area."""
    return session.scalars(
        select(Metric)
        .options(selectinload(Metric.entries), selectinload(Metric.targets))
        .join(LifeArea, LifeArea.id == Metric.life_area_id)
        .where(Metric.archived_at.is_(None), LifeArea.archived_at.is_(None))
        .order_by(LifeArea.sort_order, Metric.sort_order, Metric.id)
    ).all()


def _deadlines(metrics: Sequence[Metric], span: DateRange) -> list[Deadline]:
    """Reach-by targets due in the span and not met yet, soonest first."""
    found = [
        Deadline(metric, target)
        for metric in metrics
        for target in metric.targets
        if target.kind == "reach_by"
        and target.end_date is not None
        and target.end_date in span
        and targets.evaluate(metric, target).state != "met"
    ]
    return sorted(found, key=lambda item: (item.target.end_date, item.metric.id))


def _routines(session: Session, today: date) -> list[HomeRoutine]:
    """Each routine with steps due today, with every due step's status, streak and the
    metric it feeds."""
    due = routines.steps_for_day(session, today)
    fed: dict[int, Metric] = {}
    for metric in routines.metrics_using(session, [item.step.id for item in due]):
        if metric.archived_at is None and metric.routine_step_id is not None:
            fed.setdefault(metric.routine_step_id, metric)
    groups: dict[int, HomeRoutine] = {}
    for item in due:
        group = groups.setdefault(item.routine.id, HomeRoutine(item.routine, []))
        streak = routines.streaks(item.routine, item.step).current
        group.steps.append(HomeStep(item, streak, fed.get(item.step.id)))
    return list(groups.values())


def _current_target(metric: Metric, today: date) -> MetricTarget | None:
    return target_for(metric, DateRange(today, today))


def _to_log(metric: Metric, today: date) -> LogMetric | None:
    """A manual metric still to log today: a per-day or per-week target and no entry today."""
    if metric.source != "manual":
        return None
    target = _current_target(metric, today)
    if target is None or target.kind != "per_period" or target.period not in ("day", "week"):
        return None
    if target.start_date > today or any(entry.date == today for entry in metric.entries):
        return None
    week_start = max(targets.period_start(today, "week"), target.start_date)
    if target.period == "week":
        entries = [entry for entry in entries_of(metric) if week_start <= entry.date <= today]
        return LogMetric(metric, target, targets.combine(metric, entries), 0, 0)
    days = [week_start + timedelta(days=n) for n in range((today - week_start).days)]
    met = sum(
        targets.reaches(
            metric,
            targets.combine(metric, [entry for entry in entries_of(metric) if entry.date == day]),
            target.target_value,
        )
        for day in days
    )
    return LogMetric(metric, target, None, met, len(days))


def _behind(metric: Metric, today: date) -> PushMetric | None:
    """A metric behind its current target. Per-day targets are left out: a day can't fall
    behind before it is over, and Log today already lists them."""
    target = _current_target(metric, today)
    if target is None or target.start_date > today or target.period == "day":
        return None
    outcome = outcome_for(metric, "week", DateRange(today, today), today)
    if outcome.status != "behind":
        return None
    if target.kind == "per_period":
        assert target.period is not None
        ends_on = targets.period_end(targets.period_start(today, target.period), target.period)
        if target.end_date is not None:
            ends_on = min(ends_on, target.end_date)
    else:
        ends_on = target.end_date
    return PushMetric(metric, target, outcome.value, ends_on)


def _push_projects(session: Session, today: date) -> list[PushProject]:
    """Active projects due within 7 days (overdue ones included), soonest first, then the
    Projects overview's stalled ones and those with no next step. Each project once."""
    found = projects_overview.get_overview(session, "week", today)
    last = today + timedelta(days=DUE_SOON_DAYS)
    due = sorted(
        (
            row
            for row in found.projects
            if row.project.status == "active"
            and row.project.due_date is not None
            and row.project.due_date <= last
        ),
        key=lambda row: (row.project.due_date, row.project.id),
    )
    rows = [PushProject(row.project, "due", row.open, 0) for row in due]
    listed = {row.project.id for row in due}
    open_of = {row.project.id: row.open for row in found.projects}
    rows += [
        PushProject(item.project, "stalled", open_of.get(item.project.id, 0), item.days)
        for item in found.stalled
        if item.project.id not in listed
    ]
    rows += [
        PushProject(item.project, "no_next_step", item.open, 0)
        for item in found.no_next_step
        if item.project.id not in listed
    ]
    return rows
