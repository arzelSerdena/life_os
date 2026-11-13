from datetime import date
from typing import Any

from fastapi import APIRouter, status

from app.db import SessionDep
from app.schemas.common import ErrorResponse
from app.schemas.event import (
    EventChange,
    EventCreate,
    EventMove,
    EventRead,
    EventUpdate,
    OccurrenceCancel,
    OccurrenceEdit,
    OccurrenceRead,
)
from app.services import events as service

router = APIRouter(prefix="/api/events", tags=["events"])

NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
CONFLICT: dict[int | str, dict[str, Any]] = {409: {"model": ErrorResponse}}


def _change(change: service.EventChange) -> EventChange:
    return EventChange(event=EventRead.model_validate(change.event), batch_id=change.batch_id)


def _occurrence(occurrence: service.Occurrence) -> OccurrenceRead:
    event = occurrence.event
    return OccurrenceRead(
        event_id=event.id,
        occurrence_date=occurrence.occurrence_date,
        life_area_id=event.life_area_id,
        project_id=event.project_id,
        title=occurrence.title,
        notes=occurrence.notes,
        start_date=occurrence.start_date,
        end_date=occurrence.end_date,
        start_time=occurrence.start_time,
        end_time=occurrence.end_time,
        location=occurrence.location,
        is_repeating=event.is_repeating,
        is_cancelled=occurrence.is_cancelled,
        is_changed=occurrence.is_changed,
        is_past=occurrence.is_past,
    )


@router.get("")
def list_events(
    session: SessionDep,
    life_area_id: int | None = None,
    project_id: int | None = None,
    include_cancelled: bool = False,
    include_archived: bool = False,
) -> list[EventRead]:
    """Events and series themselves. For what happens on which day, list occurrences."""
    found = service.list_events(
        session,
        life_area_id=life_area_id,
        project_id=project_id,
        include_cancelled=include_cancelled,
        include_archived=include_archived,
    )
    return [EventRead.model_validate(event) for event in found]


@router.get("/occurrences")
def list_event_occurrences(
    session: SessionDep,
    first: date,
    last: date,
    life_area_id: int | None = None,
    project_id: int | None = None,
    include_cancelled: bool = False,
) -> list[OccurrenceRead]:
    """Every occurrence that overlaps first..last (inclusive, at most 366 days)."""
    filters = service.OccurrenceFilters(
        life_area_id=life_area_id, project_id=project_id, include_cancelled=include_cancelled
    )
    return [_occurrence(o) for o in service.list_occurrences(session, first, last, filters)]


@router.post("", status_code=status.HTTP_201_CREATED, responses=CONFLICT)
def create_event(session: SessionDep, data: EventCreate) -> EventRead:
    return EventRead.model_validate(service.create_event(session, data))


@router.get("/{event_id}", responses=NOT_FOUND)
def get_event(session: SessionDep, event_id: int) -> EventRead:
    return EventRead.model_validate(service.get_event(session, event_id))


@router.patch("/{event_id}", responses=NOT_FOUND)
def update_event(session: SessionDep, event_id: int, data: EventUpdate) -> EventRead:
    return EventRead.model_validate(service.update_event(session, event_id, data))


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_event(session: SessionDep, event_id: int) -> None:
    service.delete_event(session, event_id)


@router.post("/{event_id}/move", responses={**NOT_FOUND, **CONFLICT})
def move_event(session: SessionDep, event_id: int, data: EventMove) -> EventChange:
    return _change(service.move_event(session, event_id, data))


@router.post("/{event_id}/cancel", responses={**NOT_FOUND, **CONFLICT})
def cancel_event(session: SessionDep, event_id: int) -> EventChange:
    return _change(service.cancel_event(session, event_id))


@router.post("/{event_id}/uncancel", responses={**NOT_FOUND, **CONFLICT})
def uncancel_event(session: SessionDep, event_id: int) -> EventChange:
    return _change(service.uncancel_event(session, event_id))


@router.post("/{event_id}/archive", responses=NOT_FOUND)
def archive_event(session: SessionDep, event_id: int) -> EventChange:
    return _change(service.archive_event(session, event_id))


@router.post("/{event_id}/unarchive", responses={**NOT_FOUND, **CONFLICT})
def unarchive_event(session: SessionDep, event_id: int) -> EventChange:
    return _change(service.unarchive_event(session, event_id))


@router.post("/{event_id}/occurrences/{day}/edit", responses={**NOT_FOUND, **CONFLICT})
def edit_event_occurrence(
    session: SessionDep, event_id: int, day: date, data: OccurrenceEdit
) -> EventRead:
    """Change the occurrence on `day` (its original date): this one, this and following,
    or all. Returns the event holding the change, which is a new series after a split."""
    return EventRead.model_validate(service.edit_occurrence(session, event_id, day, data))


@router.post("/{event_id}/occurrences/{day}/cancel", responses={**NOT_FOUND, **CONFLICT})
def cancel_event_occurrence(
    session: SessionDep, event_id: int, day: date, data: OccurrenceCancel
) -> EventChange:
    event, batch_id = service.cancel_occurrence(session, event_id, day, data.scope)
    return EventChange(event=EventRead.model_validate(event), batch_id=batch_id)


@router.delete("/{event_id}/occurrences/{day}", responses=NOT_FOUND)
def restore_event_occurrence(session: SessionDep, event_id: int, day: date) -> EventRead:
    """Remove every one-off change to the occurrence on `day`, including cancelling it."""
    return EventRead.model_validate(service.restore_occurrence(session, event_id, day))
