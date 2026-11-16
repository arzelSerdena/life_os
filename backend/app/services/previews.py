"""Previews for the confirm dialog: per-item rows, grouped by what happens to them.

Cascade previews come from the same plan the change applies, so the dialog lists exactly
what the change does. Delete previews read what a hard delete removes and what it keeps.
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock, rrules
from app.errors import NotFoundError
from app.models import (
    Event,
    EventException,
    LifeArea,
    Metric,
    Project,
    Routine,
    RoutineStep,
    Task,
    TaskTemplate,
)
from app.schemas.preview import (
    EventDeletePreview,
    GroupEffect,
    MetricRef,
    PreviewCount,
    PreviewGroup,
    PreviewRow,
    RoutineDeletePreview,
)
from app.services.cascades import ARCHIVE, CANCEL, Plan
from app.services.routines import metrics_using

GROUP_ORDER: list[GroupEffect] = ["cancelled", "ends_from_today", "archived", "deleted", "kept"]
EFFECT_GROUPS: dict[str, GroupEffect] = {
    ARCHIVE: "archived",
    CANCEL: "cancelled",
    "end_series": "ends_from_today",
}
# The order rows take inside a group.
KIND_ORDER = {
    Project: 0,
    Task: 1,
    Event: 2,
    TaskTemplate: 3,
    RoutineStep: 4,
    Metric: 5,
}


class _Rows:
    """Builds rows, looking up area colours and owner names once."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.today = clock.today()
        self._areas: dict[int, LifeArea] | None = None
        self._projects: dict[int, Project] = {}

    def color(self, life_area_id: int | None) -> str | None:
        if life_area_id is None:
            return None
        if self._areas is None:
            self._areas = {area.id: area for area in self.session.scalars(select(LifeArea))}
        area = self._areas.get(life_area_id)
        return None if area is None else area.color

    def owner_name(self, life_area_id: int | None, project_id: int | None) -> str | None:
        if project_id is not None:
            if project_id not in self._projects:
                project = self.session.get(Project, project_id)
                if project is not None:
                    self._projects[project_id] = project
            if project_id in self._projects:
                return self._projects[project_id].title
        self.color(life_area_id)  # loads the areas
        area = (self._areas or {}).get(life_area_id or -1)
        return None if area is None else area.title

    def task(self, task: Task) -> PreviewRow:
        finished = task.status != "todo"
        placement = task.placement_date
        return PreviewRow(
            kind="task",
            id=task.id,
            title=task.title,
            color=self.color(task.life_area_id),
            date=None if finished else placement,
            overdue=not finished and task.due_date is not None and task.due_date < self.today,
            finished=finished,
        )

    def event(self, event: Event) -> PreviewRow:
        """A repeating event shows its rule; a one-off event its day and times."""
        row = PreviewRow(
            kind="event", id=event.id, title=event.title, color=self.color(event.life_area_id)
        )
        if event.rrule is not None:
            row.rrule = event.rrule
        else:
            row.date = event.start_date
            row.start_time = event.start_time
            row.end_time = event.end_time
        return row

    def template(self, template: TaskTemplate) -> PreviewRow:
        return PreviewRow(
            kind="task_template",
            id=template.id,
            title=template.title,
            color=self.color(template.life_area_id),
            rrule=template.rrule,
        )

    def step(self, step: RoutineStep, context: str | None) -> PreviewRow:
        return PreviewRow(
            kind="routine_step",
            id=step.id,
            title=step.title,
            color=self.color(step.life_area_id),
            context=context,
        )

    def metric(self, metric: Metric) -> PreviewRow:
        return PreviewRow(
            kind="metric",
            id=metric.id,
            title=metric.title,
            color=self.color(metric.life_area_id),
            counts=_counts(entries=len(metric.entries), targets=len(metric.targets)),
        )

    def project(self, project: Project, counts: list[PreviewCount]) -> PreviewRow:
        return PreviewRow(
            kind="project",
            id=project.id,
            title=project.title,
            color=self.color(project.life_area_id),
            counts=counts,
        )


def _counts(**counts: int) -> list[PreviewCount]:
    """Counts in the order given, without the zeros."""
    return [PreviewCount(of=of, count=count) for of, count in counts.items() if count > 0]  # type: ignore[arg-type]


def _groups(groups: dict[GroupEffect, list[PreviewRow]]) -> list[PreviewGroup]:
    return [
        PreviewGroup(effect=effect, rows=groups[effect])
        for effect in GROUP_ORDER
        if groups.get(effect)
    ]


