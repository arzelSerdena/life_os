import datetime as dt

from pydantic import BaseModel

from app.schemas.area_page import PaceStatus
from app.schemas.overview import DateRangeRead, OverviewPeriod
from app.schemas.project import ProjectStatus


class ProjectTotalsRead(BaseModel):
    """Project tasks done in a span (one-off tasks, as project progress counts them), those
    of them with a due date and those done by it, the rollovers they collected, and the
    projects finished (on time: by their due date, or with none)."""

    done: int
    done_with_due: int
    done_on_time: int
    rollovers: int
    finished: int
    finished_on_time: int


class ProjectsBucketRead(BaseModel):
    """One point of the tiles' lines: a day (week), a week (month, quarter) or a month
    (year). open and overdue are counted at the bucket's end, or today if that is earlier."""

    start: dt.date
    end: dt.date
    totals: ProjectTotalsRead
    open: int
    overdue: int


class OverviewProjectRead(BaseModel):
    """An active project, or one finished in the period. start is its start date, or the
    day it was created; done and total count as project progress does; pace_status is null
    without a due date, without tasks, and for finished projects."""

    id: int
    life_area_id: int
    title: str
    status: ProjectStatus
    start: dt.date
    due_date: dt.date | None
    completed_on: dt.date | None
    done: int
    total: int
    open: int
    overdue: int
    pace_status: PaceStatus | None


class StalledProjectRead(BaseModel):
    project_id: int
    days: int


class NoNextStepRead(BaseModel):
    project_id: int
    open: int


class ProjectsOverviewRead(BaseModel):
    """Every project over one calendar period. due_next, stalled and no_next_step refer to
    projects in `projects`."""

    period: OverviewPeriod
    range: DateRangeRead
    previous_range: DateRangeRead
    today: dt.date
    has_projects: bool
    totals: ProjectTotalsRead
    previous: ProjectTotalsRead
    open: int
    open_projects: int
    overdue: int
    overdue_projects: int
    buckets: list[ProjectsBucketRead]
    projects: list[OverviewProjectRead]
    due_next: list[int]
    stalled: list[StalledProjectRead]
    no_next_step: list[NoNextStepRead]
