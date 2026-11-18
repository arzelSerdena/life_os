import datetime as dt
from typing import Literal

from pydantic import BaseModel

from app.models import Metric, MetricTarget, Project
from app.schemas.event import OccurrenceRead
from app.schemas.metric import Aggregation, Direction, Format, Period, TargetKind
from app.schemas.overview import DateRangeRead
from app.schemas.routine import DayStatus, MetricRef
from app.schemas.task import TaskRead
from app.services import home as service


class HomeSetupRead(BaseModel):
    """The first life area, routine and task by name (null when there is none). Home shows
    its first-run message until there is an area and at least one task or routine."""

    life_area: str | None
    routine: str | None
    task: str | None


class HomeProjectRead(BaseModel):
    id: int
    life_area_id: int
    title: str
    due_date: dt.date | None

    @classmethod
    def of(cls, project: Project) -> HomeProjectRead:
        return cls(
            id=project.id,
            life_area_id=project.life_area_id,
            title=project.title,
            due_date=project.due_date,
        )


class HomeMetricRead(BaseModel):
    """A metric from any owner, with what the screen needs to format its values."""

    metric_id: int
    life_area_id: int
    project_id: int | None
    title: str
    format: Format
    unit: str | None
    aggregation: Aggregation
    direction: Direction
    target_kind: TargetKind
    target_period: Period | None
    target_value: float

    @staticmethod
    def fields(metric: Metric, target: MetricTarget) -> dict[str, object]:
        return {
            "metric_id": metric.id,
            "life_area_id": metric.life_area_id,
            "project_id": metric.project_id,
            "title": metric.title,
            "format": metric.format,
            "unit": metric.unit,
            "aggregation": metric.aggregation,
            "direction": metric.direction,
            "target_kind": target.kind,
            "target_period": target.period,
            "target_value": target.target_value,
        }


class HomeDeadlineRead(HomeMetricRead):
    """A reach-by target not met yet whose deadline is `day`."""

    day: dt.date


class LogMetricRead(HomeMetricRead):
    """A manual metric with a per-day or per-week target and no entry today. value is the
    week so far (per-week targets); days_met of days_counted are this week's days before
    today that met a per-day target."""

    value: float | None
    days_met: int
    days_counted: int


class PushMetricRead(HomeMetricRead):
    """A metric behind its current target; ends_on is the target period's end, or the
    reach-by deadline."""

    value: float | None
    ends_on: dt.date | None


class PushProjectRead(HomeProjectRead):
    """due: due within 7 days, overdue included. stalled: open tasks and nothing done for
    `days` days. no_next_step: nothing placed in the next 7 days (open 0: no tasks yet)."""

    reason: Literal["due", "stalled", "no_next_step"]
    open: int
    days: int


class HomeStepRead(BaseModel):
    step_id: int
    title: str
    life_area_id: int
    project_id: int | None
    status: DayStatus
    streak: int
    metric: MetricRef | None


class HomeRoutineRead(BaseModel):
    routine_id: int
    title: str
    steps: list[HomeStepRead]


class ComingUpRead(BaseModel):
    range: DateRangeRead
    events: list[OccurrenceRead]
    projects: list[HomeProjectRead]
    deadlines: list[HomeDeadlineRead]


class HomeRead(BaseModel):
    """Today only. overdue: open tasks due before today; tasks: open tasks placed on today
    (scheduled, else due) that aren't overdue; completed: tasks done today, newest first.
    events cover today; projects_due and deadlines fall today. routines: each routine with
    steps due today. Coming up: the next 7 days' events, project due dates and deadlines."""

    today: dt.date
    setup: HomeSetupRead
    overdue: list[TaskRead]
    tasks: list[TaskRead]
    completed: list[TaskRead]
    events: list[OccurrenceRead]
    projects_due: list[HomeProjectRead]
    deadlines: list[HomeDeadlineRead]
    routines: list[HomeRoutineRead]
    log: list[LogMetricRead]
    inbox: int
    push_projects: list[PushProjectRead]
    push_metrics: list[PushMetricRead]
    coming_up: ComingUpRead

    @classmethod
    def from_home(cls, home: service.Home) -> HomeRead:
        def deadline(item: service.Deadline) -> HomeDeadlineRead:
            assert item.target.end_date is not None
            return HomeDeadlineRead.model_validate(
                {**HomeMetricRead.fields(item.metric, item.target), "day": item.target.end_date}
            )

        def tasks(rows: object) -> list[TaskRead]:
            return [TaskRead.model_validate(task) for task in rows]  # type: ignore[attr-defined]

        assert home.coming_up is not None
        return cls(
            today=home.today,
            setup=HomeSetupRead.model_validate(home.setup, from_attributes=True),
            overdue=tasks(home.overdue),
            tasks=tasks(home.tasks),
            completed=tasks(home.completed),
            events=[OccurrenceRead.from_occurrence(item) for item in home.events],
            projects_due=[HomeProjectRead.of(project) for project in home.projects_due],
            deadlines=[deadline(item) for item in home.deadlines],
            routines=[
                HomeRoutineRead(
                    routine_id=group.routine.id,
                    title=group.routine.title,
                    steps=[
                        HomeStepRead(
                            step_id=item.step_day.step.id,
                            title=item.step_day.step.title,
                            life_area_id=item.step_day.step.life_area_id,
                            project_id=item.step_day.step.project_id,
                            status=item.step_day.status,  # type: ignore[arg-type]
                            streak=item.streak,
                            metric=None
                            if item.metric is None
                            else MetricRef(id=item.metric.id, title=item.metric.title),
                        )
                        for item in group.steps
                    ],
                )
                for group in home.routines
            ],
            log=[
                LogMetricRead.model_validate(
                    {
                        **HomeMetricRead.fields(item.metric, item.target),
                        "value": item.value,
                        "days_met": item.days_met,
                        "days_counted": item.days_counted,
                    }
                )
                for item in home.log
            ],
            inbox=home.inbox,
            push_projects=[
                PushProjectRead(
                    **HomeProjectRead.of(item.project).model_dump(),
                    reason=item.reason,  # type: ignore[arg-type]
                    open=item.open,
                    days=item.days,
                )
                for item in home.push_projects
            ],
            push_metrics=[
                PushMetricRead.model_validate(
                    {
                        **HomeMetricRead.fields(item.metric, item.target),
                        "value": item.value,
                        "ends_on": item.ends_on,
                    }
                )
                for item in home.push_metrics
            ],
            coming_up=ComingUpRead(
                range=DateRangeRead(start=home.coming_up.start, end=home.coming_up.end),
                events=[OccurrenceRead.from_occurrence(item) for item in home.coming_events],
                projects=[HomeProjectRead.of(project) for project in home.coming_projects],
                deadlines=[deadline(item) for item in home.coming_deadlines],
            ),
        )
