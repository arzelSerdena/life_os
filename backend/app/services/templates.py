"""Task templates, as in Notion, and recurring tasks (templates with a repeat rule)."""

from collections.abc import Sequence
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app import clock, rrules
from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import Task, TaskTemplate, TaskTemplateSubtask
from app.models.base import utc_now
from app.schemas.task import TaskMove
from app.schemas.task_template import (
    SeriesEdit,
    TaskFromTemplate,
    TaskTemplateCreate,
    TaskTemplateUpdate,
)
from app.services.history import ChangeRecorder
from app.services.ownership import ensure_owner_open, resolve_owner
from app.services.task_rules import cancel_open_subtasks, next_position, task_from_template

SCHEDULE_FIELDS = ("rrule", "repeat_from", "starts_on", "ends_on", "due_offset_days", "due_time")
COPIED_TO_OCCURRENCES = ("title", "notes", "priority")
SPLIT_COPY_FIELDS = (
    "life_area_id",
    "project_id",
    "section_id",
    "title",
    "notes",
    "priority",
    "due_offset_days",
    "due_time",
    "rrule",
    "repeat_from",
    "paused_at",
)


# ---------- Templates ----------


def list_templates(
    session: Session, *, include_archived: bool = False, repeating: bool | None = None
) -> Sequence[TaskTemplate]:
    query = select(TaskTemplate).options(selectinload(TaskTemplate.subtasks))
    if not include_archived:
        query = query.where(TaskTemplate.archived_at.is_(None))
    if repeating is not None:
        query = query.where(
            TaskTemplate.rrule.is_not(None) if repeating else TaskTemplate.rrule.is_(None)
        )
    return session.scalars(query.order_by(TaskTemplate.title, TaskTemplate.id)).all()


def get_template(session: Session, template_id: int) -> TaskTemplate:
    template = session.get(TaskTemplate, template_id)
    if template is None:
        raise NotFoundError(f"Template {template_id} not found")
    return template


def create_template(session: Session, data: TaskTemplateCreate) -> TaskTemplate:
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=data.section_id,
        allow_inbox=True,
    )
    fields = data.model_dump(exclude={"life_area_id", "project_id", "section_id", "subtasks"})
    _check_template(fields)
    template = TaskTemplate(
        **fields,
        life_area_id=owner.life_area_id,
        project_id=owner.project_id,
        section_id=owner.section_id,
        subtasks=_checklist(data.subtasks),
    )
    session.add(template)
    session.flush()
    _ensure_open_occurrence(session, template)
    return _save(session, template)


def update_template(session: Session, template_id: int, data: TaskTemplateUpdate) -> TaskTemplate:
    """Change the template only. Tasks already created from it don't change."""
    template = get_template(session, template_id)
    changes = data.model_dump(exclude_unset=True)
    checklist = changes.pop("subtasks", None)
    if "rrule" in changes and changes["rrule"] is None:
        # Back to a plain template: the schedule goes with the rule.
        changes.update(starts_on=None, ends_on=None, repeat_from="schedule", paused_at=None)
    _check_template({field: getattr(template, field) for field in SCHEDULE_FIELDS} | changes)

    for field, value in changes.items():
        setattr(template, field, value)
    if checklist is not None:
        template.subtasks = _checklist(checklist)
    _ensure_open_occurrence(session, template)
    return _save(session, template)


def move_template(session: Session, template_id: int, data: TaskMove) -> TaskTemplate:
    """Give the template a new owner. Tasks already created keep theirs."""
    template = get_template(session, template_id)
    owner = resolve_owner(
        session,
        life_area_id=data.life_area_id,
        project_id=data.project_id,
        section_id=data.section_id,
        allow_inbox=True,
    )
    template.life_area_id = owner.life_area_id
    template.project_id = owner.project_id
    template.section_id = owner.section_id
    return _save(session, template)


def pause_template(session: Session, template_id: int) -> TaskTemplate:
    template = get_template(session, template_id)
    if not template.is_repeating:
        raise UnprocessableError("Only a recurring task can be paused.")
    if template.paused_at is None:
        template.paused_at = utc_now()
    return _save(session, template)


def resume_template(session: Session, template_id: int) -> TaskTemplate:
    template = get_template(session, template_id)
    template.paused_at = None
    _ensure_open_occurrence(session, template)
    return _save(session, template)


