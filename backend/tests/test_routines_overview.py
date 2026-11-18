"""The Routines overview: totals across routines, each routine's days, Most missed and
Pick up."""

from datetime import date, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from tests.factories import make_life_area

TODAY = date(2026, 11, 18)  # a Wednesday; its week is Nov 16 to 22


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def area(session: Session) -> int:
    return make_life_area(session).id


def _routine(
    client: TestClient, title: str, area: int, steps: list[str], starts_on: str = "2026-11-09"
) -> dict[str, Any]:
    body = {
        "title": title,
        "starts_on": starts_on,
        "steps": [{"title": step, "life_area_id": area} for step in steps],
    }
    response = client.post("/api/routines", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _check(client: TestClient, step: dict[str, Any], day: date, status: str = "done") -> None:
    url = f"/api/routine-steps/{step['id']}/days/{day.isoformat()}"
    response = client.put(url, json={"status": status})
    assert response.status_code == 200, response.text


def _days(first: date, last: date) -> list[date]:
    return [first + timedelta(days=n) for n in range((last - first).days + 1)]


def _overview(client: TestClient, **params: Any) -> dict[str, Any]:
    response = client.get("/api/routines/overview", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_totals_add_up_routines_and_the_longest_run_names_its_routine(
    client: TestClient, area: int
) -> None:
    morning = _routine(client, "Morning", area, ["Water", "Bed"])
    evening = _routine(client, "Evening", area, ["Read"])
    water, bed = morning["steps"]
    (read,) = evening["steps"]
    for day in _days(date(2026, 11, 9), date(2026, 11, 17)):
        _check(client, read, day)  # Evening: 9 full days in a row
        _check(client, water, day)
        if day != date(2026, 11, 16):
            _check(client, bed, day)  # Morning: Bed missed on Monday
    _check(client, water, TODAY)

    body = _overview(client, period="week")

    assert (body["start"], body["end"], body["today"]) == ("2026-11-16", "2026-11-22", "2026-11-18")
    # Mon and Tue: Morning 3 done + 1 missed, Evening 2 done; today Water done.
    assert body["totals"] == {
        "done": 6,
        "missed": 1,
        "skipped": 0,
        "due_days": 6,  # 3 days (today still to do) for each routine
        "full_days": 3,  # Morning Tue, Evening Mon and Tue
        "completion_rate": 86,
    }
    assert body["previous"]["done"] == 21  # last week: 7 days of 3 steps
    assert body["longest_run"] == {
        "length": 9,
        "routine_id": evening["id"],
        "routine_title": "Evening",
    }
    assert [bucket["run"] for bucket in body["buckets"]] == [8, 9, 9]  # Mon to today

    first, second = body["routines"]
    assert (first["title"], second["title"]) == ("Morning", "Evening")
    assert (first["today_done"], first["today_due"]) == (1, 2)
    assert (second["today_done"], second["today_due"]) == (0, 1)
    assert first["totals"]["completion_rate"] == 80
    assert [item["state"] for item in first["steps"][1]["days"]][:3] == ["missed", "done", "todo"]
    assert len(first["steps"][0]["days"]) == 7
    assert (first["rrule"], first["schedule_starts_on"]) == ("FREQ=DAILY", "2026-11-09")
    assert body["started"] == "2026-11-09"


def test_most_missed_lists_the_top_three_steps(client: TestClient, area: int) -> None:
    routine = _routine(client, "Morning", area, ["A", "B", "C", "D"])
    _, b, c, d = routine["steps"]
    # Over Nov 9 to 17: A missed every day, D once, B and C done except two misses each.
    for day in _days(date(2026, 11, 9), date(2026, 11, 17)):
        if day.day not in (10, 11):
            _check(client, b, day)
            _check(client, c, day)
        if day.day != 12:
            _check(client, d, day)

    body = _overview(client, period="month")

    missed = [(row["title"], row["missed"]) for row in body["most_missed"]]
    assert missed == [("A", 9), ("B", 2), ("C", 2)]
    assert body["most_missed"][0]["routine_title"] == "Morning"


def test_pick_up_lists_runs_of_four_ended_by_a_miss_this_week(
    client: TestClient, area: int
) -> None:
    routine = _routine(client, "Morning", area, ["Long", "Short", "Earlier"], "2026-11-01")
    long, short, earlier = routine["steps"]
    for day in _days(date(2026, 11, 10), date(2026, 11, 15)):
        _check(client, long, day)  # 6 done (one skipped), then missed on Monday
    _check(client, long, date(2026, 11, 12), "skipped")
    for day in _days(date(2026, 11, 13), date(2026, 11, 16)):
        _check(client, short, day)  # 3 done in a row before Tuesday's miss...
    _check(client, short, date(2026, 11, 13), "skipped")
    for day in _days(date(2026, 11, 1), date(2026, 11, 8)):
        _check(client, earlier, day)  # its run ended last week, not this week

    body = _overview(client, period="quarter")

    assert [(row["title"], row["run"], row["ended_on"]) for row in body["pick_up"]] == [
        ("Long", 5, "2026-11-16"),
    ]


def test_with_no_routines_everything_is_empty(client: TestClient) -> None:
    body = _overview(client, period="month", date="2026-11-01")

    assert body["routines"] == []
    assert body["buckets"] == []
    assert body["previous"] is None
    assert body["longest_run"] is None
    assert body["started"] is None
    assert body["totals"]["completion_rate"] is None
    assert (body["most_missed"], body["pick_up"]) == ([], [])


def test_archived_routines_are_left_out_and_a_year_has_no_comparison(
    client: TestClient, area: int
) -> None:
    kept = _routine(client, "Morning", area, ["Water"])
    gone = _routine(client, "Evening", area, ["Read"])
    response = client.post(f"/api/routines/{gone['id']}/archive")
    assert response.status_code == 200, response.text

    body = _overview(client, period="year")

    assert [row["id"] for row in body["routines"]] == [kept["id"]]
    assert body["previous"] is None
    assert [bucket["start"] for bucket in body["buckets"]] == ["2026-11-01"]
    assert body["totals"]["missed"] == 9  # Water, Nov 9 to 17
