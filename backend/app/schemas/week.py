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
    """Monday to Sunday. Unscheduled holds every to-do task with no date."""

    week_start: date
    week_end: date
    today: date
    unscheduled: list[TaskRead]
    days: list[DayRead]
