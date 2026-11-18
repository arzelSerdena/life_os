from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app import clock
from app.db import SessionDep
from app.schemas.event import OccurrenceRead
from app.schemas.routine import RoutineStepDay
from app.schemas.task import TaskRead
from app.schemas.week import DayRead, DaysRead, WeekRead
from app.services import week as service

router = APIRouter(prefix="/api", tags=["week"])


@router.get("/week")
def get_week(
    session: SessionDep,
    start: date | None = None,
    life_area_id: int | None = None,
    project_id: int | None = None,
    include_cancelled: bool = False,
) -> WeekRead:
    """The week board for the week containing `start` (default: today), Monday to Sunday.

    First moves unfinished tasks from past days to today and creates the week's missing
    recurring tasks. Calling it again changes nothing."""
    filters = service.WeekFilters(
        life_area_id=life_area_id, project_id=project_id, include_cancelled=include_cancelled
    )
    week = service.get_week(session, start or clock.today(), filters)
    return WeekRead(
        week_start=week.start,
        week_end=week.end,
        today=week.today,
        unscheduled=[TaskRead.model_validate(task) for task in week.unscheduled],
        days=_days(week),
    )


@router.get("/days")
def get_days(
    session: SessionDep,
    start: date | None = None,
    count: Annotated[int, Query(ge=1, le=371)] = 7,
    life_area_id: int | None = None,
    project_id: int | None = None,
    include_cancelled: bool = False,
    include_routines: bool = True,
) -> DaysRead:
    """`count` days from `start` (default: today), placed as on the week board: Next 7 days.
    Up to 371 days, so the Calendar's Year view fits; `include_routines=false` leaves out
    the routine steps, which Quarter and Year don't show.

    Like the week board, it first rolls unfinished tasks over to today and creates the
    range's missing recurring tasks."""
    filters = service.WeekFilters(
        life_area_id=life_area_id,
        project_id=project_id,
        include_cancelled=include_cancelled,
        include_routines=include_routines,
    )
    found = service.get_days(session, start or clock.today(), count, filters)
    return DaysRead(
        start=found.start,
        end=found.end,
        today=found.today,
        unscheduled=[TaskRead.model_validate(task) for task in found.unscheduled],
        days=_days(found),
    )


def _days(week: service.Week) -> list[DayRead]:
    return [
        DayRead(
            day=day.day,
            tasks=[TaskRead.model_validate(task) for task in day.tasks],
            events=[OccurrenceRead.from_occurrence(o) for o in day.events],
            routine_steps=[RoutineStepDay.from_step_day(s) for s in day.routine_steps],
        )
        for day in week.days
    ]
