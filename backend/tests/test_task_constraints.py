"""Rules the database enforces on its own, so they hold even if the service is bypassed."""

from datetime import date, time
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Subtask, Task, TaskTemplate
from tests.factories import make_life_area, make_project, make_section


def _rejected(session: Session, item: Any) -> None:
    session.add(item)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_task_must_share_its_projects_life_area(session: Session) -> None:
    health = make_life_area(session, "Health")
    career = make_life_area(session, "Career")
    project = make_project(session, health)

    _rejected(session, Task(title="Run", project_id=project.id, life_area_id=career.id))


def test_project_link_needs_a_life_area(session: Session) -> None:
    project = make_project(session, make_life_area(session))

    _rejected(session, Task(title="Run", project_id=project.id))


def test_section_must_be_in_the_tasks_project(session: Session) -> None:
    life_area = make_life_area(session)
    marathon = make_project(session, life_area, "Marathon")
    other = make_project(session, life_area, "Other")
    section = make_section(session, other)

    _rejected(
        session,
        Task(title="Run", life_area_id=life_area.id, project_id=marathon.id, section_id=section.id),
    )


def test_moving_a_project_moves_its_items(session: Session) -> None:
    health = make_life_area(session, "Health")
    career = make_life_area(session, "Career")
    project = make_project(session, health)
    task = Task(title="Run", life_area_id=health.id, project_id=project.id)
    template = TaskTemplate(title="Stretch", life_area_id=health.id, project_id=project.id)
    session.add_all([task, template])
    session.commit()

    project.life_area_id = career.id
    session.commit()
    session.expire_all()

    assert task.life_area_id == career.id
    assert template.life_area_id == career.id


def test_deleting_a_section_in_use_is_blocked(session: Session) -> None:
    life_area = make_life_area(session)
    project = make_project(session, life_area)
    section = make_section(session, project)
    session.add(
        Task(title="Run", life_area_id=life_area.id, project_id=project.id, section_id=section.id)
    )
    session.commit()

    session.delete(section)
    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize(
    "fields",
    [
        {"priority": "urgent"},
        {"status": "done"},  # no completed_at
        {"due_time": time(9, 0)},  # no due_date
        {"occurrence_date": date(2026, 11, 16)},  # no template
        {"title": ""},
    ],
)
def test_task_checks(session: Session, fields: dict[str, Any]) -> None:
    _rejected(session, Task(**{"title": "Run", **fields}))


def test_one_occurrence_per_template_per_date(session: Session) -> None:
    template = TaskTemplate(title="Review", rrule="FREQ=WEEKLY", starts_on=date(2026, 11, 16))
    session.add(template)
    session.commit()
    session.add(Task(title="Review", template_id=template.id, occurrence_date=date(2026, 11, 16)))
    session.commit()

    _rejected(
        session, Task(title="Review", template_id=template.id, occurrence_date=date(2026, 11, 16))
    )


def test_tasks_created_by_hand_from_a_template_need_no_occurrence_date(session: Session) -> None:
    template = TaskTemplate(title="Pack for a trip")
    session.add(template)
    session.commit()

    session.add_all([Task(title="Pack", template_id=template.id) for _ in range(2)])
    session.commit()


@pytest.mark.parametrize(
    "fields",
    [
        {"rrule": "FREQ=DAILY"},  # no starts_on
        {"starts_on": date(2026, 11, 16)},  # no rrule
        {"repeat_from": "completion"},  # only for repeating templates
        {"ends_on": date(2026, 12, 1)},
        {"due_time": time(9, 0)},  # no due offset
        {"due_offset_days": -1},
    ],
)
def test_template_schedule_checks(session: Session, fields: dict[str, Any]) -> None:
    _rejected(session, TaskTemplate(**{"title": "Review", **fields}))


def test_deleting_a_task_deletes_its_subtasks(session: Session) -> None:
    task = Task(title="Pack", subtasks=[Subtask(title="Shoes"), Subtask(title="Watch")])
    session.add(task)
    session.commit()

    session.delete(task)
    session.commit()

    assert session.scalars(select(Subtask)).all() == []
