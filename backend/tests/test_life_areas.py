from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.main import app
from app.models import LifeArea

URL = "/api/life-areas"


def _create(client: TestClient, title: str = "Health", **fields: Any) -> dict[str, Any]:
    response = client.post(URL, json={"title": title, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_returns_the_new_life_area(client: TestClient) -> None:
    body = _create(client, "Health", vision="Feel strong", color="#22c55e")

    assert body["title"] == "Health"
    assert body["vision"] == "Feel strong"
    assert body["notes"] is None
    assert body["color"] == "#22c55e"
    assert body["archived_at"] is None
    assert body["created_at"].endswith("Z")
    assert body["updated_at"].endswith("Z")


def test_create_trims_the_title(client: TestClient) -> None:
    assert _create(client, "  Health  ")["title"] == "Health"


def test_new_life_areas_go_to_the_end(client: TestClient) -> None:
    orders = [_create(client, title)["sort_order"] for title in ("A", "B", "C")]

    assert orders == [0, 1, 2]


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 201},
        {"title": "ok", "vision": "x" * 2001},
        {"title": "ok", "notes": "x" * 50_001},
        {"title": "ok", "color": "x" * 51},
        {"title": "ok", "unknown": 1},
        {"title": "ok", "sort_order": 3},
    ],
)
def test_create_rejects_invalid_input(client: TestClient, payload: dict[str, Any]) -> None:
    assert client.post(URL, json=payload).status_code == 422


def test_create_accepts_values_at_the_limits(client: TestClient) -> None:
    body = _create(client, "x" * 200, vision="x" * 2000, notes="x" * 50_000)

    assert len(body["notes"]) == 50_000


@pytest.mark.parametrize(
    "fields",
    [{"title": ""}, {"title": "x" * 201}, {"vision": "x" * 2001}, {"notes": "x" * 50_001}],
)
def test_database_enforces_text_limits(session: Session, fields: dict[str, str]) -> None:
    session.add(LifeArea(**{"title": "ok", **fields}))

    with pytest.raises(IntegrityError):
        session.commit()


def test_list_is_ordered_and_hides_archived(client: TestClient) -> None:
    first = _create(client, "First")
    second = _create(client, "Second")
    archived = _create(client, "Archived")
    client.patch(f"{URL}/{first['id']}", json={"sort_order": 10})
    client.post(f"{URL}/{archived['id']}/archive")

    titles = [item["title"] for item in client.get(URL).json()]

    assert titles == [second["title"], first["title"]]


def test_list_can_include_archived(client: TestClient) -> None:
    archived = _create(client, "Archived")
    client.post(f"{URL}/{archived['id']}/archive")

    response = client.get(URL, params={"include_archived": True})

    assert [item["id"] for item in response.json()] == [archived["id"]]


def test_get_returns_one_life_area(client: TestClient) -> None:
    created = _create(client)

    assert client.get(f"{URL}/{created['id']}").json() == created


def test_update_changes_only_the_fields_sent(client: TestClient) -> None:
    created = _create(client, "Health", vision="Feel strong", color="#22c55e")

    body = client.patch(f"{URL}/{created['id']}", json={"title": "Fitness"}).json()

    assert body["title"] == "Fitness"
    assert body["vision"] == "Feel strong"
    assert body["color"] == "#22c55e"


def test_update_can_clear_an_optional_field(client: TestClient) -> None:
    created = _create(client, vision="Feel strong")

    body = client.patch(f"{URL}/{created['id']}", json={"vision": None}).json()

    assert body["vision"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"title": None},
        {"title": "  "},
        {"sort_order": None},
        {"sort_order": -1},
        {"archived_at": None},
    ],
)
def test_update_rejects_invalid_input(client: TestClient, payload: dict[str, Any]) -> None:
    created = _create(client)

    assert client.patch(f"{URL}/{created['id']}", json=payload).status_code == 422


