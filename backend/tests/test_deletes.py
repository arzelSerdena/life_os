"""Delete rules: hard deletes, never recorded for undo. Today is Monday 16 November 2026."""

from datetime import date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.models import EventException, Subtask, Task
from app.services import templates
from tests.factories import make_life_area, preview_rows

TODAY = date(2026, 11, 16)


@pytest.fixture(autouse=True)
def pinned_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)
    monkeypatch.setattr(clock, "now", lambda: datetime(2026, 11, 16, 12, 0))


@pytest.fixture
def area(session: Session) -> int:
    return make_life_area(session).id


def _ok(response: Any, status_code: int = 200) -> Any:
    assert response.status_code == status_code, response.text
    return None if status_code == 204 else response.json()


# ---------- Tasks ----------


def test_deleting_a_task_deletes_its_subtasks(client: TestClient, session: Session) -> None:
    task = _ok(client.post("/api/tasks", json={"title": "Pack"}), 201)
    _ok(client.post(f"/api/tasks/{task['id']}/subtasks", json={"title": "Socks"}), 201)

    _ok(client.delete(f"/api/tasks/{task['id']}"), 204)

    assert session.scalars(select(Subtask)).all() == []


# ---------- Task templates ----------


@pytest.fixture
def series(client: TestClient, session: Session) -> dict[str, Any]:
    """A daily recurring task with one done, one cancelled and two open occurrences, and
    a task made from it by hand."""
    template = _ok(
        client.post(
            "/api/task-templates",
            json={
                "title": "Stretch",
                "rrule": "FREQ=DAILY",
                "starts_on": "2026-11-16",
                "subtasks": ["Hips", "Back"],
            },
        ),
        201,
    )
    templates.generate_occurrences(session, TODAY, date(2026, 11, 19))
    occurrences = session.scalars(
        select(Task).where(Task.template_id == template["id"]).order_by(Task.occurrence_date)
    ).all()
    _ok(client.post(f"/api/tasks/{occurrences[0].id}/complete"))
    _ok(client.post(f"/api/tasks/{occurrences[1].id}/cancel"))
    _ok(client.post(f"/api/task-templates/{template['id']}/tasks", json={}), 201)
    return template


def test_the_template_delete_preview_counts_what_goes(
    client: TestClient, series: dict[str, Any]
) -> None:
    preview = _ok(client.get(f"/api/task-templates/{series['id']}/delete-preview"))

    assert preview_rows(preview) == {
        "deleted": [
            ("subtask", "Hips"),
            ("subtask", "Back"),
            ("task", "Stretch"),
            ("task", "Stretch"),
        ],
        "kept": [("task", "Stretch"), ("task", "Stretch")],
    }
    finished = preview["groups"][1]["rows"][0]
    assert finished["finished"] is True
    assert finished["counts"] == [{"of": "done", "count": 1}, {"of": "cancelled", "count": 1}]


def test_deleting_a_recurring_task_keeps_finished_occurrences_as_plain_tasks(
    client: TestClient, session: Session, series: dict[str, Any]
) -> None:
    _ok(client.delete(f"/api/task-templates/{series['id']}"), 204)

    tasks = session.scalars(select(Task).order_by(Task.id)).all()
    assert [(task.status, task.template_id, task.occurrence_date) for task in tasks] == [
        ("done", None, None),
        ("cancelled", None, None),
        ("todo", None, None),  # made by hand
    ]
    # The open occurrences went with their copied checklists.
    kept_ids = {task.id for task in tasks}
    assert {subtask.task_id for subtask in session.scalars(select(Subtask))} <= kept_ids
    assert client.get(f"/api/task-templates/{series['id']}").status_code == 404


def test_a_deleted_series_generates_nothing(
    client: TestClient, session: Session, series: dict[str, Any]
) -> None:
    _ok(client.delete(f"/api/task-templates/{series['id']}"), 204)

    assert templates.generate_occurrences(session, TODAY, date(2026, 11, 22)) == 0


def test_undoing_a_change_to_a_deleted_occurrence_is_refused(
    client: TestClient, session: Session, series: dict[str, Any]
) -> None:
    open_task = session.scalars(
        select(Task).where(
            Task.template_id == series["id"],
            Task.occurrence_date.is_not(None),
            Task.status == "todo",
        )
    ).first()
    assert open_task is not None
    change = _ok(client.post(f"/api/tasks/{open_task.id}/archive"))
    _ok(client.delete(f"/api/task-templates/{series['id']}"), 204)

    assert client.post(f"/api/undo/{change['batch_id']}").status_code == 409


# ---------- Events ----------


def _weekly(client: TestClient, area: int) -> dict[str, Any]:
    body = {
        "title": "Gym",
        "start_date": "2026-11-16",
        "rrule": "FREQ=WEEKLY",
        "life_area_id": area,
    }
    return _ok(client.post("/api/events", json=body), 201)


def _days(client: TestClient) -> list[str]:
    params = {"first": "2026-11-16", "last": "2026-12-13"}
    occurrences = _ok(client.get("/api/events/occurrences", params=params))
    return [occurrence["start_date"] for occurrence in occurrences]


def _delete(client: TestClient, event: dict[str, Any], day: str, scope: str) -> Any:
    url = f"/api/events/{event['id']}/occurrences/{day}/delete"
    return client.post(url, json={"scope": scope})


