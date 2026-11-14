from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProjectSection
from app.models.base import utc_now
from tests.factories import make_life_area

URL = "/api/projects"


def _project(
    client: TestClient, life_area_id: int, title: str = "Marathon", **fields: Any
) -> dict[str, Any]:
    response = client.post(URL, json={"life_area_id": life_area_id, "title": title, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def _section(
    client: TestClient, project: dict[str, Any], title: str = "Training"
) -> dict[str, Any]:
    response = client.post(f"{URL}/{project['id']}/sections", json={"title": title})
    assert response.status_code == 201, response.text
    return response.json()


def _task(client: TestClient, **fields: Any) -> dict[str, Any]:
    response = client.post("/api/tasks", json={"title": "Run", **fields})
    assert response.status_code == 201, response.text
    return response.json()


# ---------- Projects ----------


def test_creating_projects(client: TestClient, session: Session) -> None:
    health = make_life_area(session, "Health")
    career = make_life_area(session, "Career")

    first = _project(client, health.id, "Marathon", due_date="2027-04-18")
    second = _project(client, health.id, "Swim")
    other = _project(client, career.id, "Portfolio")

    assert (first["status"], first["due_date"]) == ("active", "2027-04-18")
    assert (first["sort_order"], second["sort_order"], other["sort_order"]) == (0, 1, 0)
    assert first["progress"] == {"done": 0, "total": 0}
    assert first["sections"] == []


@pytest.mark.parametrize(
    ("make_body", "status_code"),
    [
        (lambda ids: {"life_area_id": 999, "title": "X"}, 422),
        (lambda ids: {"life_area_id": ids["archived"], "title": "X"}, 409),
        (lambda ids: {"life_area_id": ids["area"], "title": ""}, 422),
        (lambda ids: {"title": "No area"}, 422),
    ],
)
def test_create_is_validated(
    client: TestClient, session: Session, make_body: Any, status_code: int
) -> None:
    ids = {
        "area": make_life_area(session).id,
        "archived": make_life_area(session, "Old", archived_at=utc_now()).id,
    }

    assert client.post(URL, json=make_body(ids)).status_code == status_code


def test_list_filters_by_life_area(client: TestClient, session: Session) -> None:
    health = make_life_area(session, "Health")
    career = make_life_area(session, "Career")
    _project(client, health.id, "Marathon")
    _project(client, career.id, "Portfolio")

    titles = [p["title"] for p in client.get(URL, params={"life_area_id": health.id}).json()]

    assert titles == ["Marathon"]
    assert len(client.get(URL).json()) == 2


def test_update_changes_only_the_fields_sent(client: TestClient, session: Session) -> None:
    project = _project(client, make_life_area(session).id, notes="Spring race")

    body = client.patch(f"{URL}/{project['id']}", json={"title": "Half marathon"}).json()

    assert (body["title"], body["notes"]) == ("Half marathon", "Spring race")
    assert client.patch(f"{URL}/{project['id']}", json={"title": None}).status_code == 422
    assert client.patch(f"{URL}/{project['id']}", json={"status": "done"}).status_code == 422


def test_progress_counts_one_off_tasks(client: TestClient, session: Session) -> None:
    project = _project(client, make_life_area(session).id)
    done = [_task(client, project_id=project["id"]) for _ in range(2)]
    _task(client, project_id=project["id"])  # still to do
    cancelled = _task(client, project_id=project["id"])
    archived = _task(client, project_id=project["id"])
    _task(client)  # not in the project
    for task in done:
        client.post(f"/api/tasks/{task['id']}/complete")
    client.post(f"/api/tasks/{cancelled['id']}/cancel")
    client.post(f"/api/tasks/{archived['id']}/archive")

    assert client.get(f"{URL}/{project['id']}").json()["progress"] == {"done": 2, "total": 3}


# ---------- Moving ----------


def test_moving_a_project_moves_everything_in_it(client: TestClient, session: Session) -> None:
    health = make_life_area(session, "Health")
    career = make_life_area(session, "Career")
    project = _project(client, health.id)
    pid = project["id"]
    task = _task(client, project_id=pid)
    template = client.post("/api/task-templates", json={"title": "Plan", "project_id": pid}).json()
    event = client.post(
        "/api/events", json={"title": "Race", "start_date": "2027-04-18", "project_id": pid}
    ).json()
    routine = client.post("/api/routines", json={"title": "Morning"}).json()
    step = client.post(
        f"/api/routines/{routine['id']}/steps", json={"title": "Jog", "project_id": pid}
    ).json()

    def areas() -> set[int]:
        found = {
            client.get(f"/api/tasks/{task['id']}").json()["life_area_id"],
            client.get(f"/api/task-templates/{template['id']}").json()["life_area_id"],
            client.get(f"/api/events/{event['id']}").json()["life_area_id"],
            client.get(f"/api/routines/{routine['id']}").json()["steps"][0]["life_area_id"],
        }
        session.expire_all()
        return found

    change = client.post(f"{URL}/{pid}/move", json={"life_area_id": career.id}).json()

    assert change["project"]["life_area_id"] == career.id
    assert areas() == {career.id}
    assert step["life_area_id"] == health.id  # as it was when created

    client.post(f"/api/undo/{change['batch_id']}")

    assert client.get(f"{URL}/{pid}").json()["life_area_id"] == health.id
    assert areas() == {health.id}


@pytest.mark.parametrize(("target", "status_code"), [("missing", 422), ("archived", 409)])
def test_moving_is_validated(
    client: TestClient, session: Session, target: str, status_code: int
) -> None:
    project = _project(client, make_life_area(session).id)
    archived = make_life_area(session, "Old", archived_at=utc_now())
    life_area_id = 999 if target == "missing" else archived.id

    response = client.post(f"{URL}/{project['id']}/move", json={"life_area_id": life_area_id})

    assert response.status_code == status_code


# ---------- Deleting ----------


def test_deleting_an_empty_project_removes_its_sections(
    client: TestClient, session: Session
) -> None:
    project = _project(client, make_life_area(session).id)
    _section(client, project)

    assert client.delete(f"{URL}/{project['id']}").status_code == 204
    assert client.get(f"{URL}/{project['id']}").status_code == 404
    assert session.scalars(select(ProjectSection)).all() == []


def test_a_project_with_items_cant_be_deleted(client: TestClient, session: Session) -> None:
    project = _project(client, make_life_area(session).id)
    section = _section(client, project)
    _task(client, project_id=project["id"], section_id=section["id"])

    response = client.delete(f"{URL}/{project['id']}")

    assert response.status_code == 409
    kept = client.get(f"{URL}/{project['id']}").json()
    assert [s["title"] for s in kept["sections"]] == ["Training"]  # nothing half-deleted


# ---------- Sections ----------


def test_sections_are_created_in_order_and_renamed(client: TestClient, session: Session) -> None:
    project = _project(client, make_life_area(session).id)
    first = _section(client, project, "Base")
    second = _section(client, project, "Build")

    renamed = client.patch(f"/api/sections/{second['id']}", json={"title": "Peak"}).json()

    assert (first["sort_order"], second["sort_order"]) == (0, 1)
    assert renamed["title"] == "Peak"
    sections = client.get(f"{URL}/{project['id']}").json()["sections"]
    assert [s["title"] for s in sections] == ["Base", "Peak"]


def test_deleting_a_section_keeps_its_tasks_in_the_project(
    client: TestClient, session: Session
) -> None:
    project = _project(client, make_life_area(session).id)
    section = _section(client, project)
    task = _task(client, project_id=project["id"], section_id=section["id"])
    template = client.post(
        "/api/task-templates",
        json={"title": "Plan", "project_id": project["id"], "section_id": section["id"]},
    ).json()

    assert client.delete(f"/api/sections/{section['id']}").status_code == 204

    kept_task = client.get(f"/api/tasks/{task['id']}").json()
    kept_template = client.get(f"/api/task-templates/{template['id']}").json()
    assert (kept_task["project_id"], kept_task["section_id"]) == (project["id"], None)
    assert (kept_template["project_id"], kept_template["section_id"]) == (project["id"], None)


def test_no_new_sections_in_a_finished_project(client: TestClient, session: Session) -> None:
    project = _project(client, make_life_area(session).id)
    from app.models import Project

    row = session.get(Project, project["id"])
    assert row is not None
    row.status, row.completed_at = "done", utc_now()
    session.commit()

    assert client.post(f"{URL}/{project['id']}/sections", json={"title": "X"}).status_code == 409


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/projects/999"),
        ("PATCH", "/api/projects/999"),
        ("POST", "/api/projects/999/move"),
        ("DELETE", "/api/projects/999"),
        ("POST", "/api/projects/999/sections"),
        ("PATCH", "/api/sections/999"),
        ("DELETE", "/api/sections/999"),
    ],
)
def test_missing_items_return_404(
    client: TestClient, session: Session, method: str, path: str
) -> None:
    body: dict[str, Any] = {}
    if path.endswith("/move"):
        body = {"life_area_id": make_life_area(session).id}
    if path.endswith("/sections"):
        body = {"title": "X"}
    assert client.request(method, path, json=body).status_code == 404