def _task_order(task: Task) -> tuple[bool, bool, date, int]:
    """Open tasks first, by day (undated last), then done and cancelled ones."""
    placement = task.placement_date
    return (task.status != "todo", placement is None, placement or date.max, task.id)


# ---------- Cascades ----------


def cascade(session: Session, plan: Plan) -> list[PreviewGroup]:
    """The plan's items by effect. Archived projects (an area's archive) show as one row
    each, with what they hold as counts, and their items aren't listed on their own."""
    rows = _Rows(session)
    projects = {
        effect.item.id: effect.item for effect in plan.effects if isinstance(effect.item, Project)
    }
    inside: dict[int, list[object]] = {project_id: [] for project_id in projects}
    listed: dict[GroupEffect, list[object]] = {}
    effects: dict[int, str] = {}
    for effect in plan.effects:
        item = effect.item
        project_id = getattr(item, "project_id", None)
        if project_id in inside and not isinstance(item, Project):
            inside[project_id].append(item)
            continue
        listed.setdefault(EFFECT_GROUPS[effect.effect], []).append(item)
        effects[id(item)] = effect.effect

    def order(item: object) -> tuple[int, tuple[bool, bool, date, int] | int]:
        rank = KIND_ORDER[type(item)]  # type: ignore[index]
        return (rank, _task_order(item) if isinstance(item, Task) else item.id)  # type: ignore[attr-defined]

    groups: dict[GroupEffect, list[PreviewRow]] = {}
    for group, items in listed.items():
        group_rows = groups.setdefault(group, [])
        for item in sorted(items, key=order):
            if isinstance(item, Project):
                group_rows.append(rows.project(item, _contents(inside[item.id])))
            elif isinstance(item, Task):
                group_rows.append(rows.task(item))
            elif isinstance(item, Event):
                row = rows.event(item)
                if effects[id(item)] == "end_series" and item.rrule is not None:
                    row.last_date = rrules.last_before(
                        item.rrule, item.start_date, item.repeat_ends_on, rows.today
                    )
                elif effects[id(item)] == CANCEL and item.rrule is not None:
                    # A series that hasn't started yet is cancelled whole.
                    row.from_date = item.start_date
                group_rows.append(row)
            elif isinstance(item, TaskTemplate):
                group_rows.append(rows.template(item))
            elif isinstance(item, RoutineStep):
                group_rows.append(rows.step(item, item.routine.title))
            elif isinstance(item, Metric):
                group_rows.append(rows.metric(item))
    return _groups(groups)


def _contents(items: list[object]) -> list[PreviewCount]:
    def count(model: type, **match: object) -> int:
        return sum(
            isinstance(item, model)
            and all(getattr(item, key) == value for key, value in match.items())
            for item in items
        )

    templates = [item for item in items if isinstance(item, TaskTemplate)]
    return _counts(
        tasks=count(Task),
        events=count(Event),
        metrics=count(Metric),
        recurring_tasks=sum(template.rrule is not None for template in templates),
        templates=sum(template.rrule is None for template in templates),
        routine_steps=count(RoutineStep),
    )


# ---------- Deletes ----------


def template_delete(session: Session, template: TaskTemplate) -> list[PreviewGroup]:
    """Its checklist and open occurrences go; done and cancelled occurrences stay as one row,
    and tasks made from it by hand stay as they are."""
    rows = _Rows(session)
    tasks = sorted(
        session.scalars(select(Task).where(Task.template_id == template.id)), key=_task_order
    )
    occurrences = [task for task in tasks if task.occurrence_date is not None]
    finished = [task for task in occurrences if task.status != "todo"]
    color = rows.color(template.life_area_id)

    deleted = [
        PreviewRow(kind="subtask", id=subtask.id, title=subtask.title, color=color)
        for subtask in template.subtasks
    ]
    deleted += [rows.task(task) for task in occurrences if task.status == "todo"]
    kept: list[PreviewRow] = []
    if finished:
        kept.append(
            PreviewRow(
                kind="task",
                title=template.title,
                color=color,
                finished=True,
                counts=_counts(
                    done=sum(task.status == "done" for task in finished),
                    cancelled=sum(task.status == "cancelled" for task in finished),
                ),
            )
        )
    kept += [rows.task(task) for task in tasks if task.occurrence_date is None]
    return _groups({"deleted": deleted, "kept": kept})


