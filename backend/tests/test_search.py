"""Search for the Ctrl K palette."""

from datetime import datetime
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Routine, Task
from tests.factories import make_life_area, make_project

NOW = datetime(2026, 11, 14, 12)


def search(client: TestClient, q: str, **params: Any) -> list[dict[str, Any]]:
    response = client.get("/api/search", params={"q": q, **params})
    assert response.status_code == 200, response.text
    return response.json()


def hits(client: TestClient, q: str, **params: Any) -> list[tuple[str, str]]:
    return [(hit["kind"], hit["title"]) for hit in search(client, q, **params)]


def add(session: Session, *rows: Any) -> None:
    session.add_all(rows)
    session.commit()


def test_finds_each_kind_in_order_case_insensitively(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Running club", color="teal")
    project = make_project(session, area, "Run a marathon")
    add(
        session,
        Routine(title="Morning run"),
        Task(title="Buy running shoes", life_area_id=area.id, project_id=project.id),
        Task(title="Read a book"),
    )

    assert hits(client, "RUN") == [
        ("life_area", "Running club"),
        ("project", "Run a marathon"),
        ("routine", "Morning run"),
        ("task", "Buy running shoes"),
    ]


def test_a_hit_carries_its_area_and_project(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Health", color="teal")
    project = make_project(session, area, "Marathon")
    add(
        session,
        Task(title="Long run", life_area_id=area.id, project_id=project.id),
        Task(title="Inbox run"),
    )

    by_title = {hit["title"]: hit for hit in search(client, "run")}

    assert by_title["Long run"] | {"id": 0} == {
        "kind": "task",
        "id": 0,
        "title": "Long run",
        "status": "todo",
        "life_area_id": area.id,
        "life_area_title": "Health",
        "life_area_color": "teal",
        "project_id": project.id,
        "project_title": "Marathon",
    }
    assert by_title["Inbox run"]["life_area_id"] is None
    assert by_title["Inbox run"]["project_title"] is None


def test_title_starts_first_then_word_starts(client: TestClient, session: Session) -> None:
    add(
        session,
        Task(title="Rerun the tests"),
        Task(title="Go for a run"),
        Task(title="Run errands"),
    )

    assert [title for _, title in hits(client, "run")] == [
        "Run errands",
        "Go for a run",
        "Rerun the tests",
    ]


def test_open_tasks_before_done_ones(client: TestClient, session: Session) -> None:
    add(
        session,
        Task(title="Pay rent", status="done", completed_at=NOW),
        Task(title="Pay tax"),
    )

    assert [title for _, title in hits(client, "pay")] == ["Pay tax", "Pay rent"]


def test_leaves_out_archived_items_and_cancelled_tasks(
    client: TestClient, session: Session
) -> None:
    make_life_area(session, "Old plan", archived_at=NOW)
    live = make_life_area(session, "Home")
    make_project(session, live, "Plan the garden", archived_at=NOW)
    add(
        session,
        Routine(title="Plan the week", archived_at=NOW),
        Task(title="Plan dinner", status="cancelled", cancelled_at=NOW),
        Task(title="Plan the trip", archived_at=NOW),
        Task(title="Plan holidays"),
    )

    assert hits(client, "plan") == [("task", "Plan holidays")]


def test_limit_is_per_kind(client: TestClient, session: Session) -> None:
    make_life_area(session, "Walk")
    add(session, *(Task(title=f"Walk {n}") for n in range(4)))

    found = hits(client, "walk", limit=2)

    assert [kind for kind, _ in found] == ["life_area", "task", "task"]


def test_blank_query_finds_nothing(client: TestClient, session: Session) -> None:
    add(session, Task(title="Anything"))

    assert search(client, "  ") == []


def test_like_wildcards_are_matched_literally(client: TestClient, session: Session) -> None:
    add(session, Task(title="Save 50% more"), Task(title="Save money"))

    assert hits(client, "50%") == [("task", "Save 50% more")]
    assert hits(client, "_") == []


def test_limit_is_checked(client: TestClient) -> None:
    assert client.get("/api/search", params={"q": "a", "limit": 21}).status_code == 422
    assert client.get("/api/search").status_code == 422


def test_unicode_search_with_diacritics(client: TestClient, session: Session) -> None:
    add(session, Task(title="Café résumé"))

    assert hits(client, "cafe") == [("task", "Café résumé")]
    assert hits(client, "resume") == [("task", "Café résumé")]


def test_fts5_unicode61_folds_diacritics_and_case(client: TestClient, session: Session) -> None:
    add(session, Task(title="Café résumé"))

    assert hits(client, "cafe") == [("task", "Café résumé")]
    assert hits(client, "resume") == [("task", "Café résumé")]
    assert hits(client, "CAFÉ") == [("task", "Café résumé")]
