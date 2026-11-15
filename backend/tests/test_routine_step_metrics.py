"""Metrics fed by a routine step: entries derived from the step's days, never stored.

The routine is daily from Monday 16 November 2026; today is Wednesday the 18th.
"""

from datetime import date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import clock
from app.models import Metric, RoutineStep
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 18)


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def area(session: Session) -> int:
    return make_life_area(session).id


@pytest.fixture
def routine(client: TestClient) -> dict[str, Any]:
    response = client.post("/api/routines", json={"title": "Morning", "starts_on": "2026-11-16"})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def step(client: TestClient, routine: dict[str, Any], area: int) -> dict[str, Any]:
    body = {"title": "Run", "life_area_id": area, "starts_on": "2026-11-16"}
    response = client.post(f"/api/routines/{routine['id']}/steps", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _create(client: TestClient, area: int | None, step: dict[str, Any], **fields: Any) -> Any:
    body = {
        "title": "Runs",
        "aggregation": "sum",
        "source": "routine_step",
        "routine_step_id": step["id"],
        "life_area_id": area,
        **fields,
    }
    return client.post("/api/metrics", json=body)


def _metric(
    client: TestClient, area: int | None, step: dict[str, Any], **fields: Any
) -> dict[str, Any]:
    response = _create(client, area, step, **fields)
    assert response.status_code == 201, response.text
    return response.json()


def _check(client: TestClient, step: dict[str, Any], day: str, status: str = "done") -> None:
    response = client.put(f"/api/routine-steps/{step['id']}/days/{day}", json={"status": status})
    assert response.status_code == 200, response.text


def _entries(client: TestClient, metric: dict[str, Any]) -> list[tuple[str, float]]:
    response = client.get(f"/api/metrics/{metric['id']}/entries")
    assert response.status_code == 200, response.text
    return [(entry["date"], entry["value"]) for entry in response.json()]


def _weekly_target(client: TestClient, metric: dict[str, Any], value: float) -> dict[str, Any]:
    body = {
        "kind": "per_period",
        "period": "week",
        "target_value": value,
        "start_date": "2026-11-16",
    }
    response = client.post(f"/api/metrics/{metric['id']}/targets", json=body)
    assert response.status_code == 201, response.text
    return response.json()


# ---------- Creating ----------


def test_a_sum_counts_days_done(client: TestClient, area: int, step: dict[str, Any]) -> None:
    metric = _metric(client, area, step)

    assert (metric["source"], metric["routine_step_id"]) == ("routine_step", step["id"])
    assert (metric["format"], metric["unit"]) == ("number", "days")


def test_an_average_is_a_completion_rate(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    metric = _metric(client, area, step, aggregation="average")

    assert (metric["format"], metric["unit"]) == ("percent", None)


@pytest.mark.parametrize(
    ("fields", "status_code"),
    [
        ({"aggregation": "latest"}, 422),
        ({"current_value": 3}, 422),
        ({"format": "currency"}, 422),
        ({"unit": "runs"}, 422),
        ({"routine_step_id": None}, 422),
        ({"routine_step_id": 999}, 422),
        ({"source": "manual"}, 422),  # a manual metric has no step
    ],
)
def test_create_is_validated(
    client: TestClient,
    area: int,
    step: dict[str, Any],
    fields: dict[str, Any],
    status_code: int,
) -> None:
    assert _create(client, area, step, **fields).status_code == status_code


def test_matching_format_and_unit_are_accepted(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    assert _create(client, area, step, format="number", unit="days").status_code == 201


def test_an_archived_step_cant_feed_a_new_metric(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    client.post(f"/api/routine-steps/{step['id']}/archive")

    assert _create(client, area, step).status_code == 409


def test_the_metric_may_have_another_owner_than_its_step(
    client: TestClient, session: Session, step: dict[str, Any]
) -> None:
    project = make_project(session, make_life_area(session, "Career"))

    metric = _metric(client, None, step, project_id=project.id)

    assert (metric["life_area_id"], metric["project_id"]) == (project.life_area_id, project.id)
    assert metric["life_area_id"] != step["life_area_id"]


# ---------- Entries ----------


def test_entries_come_from_the_steps_days(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    metric = _metric(client, area, step)
    _check(client, step, "2026-11-16")

    # The 17th was missed; today counts only once it's done.
    assert _entries(client, metric) == [("2026-11-16", 1), ("2026-11-17", 0)]
    _check(client, step, "2026-11-18")
    assert _entries(client, metric)[-1] == ("2026-11-18", 1)


def test_skipped_and_paused_days_are_left_out(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    area: int,
    routine: dict[str, Any],
    step: dict[str, Any],
) -> None:
    metric = _metric(client, area, step)
    _check(client, step, "2026-11-16")
    _check(client, step, "2026-11-17", "skipped")
    client.post(f"/api/routines/{routine['id']}/pause")  # paused from the 18th
    monkeypatch.setattr(clock, "today", lambda: date(2026, 11, 20))
    client.post(f"/api/routines/{routine['id']}/resume")  # due again from the 20th

    assert _entries(client, metric) == [("2026-11-16", 1)]


def test_an_average_reads_as_a_percentage(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    metric = _metric(client, area, step, aggregation="average")
    _check(client, step, "2026-11-16")
    target = client.post(
        f"/api/metrics/{metric['id']}/targets",
        json={
            "kind": "per_period",
            "period": "week",
            "target_value": 80,
            "start_date": "2026-11-16",
        },
    ).json()

    assert _entries(client, metric) == [("2026-11-16", 100), ("2026-11-17", 0)]
    assert (target["value"], target["state"]) == (50, "in_progress")


def test_a_weekly_target_counts_days_done(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    metric = _metric(client, area, step)
    for day in ("2026-11-16", "2026-11-17", "2026-11-18"):
        _check(client, step, day)

    target = client.post(
        f"/api/metrics/{metric['id']}/targets",
        json={
            "kind": "per_period",
            "period": "week",
            "target_value": 3,
            "start_date": "2026-11-16",
        },
    ).json()

    assert (target["value"], target["state"]) == (3, "met")


def test_entries_cant_be_typed_in(client: TestClient, area: int, step: dict[str, Any]) -> None:
    metric = _metric(client, area, step)

    response = client.post(f"/api/metrics/{metric['id']}/entries", json={"value": 1})

    assert response.status_code == 409
    assert client.get(f"/api/metrics/{metric['id']}/delete-preview").json()["entries"] == 0


def test_archiving_the_step_keeps_the_history_and_stops_new_days(
    client: TestClient,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
    area: int,
    step: dict[str, Any],
) -> None:
    metric = _metric(client, area, step)
    _check(client, step, "2026-11-18")
    # Archived at noon UTC on the 18th: the clock that stamps archived_at isn't pinned.
    archived = session.get(RoutineStep, step["id"])
    assert archived is not None
    archived.archived_at = datetime(2026, 11, 18, 12, 0)
    session.commit()
    monkeypatch.setattr(clock, "today", lambda: date(2026, 11, 25))

    # The archive day counts because it was done; nothing after it is added.
    assert _entries(client, metric) == [("2026-11-16", 0), ("2026-11-17", 0), ("2026-11-18", 1)]


def test_the_overview_uses_the_derived_entries(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    _metric(client, area, step)
    _check(client, step, "2026-11-16")
    _check(client, step, "2026-11-17")

    overview = client.get("/api/life-areas/overview", params={"period": "week"}).json()

    outcome = overview["outcomes"][0]
    assert (outcome["source"], outcome["unit"]) == ("routine_step", "days")
    assert [point["value"] for point in outcome["points"]] == [1, 1, None]  # today is open


# ---------- Changing ----------


def test_changing_the_aggregation_changes_the_format(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    metric = _metric(client, area, step)
    url = f"/api/metrics/{metric['id']}"

    changed = client.patch(url, json={"aggregation": "average"}).json()

    assert (changed["format"], changed["unit"]) == ("percent", None)
    assert client.patch(url, json={"aggregation": "latest"}).status_code == 422
    assert client.patch(url, json={"format": "number"}).status_code == 422
    assert client.patch(url, json={"routine_step_id": None}).status_code == 422


# ---------- Deleting the step ----------


def test_a_step_feeding_a_metric_cant_be_deleted(
    client: TestClient, area: int, routine: dict[str, Any], step: dict[str, Any]
) -> None:
    metric = _metric(client, area, step)

    step_delete = client.delete(f"/api/routine-steps/{step['id']}")
    routine_delete = client.delete(f"/api/routines/{routine['id']}")
    preview = client.get(f"/api/routine-steps/{step['id']}/delete-preview").json()

    assert step_delete.status_code == 409
    assert '"Runs"' in step_delete.json()["detail"]
    assert routine_delete.status_code == 409
    assert preview["metrics"] == [{"id": metric["id"], "title": "Runs"}]

    client.delete(f"/api/metrics/{metric['id']}")
    assert client.delete(f"/api/routine-steps/{step['id']}").status_code == 204


def test_an_archived_metric_still_blocks_the_delete(
    client: TestClient, area: int, step: dict[str, Any]
) -> None:
    metric = _metric(client, area, step)
    client.post(f"/api/metrics/{metric['id']}/archive")

    assert client.delete(f"/api/routine-steps/{step['id']}").status_code == 409


# ---------- Database rules ----------


@pytest.mark.parametrize(
    ("fields", "with_step"),
    [
        ({"source": "routine_step"}, False),
        ({"source": "manual"}, True),
        ({"source": "routine_step", "aggregation": "latest"}, True),
        ({"source": "routine_step", "unit": "runs"}, True),
        ({"source": "routine_step", "aggregation": "average"}, True),  # must be a percent
    ],
)
def test_the_database_enforces_source_rules(
    session: Session, area: int, step: dict[str, Any], fields: dict[str, Any], with_step: bool
) -> None:
    values: dict[str, Any] = {"aggregation": "sum", "unit": "days", **fields}
    if with_step:
        values["routine_step_id"] = step["id"]
    session.add(Metric(title="X", life_area_id=area, **values))

    with pytest.raises(IntegrityError):
        session.commit()


def test_the_database_refuses_to_delete_a_metrics_step(
    session: Session, client: TestClient, area: int, step: dict[str, Any]
) -> None:
    _metric(client, area, step)

    session.delete(session.get(RoutineStep, step["id"]))

    with pytest.raises(IntegrityError):
        session.commit()
