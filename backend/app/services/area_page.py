"""One life area's page over a calendar period: its metrics, timeline, projects, routine
steps, task lists and agenda. Derived on read; nothing is stored."""

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app import clock
from app.models import (
    Event,
    LifeArea,
    Metric,
    Project,
    Routine,
    RoutineStep,
    Task,
    TaskTemplate,
)
from app.services.events import Occurrence, OccurrenceFilters, list_occurrences
from app.services.life_areas import get_life_area
from app.services.overview import (
    DateRange,
    Outcome,
    area_metrics,
    local_date,
    outcome_for,
    period_range,
)
from app.services.projects import progress_of
from app.services.routines import due_days

# Needs attention: a task rolled over this many times, or a project due within this many days.
ROLLOVERS_TO_FLAG = 3
PROJECT_DUE_SOON_DAYS = 14
COMPLETED_LIMIT = 100


@dataclass(frozen=True)
class ProjectItem:
    project: Project
    start: date
    done: int
    total: int
    completed_on: date | None


@dataclass(frozen=True)
class StepRow:
    step: RoutineStep
    days: list[str]  # one status per day of the view


@dataclass(frozen=True)
class RoutineGroup:
    routine: Routine
    rrule: str
    total_steps: int
    steps: list[StepRow]


@dataclass(frozen=True)
class Deadline:
    metric: Metric
    day: date
    target_value: float


@dataclass(frozen=True)
class Contents:
    """What the area holds: the counts an archive would affect, and whether anything at all
    still belongs to it (deleting is only allowed when nothing does)."""

    active_projects: int
    open_tasks: int
    upcoming_events: int
    metrics: int
    routine_steps: int
    has_items: bool


@dataclass
class AreaPage:
    life_area: LifeArea
    period: str
    range: DateRange
    today: date
    contents: Contents
    metrics: list[Outcome] = field(default_factory=list)
    projects: list[ProjectItem] = field(default_factory=list)
    events: list[Occurrence] = field(default_factory=list)
    routines: list[RoutineGroup] = field(default_factory=list)
    overdue_tasks: Sequence[Task] = field(default_factory=list)
    rolled_over_tasks: Sequence[Task] = field(default_factory=list)
    unscheduled_tasks: Sequence[Task] = field(default_factory=list)
    recurring: Sequence[TaskTemplate] = field(default_factory=list)
    completed_tasks: Sequence[Task] = field(default_factory=list)
    agenda_tasks: Sequence[Task] = field(default_factory=list)
    agenda_range: DateRange | None = None
    deadlines: list[Deadline] = field(default_factory=list)


def get_area_page(session: Session, life_area_id: int, period: str, day: date) -> AreaPage:
    area = get_life_area(session, life_area_id)
    view = period_range(period, day)
    today = clock.today()
    page = AreaPage(area, period, view, today, contents(session, area.id, today))

    metrics = area_metrics(session, [area.id])
    page.metrics = [outcome_for(metric, period, view, today) for metric in metrics]
    page.projects = _projects(session, area.id, view)
    page.events = list_occurrences(
        session, view.start, view.end, OccurrenceFilters(life_area_id=area.id)
    )
    page.routines = _routines(session, area.id, view, today)

    open_tasks = select(Task).where(
        Task.life_area_id == area.id, Task.status == "todo", Task.archived_at.is_(None)
    )
    page.overdue_tasks = session.scalars(
        open_tasks.where(Task.due_date < today).order_by(Task.due_date, Task.id)
    ).all()
    page.rolled_over_tasks = session.scalars(
        open_tasks.where(
            Task.rollover_count >= ROLLOVERS_TO_FLAG,
            or_(Task.due_date.is_(None), Task.due_date >= today),
        ).order_by(Task.rollover_count.desc(), Task.id)
    ).all()
    page.unscheduled_tasks = session.scalars(
        open_tasks.where(Task.scheduled_date.is_(None)).order_by(Task.sort_order, Task.id)
    ).all()
    page.recurring = session.scalars(
        select(TaskTemplate)
        .where(
            TaskTemplate.life_area_id == area.id,
            TaskTemplate.rrule.is_not(None),
            TaskTemplate.archived_at.is_(None),
        )
        .order_by(TaskTemplate.title, TaskTemplate.id)
    ).all()
    page.completed_tasks = _completed(session, area.id, view)

    # The agenda runs from today (or the period's start, if later) to the period's end.
    first = max(today, view.start)
    if first <= view.end:
        page.agenda_range = DateRange(first, view.end)
        page.agenda_tasks = session.scalars(
            open_tasks.where(
                or_(
                    Task.scheduled_date.between(first, view.end),
                    Task.due_date.between(first, view.end),
                )
            ).order_by(Task.sort_order, Task.id)
        ).all()
        page.deadlines = [
            Deadline(outcome.metric, outcome.target.end_date, outcome.target.target_value)
            for outcome in page.metrics
            if outcome.target is not None
            and outcome.target.kind == "reach_by"
            and outcome.target.end_date is not None
            and first <= outcome.target.end_date <= view.end
            and outcome.status != "met"
        ]
    return page


