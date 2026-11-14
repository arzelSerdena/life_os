"""The week board, rollover and reordering. Today is pinned to Wednesday 18 November 2026."""

from datetime import date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import Task, TaskTemplate
from tests.factories import make_life_area

TODAY = date(2026, 11, 18)  # a Wednesday
MONDAY = "2026-11-16"


@pytest.fixture(autouse=True)
def pinned_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)
    monkeypatch.setattr(clock, "now", lambda: datetime(2026, 11, 18, 12, 0))


def _task(client: TestClient, title: str, **fields: Any) -> dict[str, Any]:
    response = client.post("/api/tasks", json={"title": title, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def _week(client: TestClient, **params: Any) -> dict[str, Any]:
    response = client.get("/api/week", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _board(week: dict[str, Any]) -> dict[str, list[str]]:
    """Task titles per day, keyed by date, plus 'unscheduled'."""
    board = {day["day"]: [task["title"] for task in day["tasks"]] for day in week["days"]}
    board["unscheduled"] = [task["title"] for task in week["unscheduled"]]
    return board


# ---------- Shape ----------


def test_the_week_runs_monday_to_sunday_around_any_day(client: TestClient) -> None:
    week = _week(client, start="2026-11-20")

    assert (week["week_start"], week["week_end"], week["today"]) == (
        MONDAY,
        "2026-11-22",
        "2026-11-18",
    )
    assert [day["day"] for day in week["days"]] == [
        "2026-11-16",
        "2026-11-17",
        "2026-11-18",
        "2026-11-19",
        "2026-11-20",
        "2026-11-21",
        "2026-11-22",
    ]


def test_without_a_start_it_shows_this_week(client: TestClient) -> None:
    assert _week(client)["week_start"] == MONDAY


def test_tasks_land_on_their_days_and_unscheduled(client: TestClient) -> None:
    _task(client, "Thursday", scheduled_date="2026-11-19")
    _task(client, "Next week", scheduled_date="2026-11-23")
    _task(client, "Someday")
    done = _task(client, "Done Friday", scheduled_date="2026-11-20")
    client.post(f"/api/tasks/{done['id']}/complete")
    done_unscheduled = _task(client, "Done, no date")
    client.post(f"/api/tasks/{done_unscheduled['id']}/complete")

    board = _board(_week(client))

    assert board["2026-11-19"] == ["Thursday"]
    assert board["2026-11-20"] == ["Done Friday"]  # done tasks show, ticked
    assert board["unscheduled"] == ["Someday"]  # only to-do tasks
    assert all("Next week" not in titles for titles in board.values())


def test_cancelled_tasks_show_only_when_asked(client: TestClient) -> None:
    cancelled = _task(client, "Cancelled", scheduled_date="2026-11-19")
    client.post(f"/api/tasks/{cancelled['id']}/cancel")

    assert _board(_week(client))["2026-11-19"] == []
    assert _board(_week(client, include_cancelled=True))["2026-11-19"] == ["Cancelled"]


def test_filtering_by_life_area(client: TestClient, session: Session) -> None:
    health = make_life_area(session, "Health")
    _task(client, "Run", life_area_id=health.id, scheduled_date="2026-11-19")
    _task(client, "Stretch", life_area_id=health.id)
    _task(client, "Inbox")
    client.post(
        "/api/events",
        json={"title": "Race", "start_date": "2026-11-21", "life_area_id": health.id},
    )

    board = _week(client, life_area_id=health.id)

    assert _board(board)["2026-11-19"] == ["Run"]
    assert _board(board)["unscheduled"] == ["Stretch"]
    assert [e["title"] for e in board["days"][5]["events"]] == ["Race"]


# ---------- Events ----------


def test_events_appear_on_every_day_they_cover(client: TestClient, session: Session) -> None:
    area = make_life_area(session).id
    client.post(
        "/api/events",
        json={
            "title": "Trip",
            "start_date": "2026-11-14",
            "end_date": "2026-11-17",
            "life_area_id": area,
        },
    )
    client.post(
        "/api/events",
        json={
            "title": "Gym",
            "start_date": "2026-11-02",
            "start_time": "18:00",
            "rrule": "FREQ=WEEKLY;BYDAY=TU,TH",
            "life_area_id": area,
        },
    )

    week = _week(client)
    events = {day["day"]: [e["title"] for e in day["events"]] for day in week["days"]}

    assert events["2026-11-16"] == ["Trip"]
    assert events["2026-11-17"] == ["Trip", "Gym"]  # all-day first, then by time
    assert events["2026-11-19"] == ["Gym"]
    assert events["2026-11-18"] == []
    trip = week["days"][0]["events"][0]
    assert (trip["start_date"], trip["end_date"]) == ("2026-11-14", "2026-11-17")


# ---------- Recurring tasks ----------


def test_loading_a_week_creates_its_recurring_tasks_once(
    client: TestClient, session: Session
) -> None:
    client.post(
        "/api/task-templates",
        json={"title": "Water plants", "rrule": "FREQ=DAILY", "starts_on": "2026-11-01"},
    )

    first = _board(_week(client))
    second = _board(_week(client))

    assert first == second
    # From today forward only: nothing is created for Monday or Tuesday
    assert first["2026-11-16"] == []
    assert first["2026-11-17"] == []
    assert all(first[day] == ["Water plants"] for day in ("2026-11-18", "2026-11-22"))
    assert session.query(Task).count() == 5


# ---------- Rollover ----------


def test_unfinished_tasks_from_past_days_roll_over_to_today(
    client: TestClient, session: Session
) -> None:
    _task(client, "Already today", scheduled_date="2026-11-18")
    _task(client, "Monday", scheduled_date="2026-11-16")
    _task(client, "Last week", scheduled_date="2026-11-10", due_date="2026-11-11")
    done = _task(client, "Done Monday", scheduled_date="2026-11-16")
    client.post(f"/api/tasks/{done['id']}/complete")
    archived = _task(client, "Archived Monday", scheduled_date="2026-11-16")
    client.post(f"/api/tasks/{archived['id']}/archive")

    board = _board(_week(client))
    _week(client)  # a second load changes nothing

    assert board["2026-11-16"] == ["Done Monday"]
    assert board["2026-11-18"] == ["Already today", "Last week", "Monday"]
    session.expire_all()
    moved = {task.title: task for task in session.query(Task)}
    assert moved["Last week"].rollover_count == 1  # once, however many days it missed
    assert str(moved["Last week"].due_date) == "2026-11-11"  # due date unchanged
    assert str(moved["Archived Monday"].scheduled_date) == "2026-11-16"


def test_recurring_occurrences_dont_roll_over(client: TestClient, session: Session) -> None:
    template = TaskTemplate(title="Review", rrule="FREQ=WEEKLY", starts_on=date(2026, 11, 16))
    session.add(template)
    session.commit()
    session.add(
        Task(
            title="Review",
            template_id=template.id,
            occurrence_date=date(2026, 11, 16),
            scheduled_date=date(2026, 11, 16),
        )
    )
    session.commit()

    assert _board(_week(client))["2026-11-16"] == ["Review"]


# ---------- Reordering ----------


def _ids(client: TestClient, day: str | None) -> list[int]:
    """The task ids in board order for one day, or for the unscheduled list."""
    week = _week(client)
    tasks = (
        week["unscheduled"]
        if day is None
        else next(d["tasks"] for d in week["days"] if d["day"] == day)
    )
    return [task["id"] for task in tasks]


def test_reorder_sets_a_days_order(client: TestClient) -> None:
    a, b, c = (_task(client, title, scheduled_date="2026-11-19")["id"] for title in "ABC")

    response = client.post(
        "/api/tasks/reorder", json={"scheduled_date": "2026-11-19", "task_ids": [c, a, b]}
    )

    assert response.status_code == 200
    assert _ids(client, "2026-11-19") == [c, a, b]


def test_reorder_keeps_unlisted_tasks_after_the_listed_ones(client: TestClient) -> None:
    a, b, c = (_task(client, title)["id"] for title in "ABC")

    client.post("/api/tasks/reorder", json={"scheduled_date": None, "task_ids": [c]})

    assert _ids(client, None) == [c, a, b]


@pytest.mark.parametrize(
    ("make_body", "status_code"),
    [
        (lambda ids: {"scheduled_date": "2026-11-19", "task_ids": [ids["a"], ids["a"]]}, 422),
        (lambda ids: {"scheduled_date": "2026-11-19", "task_ids": [ids["a"], ids["friday"]]}, 422),
        (lambda ids: {"scheduled_date": "2026-11-19", "task_ids": [999]}, 404),
        (lambda ids: {"scheduled_date": "2026-11-19", "task_ids": []}, 422),
    ],
)
def test_reorder_is_validated(client: TestClient, make_body: Any, status_code: int) -> None:
    ids = {
        "a": _task(client, "A", scheduled_date="2026-11-19")["id"],
        "friday": _task(client, "Friday", scheduled_date="2026-11-20")["id"],
    }

    response = client.post("/api/tasks/reorder", json=make_body(ids))

    assert response.status_code == status_code


# ---------- Routine steps ----------


def test_each_day_lists_its_due_routine_steps(client: TestClient, session: Session) -> None:
    health = make_life_area(session, "Health")
    career = make_life_area(session, "Career")
    routine = client.post(
        "/api/routines",
        json={"title": "Morning", "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR", "starts_on": "2026-11-01"},
    ).json()
    stretch = client.post(
        f"/api/routines/{routine['id']}/steps",
        json={"title": "Stretch", "life_area_id": health.id, "starts_on": "2026-11-01"},
    ).json()
    client.post(
        f"/api/routines/{routine['id']}/steps",
        json={"title": "Plan day", "life_area_id": career.id, "starts_on": "2026-11-01"},
    )
    client.put(f"/api/routine-steps/{stretch['id']}/days/2026-11-18", json={"status": "done"})

    week = _week(client)
    steps = {
        day["day"]: {step["title"]: step["status"] for step in day["routine_steps"]}
        for day in week["days"]
    }

    assert steps["2026-11-16"] == {"Stretch": "missed", "Plan day": "missed"}
    assert steps["2026-11-17"] == {}
    assert steps["2026-11-18"] == {"Stretch": "done", "Plan day": "todo"}
    assert steps["2026-11-20"] == {"Stretch": "todo", "Plan day": "todo"}
    health_only = _week(client, life_area_id=health.id)
    assert [s["title"] for s in health_only["days"][2]["routine_steps"]] == ["Stretch"]
