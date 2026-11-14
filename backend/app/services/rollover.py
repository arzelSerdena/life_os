"""Rollover: unfinished one-off tasks from past days move to today."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.models import Task
from app.services.task_rules import next_position


def roll_over(session: Session) -> int:
    """Move every unfinished one-off task scheduled before today onto today.

    It lands at the end of today's list, keeping its order with other moved tasks, and
    rollover_count goes up by 1 however many days it missed. Recurring occurrences don't
    roll over, due dates don't change, and nothing is recorded for undo. Running it again
    the same day changes nothing. Returns how many tasks moved.
    """
    today = clock.today()
    overdue = session.scalars(
        select(Task)
        .where(
            Task.status == "todo",
            Task.archived_at.is_(None),
            Task.occurrence_date.is_(None),
            Task.scheduled_date < today,
        )
        .order_by(Task.scheduled_date, Task.sort_order, Task.id)
    ).all()
    if not overdue:
        return 0

    position = next_position(session, today)
    for task in overdue:
        task.scheduled_date = today
        task.sort_order = position
        task.rollover_count += 1
        position += 1
    session.commit()
    return len(overdue)
