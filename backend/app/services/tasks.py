from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import Subtask, Task
from app.models.base import utc_now
from app.schemas.task import (
    SubtaskCreate,
    SubtaskUpdate,
    TaskCreate,
    TaskMove,
    TaskReorder,
    TaskUpdate,
)
from app.services import templates
from app.services.history import ChangeRecorder
from app.services.ownership import ensure_owner_open, resolve_owner
from app.services.task_rules import cancel_open_subtasks, next_position

PRIORITY_RANK = case({"high": 0, "medium": 1, "low": 2, "none": 3}, value=Task.priority, else_=3)


@dataclass(frozen=True)
class TaskFilters:
    life_area_id: int | None = None
    project_id: int | None = None
    inbox: bool = False
    scheduled_from: date | None = None
    scheduled_to: date | None = None
    unscheduled: bool = False
    include_cancelled: bool = False
    include_archived: bool = False


@dataclass(frozen=True)
class TaskChange:
    task: Task
    batch_id: str | None


def list_tasks(session: Session, filters: TaskFilters) -> Sequence[Task]:
    if filters.inbox and (filters.life_area_id is not None or filters.project_id is not None):
        raise UnprocessableError("The Inbox has no life area or project to filter by.")
    if filters.unscheduled and (filters.scheduled_from or filters.scheduled_to):
        raise UnprocessableError("Unscheduled tasks have no date range.")

    query = select(Task).options(selectinload(Task.subtasks))
    if filters.inbox:
        query = query.where(Task.life_area_id.is_(None))
    if filters.life_area_id is not None:
        query = query.where(Task.life_area_id == filters.life_area_id)
    if filters.project_id is not None:
        query = query.where(Task.project_id == filters.project_id)
    if filters.unscheduled:
        query = query.where(Task.scheduled_date.is_(None))
    if filters.scheduled_from is not None:
        query = query.where(Task.scheduled_date >= filters.scheduled_from)
    if filters.scheduled_to is not None:
        query = query.where(Task.scheduled_date <= filters.scheduled_to)
    if not filters.include_cancelled:
        query = query.where(Task.status != "cancelled")
    if not filters.include_archived:
        query = query.where(Task.archived_at.is_(None))

    query = query.order_by(Task.scheduled_date, Task.sort_order, PRIORITY_RANK, Task.id)
    return session.scalars(query).all()


def get_task(session: Session, task_id: int) -> Task:
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    return task


def create_task(session: Session, data: TaskCreate) -> Task:
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=data.section_id,
        allow_inbox=True,
    )
    task = Task(
        **data.model_dump(exclude={"life_area_id", "project_id", "section_id", "subtasks"}),
        life_area_id=owner.life_area_id,
        project_id=owner.project_id,
        section_id=owner.section_id,
        sort_order=next_position(session, data.scheduled_date),
        subtasks=[
            Subtask(title=title, sort_order=position)
            for position, title in enumerate(data.subtasks)
        ],
    )
    session.add(task)
    return _save(session, task)


def update_task(session: Session, task_id: int, data: TaskUpdate) -> Task:
    task = get_task(session, task_id)
    changes = data.model_dump(exclude_unset=True)
    # Check the result before touching the task, so a refused edit leaves nothing behind.
    due_date = changes.get("due_date", task.due_date)
    if changes.get("due_time", task.due_time) is not None and due_date is None:
        raise UnprocessableError("A due time needs a due date.")
    for field, value in changes.items():
        setattr(task, field, value)
    return _save(session, task)


def reorder_tasks(session: Session, data: TaskReorder) -> list[Task]:
    """Set the order of a day's tasks, or of the unscheduled list, in one step."""
    if len(set(data.task_ids)) != len(data.task_ids):
        raise UnprocessableError("A task can only appear once in the new order.")
    listed = [get_task(session, task_id) for task_id in data.task_ids]
    for task in listed:
        if task.scheduled_date != data.scheduled_date:
            where = data.scheduled_date or "the unscheduled list"
            raise UnprocessableError(f"Task {task.id} isn't on {where}.")
    same_day = (
        Task.scheduled_date.is_(None)
        if data.scheduled_date is None
        else Task.scheduled_date == data.scheduled_date
    )
    others = session.scalars(
        select(Task)
        .where(same_day, Task.id.not_in(data.task_ids))
        .order_by(Task.sort_order, Task.id)
    ).all()
    for position, task in enumerate([*listed, *others]):
        task.sort_order = position
    session.commit()
    return listed


