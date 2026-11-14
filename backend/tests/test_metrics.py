"""Metrics, entries and targets. Today is pinned to Wednesday 18 November 2026."""

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import clock
from app.models import MetricEntry, MetricTarget
from app.models.base import utc_now
from app.services.metric_targets import period_end, period_start
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 18)  # a Wednesday


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def area(session: Session) -> int:
    return make_life_area(session).id


def _metric(client: TestClient, area: int, **fields: Any) -> dict[str, Any]:
    body = {"title": "Distance", "unit": "km", "aggregation": "sum", "life_area_id": area, **fields}
    response = client.post("/api/metrics", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _log(client: TestClient, metric: dict[str, Any], day: str, value: float) -> None:
    response = client.post(
        f"/api/metrics/{metric['id']}/entries", json={"date": day, "value": value}
    )
    assert response.status_code == 201, response.text


def _target(client: TestClient, metric: dict[str, Any], **fields: Any) -> dict[str, Any]:
    response = client.post(f"/api/metrics/{metric['id']}/targets", json=fields)
    assert response.status_code == 201, response.text
    return response.json()


def _targets(client: TestClient, metric: dict[str, Any]) -> list[dict[str, Any]]:
    return client.get(f"/api/metrics/{metric['id']}").json()["targets"]


# ---------- Metrics ----------


def test_a_projects_metric_inherits_its_life_area(client: TestClient, session: Session) -> None:
    project = make_project(session, make_life_area(session))

    response = client.post(
        "/api/metrics", json={"title": "Pages", "aggregation": "sum", "project_id": project.id}
    )

    assert response.json()["life_area_id"] == project.life_area_id
    assert response.json()["direction"] == "higher"


@pytest.mark.parametrize(
    ("make_body", "status_code"),
    [
        (lambda ids: {"title": "X", "aggregation": "sum"}, 422),  # no owner
        (lambda ids: {"title": "X", "aggregation": "max", "life_area_id": ids["area"]}, 422),
        (
            lambda ids: {
                "title": "X",
                "aggregation": "sum",
                "unit": "x" * 21,
                "life_area_id": ids["area"],
            },
            422,
        ),
        (lambda ids: {"title": "X", "aggregation": "sum", "life_area_id": ids["archived"]}, 409),
    ],
)
def test_create_is_validated(
    client: TestClient, session: Session, make_body: Any, status_code: int
) -> None:
    ids = {
        "area": make_life_area(session).id,
        "archived": make_life_area(session, "Old", archived_at=utc_now()).id,
    }

    assert client.post("/api/metrics", json=make_body(ids)).status_code == status_code


def test_list_filters_and_hides_archived(client: TestClient, session: Session, area: int) -> None:
    project = make_project(session, make_life_area(session, "Career"))
    _metric(client, area, title="Distance")
    _metric(client, area, title="Pages", project_id=project.id, life_area_id=None)
    archived = _metric(client, area, title="Old")
    client.post(f"/api/metrics/{archived['id']}/archive")

    def titles(**params: Any) -> list[str]:
        return [m["title"] for m in client.get("/api/metrics", params=params).json()]

    assert titles() == ["Distance", "Pages"]
    assert titles(life_area_id=area) == ["Distance"]
    assert titles(project_id=project.id) == ["Pages"]
    assert titles(include_archived=True) == ["Distance", "Pages", "Old"]


def test_archiving_can_be_undone(client: TestClient, area: int) -> None:
    metric = _metric(client, area)

    change = client.post(f"/api/metrics/{metric['id']}/archive").json()
    client.post(f"/api/undo/{change['batch_id']}")

    assert client.get(f"/api/metrics/{metric['id']}").json()["archived_at"] is None


def test_deleting_a_metric_deletes_its_entries_and_targets(
    client: TestClient, session: Session, area: int
) -> None:
    metric = _metric(client, area)
    _log(client, metric, "2026-11-18", 5)
    _target(client, metric, kind="per_period", period="week", target_value=20)

    assert client.delete(f"/api/metrics/{metric['id']}").status_code == 204
    assert session.scalars(select(MetricEntry)).all() == []
    assert session.scalars(select(MetricTarget)).all() == []


# ---------- Entries ----------


def test_entries_default_to_today_and_list_by_date(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    client.post(f"/api/metrics/{metric['id']}/entries", json={"value": 5, "note": "Easy"})
    _log(client, metric, "2026-11-10", 8)
    _log(client, metric, "2026-11-12", 3)

    all_entries = client.get(f"/api/metrics/{metric['id']}/entries").json()
    some = client.get(
        f"/api/metrics/{metric['id']}/entries", params={"first": "2026-11-11", "last": "2026-11-17"}
    ).json()

    assert [(e["date"], e["value"]) for e in all_entries] == [
        ("2026-11-10", 8.0),
        ("2026-11-12", 3.0),
        ("2026-11-18", 5.0),
    ]
    assert [e["date"] for e in some] == ["2026-11-12"]


def test_entries_cant_be_in_the_future(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    _log(client, metric, "2026-11-18", 5)
    entry = client.get(f"/api/metrics/{metric['id']}/entries").json()[0]

    future = client.post(
        f"/api/metrics/{metric['id']}/entries", json={"date": "2026-11-19", "value": 1}
    )
    moved = client.patch(f"/api/metric-entries/{entry['id']}", json={"date": "2026-11-19"})

    assert (future.status_code, moved.status_code) == (422, 422)


def test_entries_can_be_changed_and_deleted(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    _log(client, metric, "2026-11-18", 5)
    entry = client.get(f"/api/metrics/{metric['id']}/entries").json()[0]

    changed = client.patch(f"/api/metric-entries/{entry['id']}", json={"value": 6.5}).json()
    deleted = client.delete(f"/api/metric-entries/{entry['id']}")

    assert changed["value"] == 6.5
    assert deleted.status_code == 204
    assert client.get(f"/api/metrics/{metric['id']}/entries").json() == []


def test_an_archived_metric_takes_no_entries(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    client.post(f"/api/metrics/{metric['id']}/archive")

    response = client.post(f"/api/metrics/{metric['id']}/entries", json={"value": 1})

    assert response.status_code == 409


# ---------- Reach-by targets ----------


def test_reach_by_sums_from_its_start(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    _log(client, metric, "2026-10-31", 50)  # before the target started
    _log(client, metric, "2026-11-05", 40)
    _log(client, metric, "2026-11-12", 30)

    target = _target(
        client,
        metric,
        kind="reach_by",
        target_value=100,
        start_date="2026-11-01",
        end_date="2026-12-31",
    )

    assert (target["state"], target["value"]) == ("in_progress", 70.0)
    _log(client, metric, "2026-11-18", 30)
    assert _targets(client, metric)[0]["state"] == "met"


def test_reach_by_is_missed_after_its_deadline(
    client: TestClient, area: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    metric = _metric(client, area)
    _target(
        client,
        metric,
        kind="reach_by",
        target_value=100,
        start_date="2026-11-01",
        end_date="2026-11-30",
    )
    _log(client, metric, "2026-11-10", 60)

    monkeypatch.setattr(clock, "today", lambda: date(2026, 12, 5))
    _log(client, metric, "2026-12-02", 60)  # after the deadline, so it doesn't count

    (target,) = _targets(client, metric)
    assert (target["state"], target["value"]) == ("missed", 60.0)


def test_lower_is_better_uses_the_latest_value(client: TestClient, area: int) -> None:
    metric = _metric(
        client, area, title="Weight", unit="kg", aggregation="latest", direction="lower"
    )
    _target(
        client,
        metric,
        kind="reach_by",
        target_value=70,
        start_date="2026-11-01",
        end_date="2027-06-01",
    )
    _log(client, metric, "2026-11-05", 69.5)
    _log(client, metric, "2026-11-12", 71.2)

    (target,) = _targets(client, metric)

    assert (target["state"], target["value"]) == ("in_progress", 71.2)


def test_a_target_that_hasnt_started_is_upcoming(client: TestClient, area: int) -> None:
    metric = _metric(client, area)

    target = _target(
        client,
        metric,
        kind="reach_by",
        target_value=10,
        start_date="2026-12-01",
        end_date="2026-12-31",
    )

    assert (target["state"], target["value"]) == ("upcoming", None)


# ---------- Per-period targets ----------


def test_weekly_target_judges_each_calendar_week(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    for day, value in [
        ("2026-11-03", 12),
        ("2026-11-06", 9),
        ("2026-11-10", 10),
        ("2026-11-17", 5),
    ]:
        _log(client, metric, day, value)

    target = _target(
        client, metric, kind="per_period", period="week", target_value=20, start_date="2026-11-02"
    )

    assert target["state"] == "in_progress"
    assert target["current_period"] == {
        "start": "2026-11-16",
        "end": "2026-11-22",
        "value": 5.0,
        "status": "in_progress",
    }
    assert [(p["start"], p["status"]) for p in target["recent_periods"]] == [
        ("2026-11-09", "missed"),
        ("2026-11-02", "met"),
    ]
    assert (target["met_periods"], target["missed_periods"]) == (1, 1)


def test_a_period_only_counts_entries_from_the_targets_start(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    _log(client, metric, "2026-11-02", 100)  # same month, but before the target

    target = _target(
        client, metric, kind="per_period", period="month", target_value=50, start_date="2026-11-10"
    )

    assert target["current_period"]["start"] == "2026-11-01"
    assert target["current_period"]["value"] is None


def test_daily_average_target(client: TestClient, area: int) -> None:
    metric = _metric(client, area, title="Sleep", unit="h", aggregation="average")
    _log(client, metric, "2026-11-17", 7)
    _log(client, metric, "2026-11-17", 9)  # two naps' worth averaged
    _log(client, metric, "2026-11-16", 6)

    target = _target(
        client, metric, kind="per_period", period="day", target_value=8, start_date="2026-11-16"
    )

    assert [(p["start"], p["value"], p["status"]) for p in target["recent_periods"]] == [
        ("2026-11-17", 8.0, "met"),
        ("2026-11-16", 6.0, "missed"),
    ]


def test_a_finished_per_period_target_has_ended(client: TestClient, area: int) -> None:
    metric = _metric(client, area)

    target = _target(
        client,
        metric,
        kind="per_period",
        period="week",
        target_value=20,
        start_date="2026-10-05",
        end_date="2026-10-25",
    )

    assert target["state"] == "ended"
    assert target["current_period"] is None
    assert target["missed_periods"] == 3


@pytest.mark.parametrize(
    ("day", "period", "start", "end"),
    [
        ("2026-11-18", "week", "2026-11-16", "2026-11-22"),
        ("2026-12-15", "month", "2026-12-01", "2026-12-31"),
        ("2028-02-10", "month", "2028-02-01", "2028-02-29"),
        ("2026-11-18", "day", "2026-11-18", "2026-11-18"),
    ],
)
def test_calendar_periods(day: str, period: str, start: str, end: str) -> None:
    first = period_start(date.fromisoformat(day), period)

    assert (str(first), str(period_end(first, period))) == (start, end)


# ---------- Target rules ----------


@pytest.mark.parametrize(
    ("body", "status_code"),
    [
        ({"kind": "reach_by", "target_value": 10}, 422),  # no deadline
        ({"kind": "per_period", "target_value": 10}, 422),  # no period
        ({"kind": "reach_by", "target_value": 10, "period": "week", "end_date": "2026-12-01"}, 422),
        (
            {"kind": "per_period", "target_value": 10, "period": "week", "end_date": "2026-11-01"},
            422,
        ),
        ({"kind": "per_period", "target_value": 10, "period": "year"}, 422),
    ],
)
def test_target_rules(
    client: TestClient, area: int, body: dict[str, Any], status_code: int
) -> None:
    metric = _metric(client, area)

    assert client.post(f"/api/metrics/{metric['id']}/targets", json=body).status_code == status_code


def test_targets_of_one_kind_cant_overlap(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    _target(
        client, metric, kind="per_period", period="week", target_value=20, start_date="2026-11-01"
    )

    overlapping = client.post(
        f"/api/metrics/{metric['id']}/targets",
        json={
            "kind": "per_period",
            "period": "month",
            "target_value": 80,
            "start_date": "2026-12-01",
        },
    )
    other_kind = client.post(
        f"/api/metrics/{metric['id']}/targets",
        json={"kind": "reach_by", "target_value": 500, "end_date": "2026-12-31"},
    )

    assert (overlapping.status_code, other_kind.status_code) == (409, 201)


def test_changing_a_target_keeps_its_history(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    _log(client, metric, "2026-11-04", 25)
    old = _target(
        client, metric, kind="per_period", period="week", target_value=20, start_date="2026-11-02"
    )

    new = client.post(f"/api/metric-targets/{old['id']}/replace", json={"target_value": 30}).json()

    assert (new["start_date"], new["target_value"]) == ("2026-11-18", 30.0)
    previous = next(t for t in _targets(client, metric) if t["id"] == old["id"])
    assert previous["end_date"] == "2026-11-17"
    assert previous["met_periods"] == 1  # its history is still there


def test_changing_a_target_that_started_today_edits_it(client: TestClient, area: int) -> None:
    metric = _metric(client, area)
    target = _target(client, metric, kind="per_period", period="week", target_value=20)

    changed = client.post(
        f"/api/metric-targets/{target['id']}/replace", json={"period": "month"}
    ).json()

    assert (changed["id"], changed["period"]) == (target["id"], "month")
    assert len(_targets(client, metric)) == 1


@pytest.mark.parametrize(
    ("make_target", "body", "status_code"),
    [
        (
            {
                "kind": "reach_by",
                "target_value": 10,
                "start_date": "2026-11-01",
                "end_date": "2026-12-01",
            },
            {"period": "week"},
            422,
        ),
        (
            {
                "kind": "per_period",
                "period": "week",
                "target_value": 10,
                "start_date": "2026-10-01",
                "end_date": "2026-10-31",
            },
            {"target_value": 5},
            409,
        ),
    ],
)
def test_changing_a_target_is_validated(
    client: TestClient,
    area: int,
    make_target: dict[str, Any],
    body: dict[str, Any],
    status_code: int,
) -> None:
    metric = _metric(client, area)
    target = _target(client, metric, **make_target)

    response = client.post(f"/api/metric-targets/{target['id']}/replace", json=body)

    assert response.status_code == status_code


# ---------- Database rules ----------


@pytest.mark.parametrize(
    "fields",
    [
        {"kind": "reach_by", "end_date": None},
        {"kind": "per_period", "period": None},
        {"kind": "reach_by", "period": "week", "end_date": date(2026, 12, 1)},
        {"kind": "per_period", "period": "week", "end_date": date(2026, 11, 1)},
    ],
)
def test_the_database_enforces_target_rules(
    client: TestClient, session: Session, area: int, fields: dict[str, Any]
) -> None:
    metric = _metric(client, area)
    session.add(
        MetricTarget(
            **{"metric_id": metric["id"], "target_value": 1, "start_date": TODAY, **fields}
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()
