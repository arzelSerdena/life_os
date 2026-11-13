from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.services import templates
from tests.factories import make_life_area, make_project

URL = "/api/task-templates"
TODAY = date(2026, 11, 16)  # a Monday


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


def _create(client: TestClient, title: str = "Weekly review", **fields: Any) -> dict[str, Any]:
    response = client.post(URL, json={"title": title, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def test_a_plain_template_keeps_its_checklist_and_owner(
    client: TestClient, session: Session
) -> None:
    project = make_project(session, make_life_area(session))

    body = _create(
        client,
        "Pack for a trip",
        priority="high",
        project_id=project.id,
        subtasks=["Passport", "Charger"],
        due_offset_days=2,
        due_time="18:00",
    )

    assert body["rrule"] is None
    assert body["life_area_id"] == project.life_area_id
    assert [item["title"] for item in body["subtasks"]] == ["Passport", "Charger"]


def test_a_recurring_task_stores_a_normalized_rule(client: TestClient) -> None:
    body = _create(client, rrule="freq=weekly;byday=fr", starts_on="2026-11-20")

    assert body["rrule"] == "FREQ=WEEKLY;BYDAY=FR"
    assert body["repeat_from"] == "schedule"


@pytest.mark.parametrize(
    "fields",
    [
        {"rrule": "FREQ=WEEKLY"},  # no start date
        {"starts_on": "2026-11-16"},  # no rule
        {"rrule": "FREQ=WEEKLY;COUNT=4", "starts_on": "2026-11-16"},
        {"rrule": "every week", "starts_on": "2026-11-16"},
        {"repeat_from": "completion"},
        {"ends_on": "2026-12-01"},
        {"rrule": "FREQ=DAILY", "starts_on": "2026-11-16", "ends_on": "2026-11-01"},
        {"due_time": "09:00"},
        {"due_offset_days": -1},
    ],
)
def test_create_rejects_an_invalid_schedule(client: TestClient, fields: dict[str, Any]) -> None:
    assert client.post(URL, json={"title": "Review", **fields}).status_code == 422


def test_creating_a_task_copies_the_template(client: TestClient) -> None:
    template = _create(
        client, "Pack", priority="high", notes="Light", subtasks=["Passport"], due_offset_days=3
    )

    response = client.post(f"{URL}/{template['id']}/tasks", json={"scheduled_date": "2026-11-18"})

    task = response.json()
    assert response.status_code == 201
    assert (task["title"], task["priority"], task["notes"]) == ("Pack", "high", "Light")
    assert (task["template_id"], task["occurrence_date"]) == (template["id"], None)
    assert task["scheduled_date"] == "2026-11-18"
    assert task["due_date"] == "2026-11-19"  # 3 days after today, the day it was created
    assert [subtask["title"] for subtask in task["subtasks"]] == ["Passport"]


def test_editing_a_template_leaves_existing_tasks_alone(client: TestClient) -> None:
    template = _create(client, "Pack", subtasks=["Passport"])
    task = client.post(f"{URL}/{template['id']}/tasks", json={}).json()

    updated = client.patch(
        f"{URL}/{template['id']}", json={"title": "Pack bags", "subtasks": ["Passport", "Socks"]}
    ).json()

    assert updated["title"] == "Pack bags"
    assert [item["title"] for item in updated["subtasks"]] == ["Passport", "Socks"]
    unchanged = client.get(f"/api/tasks/{task['id']}").json()
    assert unchanged["title"] == "Pack"
    assert len(unchanged["subtasks"]) == 1


def test_removing_the_rule_turns_a_recurring_task_into_a_plain_template(
    client: TestClient,
) -> None:
    template = _create(client, rrule="FREQ=DAILY", starts_on="2026-11-16", ends_on="2026-12-01")
    client.post(f"{URL}/{template['id']}/pause")

    body = client.patch(f"{URL}/{template['id']}", json={"rrule": None}).json()

    assert (body["rrule"], body["starts_on"], body["ends_on"], body["paused_at"]) == (
        None,
        None,
        None,
        None,
    )


def test_pausing_needs_a_recurring_task(client: TestClient) -> None:
    plain = _create(client)
    recurring = _create(client, rrule="FREQ=DAILY", starts_on="2026-11-16")

    assert client.post(f"{URL}/{plain['id']}/pause").status_code == 422
    paused = client.post(f"{URL}/{recurring['id']}/pause").json()
    resumed = client.post(f"{URL}/{recurring['id']}/resume").json()
    assert paused["paused_at"] is not None
    assert resumed["paused_at"] is None


def test_list_filters(client: TestClient) -> None:
    _create(client, "Plain")
    _create(client, "Recurring", rrule="FREQ=DAILY", starts_on="2026-11-16")
    archived = _create(client, "Archived")
    client.post(f"{URL}/{archived['id']}/archive")

    def titles(**params: Any) -> list[str]:
        return [item["title"] for item in client.get(URL, params=params).json()]

    assert titles() == ["Plain", "Recurring"]
    assert titles(repeating=True) == ["Recurring"]
    assert titles(repeating=False) == ["Plain"]
    assert titles(include_archived=True) == ["Archived", "Plain", "Recurring"]


def test_an_archived_template_cant_create_tasks(client: TestClient) -> None:
    template = _create(client)
    client.post(f"{URL}/{template['id']}/archive")

    assert client.post(f"{URL}/{template['id']}/tasks", json={}).status_code == 409


def test_deleting_a_template_keeps_tasks_made_from_it(client: TestClient) -> None:
    template = _create(client, "Pack")
    task = client.post(f"{URL}/{template['id']}/tasks", json={}).json()

    assert client.delete(f"{URL}/{template['id']}").status_code == 204
    kept = client.get(f"/api/tasks/{task['id']}").json()
    assert (kept["title"], kept["template_id"]) == ("Pack", None)


def test_a_recurring_task_with_occurrences_can_only_be_archived(
    client: TestClient, session: Session
) -> None:
    template = _create(client, rrule="FREQ=DAILY", starts_on="2026-11-16")
    templates.generate_occurrences(session, TODAY, TODAY)

    response = client.delete(f"{URL}/{template['id']}")

    assert response.status_code == 409
    assert "Archive it instead" in response.json()["detail"]


def test_moving_a_template(client: TestClient, session: Session) -> None:
    life_area = make_life_area(session)
    template = _create(client)

    body = client.post(f"{URL}/{template['id']}/move", json={"life_area_id": life_area.id}).json()

    assert body["life_area_id"] == life_area.id