def archive_template(session: Session, template_id: int) -> TaskTemplate:
    template = get_template(session, template_id)
    if template.archived_at is None:
        template.archived_at = utc_now()
    return _save(session, template)


def unarchive_template(session: Session, template_id: int) -> TaskTemplate:
    template = get_template(session, template_id)
    if template.archived_at is not None:
        ensure_owner_open(session, template.life_area_id, template.project_id)
        template.archived_at = None
        _ensure_open_occurrence(session, template)
    return _save(session, template)


def delete_template(session: Session, template_id: int) -> None:
    """Delete a template. Tasks created from it by hand stay, without the link.

    A recurring task with occurrences can only be archived: its occurrences need it.
    """
    template = get_template(session, template_id)
    has_occurrences = session.scalar(
        select(Task.id)
        .where(Task.template_id == template.id, Task.occurrence_date.is_not(None))
        .limit(1)
    )
    if has_occurrences is not None:
        raise ConflictError(
            f"Template {template_id} has occurrences, so it can't be deleted. Archive it instead."
        )
    session.execute(update(Task).where(Task.template_id == template.id).values(template_id=None))
    session.delete(template)
    session.commit()


def create_task_from_template(session: Session, template_id: int, data: TaskFromTemplate) -> Task:
    """A new task copied from the template. Its due-date offset counts from today."""
    template = get_template(session, template_id)
    if template.archived_at is not None:
        raise ConflictError(f"Template {template_id} is archived. Restore it first.")
    ensure_owner_open(session, template.life_area_id, template.project_id)
    task = task_from_template(
        template,
        scheduled_date=data.scheduled_date,
        occurrence_date=None,
        base_date=clock.today(),
        sort_order=next_position(session, data.scheduled_date),
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


# ---------- Occurrences ----------


def generate_occurrences(session: Session, first: date, last: date) -> int:
    """Create missing occurrences of schedule-based recurring tasks, from today forward.

    An occurrence that already exists is never created again, even if it was moved or
    cancelled. Returns how many were created.
    """
    if last < first:
        raise UnprocessableError("The range ends before it starts.")
    first = max(first, clock.today())
    if first > last:
        return 0

    templates = session.scalars(
        select(TaskTemplate)
        .options(selectinload(TaskTemplate.subtasks))
        .where(
            TaskTemplate.rrule.is_not(None),
            TaskTemplate.repeat_from == "schedule",
            TaskTemplate.paused_at.is_(None),
            TaskTemplate.archived_at.is_(None),
            TaskTemplate.starts_on <= last,
            (TaskTemplate.ends_on.is_(None)) | (TaskTemplate.ends_on >= first),
        )
    ).all()

    created = 0
    for template in templates:
        if not _owner_is_open(session, template):
            continue
        assert template.rrule is not None and template.starts_on is not None
        days = rrules.dates_between(
            template.rrule, template.starts_on, template.ends_on, first, last
        )
        existing = set(
            session.scalars(
                select(Task.occurrence_date).where(
                    Task.template_id == template.id, Task.occurrence_date.in_(days)
                )
            )
        )
        for day in days:
            if day not in existing:
                _add_occurrence(session, template, day)
                created += 1
    session.commit()
    return created


def after_occurrence_finished(session: Session, task: Task, history: ChangeRecorder) -> None:
    """For "repeat from completion": finishing or cancelling an occurrence creates the next.

    The new occurrence is recorded in the same batch, so undo removes it again.
    """
    if task.template_id is None or task.occurrence_date is None:
        return
    template = session.get(TaskTemplate, task.template_id)
    if template is None or template.repeat_from != "completion" or not template.generates:
        return
    if _has_open_occurrence(session, template, excluding=task.id):
        return
    assert template.rrule is not None
    next_day = rrules.next_after(template.rrule, clock.today(), template.ends_on)
    if next_day is None or _occurrence_exists(session, template, next_day):
        return
    if not _owner_is_open(session, template):
        return
    history.created(_add_occurrence(session, template, next_day))


# ---------- This and following / All ----------


def edit_series(session: Session, task_id: int, data: SeriesEdit) -> TaskTemplate:
    """Change a recurring task from one of its occurrences.

    "following" ends the series the day before this occurrence and starts a new one from
    it with the changes; "all" changes the whole series. Unfinished occurrences in range
    get the changes; done and cancelled ones never change. Can't be undone.
    """
    task, template = _occurrence_and_template(session, task_id)
    assert task.occurrence_date is not None and template.starts_on is not None
    changes = data.model_dump(exclude_unset=True, exclude={"scope"})
    checklist = changes.pop("subtasks", None)
    _check_template({field: getattr(template, field) for field in SCHEDULE_FIELDS} | changes)

    first_day: date | None = None
    target = template
    if _splits(template, task.occurrence_date, data.scope):
        target = _split(session, template, task.occurrence_date)
        first_day = task.occurrence_date

    old_offset = target.due_offset_days
    rule_changed = "rrule" in changes and changes["rrule"] != target.rrule
    for field, value in changes.items():
        setattr(target, field, value)
    if checklist is not None:
        target.subtasks = _checklist(checklist)

    _update_unfinished(session, target, changes, first_day, old_offset, rule_changed)
    _ensure_open_occurrence(session, target)
    return _save(session, target)


def cancel_series(session: Session, task_id: int, scope: str) -> tuple[TaskTemplate, str | None]:
    """Cancel a recurring task from one of its occurrences, as one undoable batch.

    "following" ends the series the day before; "all" archives it. Unfinished occurrences
    in range are cancelled; done ones stay.
    """
    task, template = _occurrence_and_template(session, task_id)
    assert task.occurrence_date is not None
    history = ChangeRecorder(session)
    now = utc_now()

    first_day: date | None = None
    if _splits(template, task.occurrence_date, scope):
        first_day = task.occurrence_date
        new_end = first_day - timedelta(days=1)
        if template.ends_on is None or template.ends_on > new_end:
            history.set(template, "ends_on", new_end)
    else:
        history.set(template, "archived_at", now)

    for occurrence in _unfinished(session, template, first_day):
        history.set(occurrence, "status", "cancelled")
        history.set(occurrence, "cancelled_at", now)
        cancel_open_subtasks(occurrence, history)

    template = _save(session, template)
    return template, history.batch_id


# ---------- Helpers ----------


def _check_template(state: dict[str, Any]) -> None:
    """The schedule rules, checked before anything changes so a refused edit leaves nothing."""
    rule, starts_on, ends_on = state.get("rrule"), state.get("starts_on"), state.get("ends_on")
    if (rule is None) != (starts_on is None):
        raise UnprocessableError(
            "A repeat rule needs a start date, and a start date needs a repeat rule."
        )
    if rule is None and (ends_on is not None or state.get("repeat_from") == "completion"):
        raise UnprocessableError(
            "Only a recurring task can have an end date or repeat from completion."
        )
    if ends_on is not None and starts_on is not None and ends_on < starts_on:
        raise UnprocessableError("The end date can't be before the start date.")
    if state.get("due_time") is not None and state.get("due_offset_days") is None:
        raise UnprocessableError("A due time needs a due-date offset.")


def _checklist(titles: list[str]) -> list[TaskTemplateSubtask]:
    return [
        TaskTemplateSubtask(title=title, sort_order=index) for index, title in enumerate(titles)
    ]


def _add_occurrence(session: Session, template: TaskTemplate, day: date) -> Task:
    task = task_from_template(
        template,
        scheduled_date=day,
        occurrence_date=day,
        base_date=day,
        sort_order=next_position(session, day),
    )
    session.add(task)
    session.flush()
    return task


def _ensure_open_occurrence(session: Session, template: TaskTemplate) -> None:
    """A "repeat from completion" task always has one open occurrence while it runs."""
    if template.repeat_from != "completion" or not template.generates:
        return
    if _has_open_occurrence(session, template) or not _owner_is_open(session, template):
        return
    assert template.starts_on is not None
    day = max(template.starts_on, clock.today())
    if template.ends_on is not None and day > template.ends_on:
        return
    if not _occurrence_exists(session, template, day):
        _add_occurrence(session, template, day)


def _has_open_occurrence(
    session: Session, template: TaskTemplate, *, excluding: int | None = None
) -> bool:
    query = select(Task.id).where(
        Task.template_id == template.id,
        Task.occurrence_date.is_not(None),
        Task.status == "todo",
        Task.archived_at.is_(None),
    )
    if excluding is not None:
        query = query.where(Task.id != excluding)
    return session.scalar(query.limit(1)) is not None


def _occurrence_exists(session: Session, template: TaskTemplate, day: date) -> bool:
    query = select(Task.id).where(Task.template_id == template.id, Task.occurrence_date == day)
    return session.scalar(query) is not None


def _owner_is_open(session: Session, template: TaskTemplate) -> bool:
    try:
        ensure_owner_open(session, template.life_area_id, template.project_id)
    except ConflictError:
        return False
    return True


def _occurrence_and_template(session: Session, task_id: int) -> tuple[Task, TaskTemplate]:
    task = session.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    if task.occurrence_date is None or task.template_id is None:
        raise UnprocessableError(f"Task {task_id} isn't an occurrence of a recurring task.")
    template = get_template(session, task.template_id)
    if template.archived_at is not None:
        raise ConflictError("This recurring task is archived. Restore it first.")
    return task, template


def _splits(template: TaskTemplate, day: date, scope: str) -> bool:
    """Whether "this and following" needs a new series.

    From the first occurrence it is the same as "all". A "repeat from completion" task has
    only one open occurrence, so "following" also means "all".
    """
    assert template.starts_on is not None
    return scope == "following" and template.repeat_from == "schedule" and day > template.starts_on


def _split(session: Session, template: TaskTemplate, day: date) -> TaskTemplate:
    """End the series the day before `day` and continue it as a new series from `day`.

    Every occurrence from `day` on, finished or not, moves to the new series, so none is
    ever generated twice.
    """
    continuation = TaskTemplate(
        **{field: getattr(template, field) for field in SPLIT_COPY_FIELDS},
        starts_on=day,
        ends_on=template.ends_on,
        subtasks=[
            TaskTemplateSubtask(title=item.title, sort_order=item.sort_order)
            for item in template.subtasks
        ],
    )
    template.ends_on = day - timedelta(days=1)
    session.add(continuation)
    session.flush()
    session.execute(
        update(Task)
        .where(Task.template_id == template.id, Task.occurrence_date >= day)
        .values(template_id=continuation.id)
    )
    session.expire_all()
    return continuation


def _unfinished(session: Session, template: TaskTemplate, first_day: date | None) -> list[Task]:
    query = select(Task).where(
        Task.template_id == template.id,
        Task.occurrence_date.is_not(None),
        Task.status == "todo",
        Task.archived_at.is_(None),
    )
    if first_day is not None:
        query = query.where(Task.occurrence_date >= first_day)
    return list(session.scalars(query))


def _update_unfinished(
    session: Session,
    template: TaskTemplate,
    changes: dict[str, Any],
    first_day: date | None,
    old_offset: int | None,
    rule_changed: bool,
) -> None:
    today = clock.today()
    for occurrence in _unfinished(session, template, first_day):
        assert occurrence.occurrence_date is not None
        unmoved = occurrence.scheduled_date == occurrence.occurrence_date
        if (
            rule_changed
            and template.repeat_from == "schedule"
            and unmoved
            and occurrence.occurrence_date >= today
        ):
            # Its date may no longer be in the series. It is generated again if it is.
            session.delete(occurrence)
            continue
        for field in COPIED_TO_OCCURRENCES:
            if field in changes:
                setattr(occurrence, field, changes[field])
        if "due_offset_days" in changes or "due_time" in changes:
            _update_due(occurrence, template, old_offset)


def _update_due(occurrence: Task, template: TaskTemplate, old_offset: int | None) -> None:
    """Move the due date with the new offset, unless it was changed by hand."""
    assert occurrence.occurrence_date is not None
    expected = (
        occurrence.occurrence_date + timedelta(days=old_offset) if old_offset is not None else None
    )
    if occurrence.due_date != expected:
        return
    offset = template.due_offset_days
    occurrence.due_date = (
        occurrence.occurrence_date + timedelta(days=offset) if offset is not None else None
    )
    occurrence.due_time = template.due_time if occurrence.due_date is not None else None


def _save(session: Session, template: TaskTemplate) -> TaskTemplate:
    session.commit()
    session.refresh(template)
    return template