def metric_delete(metric: Metric) -> list[PreviewGroup]:
    entries, targets = len(metric.entries), len(metric.targets)
    deleted: list[PreviewRow] = []
    if entries:
        deleted.append(PreviewRow(kind="entries", counts=_counts(entries=entries)))
    if targets:
        deleted.append(PreviewRow(kind="targets", counts=_counts(targets=targets)))
    return _groups({"deleted": deleted})


def _history(steps: list[RoutineStep], routine_pauses: int = 0) -> list[PreviewRow]:
    """The steps' logged days, and their pauses (with the routine's own)."""
    logs = [log for step in steps for log in step.logs]
    pauses = routine_pauses + sum(len(step.pauses) for step in steps)
    rows: list[PreviewRow] = []
    if logs:
        days = len({log.date for log in logs})
        rows.append(PreviewRow(kind="history", counts=_counts(logs=len(logs), days=days)))
    if pauses:
        rows.append(PreviewRow(kind="pauses", counts=_counts(pauses=pauses)))
    return rows


def routine_delete(session: Session, routine: Routine) -> RoutineDeletePreview:
    rows = _Rows(session)
    steps = list(routine.steps)
    deleted = [
        rows.step(step, rows.owner_name(step.life_area_id, step.project_id)) for step in steps
    ]
    deleted += _history(steps, len(routine.pauses))
    deleted.append(PreviewRow(kind="schedules", counts=_counts(schedules=len(routine.schedules))))
    return RoutineDeletePreview(
        groups=_groups({"deleted": deleted}),
        metrics=_metric_refs(session, [step.id for step in steps]),
    )


def step_delete(session: Session, step: RoutineStep) -> RoutineDeletePreview:
    return RoutineDeletePreview(
        groups=_groups({"deleted": _history([step])}),
        metrics=_metric_refs(session, [step.id]),
    )


def _metric_refs(session: Session, step_ids: list[int]) -> list[MetricRef]:
    return [
        MetricRef(id=metric.id, title=metric.title) for metric in metrics_using(session, step_ids)
    ]


def event_delete(
    session: Session, event: Event, day: date | None, scope: str
) -> EventDeletePreview:
    """What deleting the event removes. A repeating event opened on an occurrence passes
    the day and the scope: "this" cancels only that day, so nothing is listed; "following"
    cuts the series from the day on; "all" (or "following" from the first day) deletes it
    whole. A one-off event lists nothing: it has no one-off changes."""
    rows = _Rows(session)
    today = rows.today
    if event.rrule is None:
        return EventDeletePreview(
            groups=[], past_occurrences=0, has_upcoming=event.start_date >= today
        )
    if day is not None and rrules.dates_between(
        event.rrule, event.start_date, event.repeat_ends_on, day, day
    ) != [day]:
        raise NotFoundError(f"Event {event.id} has no occurrence on {day}.")

    past = rrules.dates_between(
        event.rrule,
        event.start_date,
        event.repeat_ends_on,
        event.start_date,
        today - timedelta(days=1),
    )
    skipped = {
        exception.occurrence_date for exception in event.exceptions if exception.is_cancelled
    }
    preview = EventDeletePreview(
        groups=[],
        past_occurrences=len([past_day for past_day in past if past_day not in skipped]),
        has_upcoming=rrules.first_from(event.rrule, event.start_date, event.repeat_ends_on, today)
        is not None,
    )
    if scope == "this" and day is not None:
        return preview

    color = rows.color(event.life_area_id)
    row = PreviewRow(
        kind="event",
        id=event.id,
        title=event.title,
        color=color,
        start_time=event.start_time,
        end_time=event.end_time,
    )
    cut_from = day if scope == "following" and day is not None and day > event.start_date else None
    if cut_from is not None:
        row.date = cut_from
        row.and_later = True
    else:
        row.rrule = event.rrule
        row.from_date = event.start_date
    exceptions = sorted(
        (
            exception
            for exception in event.exceptions
            if cut_from is None or exception.occurrence_date >= cut_from
        ),
        key=lambda exception: exception.occurrence_date,
    )
    preview.groups = _groups(
        {"deleted": [row, *(_exception_row(exception, color) for exception in exceptions)]}
    )
    return preview


def _exception_row(exception: EventException, color: str | None) -> PreviewRow:
    if exception.is_cancelled:
        kind = "skipped_occurrence"
    elif exception.start_date is not None and exception.start_date != exception.occurrence_date:
        kind = "moved_occurrence"
    else:
        kind = "changed_occurrence"
    return PreviewRow(
        kind=kind,  # type: ignore[arg-type]
        id=exception.id,
        color=color,
        date=exception.occurrence_date,
        moved_to=exception.start_date if kind == "moved_occurrence" else None,
    )
