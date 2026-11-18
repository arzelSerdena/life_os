from datetime import date

from pydantic import BaseModel

from app.schemas.common import UtcDatetime
from app.schemas.project import ProjectStatus


class ArchivedAreaRead(BaseModel):
    id: int
    title: str
    color: str | None
    archived_at: UtcDatetime
    archived_on: date
    # What Restore brings back: what the area's last archive took, still archived.
    projects: int
    tasks: int
    metrics: int
    # Whether anything belongs to it, archived items included: only an empty area can be
    # deleted.
    has_items: bool


class FinishedProjectRead(BaseModel):
    id: int
    life_area_id: int
    title: str
    status: ProjectStatus
    archived_at: UtcDatetime | None
    # The day it was archived, or else the day it was done or cancelled.
    on: date
    # Done one-off tasks out of all of them, cancelled and archived ones included.
    done: int
    total: int
    has_items: bool


class ArchivedRoutineRead(BaseModel):
    id: int
    title: str
    archived_at: UtcDatetime
    archived_on: date
    # The schedule in force on the archive day, and the day it started.
    rrule: str
    schedule_starts_on: date
    # Its steps that aren't archived on their own.
    steps: int
    # The longest run of full days, up to the archive day.
    best_run: int
    # Metrics one of its steps feeds: it can't be deleted while there are any.
    feeds: list[str]


class ArchiveRead(BaseModel):
    """Finished & archived: archived areas, done, cancelled or archived projects, and
    archived routines, each newest first."""

    areas: list[ArchivedAreaRead]
    projects: list[FinishedProjectRead]
    routines: list[ArchivedRoutineRead]
