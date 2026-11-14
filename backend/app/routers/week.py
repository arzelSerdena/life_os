from datetime import date

from fastapi import APIRouter

from app import clock
from app.db import SessionDep
from app.schemas.event import OccurrenceRead
from app.schemas.routine import RoutineStepDay
from app.schemas.task import TaskRead
from app.schemas.week import DayRead, WeekRead
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
        days=[
            DayRead(
                day=day.day,
                tasks=[TaskRead.model_validate(task) for task in day.tasks],
                events=[OccurrenceRead.from_occurrence(o) for o in day.events],
                routine_steps=[RoutineStepDay.from_step_day(s) for s in day.routine_steps],
            )
            for day in week.days
        ],
    )
