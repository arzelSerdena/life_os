from datetime import date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import (
    Event,
    LifeArea,
    Metric,
    Project,
    Routine,
    RoutineSchedule,
    RoutineStep,
    Subtask,
    Task,
    TaskTemplate,
)
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 14)
STAMP = datetime(2026, 11, 1, 12)


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


def add(session: Session, *rows: Any) -> None:
    session.add_all(rows)
    session.commit()


def fresh(session: Session, row: Any) -> Any:
    session.expire_all()
    return session.get(type(row), row.id)


def fill(session: Session, area: LifeArea, project: Project | None = None) -> dict[str, Any]:
    """One of each item, owned by the project when given, otherwise by the area."""
    owner = {"life_area_id": area.id, "project_id": project.id if project else None}
    routine = Routine(title="Morning")
    add(session, routine)
    items: dict[str, Any] = {
        "open_task": Task(title="Write", **owner),
        "done_task": Task(title="Shipped", status="done", completed_at=STAMP, **owner),
        "template": TaskTemplate(title="Weekly review", **owner),
        "upcoming_event": Event(title="Demo", start_date=TODAY + timedelta(days=3), **owner),
        "past_event": Event(title="Kickoff", start_date=TODAY - timedelta(days=10), **owner),
        "running_series": Event(
            title="Standup", start_date=TODAY - timedelta(days=30), rrule="FREQ=WEEKLY", **owner
        ),
        "future_series": Event(
            title="Retro", start_date=TODAY + timedelta(days=7), rrule="FREQ=WEEKLY", **owner
        ),
        "metric": Metric(title="Hours", aggregation="sum", **owner),
        "step": RoutineStep(routine_id=routine.id, title="Stretch", starts_on=TODAY, **owner),
    }
    add(session, RoutineSchedule(routine_id=routine.id, starts_on=TODAY), *items.values())
    items["subtask"] = Subtask(task_id=items["open_task"].id, title="Outline")
    add(session, items["subtask"])
    return items


# ---------- Life areas ----------


