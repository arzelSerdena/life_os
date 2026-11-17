"""The routine page: totals, runs, each step's days, and the schedules and pauses."""

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import RoutinePause
from tests.factories import make_life_area

TODAY = date(2026, 11, 18)  # a Wednesday; its week is Nov 16 to 22


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def area(session: Session) -> int:
    return make_life_area(session).id


def _routine(client: TestClient, starts_on: str = "2026-11-09", **fields: Any) -> dict[str, Any]:
    body = {"title": "Evening", "starts_on": starts_on, **fields}
    response = client.post("/api/routines", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _step(
    client: TestClient, routine: dict[str, Any], area: int, title: str, starts_on: str
) -> dict[str, Any]:
    body = {"title": title, "life_area_id": area, "starts_on": starts_on}
    response = client.post(f"/api/routines/{routine['id']}/steps", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _check(client: TestClient, step: dict[str, Any], day: str, status: str = "done") -> None:
    url = f"/api/routine-steps/{step['id']}/days/{day}"
    response = client.put(url, json={"status": status})
    assert response.status_code == 200, response.text


def _page(client: TestClient, routine: dict[str, Any], **params: Any) -> dict[str, Any]:
    response = client.get(f"/api/routines/{routine['id']}/page", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _two_steps(client: TestClient, area: int) -> tuple[dict[str, Any], dict[str, Any], dict]:
    routine = _routine(client)
    read = _step(client, routine, area, "Read", "2026-11-09")
    stretch = _step(client, routine, area, "Stretch", "2026-11-09")
    return routine, read, stretch


def test_totals_and_runs_over_a_week(client: TestClient, area: int) -> None:
    routine, read, stretch = _two_steps(client, area)
    for day in range(9, 16):  # last week: every day full
        _check(client, read, f"2026-11-{day:02}")
        _check(client, stretch, f"2026-11-{day:02}")
    _check(client, read, "2026-11-16")  # Stretch missed: breaks the run
    _check(client, read, "2026-11-17")
    _check(client, stretch, "2026-11-17")
    _check(client, read, "2026-11-18")  # today, Stretch still to do: neutral

    body = _page(client, routine, period="week")

    assert (body["start"], body["end"], body["today"]) == ("2026-11-16", "2026-11-22", "2026-11-18")
    assert body["totals"] == {
        "done": 4,
        "missed": 1,
        "skipped": 0,
        "due_days": 3,
        "full_days": 1,
        "completion_rate": 80,
    }
    assert body["previous"]["full_days"] == 7
    assert body["previous"]["completion_rate"] == 100
    assert body["current_run"] == {"length": 1, "start": "2026-11-17", "end": "2026-11-17"}
    assert body["best_run"]["length"] == 1
    # One point per day up to today.
    assert [(b["start"], b["run"]) for b in body["buckets"]] == [
        ("2026-11-16", 0),
        ("2026-11-17", 1),
        ("2026-11-18", 1),
    ]

    # Last week's best run is the seven full days.
    before = _page(client, routine, period="week", date="2026-11-10")
    assert before["best_run"] == {"length": 7, "start": "2026-11-09", "end": "2026-11-15"}


def test_skipped_steps_are_left_out_and_today_counts_once_full(
    client: TestClient, area: int
) -> None:
    routine, read, stretch = _two_steps(client, area)
    _check(client, read, "2026-11-16")
    _check(client, stretch, "2026-11-16", "skipped")  # full: the skipped step is left out
    _check(client, read, "2026-11-17", "skipped")
    _check(client, stretch, "2026-11-17", "skipped")  # every step skipped: neutral
    _check(client, read, "2026-11-18")
    _check(client, stretch, "2026-11-18")  # today, all done: counts

    body = _page(client, routine, period="week")

    assert body["totals"]["full_days"] == 2
    assert body["totals"]["skipped"] == 3
    assert body["current_run"] == {"length": 2, "start": "2026-11-16", "end": "2026-11-18"}


def test_step_rows_hold_each_day_and_their_completion(client: TestClient, area: int) -> None:
    routine, read, _ = _two_steps(client, area)
    late = _step(client, routine, area, "Floss", "2026-11-17")
    _check(client, read, "2026-11-16")
    metric = client.post(
        "/api/metrics",
        json={
            "title": "Reading days",
            "aggregation": "sum",
            "source": "routine_step",
            "routine_step_id": read["id"],
            "life_area_id": area,
        },
    )
    assert metric.status_code == 201, metric.text

    rows = {row["step"]["title"]: row for row in _page(client, routine, period="week")["steps"]}

    assert [day["state"] for day in rows["Floss"]["days"]] == [
        "none",
        "missed",
        "todo",
        "upcoming",
        "upcoming",
        "upcoming",
        "upcoming",
    ]
    assert (rows["Read"]["done"], rows["Read"]["missed"]) == (1, 1)
    assert rows["Read"]["metric"]["title"] == "Reading days"
    assert rows["Floss"]["metric"] is None
    assert rows["Floss"]["next_due"] == "2026-11-18"
    assert late["id"] == rows["Floss"]["step"]["id"]


def test_paused_days_are_neutral_and_listed(
    client: TestClient, area: int, session: Session
) -> None:
    routine, read, stretch = _two_steps(client, area)
    session.add(RoutinePause(routine_id=routine["id"], starts_on=date(2026, 11, 10), ends_on=None))
    session.commit()
    _check(client, read, "2026-11-09")
    _check(client, stretch, "2026-11-09")

    body = _page(client, routine, period="month")

    assert body["paused_since"] == "2026-11-10"
    assert body["pauses"] == [{"starts_on": "2026-11-10", "ends_on": None}]
    assert body["totals"]["missed"] == 0
    assert body["current_run"]["length"] == 1
    assert {day["state"] for day in body["steps"][0]["days"][10:20]} == {"paused"}


def test_no_previous_period_before_the_routine_started(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    _step(client, routine, area, "Read", "2026-11-16")

    assert _page(client, routine, period="week")["previous"] is None
    assert _page(client, routine, period="month")["previous"] is None
    assert _page(client, routine, period="year")["previous"] is None


def test_the_previous_period_counts_from_the_routines_start(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-09-28")  # two days before Q3 ends
    step = _step(client, routine, area, "Read", "2026-09-28")
    _check(client, step, "2026-09-29")

    previous = _page(client, routine, period="quarter")["previous"]

    assert previous is not None
    assert (previous["done"], previous["missed"], previous["due_days"]) == (1, 2, 3)


def test_month_and_year_points(client: TestClient, area: int) -> None:
    routine, *_ = _two_steps(client, area)

    month = _page(client, routine, period="month")
    year = _page(client, routine, period="year")

    # Weeks of November from the routine's start up to today, clipped to the month.
    assert [(b["start"], b["end"]) for b in month["buckets"]] == [
        ("2026-11-09", "2026-11-15"),
        ("2026-11-16", "2026-11-22"),
    ]
    assert [b["start"] for b in year["buckets"]] == ["2026-11-01"]
    assert len(year["steps"][0]["days"]) == 365


def test_a_routine_with_no_steps_has_empty_totals(client: TestClient) -> None:
    routine = _routine(client)

    body = _page(client, routine)

    assert body["period"] == "quarter"
    assert body["steps"] == []
    assert body["totals"]["completion_rate"] is None
    assert body["current_run"] == {"length": 0, "start": None, "end": None}


def test_an_unknown_routine_is_not_found(client: TestClient) -> None:
    assert client.get("/api/routines/999/page").status_code == 404
