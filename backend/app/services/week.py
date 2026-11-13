"""The week board: Unscheduled plus seven days of tasks and event occurrences."""

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app import clock
from app.models import Task
from app.services import events, rollover, routines, tasks, templates


@dataclass(frozen=True)
class WeekFilters:
    life_area_id: int | None = None
    project_id: int | None = None
    include_cancelled: bool = False


@dataclass(frozen=True)
class Day:
    day: date
    tasks: list[Task]
    events: list[events.Occurrence]
    routine_steps: list[routines.StepDay]


@dataclass(frozen=True)
class Week:
    start: date
    end: date
    today: date
    unscheduled: list[Task]
    days: list[Day]


def get_week(session: Session, any_day: date, filters: WeekFilters) -> Week:
    """The Monday-to-Sunday week containing `any_day`.

    Rolls unfinished tasks from past days over to today and creates the week's missing
    recurring tasks first. Both are safe to repeat: a second call changes nothing.
    """
    start = any_day - timedelta(days=any_day.weekday())
    end = start + timedelta(days=6)

    rollover.roll_over(session)
    templates.generate_occurrences(session, start, end)

    scheduled = tasks.list_tasks(
        session,
        tasks.TaskFilters(
            life_area_id=filters.life_area_id,
            project_id=filters.project_id,
            scheduled_from=start,
            scheduled_to=end,
            include_cancelled=filters.include_cancelled,
        ),
    )
    unscheduled = [
        task
        for task in tasks.list_tasks(
            session,
            tasks.TaskFilters(
                life_area_id=filters.life_area_id,
                project_id=filters.project_id,
                unscheduled=True,
            ),
        )
        if task.status == "todo"
    ]
    occurrences = events.list_occurrences(
        session,
        start,
        end,
        events.OccurrenceFilters(
            life_area_id=filters.life_area_id,
            project_id=filters.project_id,
            include_cancelled=filters.include_cancelled,
        ),
    )

    week_days = [start + timedelta(days=offset) for offset in range(7)]
    due_steps = routines.steps_for_days(
        session, week_days, life_area_id=filters.life_area_id, project_id=filters.project_id
    )

    days = []
    for day in week_days:
        days.append(
            Day(
                day=day,
                tasks=[task for task in scheduled if task.scheduled_date == day],
                # A multi-day event appears on every day it covers.
                events=[o for o in occurrences if o.start_date <= day <= o.end_date],
                routine_steps=due_steps[day],
            )
        )
    return Week(start=start, end=end, today=clock.today(), unscheduled=unscheduled, days=days)
