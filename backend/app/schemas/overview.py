import datetime as dt
from typing import Literal

from pydantic import BaseModel

from app.schemas.life_area import LifeAreaRead
from app.schemas.metric import Aggregation, Direction, Period, PeriodStatus, TargetKind
from app.services import overview as service

OverviewPeriod = Literal["week", "month", "quarter", "year"]
OutcomeStatus = Literal["met", "on_track", "behind", "missed", "improving", "worsening", "steady"]


class DateRangeRead(BaseModel):
    start: dt.date
    end: dt.date


class EffortAreaRead(BaseModel):
    """Done tasks in the area, completed in the period and in the one before."""

    life_area_id: int
    done: int
    previous_done: int


class OutcomeTargetRead(BaseModel):
    id: int
    kind: TargetKind
    target_value: float
    period: Period | None
    start_date: dt.date
    end_date: dt.date | None


class ChartPointRead(BaseModel):
    start: dt.date
    end: dt.date
    value: float | None
    status: PeriodStatus | None
    is_current: bool


class OutcomeRead(BaseModel):
    """An area-owned metric over the period.

    chart is per_period (one point per target period), reach_by (the value counted from
    the target's start) or none (the value of each step: days, weeks or months)."""

    metric_id: int
    life_area_id: int
    title: str
    unit: str | None
    aggregation: Aggregation
    direction: Direction
    target: OutcomeTargetRead | None
    chart: Literal["per_period", "reach_by", "none"]
    points: list[ChartPointRead]
    value: float | None
    previous_value: float | None
    status: OutcomeStatus | None
    met_periods: int
    finished_periods: int

    @classmethod
    def from_outcome(cls, outcome: service.Outcome) -> OutcomeRead:
        metric, target = outcome.metric, outcome.target
        return cls(
            metric_id=metric.id,
            life_area_id=metric.life_area_id,
            title=metric.title,
            unit=metric.unit,
            aggregation=metric.aggregation,  # type: ignore[arg-type]
            direction=metric.direction,  # type: ignore[arg-type]
            target=None
            if target is None
            else OutcomeTargetRead(
                id=target.id,
                kind=target.kind,  # type: ignore[arg-type]
                target_value=target.target_value,
                period=target.period,  # type: ignore[arg-type]
                start_date=target.start_date,
                end_date=target.end_date,
            ),
            chart=outcome.chart,  # type: ignore[arg-type]
            points=[
                ChartPointRead(
                    start=point.start,
                    end=point.end,
                    value=point.value,
                    status=point.status,  # type: ignore[arg-type]
                    is_current=point.is_current,
                )
                for point in outcome.points
            ],
            value=outcome.value,
            previous_value=outcome.previous_value,
            status=outcome.status,  # type: ignore[arg-type]
            met_periods=outcome.met_periods,
            finished_periods=outcome.finished_periods,
        )


class ProjectsAreaRead(BaseModel):
    """Tasks done across the area's active projects, against how much of their time has
    passed (pace, 0 to 1; null when none has a due date)."""

    life_area_id: int
    active_projects: int
    done: int
    total: int
    pace: float | None
    pace_status: Literal["ahead", "behind", "on_pace"] | None


class RoutineWeekRead(BaseModel):
    start: dt.date
    end: dt.date
    due: int
    done: int
    is_current: bool
    is_upcoming: bool


class RoutinesAreaRead(BaseModel):
    life_area_id: int
    steps: int
    routines: int
    due: int
    done: int
    weeks: list[RoutineWeekRead]


class WinRead(BaseModel):
    """A project finished, a per-period target met (times = how many periods), or a
    reach-by target reached. day is when it happened (for periods, the last one's end)."""

    kind: Literal["project_finished", "target_periods_met", "target_reached"]
    life_area_id: int
    title: str
    day: dt.date
    project_id: int | None
    metric_id: int | None
    target_value: float | None
    unit: str | None
    direction: Direction | None
    period: Period | None
    times: int


class OverviewRead(BaseModel):
    """The active life areas compared over one calendar period. Lists follow the area
    order, except wins, which are newest first."""

    period: OverviewPeriod
    range: DateRangeRead
    previous_range: DateRangeRead
    today: dt.date
    life_areas: list[LifeAreaRead]
    effort: list[EffortAreaRead]
    outcomes: list[OutcomeRead]
    projects: list[ProjectsAreaRead]
    routines: list[RoutinesAreaRead]
    wins: list[WinRead]

    @classmethod
    def from_overview(cls, overview: service.Overview) -> OverviewRead:
        return cls(
            period=overview.period,  # type: ignore[arg-type]
            range=DateRangeRead(start=overview.range.start, end=overview.range.end),
            previous_range=DateRangeRead(start=overview.previous.start, end=overview.previous.end),
            today=overview.today,
            life_areas=[LifeAreaRead.model_validate(area) for area in overview.life_areas],
            effort=[
                EffortAreaRead.model_validate(e, from_attributes=True) for e in overview.effort
            ],
            outcomes=[OutcomeRead.from_outcome(outcome) for outcome in overview.outcomes],
            projects=[
                ProjectsAreaRead.model_validate(p, from_attributes=True) for p in overview.projects
            ],
            routines=[
                RoutinesAreaRead.model_validate(r, from_attributes=True) for r in overview.routines
            ],
            wins=[WinRead.model_validate(win, from_attributes=True) for win in overview.wins],
        )
