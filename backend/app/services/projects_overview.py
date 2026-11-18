"""The Projects overview: every project over one calendar period. Execution stats counted
from project tasks, the projects with their progress and pace, and what needs a push.
Derived on read; nothing is stored (docs/DOMAIN.md, section 8)."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.clock import local_date
from app.models import LifeArea, Project, Task
from app.services.area_page import project_pace
from app.services.overview import DateRange, pace_status, period_range, previous_range
from app.services.routine_page import bucket_ranges

# A project with open tasks and nothing done for this many days is stalled.
STALLED_DAYS = 14
# A project has a next step when an open task is placed within this many days from today.
NEXT_STEP_DAYS = 7


@dataclass(frozen=True)
class Totals:
    """Project tasks done in a span (one-off tasks only, as project progress counts them),
    how many of those had a due date and met it, their rollovers, and projects finished."""

    done: int = 0
    done_with_due: int = 0
    done_on_time: int = 0
    rollovers: int = 0
    finished: int = 0
    finished_on_time: int = 0


@dataclass(frozen=True)
class Bucket:
    start: date
    end: date
    totals: Totals
    open: int  # open tasks at the bucket's end (or today, if earlier)
    overdue: int


@dataclass(frozen=True)
class ProjectRow:
    project: Project
    start: date
    completed_on: date | None
    done: int
    total: int
    open: int
    overdue: int
    pace_status: str | None


@dataclass(frozen=True)
class Stalled:
    project: Project
    days: int  # days since a task was last done, or since the project started


@dataclass(frozen=True)
class NoNextStep:
    project: Project
    open: int


@dataclass(frozen=True)
class ProjectsOverview:
    period: str
    view: DateRange
    previous_view: DateRange
    today: date
    has_projects: bool  # any project that isn't archived, in an active area
    totals: Totals
    previous: Totals
    open: int
    open_projects: int
    overdue: int
    overdue_projects: int
    buckets: list[Bucket]
    projects: list[ProjectRow]  # active ones, and those finished in the period
    due_next: list[ProjectRow]
    stalled: list[Stalled]
    no_next_step: list[NoNextStep]


def get_overview(session: Session, period: str, day: date) -> ProjectsOverview:
    today = clock.today()
    view = period_range(period, day)
    before = previous_range(period, view)

    projects = session.scalars(
        select(Project)
        .join(LifeArea, LifeArea.id == Project.life_area_id)
        .where(Project.archived_at.is_(None), LifeArea.archived_at.is_(None))
        .order_by(LifeArea.sort_order, LifeArea.id, Project.sort_order, Project.id)
    ).all()
    project_ids = [project.id for project in projects]
    tasks = (
        session.scalars(
            select(Task).where(Task.project_id.in_(project_ids), Task.archived_at.is_(None))
        ).all()
        if project_ids
        else []
    )
    one_off = [task for task in tasks if task.occurrence_date is None]
    by_project: dict[int, list[Task]] = {}
    for task in tasks:
        assert task.project_id is not None
        by_project.setdefault(task.project_id, []).append(task)

    def totals(span: DateRange) -> Totals:
        done = [task for task in one_off if _done_in(task, span)]
        with_due = [task for task in done if task.due_date is not None]
        finished = [
            project
            for project in projects
            if project.status == "done"
            and project.completed_at is not None
            and local_date(project.completed_at) in span
        ]
        return Totals(
            done=len(done),
            done_with_due=len(with_due),
            done_on_time=sum(1 for task in with_due if _on_time(task)),
            rollovers=sum(task.rollover_count for task in done),
            finished=len(finished),
            finished_on_time=sum(
                1
                for project in finished
                if project.due_date is None
                or (project.completed_at and local_date(project.completed_at) <= project.due_date)
            ),
        )

    buckets = [
        Bucket(
            span.start,
            span.end,
            totals(span),
            open=sum(1 for task in one_off if _open_on(task, min(span.end, today))),
            overdue=sum(1 for task in one_off if _overdue_on(task, min(span.end, today))),
        )
        for span in bucket_ranges(period, view)
        if span.start <= today
    ]

    rows: list[ProjectRow] = []
    for project in projects:
        completed_on = local_date(project.completed_at) if project.completed_at else None
        if project.status == "done":
            if completed_on is None or completed_on not in view:
                continue
        elif project.status != "active":
            continue
        rows.append(_row(project, by_project.get(project.id, []), completed_on, today))

    active = [row for row in rows if row.project.status == "active"]
    due_next = sorted(
        (row for row in active if row.project.due_date and row.project.due_date <= view.end),
        key=lambda row: (row.project.due_date, row.project.id),
    )
    stalled: list[Stalled] = []
    no_next_step: list[NoNextStep] = []
    for row in active:
        project_tasks = by_project.get(row.project.id, [])
        open_tasks = [task for task in project_tasks if task.status == "todo"]
        if not open_tasks:
            if row.total == 0:
                no_next_step.append(NoNextStep(row.project, 0))
            continue
        quiet = (today - _last_done(project_tasks, row.start)).days
        if quiet >= STALLED_DAYS:
            stalled.append(Stalled(row.project, quiet))
        elif not _has_next_step(open_tasks, today):
            no_next_step.append(NoNextStep(row.project, row.open))
    stalled.sort(key=lambda item: -item.days)

    open_now = [task for task in one_off if task.status == "todo"]
    overdue_now = [task for task in open_now if _overdue_on(task, today)]
    return ProjectsOverview(
        period=period,
        view=view,
        previous_view=before,
        today=today,
        has_projects=bool(projects),
        totals=totals(view),
        previous=totals(before),
        open=len(open_now),
        open_projects=len({task.project_id for task in open_now}),
        overdue=len(overdue_now),
        overdue_projects=len({task.project_id for task in overdue_now}),
        buckets=buckets,
        projects=rows,
        due_next=due_next,
        stalled=stalled,
        no_next_step=no_next_step,
    )


def _row(project: Project, tasks: list[Task], completed_on: date | None, today: date) -> ProjectRow:
    counted = [
        task for task in tasks if task.occurrence_date is None and task.status != "cancelled"
    ]
    done = sum(1 for task in counted if task.status == "done")
    start = project.start_date or local_date(project.created_at)
    pace = project_pace(project, start, today) if project.status == "active" else None
    return ProjectRow(
        project=project,
        start=start,
        completed_on=completed_on,
        done=done,
        total=len(counted),
        open=len(counted) - done,
        overdue=sum(1 for task in counted if _overdue_on(task, today)),
        pace_status=pace_status(done, len(counted), pace),
    )


def _done_in(task: Task, span: DateRange) -> bool:
    return (
        task.status == "done"
        and task.completed_at is not None
        and local_date(task.completed_at) in span
    )


def _on_time(task: Task) -> bool:
    assert task.completed_at is not None and task.due_date is not None
    return local_date(task.completed_at) <= task.due_date


def _open_on(task: Task, day: date) -> bool:
    """Whether the task existed and was still open at the end of `day`."""
    if local_date(task.created_at) > day:
        return False
    if task.status == "done" and task.completed_at is not None:
        return local_date(task.completed_at) > day
    if task.status == "cancelled" and task.cancelled_at is not None:
        return local_date(task.cancelled_at) > day
    return True


def _overdue_on(task: Task, day: date) -> bool:
    return task.due_date is not None and task.due_date < day and _open_on(task, day)


def _last_done(tasks: Iterable[Task], start: date) -> date:
    """The day a task was last done, or the project's start if none has been."""
    days = [
        local_date(task.completed_at)
        for task in tasks
        if task.status == "done" and task.completed_at is not None
    ]
    return max([start, *days])


def _has_next_step(open_tasks: Iterable[Task], today: date) -> bool:
    """An open task sits within the next 7 days: scheduled, else due (overdue ones count,
    as they are listed in Today)."""
    last = today + timedelta(days=NEXT_STEP_DAYS - 1)
    return any(
        (placed := task.scheduled_date or task.due_date) is not None and placed <= last
        for task in open_tasks
    )
