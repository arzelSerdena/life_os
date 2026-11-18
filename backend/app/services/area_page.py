"""One life area's or one project's page over a calendar period: its metrics, timeline,
projects, routine steps, task lists and agenda. Derived on read; nothing is stored."""

from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from datetime import date, datetime, time, timedelta

from sqlalchemy import ColumnElement, Select, func, or_, select
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
    pace_status,
    period_range,
)
from app.services.projects import get_project, has_items, progress_of
from app.services.routines import due_days

# Needs attention: a task rolled over this many times, or a project due within this many days.
ROLLOVERS_TO_FLAG = 3
PROJECT_DUE_SOON_DAYS = 14
COMPLETED_LIMIT = 100


@dataclass(frozen=True)
class Owner:
    """Whose page it is: a life area (with its projects' items), or one project."""

    life_area_id: int
    project_id: int | None = None

    def owns(
        self,
        model: type[Task] | type[TaskTemplate] | type[Event] | type[Metric] | type[RoutineStep],
    ) -> ColumnElement[bool]:
        if self.project_id is not None:
            return model.project_id == self.project_id
        return model.life_area_id == self.life_area_id

    def owns_step(self, step: RoutineStep) -> bool:
        if self.project_id is not None:
            return step.project_id == self.project_id
        return step.life_area_id == self.life_area_id


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


@dataclass
class ProjectPage(AreaPage):
    """A project's page: the area page's parts for the project's own items. Its one
    project item is the project itself, for the timeline."""

    project: Project | None = None
    pace: float | None = None  # share of the project's time that has passed, 0 to 1
    pace_status: str | None = None  # ahead, behind or on_pace


def get_area_page(session: Session, life_area_id: int, period: str, day: date) -> AreaPage:
    area = get_life_area(session, life_area_id)
    view = period_range(period, day)
    today = clock.today()
    page = AreaPage(area, period, view, today, contents(session, area.id, today))
    _fill(session, page, Owner(area.id), area_metrics(session, [area.id]))
    page.projects = _projects(session, area.id, view)
    return page


def get_project_page(session: Session, project_id: int, period: str, day: date) -> ProjectPage:
    project = get_project(session, project_id)
    view = period_range(period, day)
    today = clock.today()
    owner = Owner(project.life_area_id, project.id)
    page = ProjectPage(
        get_life_area(session, project.life_area_id),
        period,
        view,
        today,
        _contents(session, owner, today, has_items(session, project)),
        project=project,
    )
    metrics = session.scalars(
        select(Metric)
        .options(selectinload(Metric.entries), selectinload(Metric.targets))
        .where(Metric.project_id == project.id, Metric.archived_at.is_(None))
        .order_by(Metric.sort_order, Metric.id)
    ).all()
    _fill(session, page, owner, metrics)
    item = _project_item(session, project)
    page.projects = [item]
    page.pace = project_pace(project, item.start, today)
    page.pace_status = pace_status(item.done, item.total, page.pace)
    return page


def project_pace(project: Project, start: date, today: date) -> float | None:
    """The share of a project's time, from its start to its due date, that has passed.
    None with no due date, or a due date on its start."""
    if project.due_date is None:
        return None
    length = (project.due_date - start).days
    if length <= 0:
        return None
    return min(max((today - start).days, 0), length) / length


def _fill(session: Session, page: AreaPage, owner: Owner, metrics: Sequence[Metric]) -> None:
    """Everything but the projects: metrics, events, routines, task lists and the agenda."""
    view, today, period = page.range, page.today, page.period
    page.metrics = [outcome_for(metric, period, view, today) for metric in metrics]
    page.events = list_occurrences(
        session,
        view.start,
        view.end,
        OccurrenceFilters(life_area_id=owner.life_area_id, project_id=owner.project_id),
    )
    page.routines = _routines(session, owner, view, today)

    open_tasks = select(Task).where(
        owner.owns(Task), Task.status == "todo", Task.archived_at.is_(None)
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
        open_tasks.where(Task.placement_date.is_(None)).order_by(Task.sort_order, Task.id)
    ).all()
    page.recurring = session.scalars(
        select(TaskTemplate)
        .where(
            owner.owns(TaskTemplate),
            TaskTemplate.rrule.is_not(None),
            TaskTemplate.archived_at.is_(None),
        )
        .order_by(TaskTemplate.title, TaskTemplate.id)
    ).all()
    page.completed_tasks = _completed(session, owner, view)

    # The agenda runs from today (or the period's start, if later) to the period's end.
    first = max(today, view.start)
    if first <= view.end:
        page.agenda_range = DateRange(first, view.end)
        page.agenda_tasks = session.scalars(
            open_tasks.where(Task.placement_date.between(first, view.end)).order_by(
                Task.placement_date, Task.sort_order, Task.id
            )
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


def _count(session: Session, query: Select[int]) -> int:
    return session.scalar(select(func.count()).select_from(query.subquery())) or 0


def contents(session: Session, life_area_id: int, today: date) -> Contents:
    owner = Owner(life_area_id)
    projects = select(Project.id).where(Project.life_area_id == life_area_id)
    has_any = _count(session, projects) > 0 or any(
        _count(session, select(model.id).where(owner.owns(model)))
        for model in (Task, TaskTemplate, Event, Metric, RoutineStep)
    )
    found = _contents(session, owner, today, has_any)
    active = projects.where(Project.status == "active", Project.archived_at.is_(None))
    return replace(found, active_projects=_count(session, active))


def _contents(session: Session, owner: Owner, today: date, has_any: bool) -> Contents:
    """What an owner holds (a project holds no projects)."""
    upcoming = list_occurrences(
        session,
        today,
        today + timedelta(days=365),
        OccurrenceFilters(life_area_id=owner.life_area_id, project_id=owner.project_id),
    )
    open_tasks = select(Task.id).where(
        owner.owns(Task), Task.status == "todo", Task.archived_at.is_(None)
    )
    metrics = select(Metric.id).where(owner.owns(Metric), Metric.archived_at.is_(None))
    steps = select(RoutineStep.id).where(owner.owns(RoutineStep), RoutineStep.archived_at.is_(None))
    return Contents(
        active_projects=0,
        open_tasks=_count(session, open_tasks),
        upcoming_events=len({occurrence.event.id for occurrence in upcoming}),
        metrics=_count(session, metrics),
        routine_steps=_count(session, steps),
        has_items=has_any,
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
        items.append(_project_item(session, project))
    return items


def _project_item(session: Session, project: Project) -> ProjectItem:
    completed_on = local_date(project.completed_at) if project.completed_at else None
    progress = progress_of(session, project)
    start = project.start_date or local_date(project.created_at)
    return ProjectItem(project, start, progress.done, progress.total, completed_on)


def _routines(session: Session, owner: Owner, view: DateRange, today: date) -> list[RoutineGroup]:
    """Each routine with steps the owner owns, and every such step's status day by day:
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
        own = [step for step in active if owner.owns_step(step)]
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


def _completed(session: Session, owner: Owner, view: DateRange) -> list[Task]:
    """Tasks done in the period, newest first."""
    tasks = session.scalars(
        select(Task)
        .where(
            owner.owns(Task),
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
