"""How a metric's values are shown (format and unit), and its current value on create.

Today is pinned to Wednesday 18 November 2026.
"""

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import clock
from app.models import Metric
from tests.factories import make_life_area

TODAY = date(2026, 11, 18)


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def area(session: Session) -> int:
    return make_life_area(session).id


def _create(client: TestClient, area: int, **fields: Any) -> Any:
    body = {"title": "Savings", "aggregation": "latest", "life_area_id": area, **fields}
    return client.post("/api/metrics", json=body)


def _metric(client: TestClient, area: int, **fields: Any) -> dict[str, Any]:
    response = _create(client, area, **fields)
    assert response.status_code == 201, response.text
    return response.json()


def test_a_metric_is_a_manual_number_by_default(client: TestClient, area: int) -> None:
    metric = _metric(client, area, unit="km")

    assert (metric["format"], metric["unit"], metric["source"]) == ("number", "km", "manual")
    assert metric["routine_step_id"] is None


@pytest.mark.parametrize(
    ("fields", "unit"),
    [
        ({"format": "currency"}, "PHP"),
        ({"format": "currency", "unit": "usd"}, "USD"),
        ({"format": "percent"}, None),
        ({"format": "duration"}, None),
        ({"format": "number"}, None),
    ],
)
def test_each_format_gets_its_unit(
    client: TestClient, area: int, fields: dict[str, Any], unit: str | None
) -> None:
    assert _metric(client, area, **fields)["unit"] == unit


@pytest.mark.parametrize(
    "fields",
    [
        {"format": "currency", "unit": "pesos"},
        {"format": "currency", "unit": "P1"},
        {"format": "percent", "unit": "%"},
        {"format": "duration", "unit": "min"},
        {"format": "hours"},
        {"unit": "x" * 21},
    ],
)
def test_units_are_checked_against_the_format(
    client: TestClient, area: int, fields: dict[str, Any]
) -> None:
    assert _create(client, area, **fields).status_code == 422


def test_changing_the_format_resets_the_unit_and_keeps_the_values(
    client: TestClient, area: int
) -> None:
    metric = _metric(client, area, unit="km", current_value=1500)
    url = f"/api/metrics/{metric['id']}"

    as_money = client.patch(url, json={"format": "currency"}).json()
    as_dollars = client.patch(url, json={"unit": "USD"}).json()
    as_percent = client.patch(url, json={"format": "percent"}).json()
    entries = client.get(f"{url}/entries").json()

    assert (as_money["format"], as_money["unit"]) == ("currency", "PHP")
    assert as_dollars["unit"] == "USD"
    assert (as_percent["format"], as_percent["unit"]) == ("percent", None)
    assert [entry["value"] for entry in entries] == [1500]  # never converted
    assert client.patch(url, json={"unit": "x"}).status_code == 422
    assert client.patch(url, json={"format": None}).status_code == 422


def test_the_source_cant_change(client: TestClient, area: int) -> None:
    metric = _metric(client, area)

    response = client.patch(f"/api/metrics/{metric['id']}", json={"source": "routine_step"})

    assert response.status_code == 422


def test_current_value_logs_todays_first_entry(client: TestClient, area: int) -> None:
    metric = _metric(client, area, format="currency", current_value=100000)

    entries = client.get(f"/api/metrics/{metric['id']}/entries").json()

    assert [(entry["date"], entry["value"]) for entry in entries] == [("2026-11-18", 100000)]


def test_no_current_value_means_no_entries(client: TestClient, area: int) -> None:
    metric = _metric(client, area)

    assert client.get(f"/api/metrics/{metric['id']}/entries").json() == []


def test_an_overview_outcome_carries_the_format(client: TestClient, area: int) -> None:
    _metric(client, area, format="currency")

    overview = client.get("/api/life-areas/overview", params={"period": "month"}).json()

    outcome = overview["outcomes"][0]
    assert (outcome["format"], outcome["unit"], outcome["source"]) == ("currency", "PHP", "manual")


def test_the_delete_preview_counts_entries_and_targets(client: TestClient, area: int) -> None:
    metric = _metric(client, area, current_value=5)
    client.post(f"/api/metrics/{metric['id']}/entries", json={"value": 6})
    client.post(
        f"/api/metrics/{metric['id']}/targets",
        json={"kind": "reach_by", "target_value": 10, "end_date": "2026-12-31"},
    )

    preview = client.get(f"/api/metrics/{metric['id']}/delete-preview").json()

    assert [(row["kind"], row["counts"]) for row in preview["groups"][0]["rows"]] == [
        ("entries", [{"of": "entries", "count": 2}]),
        ("targets", [{"of": "targets", "count": 1}]),
    ]


@pytest.mark.parametrize(
    ("fields"),
    [
        {"format": "percent", "unit": "%"},
        {"format": "currency", "unit": None},
        {"format": "currency", "unit": "php"},
        {"format": "number", "unit": ""},
        {"format": "hours"},
    ],
)
def test_the_database_enforces_unit_rules(
    session: Session, area: int, fields: dict[str, Any]
) -> None:
    session.add(Metric(title="X", aggregation="sum", life_area_id=area, **fields))

    with pytest.raises(IntegrityError):
        session.commit()