def test_deleting_this_occurrence_cancels_it(client: TestClient, area: int) -> None:
    event = _weekly(client, area)

    result = _ok(_delete(client, event, "2026-11-23", "this"))

    assert result["event"]["id"] == event["id"]
    assert _days(client) == ["2026-11-16", "2026-11-30", "2026-12-07"]


def test_deleting_following_ends_the_series_and_drops_later_changes(
    client: TestClient, session: Session, area: int
) -> None:
    event = _weekly(client, area)
    for day in ("2026-11-23", "2026-12-07"):
        url = f"/api/events/{event['id']}/occurrences/{day}/edit"
        _ok(client.post(url, json={"scope": "this", "title": "Legs"}))

    result = _ok(_delete(client, event, "2026-11-30", "following"))

    assert result["event"]["repeat_ends_on"] == "2026-11-29"
    assert _days(client) == ["2026-11-16", "2026-11-23"]
    exceptions = session.scalars(select(EventException)).all()
    assert [exception.occurrence_date for exception in exceptions] == [date(2026, 11, 23)]


@pytest.mark.parametrize(("day", "scope"), [("2026-11-16", "following"), ("2026-11-30", "all")])
def test_deleting_the_whole_series(client: TestClient, area: int, day: str, scope: str) -> None:
    event = _weekly(client, area)

    result = _ok(_delete(client, event, day, scope))

    assert result == {"event": None}
    assert client.get(f"/api/events/{event['id']}").status_code == 404


def _preview(client: TestClient, event: dict[str, Any], **params: str) -> Any:
    return _ok(client.get(f"/api/events/{event['id']}/delete-preview", params=params))


def test_the_event_delete_preview_follows_the_scope(client: TestClient, area: int) -> None:
    event = _weekly(client, area)
    base = f"/api/events/{event['id']}/occurrences"
    _ok(client.post(f"{base}/2026-11-23/cancel", json={"scope": "this"}))
    _ok(client.post(f"{base}/2026-12-07/edit", json={"scope": "this", "start_date": "2026-12-08"}))

    this = _preview(client, event, day="2026-11-30", scope="this")
    following = _preview(client, event, day="2026-11-30", scope="following")
    everything = _preview(client, event)

    assert this["groups"] == []
    assert preview_rows(following) == {"deleted": [("event", "Gym"), ("moved_occurrence", None)]}
    cut = following["groups"][0]["rows"][0]
    assert (cut["date"], cut["and_later"], cut["rrule"]) == ("2026-11-30", True, None)
    moved = following["groups"][0]["rows"][1]
    assert (moved["date"], moved["moved_to"]) == ("2026-12-07", "2026-12-08")
    assert preview_rows(everything) == {
        "deleted": [("event", "Gym"), ("skipped_occurrence", None), ("moved_occurrence", None)]
    }
    whole = everything["groups"][0]["rows"][0]
    assert (whole["rrule"], whole["from_date"]) == ("FREQ=WEEKLY", "2026-11-16")
    assert (everything["past_occurrences"], everything["has_upcoming"]) == (0, True)
    assert (
        client.get(
            f"/api/events/{event['id']}/delete-preview", params={"day": "2026-11-24"}
        ).status_code
        == 404
    )


def test_deleting_an_occurrence_needs_a_real_one(client: TestClient, area: int) -> None:
    event = _weekly(client, area)
    one_off = _ok(
        client.post(
            "/api/events",
            json={"title": "Dentist", "start_date": "2026-11-20", "life_area_id": area},
        ),
        201,
    )

    assert _delete(client, event, "2026-11-24", "this").status_code == 404
    assert _delete(client, one_off, "2026-11-20", "all").status_code == 422


# ---------- Routines ----------


def test_the_routine_delete_preview_counts_what_goes(client: TestClient, area: int) -> None:
    routine = _ok(client.post("/api/routines", json={"title": "Morning"}), 201)
    steps = [
        _ok(
            client.post(
                f"/api/routines/{routine['id']}/steps", json={"title": title, "life_area_id": area}
            ),
            201,
        )
        for title in ("Stretch", "Read")
    ]
    url = f"/api/routine-steps/{steps[0]['id']}"
    _ok(client.put(f"{url}/days/2026-11-16", json={"status": "done"}))
    _ok(client.post(f"{url}/pause"))

    routine_preview = _ok(client.get(f"/api/routines/{routine['id']}/delete-preview"))
    step_preview = _ok(client.get(f"{url}/delete-preview"))

    assert preview_rows(routine_preview) == {
        "deleted": [
            ("routine_step", "Stretch"),
            ("routine_step", "Read"),
            ("history", None),
            ("pauses", None),
            ("schedules", None),
        ]
    }
    rows = routine_preview["groups"][0]["rows"]
    assert rows[0]["context"] == "Health"
    assert rows[2]["counts"] == [{"of": "logs", "count": 1}, {"of": "days", "count": 1}]
    assert routine_preview["metrics"] == []
    assert preview_rows(step_preview) == {"deleted": [("history", None), ("pauses", None)]}
    _ok(client.delete(f"/api/routines/{routine['id']}"), 204)
    assert client.get(f"{url}/delete-preview").status_code == 404
