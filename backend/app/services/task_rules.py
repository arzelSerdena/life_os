"""Task helpers shared by the tasks and templates services."""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Subtask, Task, TaskTemplate
from app.models.base import utc_now
from app.services.history import ChangeRecorder


def next_position(session: Session, scheduled_date: date | None) -> int:
    """New tasks go to the end of their day, or of the unscheduled list."""
    same_day = (
        Task.scheduled_date.is_(None)
        if scheduled_date is None
        else Task.scheduled_date == scheduled_date
    )
    last_position = session.scalar(select(func.max(Task.sort_order)).where(same_day))
    return 0 if last_position is None else last_position + 1


def cancel_open_subtasks(task: Task, history: ChangeRecorder) -> None:
    now = utc_now()
    for subtask in task.subtasks:
        if subtask.status == "todo":
            history.set(subtask, "status", "cancelled")
            history.set(subtask, "cancelled_at", now)


def task_from_template(
    template: TaskTemplate,
    *,
    scheduled_date: date | None,
    occurrence_date: date | None,
    base_date: date,
    sort_order: int,
) -> Task:
    """A new task copied from the template, including its checklist.

    base_date is what the due-date offset counts from: the occurrence date for a
    recurring task, or the day a task is created from the template by hand.
    """
    due_date = (
        base_date + timedelta(days=template.due_offset_days)
        if template.due_offset_days is not None
        else None
    )
    return Task(
        life_area_id=template.life_area_id,
        project_id=template.project_id,
        section_id=template.section_id,
        template_id=template.id,
        occurrence_date=occurrence_date,
        title=template.title,
        notes=template.notes,
        priority=template.priority,
        scheduled_date=scheduled_date,
        due_date=due_date,
        due_time=template.due_time if due_date is not None else None,
        sort_order=sort_order,
        subtasks=[
            Subtask(title=item.title, sort_order=item.sort_order) for item in template.subtasks
        ],
    )