def test_archive_sets_the_timestamp_and_keeps_the_row(client: TestClient) -> None:
    created = _create(client)

    body = client.post(f"{URL}/{created['id']}/archive").json()

    assert body["archived_at"].endswith("Z")
    assert client.get(f"{URL}/{created['id']}").status_code == 200


def test_archiving_twice_keeps_the_first_timestamp(client: TestClient) -> None:
    created = _create(client)
    first = client.post(f"{URL}/{created['id']}/archive").json()

    second = client.post(f"{URL}/{created['id']}/archive").json()

    assert second["archived_at"] == first["archived_at"]


def test_unarchive_brings_it_back(client: TestClient) -> None:
    created = _create(client)
    client.post(f"{URL}/{created['id']}/archive")

    body = client.post(f"{URL}/{created['id']}/unarchive").json()

    assert body["archived_at"] is None
    assert [item["id"] for item in client.get(URL).json()] == [created["id"]]


def test_delete_removes_the_life_area(client: TestClient) -> None:
    created = _create(client)

    assert client.delete(f"{URL}/{created['id']}").status_code == 204
    assert client.get(f"{URL}/{created['id']}").status_code == 404


def test_delete_is_refused_while_items_belong_to_it(client: TestClient, engine: Engine) -> None:
    created = _create(client)
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE child (id INTEGER PRIMARY KEY, life_area_id REFERENCES life_areas)")
        )
        connection.execute(
            text("INSERT INTO child (life_area_id) VALUES (:id)"), {"id": created["id"]}
        )

    response = client.delete(f"{URL}/{created['id']}")

    assert response.status_code == 409
    assert "Archive it instead" in response.json()["detail"]
    assert client.get(f"{URL}/{created['id']}").status_code == 200


def test_reorder_sets_the_order_of_the_sidebar(client: TestClient) -> None:
    career, finance, home = (
        _create(client, title)["id"] for title in ["Career", "Finance", "Home"]
    )

    response = client.post(f"{URL}/reorder", json={"life_area_ids": [home, career, finance]})

    assert response.status_code == 200, response.text
    assert [area["title"] for area in response.json()] == ["Home", "Career", "Finance"]
    assert [area["title"] for area in client.get(URL).json()] == ["Home", "Career", "Finance"]


def test_reorder_puts_unlisted_areas_after_the_listed_ones(client: TestClient) -> None:
    career, finance, home = (
        _create(client, title)["id"] for title in ["Career", "Finance", "Home"]
    )
    client.post(f"{URL}/{career}/archive")

    client.post(f"{URL}/reorder", json={"life_area_ids": [home, finance]})
    client.post(f"{URL}/{career}/unarchive")

    assert [area["title"] for area in client.get(URL).json()] == ["Home", "Finance", "Career"]


def test_reorder_rejects_an_area_listed_twice(client: TestClient) -> None:
    career = _create(client, "Career")["id"]

    response = client.post(f"{URL}/reorder", json={"life_area_ids": [career, career]})

    assert response.status_code == 422
    assert response.json() == {"detail": "A life area can only appear once in the new order."}


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("GET", "/999", None),
        ("PATCH", "/999", {"title": "New"}),
        ("POST", "/999/archive", None),
        ("POST", "/999/unarchive", None),
        ("DELETE", "/999", None),
        ("POST", "/reorder", {"life_area_ids": [999]}),
    ],
)
def test_missing_life_area_returns_404(
    client: TestClient, method: str, path: str, payload: dict[str, str] | None
) -> None:
    response = client.request(method, f"{URL}{path}", json=payload)

    assert response.status_code == 404
    assert response.json() == {"detail": "Life area 999 not found"}


def test_openapi_uses_function_names_for_the_generated_client() -> None:
    operation_ids = {
        operation["operationId"]
        for path in app.openapi()["paths"].values()
        for operation in path.values()
    }

    assert {"list_life_areas", "create_life_area", "archive_life_area"} <= operation_ids
