"""Finished & archived: archived life areas, done, cancelled or archived projects, and
archived routines, newest first. Derived on read (docs/DOMAIN.md, section 8)."""

from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app import clock
from app.models import LifeArea, Metric, Project, Routine, Task
from app.services.area_page import area_has_items
from app.services.cascades import taken_by_last_archive
from app.services.projects import has_items
from app.services.routine_page import routine_start, track
from app.services.routines import metrics_using


@dataclass(frozen=True)
class AreaRow:
    area: LifeArea
    archived_on: date
    # What restoring the area brings back: what its last archive took, still archived.
    projects: int
    tasks: int
    metrics: int
    has_items: bool


@dataclass(frozen=True)
class ProjectRow:
    project: Project
    # The day it was archived, or else the day it was done or cancelled.
    on: date
    done: int
    total: int
    has_items: bool


@dataclass(frozen=True)
class RoutineRow:
    routine: Routine
    archived_on: date
    # The schedule in force on the archive day.
    rrule: str
    schedule_starts_on: date
    steps: int
    best_run: int
    # Metrics one of its steps feeds: it can't be deleted while there are any.
    feeds: list[str]


@dataclass(frozen=True)
class Archive:
    areas: list[AreaRow]
    projects: list[ProjectRow]
    routines: list[RoutineRow]


def get_archive(session: Session) -> Archive:
    return Archive(_areas(session), _projects(session), _routines(session))


def _newest_first(stamp: datetime | None, item_id: int) -> tuple[float, int]:
    return (-(stamp.timestamp() if stamp else 0), -item_id)


def _areas(session: Session) -> list[AreaRow]:
    areas = session.scalars(select(LifeArea).where(LifeArea.archived_at.is_not(None))).all()
    rows = []
    for area in sorted(areas, key=lambda item: _newest_first(item.archived_at, item.id)):
        assert area.archived_at is not None
        taken = taken_by_last_archive(session, area)
        rows.append(
            AreaRow(
                area=area,
                archived_on=clock.local_date(area.archived_at),
                projects=sum(isinstance(item, Project) for item in taken),
                tasks=sum(isinstance(item, Task) for item in taken),
                metrics=sum(isinstance(item, Metric) for item in taken),
                has_items=area_has_items(session, area.id),
            )
        )
    return rows


def _project_stamp(project: Project) -> datetime | None:
    if project.archived_at is not None:
        return project.archived_at
    return project.completed_at or project.cancelled_at


def _projects(session: Session) -> list[ProjectRow]:
    projects = session.scalars(
        select(Project).where(
            or_(Project.archived_at.is_not(None), Project.status.in_(("done", "cancelled")))
        )
    ).all()
    rows = []
    for project in sorted(projects, key=lambda item: _newest_first(_project_stamp(item), item.id)):
        # Done out of every one-off task, cancelled and archived ones included: finishing a
        # project cancels its open tasks, and archiving it archives them.
        done, total = session.execute(
            select(func.count(case((Task.status == "done", 1))), func.count(Task.id)).where(
                Task.project_id == project.id, Task.occurrence_date.is_(None)
            )
        ).one()
        stamp = _project_stamp(project)
        rows.append(
            ProjectRow(
                project=project,
                on=clock.local_date(stamp) if stamp else clock.today(),
                done=done,
                total=total,
                has_items=has_items(session, project),
            )
        )
    return rows


def _routines(session: Session) -> list[RoutineRow]:
    routines = session.scalars(select(Routine).where(Routine.archived_at.is_not(None))).all()
    rows = []
    for routine in sorted(routines, key=lambda item: _newest_first(item.archived_at, item.id)):
        assert routine.archived_at is not None
        archived_on = clock.local_date(routine.archived_at)
        started = [row for row in routine.schedules if row.starts_on <= archived_on]
        schedule = started[-1] if started else routine.schedules[0]
        start = routine_start(routine)
        # Tracking stops on the archive day, so the runs are the routine's whole history.
        runs = track(routine, start, start).runs
        rows.append(
            RoutineRow(
                routine=routine,
                archived_on=archived_on,
                rrule=schedule.rrule,
                schedule_starts_on=schedule.starts_on,
                steps=sum(step.archived_at is None for step in routine.steps),
                best_run=max((run.length for run in runs.values()), default=0),
                feeds=[
                    metric.title
                    for metric in metrics_using(session, [step.id for step in routine.steps])
                ],
            )
        )
    return rows