def contents(session: Session, life_area_id: int, today: date) -> Contents:
    def count(query: Select[int]) -> int:
        return session.scalar(select(func.count()).select_from(query.subquery())) or 0

    of_area = {
        "projects": select(Project.id).where(Project.life_area_id == life_area_id),
        "tasks": select(Task.id).where(Task.life_area_id == life_area_id),
        "templates": select(TaskTemplate.id).where(TaskTemplate.life_area_id == life_area_id),
        "events": select(Event.id).where(Event.life_area_id == life_area_id),
        "metrics": select(Metric.id).where(Metric.life_area_id == life_area_id),
        "steps": select(RoutineStep.id).where(RoutineStep.life_area_id == life_area_id),
    }
    upcoming = list_occurrences(
        session, today, today + timedelta(days=365), OccurrenceFilters(life_area_id=life_area_id)
    )
    return Contents(
        active_projects=count(
            of_area["projects"].where(Project.status == "active", Project.archived_at.is_(None))
        ),
        open_tasks=count(of_area["tasks"].where(Task.status == "todo", Task.archived_at.is_(None))),
        upcoming_events=len({occurrence.event.id for occurrence in upcoming}),
        metrics=count(of_area["metrics"].where(Metric.archived_at.is_(None))),
        routine_steps=count(of_area["steps"].where(RoutineStep.archived_at.is_(None))),
        has_items=any(count(query) for query in of_area.values()),
    )


def _projects(session: Session, life_area_id: int, view: DateRange) -> list[ProjectItem]:
    """Active projects, and those finished in the period."""
    projects = session.scalars(
        select(Project)
        .where(
            Project.life_area_id == life_area_id,
            Project.archived_at.is_(None),
            Project.status.in_(("active", "done")),
        )
        .order_by(Project.sort_order, Project.id)
    ).all()
    items: list[ProjectItem] = []
    for project in projects:
        completed_on = local_date(project.completed_at) if project.completed_at else None
        if project.status == "done" and (completed_on is None or completed_on not in view):
            continue
        progress = progress_of(session, project)
        start = local_date(project.created_at)
        items.append(ProjectItem(project, start, progress.done, progress.total, completed_on))
    return items


def _routines(
    session: Session, life_area_id: int, view: DateRange, today: date
) -> list[RoutineGroup]:
    """Each routine with steps in this area, and every such step's status day by day:
    done, skipped, missed, paused, todo (today), upcoming or not_due."""
    routines = session.scalars(
        select(Routine)
        .options(
            selectinload(Routine.schedules),
            selectinload(Routine.pauses),
            selectinload(Routine.steps).selectinload(RoutineStep.pauses),
            selectinload(Routine.steps).selectinload(RoutineStep.logs),
        )
        .where(Routine.archived_at.is_(None))
        .order_by(Routine.sort_order, Routine.id)
    ).all()
    days = [
        view.start + timedelta(days=offset) for offset in range((view.end - view.start).days + 1)
    ]
    groups: list[RoutineGroup] = []
    for routine in routines:
        active = [step for step in routine.steps if step.archived_at is None]
        own = [step for step in active if step.life_area_id == life_area_id]
        if not own:
            continue
        rows = []
        for step in own:
            due = set(due_days(routine, step, view.start, view.end))
            logs = {log.date: log.status for log in step.logs}
            pauses = [*routine.pauses, *step.pauses]
            statuses = []
            for day in days:
                if day in logs:
                    statuses.append(logs[day])
                elif day >= step.starts_on and any(pause.covers(day) for pause in pauses):
                    statuses.append("paused")
                elif day not in due:
                    statuses.append("not_due")
                elif day < today:
                    statuses.append("missed")
                else:
                    statuses.append("todo" if day == today else "upcoming")
            rows.append(StepRow(step, statuses))
        rrule = routine.schedules[-1].rrule if routine.schedules else "FREQ=DAILY"
        groups.append(RoutineGroup(routine, rrule, len(active), rows))
    return groups


def _completed(session: Session, life_area_id: int, view: DateRange) -> list[Task]:
    """Tasks done in the period, newest first."""
    tasks = session.scalars(
        select(Task)
        .where(
            Task.life_area_id == life_area_id,
            Task.status == "done",
            Task.archived_at.is_(None),
            # A day of margin covers any time zone; local_date does the exact cut.
            Task.completed_at >= datetime.combine(view.start - timedelta(days=1), time.min),
            Task.completed_at < datetime.combine(view.end + timedelta(days=2), time.min),
        )
        .order_by(Task.completed_at.desc(), Task.id.desc())
    ).all()
    done = [task for task in tasks if task.completed_at and local_date(task.completed_at) in view]
    return done[:COMPLETED_LIMIT]
