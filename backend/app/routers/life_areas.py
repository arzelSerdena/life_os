from collections.abc import Sequence
from datetime import date
from typing import Any

from fastapi import APIRouter, status

from app import clock
from app.db import SessionDep
from app.models import LifeArea
from app.schemas.common import ErrorResponse
from app.schemas.life_area import LifeAreaCreate, LifeAreaRead, LifeAreaReorder, LifeAreaUpdate
from app.schemas.overview import OverviewPeriod, OverviewRead
from app.services import life_areas as service
from app.services import overview as overview_service

router = APIRouter(prefix="/api/life-areas", tags=["life-areas"])

NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
CONFLICT: dict[int | str, dict[str, Any]] = {409: {"model": ErrorResponse}}


@router.get("", response_model=list[LifeAreaRead])
def list_life_areas(session: SessionDep, include_archived: bool = False) -> Sequence[LifeArea]:
    return service.list_life_areas(session, include_archived=include_archived)


@router.post("", response_model=LifeAreaRead, status_code=status.HTTP_201_CREATED)
def create_life_area(session: SessionDep, data: LifeAreaCreate) -> LifeArea:
    return service.create_life_area(session, data)


@router.get("/overview")
def get_overview(
    session: SessionDep, period: OverviewPeriod = "quarter", date: date | None = None
) -> OverviewRead:
    """The active areas compared over the week, month, quarter or year containing `date`
    (default: today): effort, outcomes, projects against pace, routine steps and wins."""
    overview = overview_service.get_overview(session, period, date or clock.today())
    return OverviewRead.from_overview(overview)


@router.post(
    "/reorder",
    response_model=list[LifeAreaRead],
    responses=NOT_FOUND,
)
def reorder_life_areas(session: SessionDep, data: LifeAreaReorder) -> Sequence[LifeArea]:
    """Set the areas' order; returns the active areas in their new order."""
    return service.reorder_life_areas(session, data)


@router.get("/{life_area_id}", response_model=LifeAreaRead, responses=NOT_FOUND)
def get_life_area(session: SessionDep, life_area_id: int) -> LifeArea:
    return service.get_life_area(session, life_area_id)


@router.patch("/{life_area_id}", response_model=LifeAreaRead, responses=NOT_FOUND)
def update_life_area(session: SessionDep, life_area_id: int, data: LifeAreaUpdate) -> LifeArea:
    return service.update_life_area(session, life_area_id, data)


@router.post("/{life_area_id}/archive", response_model=LifeAreaRead, responses=NOT_FOUND)
def archive_life_area(session: SessionDep, life_area_id: int) -> LifeArea:
    return service.archive_life_area(session, life_area_id)


@router.post("/{life_area_id}/unarchive", response_model=LifeAreaRead, responses=NOT_FOUND)
def unarchive_life_area(session: SessionDep, life_area_id: int) -> LifeArea:
    return service.unarchive_life_area(session, life_area_id)


@router.delete(
    "/{life_area_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
)
def delete_life_area(session: SessionDep, life_area_id: int) -> None:
    service.delete_life_area(session, life_area_id)
