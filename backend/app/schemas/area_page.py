import datetime as dt
from typing import Literal

from pydantic import BaseModel

from app.schemas.event import OccurrenceRead
from app.schemas.life_area import LifeAreaRead
from app.schemas.overview import DateRangeRead, OutcomeRead, OverviewPeriod
from app.schemas.project import ProjectStatus
from app.schemas.task import TaskRead
from app.schemas.task_template import TaskTemplateRead
from app.services import area_page as service

StepDayStatus = Literal["done", "skipped", "missed", "paused", "todo", "upcoming", "not_due"]


class AreaProjectRead(BaseModel):
    """An active project, or one finished in the period. start is its created date until
    projects get a start date."""

    id: int
    title: str
    status: ProjectStatus
    start: dt.date
    due_date: dt.date | None
    completed_on: dt.date | None
    done: int
    total: int


class StepRowRead(BaseModel):
    step_id: int
    title: str
    project_id: int | None
    days: list[StepDayStatus]  # one per day of the range


class RoutineGroupRead(BaseModel):
    routine_id: int
    title: str
    rrule: str
    total_steps: int
    steps: list[StepRowRead]


class DeadlineRead(BaseModel):
    metric_id: int
    title: str
    day: dt.date
    target_value: float
    unit: str | None


class ContentsRead(BaseModel):
    active_projects: int
    open_tasks: int
    upcoming_events: int
    metrics: int
    routine_steps: int
    has_items: bool


class AreaPageRead(BaseModel):
    """One area over one calendar period. Tasks and events include those of the area's
    projects. The agenda runs from today (or the period's start, if later) to its end, and
    is empty for a past period."""

    life_area: LifeAreaRead
    period: OverviewPeriod
    range: DateRangeRead
    today: dt.date
    contents: ContentsRead
    metrics: list[OutcomeRead]
    projects: list[AreaProjectRead]
    events: list[OccurrenceRead]
    routines: list[RoutineGroupRead]
    overdue_tasks: list[TaskRead]
    rolled_over_tasks: list[TaskRead]
    unscheduled_tasks: list[TaskRead]
    recurring: list[TaskTemplateRead]
    completed_tasks: list[TaskRead]
    agenda_range: DateRangeRead | None
    agenda_tasks: list[TaskRead]
    deadlines: list[DeadlineRead]

    @classmethod
    def from_page(cls, page: service.AreaPage) -> AreaPageRead:
        def tasks(rows: object) -> list[TaskRead]:
            return [TaskRead.model_validate(task) for task in rows]  # type: ignore[attr-defined]

        return cls(
            life_area=LifeAreaRead.model_validate(page.life_area),
            period=page.period,  # type: ignore[arg-type]
            range=DateRangeRead(start=page.range.start, end=page.range.end),
            today=page.today,
            contents=ContentsRead.model_validate(page.contents, from_attributes=True),
            metrics=[OutcomeRead.from_outcome(outcome) for outcome in page.metrics],
            projects=[
                AreaProjectRead(
                    id=item.project.id,
                    title=item.project.title,
                    status=item.project.status,  # type: ignore[arg-type]
                    start=item.start,
                    due_date=item.project.due_date,
                    completed_on=item.completed_on,
                    done=item.done,
                    total=item.total,
                )
                for item in page.projects
            ],
            events=[OccurrenceRead.from_occurrence(occurrence) for occurrence in page.events],
            routines=[
                RoutineGroupRead(
                    routine_id=group.routine.id,
                    title=group.routine.title,
                    rrule=group.rrule,
                    total_steps=group.total_steps,
                    steps=[
                        StepRowRead(
                            step_id=row.step.id,
                            title=row.step.title,
                            project_id=row.step.project_id,
                            days=row.days,  # type: ignore[arg-type]
                        )
                        for row in group.steps
                    ],
                )
                for group in page.routines
            ],
            overdue_tasks=tasks(page.overdue_tasks),
            rolled_over_tasks=tasks(page.rolled_over_tasks),
            unscheduled_tasks=tasks(page.unscheduled_tasks),
            recurring=[TaskTemplateRead.model_validate(t) for t in page.recurring],
            completed_tasks=tasks(page.completed_tasks),
            agenda_range=None
            if page.agenda_range is None
            else DateRangeRead(start=page.agenda_range.start, end=page.agenda_range.end),
            agenda_tasks=tasks(page.agenda_tasks),
            deadlines=[
                DeadlineRead(
                    metric_id=deadline.metric.id,
                    title=deadline.metric.title,
                    day=deadline.day,
                    target_value=deadline.target_value,
                    unit=deadline.metric.unit,
                )
                for deadline in page.deadlines
            ],
        )
