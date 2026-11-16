from datetime import date

from pydantic import BaseModel

from app.schemas.event import OccurrenceRead
from app.schemas.routine import RoutineStepDay
from app.schemas.task import TaskRead


class DayRead(BaseModel):
    day: date
    tasks: list[TaskRead]
    events: list[OccurrenceRead]
    routine_steps: list[RoutineStepDay]


class WeekRead(BaseModel):
    """Monday to Sunday. A task sits on its scheduled date, else its due date; Unscheduled
    holds every to-do task with neither."""

    week_start: date
    week_end: date
    today: date
    unscheduled: list[TaskRead]
    days: list[DayRead]


class DaysRead(BaseModel):
    """A run of days from `start` to `end` (Next 7 days: today and the six after it), placed
    as on the week board, plus Unscheduled."""

    start: date
    end: date
    today: date
    unscheduled: list[TaskRead]
    days: list[DayRead]
