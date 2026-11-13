from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Task, TaskTemplate
from app.models.base import utc_now
from tests.factories import make_life_area, make_project, make_section

URL = "/api/tasks"


def _create(client: TestClient, title: str = "Run", **fields: Any) -> dict[str, Any]:
    response = client.post(URL, json={"title": title, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def _action(client: TestClient, task_id: int, action: str, **body: Any) -> dict[str, Any]:
    response = client.post(f"{URL}/{task_id}/{action}", json=body or None)
    assert response.status_code == 200, response.text
    return response.json()


def _titles(client: TestClient, **params: Any) -> list[str]:
    response = client.get(URL, params=params)
    assert response.status_code == 200, response.text
    return [task["title"] for task in response.json()]


# ---------- Creating and owning ----------


def test_a_task_with_no_owner_goes_to_the_inbox(client: TestClient) -> None:
    body = _create(client, "Call mum", subtasks=["Find number", "Call"])

    assert body["life_area_id"] is None
    assert body["project_id"] is None
    assert body["status"] == "todo"
    assert body["priority"] == "none"
    assert [subtask["title"] for subtask in body["subtasks"]] == ["Find number", "Call"]
    assert _titles(client, inbox=True) == ["Call mum"]


def test_a_projects_task_inherits_the_projects_life_area(
    client: TestClient, session: Session
) -> None:
    life_area = make_life_area(session)
    project = make_project(session, life_area)
    section = make_section(session, project)

    body = _create(client, project_id=project.id, section_id=section.id, priority="high")

    assert body["life_area_id"] == life_area.id
    assert body["section_id"] == section.id
    assert body["priority"] == "high"


@pytest.mark.parametrize(
    ("make_fields", "status_code"),
    [
        (lambda ids: {"life_area_id": 999}, 422),
        (lambda ids: {"project_id": 999}, 422),
        (lambda ids: {"project_id": ids["project"], "life_area_id": ids["other_area"]}, 422),
        (lambda ids: {"section_id": ids["section"]}, 422),
        (lambda ids: {"project_id": ids["other_project"], "section_id": ids["section"]}, 422),
        (lambda ids: {"life_area_id": ids["archived_area"]}, 409),
        (lambda ids: {"project_id": ids["done_project"]}, 409),
        (lambda ids: {"due_time": "09:00"}, 422),
        (lambda ids: {"priority": "urgent"}, 422),
    ],
)
def test_create_rejects_invalid_owners_and_fields(
    client: TestClient, session: Session, make_fields: Any, status_code: int
) -> None:
    health = make_life_area(session, "Health")
    project = make_project(session, health)
    ids = {
        "project": project.id,
        "other_area": make_life_area(session, "Career").id,
        "section": make_section(session, project).id,
        "other_project": make_project(session, health, "Other").id,
        "archived_area": make_life_area(session, "Old", archived_at=utc_now()).id,
        "done_project": make_project(
            session, health, "Done", status="done", completed_at=utc_now()
        ).id,
    }

    response = client.post(URL, json={"title": "Run", **make_fields(ids)})

    assert response.status_code == status_code, response.text


def test_new_tasks_go_to_the_end_of_their_day(client: TestClient) -> None:
    monday = _create(client, "A", scheduled_date="2026-11-16")
    second = _create(client, "B", scheduled_date="2026-11-16")
    unscheduled = _create(client, "C")

    assert (monday["sort_order"], second["sort_order"], unscheduled["sort_order"]) == (0, 1, 0)


# ---------- Listing ----------


def test_list_filters(client: TestClient, session: Session) -> None:
    life_area = make_life_area(session)
    project = make_project(session, life_area)
    _create(client, "Inbox")
    _create(client, "Area", life_area_id=life_area.id, scheduled_date="2026-11-16")
    _create(client, "Project", project_id=project.id, scheduled_date="2026-11-20")
    _create(client, "Later", life_area_id=life_area.id, scheduled_date="2026-11-30")

    assert _titles(client, inbox=True) == ["Inbox"]
    assert _titles(client, life_area_id=life_area.id) == ["Area", "Project", "Later"]
    assert _titles(client, project_id=project.id) == ["Project"]
    assert _titles(client, scheduled_from="2026-11-16", scheduled_to="2026-11-22") == [
        "Area",
        "Project",
    ]
    assert _titles(client, unscheduled=True) == ["Inbox"]


def test_cancelled_and_archived_tasks_are_hidden_unless_asked_for(client: TestClient) -> None:
    cancelled = _create(client, "Cancelled")
    archived = _create(client, "Archived")
    _create(client, "Open")
    _action(client, cancelled["id"], "cancel")
    _action(client, archived["id"], "archive")

    assert _titles(client) == ["Open"]
    assert set(_titles(client, include_cancelled=True)) == {"Open", "Cancelled"}
    assert set(_titles(client, include_archived=True)) == {"Open", "Archived"}


@pytest.mark.parametrize(
    "params",
    [{"inbox": True, "life_area_id": 1}, {"unscheduled": True, "scheduled_from": "2026-11-16"}],
)
def test_list_rejects_contradictory_filters(client: TestClient, params: dict[str, Any]) -> None:
    assert client.get(URL, params=params).status_code == 422


# ---------- Editing ----------


def test_update_changes_only_the_fields_sent(client: TestClient) -> None:
    task = _create(client, "Run", notes="5 km", priority="low")

    body = client.patch(f"{URL}/{task['id']}", json={"title": "Long run"}).json()

    assert (body["title"], body["notes"], body["priority"]) == ("Long run", "5 km", "low")


@pytest.mark.parametrize(
    "payload",
    [{"title": None}, {"priority": None}, {"due_time": "09:00"}, {"status": "done"}],
)
def test_update_rejects_invalid_input(client: TestClient, payload: dict[str, Any]) -> None:
    task = _create(client)

    assert client.patch(f"{URL}/{task['id']}", json=payload).status_code == 422
    assert client.get(f"{URL}/{task['id']}").json()["due_time"] is None


def test_clearing_the_due_date_needs_the_due_time_cleared_too(client: TestClient) -> None:
    task = _create(client, due_date="2026-11-20", due_time="09:00")

    refused = client.patch(f"{URL}/{task['id']}", json={"due_date": None})
    cleared = client.patch(f"{URL}/{task['id']}", json={"due_date": None, "due_time": None})

    assert refused.status_code == 422
    assert cleared.status_code == 200


# ---------- Status, cascades and undo ----------


def test_completing_a_task_cancels_its_open_subtasks(client: TestClient) -> None:
    task = _create(client, "Pack", subtasks=["Shoes", "Watch"])
    shoes = task["subtasks"][0]
    client.patch(f"/api/subtasks/{shoes['id']}", json={"status": "done"})

    change = _action(client, task["id"], "complete")

    assert change["batch_id"]
    assert change["task"]["status"] == "done"
    assert change["task"]["completed_at"].endswith("Z")
    statuses = {subtask["title"]: subtask["status"] for subtask in change["task"]["subtasks"]}
    assert statuses == {"Shoes": "done", "Watch": "cancelled"}


def test_undo_restores_the_task_and_its_subtasks(client: TestClient) -> None:
    task = _create(client, "Pack", subtasks=["Shoes"])
    change = _action(client, task["id"], "cancel")

    response = client.post(f"/api/undo/{change['batch_id']}")

    assert response.json() == {"restored_items": 2}
    restored = client.get(f"{URL}/{task['id']}").json()
    assert (restored["status"], restored["cancelled_at"]) == ("todo", None)
    assert restored["subtasks"][0]["status"] == "todo"
    assert client.post(f"/api/undo/{change['batch_id']}").status_code == 404


def test_undo_refuses_to_overwrite_a_later_change(client: TestClient) -> None:
    task = _create(client)
    change = _action(client, task["id"], "complete")
    _action(client, task["id"], "reopen")

    response = client.post(f"/api/undo/{change['batch_id']}")

    assert response.status_code == 409
    assert client.get(f"{URL}/{task['id']}").json()["status"] == "todo"


def test_undo_refuses_when_the_task_was_deleted(client: TestClient) -> None:
    task = _create(client)
    change = _action(client, task["id"], "complete")
    client.delete(f"{URL}/{task['id']}")

    assert client.post(f"/api/undo/{change['batch_id']}").status_code == 409


@pytest.mark.parametrize("action", ["complete", "cancel"])
def test_only_a_todo_task_can_be_finished(client: TestClient, action: str) -> None:
    task = _create(client)
    _action(client, task["id"], "complete")

    response = client.post(f"{URL}/{task['id']}/{action}")

    assert response.status_code == 409


def test_reopen_brings_a_task_back_to_todo(client: TestClient) -> None:
    task = _create(client)
    _action(client, task["id"], "complete")

    body = _action(client, task["id"], "reopen")["task"]

    assert (body["status"], body["completed_at"]) == ("todo", None)
    assert client.post(f"{URL}/{task['id']}/reopen").status_code == 409


def test_reopen_is_refused_in_a_finished_project(client: TestClient, session: Session) -> None:
    project = make_project(session, make_life_area(session))
    task = _create(client, project_id=project.id)
    _action(client, task["id"], "complete")
    project.status, project.completed_at = "done", utc_now()
    session.commit()

    assert client.post(f"{URL}/{task['id']}/reopen").status_code == 409


def test_archiving_hides_the_task_and_cancels_open_subtasks(client: TestClient) -> None:
    task = _create(client, subtasks=["Shoes"])

    change = _action(client, task["id"], "archive")
    again = _action(client, task["id"], "archive")

    assert change["task"]["archived_at"].endswith("Z")
    assert change["task"]["subtasks"][0]["status"] == "cancelled"
    assert again["batch_id"] is None
    assert again["task"]["archived_at"] == change["task"]["archived_at"]
    assert client.post(f"{URL}/{task['id']}/complete").status_code == 409


def test_unarchive_is_refused_under_an_archived_life_area(
    client: TestClient, session: Session
) -> None:
    life_area = make_life_area(session)
    task = _create(client, life_area_id=life_area.id)
    _action(client, task["id"], "archive")
    life_area.archived_at = utc_now()
    session.commit()

    assert client.post(f"{URL}/{task['id']}/unarchive").status_code == 409

    life_area.archived_at = None
    session.commit()
    assert _action(client, task["id"], "unarchive")["task"]["archived_at"] is None


# ---------- Moving ----------


def test_moving_to_a_project_inherits_its_life_area(client: TestClient, session: Session) -> None:
    life_area = make_life_area(session)
    project = make_project(session, life_area)
    task = _create(client)

    change = _action(client, task["id"], "move", project_id=project.id)

    assert (change["task"]["life_area_id"], change["task"]["project_id"]) == (
        life_area.id,
        project.id,
    )


def test_moving_to_another_project_clears_the_section(client: TestClient, session: Session) -> None:
    life_area = make_life_area(session)
    marathon = make_project(session, life_area, "Marathon")
    other = make_project(session, life_area, "Other")
    section = make_section(session, marathon)
    task = _create(client, project_id=marathon.id, section_id=section.id)

    change = _action(client, task["id"], "move", project_id=other.id)

    assert change["task"]["section_id"] is None


def test_unlinking_and_undoing_a_move(client: TestClient, session: Session) -> None:
    life_area = make_life_area(session)
    project = make_project(session, life_area)
    task = _create(client, project_id=project.id)

    unlinked = _action(client, task["id"], "move", life_area_id=life_area.id)
    client.post(f"/api/undo/{unlinked['batch_id']}")

    assert unlinked["task"]["project_id"] is None
    assert client.get(f"{URL}/{task['id']}").json()["project_id"] == project.id


# ---------- Deleting ----------


def test_deleting_a_task_removes_it_and_its_subtasks(client: TestClient) -> None:
    task = _create(client, subtasks=["Shoes"])

    assert client.delete(f"{URL}/{task['id']}").status_code == 204
    assert client.get(f"{URL}/{task['id']}").status_code == 404
    assert client.patch(f"/api/subtasks/{task['subtasks'][0]['id']}", json={}).status_code == 404


def test_a_recurring_occurrence_can_only_be_cancelled(client: TestClient, session: Session) -> None:
    template = TaskTemplate(title="Review", rrule="FREQ=WEEKLY", starts_on=date(2026, 11, 16))
    session.add(template)
    session.commit()
    occurrence = Task(title="Review", template_id=template.id, occurrence_date=date(2026, 11, 16))
    session.add(occurrence)
    session.commit()

    response = client.delete(f"{URL}/{occurrence.id}")

    assert response.status_code == 409
    assert "Cancel it instead" in response.json()["detail"]


def test_a_life_area_with_tasks_cant_be_deleted(client: TestClient, session: Session) -> None:
    life_area = make_life_area(session)
    _create(client, life_area_id=life_area.id)

    assert client.delete(f"/api/life-areas/{life_area.id}").status_code == 409


# ---------- Subtasks ----------


def test_subtasks_can_be_added_checked_and_removed(client: TestClient) -> None:
    task = _create(client, subtasks=["Shoes"])

    added = client.post(f"{URL}/{task['id']}/subtasks", json={"title": "Watch"}).json()
    done = client.patch(f"/api/subtasks/{added['id']}", json={"status": "done"}).json()
    reopened = client.patch(f"/api/subtasks/{added['id']}", json={"status": "todo"}).json()
    deleted = client.delete(f"/api/subtasks/{added['id']}")

    assert added["sort_order"] == 1
    assert done["completed_at"].endswith("Z")
    assert (reopened["status"], reopened["completed_at"]) == ("todo", None)
    assert deleted.status_code == 204
    assert len(client.get(f"{URL}/{task['id']}").json()["subtasks"]) == 1


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/tasks/999"),
        ("PATCH", "/api/tasks/999"),
        ("POST", "/api/tasks/999/complete"),
        ("POST", "/api/tasks/999/move"),
        ("DELETE", "/api/tasks/999"),
        ("POST", "/api/tasks/999/subtasks"),
        ("PATCH", "/api/subtasks/999"),
    ],
)
def test_missing_items_return_404(client: TestClient, method: str, path: str) -> None:
    body = {"title": "x"} if path.endswith("subtasks") else {}
    assert client.request(method, path, json=body).status_code == 404