def test_archive_preview_lists_everything_the_area_owns(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    project = make_project(session, area, "Resume")
    fill(session, area)
    add(session, Task(title="Already hidden", life_area_id=area.id, archived_at=STAMP))

    response = client.get(f"/api/life-areas/{area.id}/archive/preview")

    assert response.status_code == 200
    items = response.json()["items"]
    assert {item["effect"] for item in items} == {"archive"}
    assert {(item["kind"], item["title"]) for item in items} == {
        ("project", project.title),
        ("task", "Write"),
        ("task", "Shipped"),
        ("task_template", "Weekly review"),
        ("event", "Demo"),
        ("event", "Kickoff"),
        ("event", "Standup"),
        ("event", "Retro"),
        ("metric", "Hours"),
        ("routine_step", "Stretch"),
    }


def test_archiving_an_area_archives_its_items_and_undo_restores_them(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    project = make_project(session, area)
    items = fill(session, area)

    body = client.post(f"/api/life-areas/{area.id}/archive").json()

    assert body["life_area"]["archived_at"] is not None
    for row in [project, *(v for k, v in items.items() if k != "subtask")]:
        assert fresh(session, row).archived_at is not None
    assert fresh(session, items["subtask"]).status == "cancelled"

    assert client.post(f"/api/undo/{body['batch_id']}").status_code == 200

    assert fresh(session, area).archived_at is None
    for row in [project, *(v for k, v in items.items() if k != "subtask")]:
        assert fresh(session, row).archived_at is None
    assert fresh(session, items["subtask"]).status == "todo"


def test_restoring_an_area_brings_back_only_what_its_archive_took(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    earlier = Task(title="Archived before", life_area_id=area.id, archived_at=STAMP)
    task = Task(title="Write", life_area_id=area.id)
    add(session, earlier, task)
    client.post(f"/api/life-areas/{area.id}/archive")

    body = client.post(f"/api/life-areas/{area.id}/unarchive").json()

    assert body["life_area"]["archived_at"] is None
    assert body["batch_id"]
    assert fresh(session, task).archived_at is None
    assert fresh(session, earlier).archived_at == STAMP


# ---------- Projects ----------


def test_completing_a_project_previews_and_applies_its_cascade(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session)
    project = make_project(session, area)
    items = fill(session, area, project)

    preview = client.get(f"/api/projects/{project.id}/preview", params={"action": "complete"})
    assert {(i["title"], i["effect"]) for i in preview.json()["items"]} == {
        ("Write", "cancel"),
        ("Demo", "cancel"),
        ("Retro", "cancel"),
        ("Standup", "end_series"),
        ("Weekly review", "archive"),
        ("Hours", "archive"),
        ("Stretch", "archive"),
    }

    body = client.post(f"/api/projects/{project.id}/complete").json()

    assert body["project"]["status"] == "done"
    assert body["project"]["completed_at"] is not None
    task = fresh(session, items["open_task"])
    assert (task.status, task.cancelled_at is not None) == ("cancelled", True)
    assert fresh(session, items["subtask"]).status == "cancelled"
    assert fresh(session, items["done_task"]).status == "done"
    assert fresh(session, items["upcoming_event"]).cancelled_at is not None
    assert fresh(session, items["past_event"]).cancelled_at is None
    assert fresh(session, items["running_series"]).repeat_ends_on == TODAY - timedelta(days=1)
    assert fresh(session, items["future_series"]).cancelled_at is not None
    for key in ("template", "metric", "step"):
        assert fresh(session, items[key]).archived_at is not None

    assert client.post(f"/api/undo/{body['batch_id']}").status_code == 200

    restored = fresh(session, project)
    assert (restored.status, restored.completed_at) == ("active", None)
    assert fresh(session, items["open_task"]).status == "todo"
    assert fresh(session, items["running_series"]).repeat_ends_on is None
    assert fresh(session, items["metric"]).archived_at is None


def test_cancelling_a_project_sets_its_cancelled_time(client: TestClient, session: Session) -> None:
    project = make_project(session, make_life_area(session))

    body = client.post(f"/api/projects/{project.id}/cancel").json()

    assert body["project"]["status"] == "cancelled"
    assert body["project"]["cancelled_at"] is not None
    assert body["project"]["completed_at"] is None


def test_reopening_a_project_makes_it_active_again(client: TestClient, session: Session) -> None:
    project = make_project(session, make_life_area(session))
    client.post(f"/api/projects/{project.id}/complete")

    body = client.post(f"/api/projects/{project.id}/reopen").json()

    assert body["project"]["status"] == "active"
    assert body["project"]["completed_at"] is None


def test_archiving_and_restoring_a_project(client: TestClient, session: Session) -> None:
    area = make_life_area(session)
    project = make_project(session, area)
    items = fill(session, area, project)

    preview = client.get(f"/api/projects/{project.id}/preview", params={"action": "archive"})
    assert {i["effect"] for i in preview.json()["items"]} == {"archive"}
    client.post(f"/api/projects/{project.id}/archive")
    assert fresh(session, items["metric"]).archived_at is not None

    body = client.post(f"/api/projects/{project.id}/unarchive").json()

    assert body["project"]["archived_at"] is None
    assert fresh(session, items["metric"]).archived_at is None
    assert fresh(session, items["open_task"]).archived_at is None


def test_a_project_in_an_archived_area_stays_put(client: TestClient, session: Session) -> None:
    area = make_life_area(session)
    project = make_project(session, area, status="done", completed_at=STAMP)
    add(session, area)
    area.archived_at = STAMP
    session.commit()

    response = client.post(f"/api/projects/{project.id}/reopen")

    assert response.status_code == 409
    assert response.json() == {"detail": f"Life area {area.id} is archived. Restore it first."}


def test_an_archived_project_cant_be_completed(client: TestClient, session: Session) -> None:
    project = make_project(session, make_life_area(session), archived_at=STAMP)

    response = client.post(f"/api/projects/{project.id}/complete")

    assert response.status_code == 409
