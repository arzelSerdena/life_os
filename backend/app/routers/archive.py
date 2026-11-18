from fastapi import APIRouter

from app.db import SessionDep
from app.schemas.archive import (
    ArchivedAreaRead,
    ArchivedRoutineRead,
    ArchiveRead,
    FinishedProjectRead,
)
from app.services import archive as service

router = APIRouter(prefix="/api", tags=["archive"])


@router.get("/archive")
def get_archive(session: SessionDep) -> ArchiveRead:
    """Finished & archived: archived life areas (with what Restore brings back), done,
    cancelled or archived projects, and archived routines, newest first."""
    found = service.get_archive(session)
    return ArchiveRead(
        areas=[
            ArchivedAreaRead(
                id=row.area.id,
                title=row.area.title,
                color=row.area.color,
                archived_at=row.area.archived_at,  # type: ignore[arg-type]
                archived_on=row.archived_on,
                projects=row.projects,
                tasks=row.tasks,
                metrics=row.metrics,
                has_items=row.has_items,
            )
            for row in found.areas
        ],
        projects=[
            FinishedProjectRead(
                id=row.project.id,
                life_area_id=row.project.life_area_id,
                title=row.project.title,
                status=row.project.status,  # type: ignore[arg-type]
                archived_at=row.project.archived_at,
                on=row.on,
                done=row.done,
                total=row.total,
                has_items=row.has_items,
            )
            for row in found.projects
        ],
        routines=[
            ArchivedRoutineRead(
                id=row.routine.id,
                title=row.routine.title,
                archived_at=row.routine.archived_at,  # type: ignore[arg-type]
                archived_on=row.archived_on,
                rrule=row.rrule,
                schedule_starts_on=row.schedule_starts_on,
                steps=row.steps,
                best_run=row.best_run,
                feeds=row.feeds,
            )
            for row in found.routines
        ],
    )