def move_task(session: Session, task_id: int, data: TaskMove) -> TaskChange:
    """Give the task a new owner. Moving to another project clears its section."""
    task = get_task(session, task_id)
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=data.section_id,
        allow_inbox=True,
    )
    history = ChangeRecorder(session)
    history.set(task, "life_area_id", owner.life_area_id)
    history.set(task, "project_id", owner.project_id)
    history.set(task, "section_id", owner.section_id)
    return TaskChange(_save(session, task), history.batch_id)


def complete_task(session: Session, task_id: int) -> TaskChange:
    return _finish(session, task_id, status="done", timestamp_field="completed_at")


def cancel_task(session: Session, task_id: int) -> TaskChange:
    return _finish(session, task_id, status="cancelled", timestamp_field="cancelled_at")


def reopen_task(session: Session, task_id: int) -> TaskChange:
    """Back to to-do. Subtasks the task cancelled stay cancelled; undo restores them."""
    task = _get_unarchived(session, task_id)
    if task.status == "todo":
        raise ConflictError(f"Task {task_id} is already to-do.")
    ensure_owner_open(session, task.life_area_id, task.project_id)
    history = ChangeRecorder(session)
    history.set(task, "status", "todo")
    history.set(task, "completed_at", None)
    history.set(task, "cancelled_at", None)
    return TaskChange(_save(session, task), history.batch_id)


def archive_task(session: Session, task_id: int) -> TaskChange:
    """Hide the task and cancel its open subtasks. Archiving twice changes nothing."""
    task = get_task(session, task_id)
    history = ChangeRecorder(session)
    if task.archived_at is None:
        history.set(task, "archived_at", utc_now())
        cancel_open_subtasks(task, history)
    return TaskChange(_save(session, task), history.batch_id)


def unarchive_task(session: Session, task_id: int) -> TaskChange:
    task = get_task(session, task_id)
    history = ChangeRecorder(session)
    if task.archived_at is not None:
        ensure_owner_open(session, task.life_area_id, task.project_id)
        history.set(task, "archived_at", None)
    return TaskChange(_save(session, task), history.batch_id)


def delete_task(session: Session, task_id: int) -> None:
    task = get_task(session, task_id)
    if task.occurrence_date is not None:
        # A deleted occurrence would be generated again on the next visit to its week.
        raise ConflictError(
            f"Task {task_id} is an occurrence of a recurring task. Cancel it instead."
        )
    session.delete(task)
    session.commit()


def create_subtask(session: Session, task_id: int, data: SubtaskCreate) -> Subtask:
    task = get_task(session, task_id)
    last_position = session.scalar(
        select(func.max(Subtask.sort_order)).where(Subtask.task_id == task.id)
    )
    subtask = Subtask(
        task_id=task.id,
        title=data.title,
        sort_order=0 if last_position is None else last_position + 1,
    )
    session.add(subtask)
    return _save(session, subtask)


def update_subtask(session: Session, subtask_id: int, data: SubtaskUpdate) -> Subtask:
    subtask = _get_subtask(session, subtask_id)
    changes = data.model_dump(exclude_unset=True)
    new_status = changes.pop("status", None)
    for field, value in changes.items():
        setattr(subtask, field, value)
    if new_status is not None and new_status != subtask.status:
        # Status and its timestamps change together, in one UPDATE.
        now = utc_now()
        subtask.status = new_status
        subtask.completed_at = now if new_status == "done" else None
        subtask.cancelled_at = now if new_status == "cancelled" else None
    return _save(session, subtask)


def delete_subtask(session: Session, subtask_id: int) -> None:
    session.delete(_get_subtask(session, subtask_id))
    session.commit()


def _finish(session: Session, task_id: int, *, status: str, timestamp_field: str) -> TaskChange:
    """Mark the task done or cancelled, and cancel its open subtasks, as one undoable batch."""
    task = _get_unarchived(session, task_id)
    if task.status != "todo":
        raise ConflictError(f"Task {task_id} is already {task.status}. Reopen it first.")
    history = ChangeRecorder(session)
    history.set(task, "status", status)
    history.set(task, timestamp_field, utc_now())
    cancel_open_subtasks(task, history)
    templates.after_occurrence_finished(session, task, history)
    return TaskChange(_save(session, task), history.batch_id)


def _get_unarchived(session: Session, task_id: int) -> Task:
    task = get_task(session, task_id)
    if task.archived_at is not None:
        raise ConflictError(f"Task {task_id} is archived. Restore it first.")
    return task


def _get_subtask(session: Session, subtask_id: int) -> Subtask:
    subtask = session.get(Subtask, subtask_id)
    if subtask is None:
        raise NotFoundError(f"Subtask {subtask_id} not found")
    return subtask


def _save[T: (Task, Subtask)](session: Session, item: T) -> T:
    session.commit()
    session.refresh(item)  # picks up database-set values such as updated_at
    return item
