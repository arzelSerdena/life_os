"""Routines: schedules, steps, checking off, pausing and streaks."""

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import clock
from app.models import RoutineLog, RoutinePause
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 18)  # a Wednesday


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def area(session: Session) -> int:
    return make_life_area(session).id


def _set_today(monkeypatch: pytest.MonkeyPatch, day: str) -> None:
    monkeypatch.setattr(clock, "today", lambda: date.fromisoformat(day))


def _routine(client: TestClient, title: str = "Morning", **fields: Any) -> dict[str, Any]:
    response = client.post("/api/routines", json={"title": title, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def _step(
    client: TestClient, routine: dict[str, Any], area: int, title: str = "Stretch", **fields: Any
) -> dict[str, Any]:
    body = {"title": title, "life_area_id": area, **fields}
    response = client.post(f"/api/routines/{routine['id']}/steps", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _day(client: TestClient, day: str = "2026-11-18", **params: Any) -> dict[str, str]:
    response = client.get("/api/routines/day", params={"day": day, **params})
    assert response.status_code == 200, response.text
    return {item["title"]: item["status"] for item in response.json()}


def _check(client: TestClient, step: dict[str, Any], day: str, status: str = "done") -> Any:
    return client.put(f"/api/routine-steps/{step['id']}/days/{day}", json={"status": status})


def _get_step(client: TestClient, routine: dict[str, Any], step: dict[str, Any]) -> dict[str, Any]:
    body = client.get(f"/api/routines/{routine['id']}").json()
    return next(item for item in body["steps"] if item["id"] == step["id"])


# ---------- Routines and schedules ----------


def test_a_routine_is_daily_from_today_by_default(client: TestClient) -> None:
    first = _routine(client, "Morning")
    second = _routine(client, "Evening")

    assert first["schedules"] == [{"rrule": "FREQ=DAILY", "starts_on": "2026-11-18"}]
    assert (first["sort_order"], second["sort_order"]) == (0, 1)
    assert first["is_paused"] is False


def test_invalid_rules_are_rejected(client: TestClient) -> None:
    response = client.post("/api/routines", json={"title": "X", "rrule": "FREQ=DAILY;COUNT=3"})

    assert response.status_code == 422


def test_steps_are_due_on_the_schedules_days(client: TestClient, area: int) -> None:
    routine = _routine(client, rrule="FREQ=WEEKLY;BYDAY=MO,WE", starts_on="2026-11-01")
    _step(client, routine, area, starts_on="2026-11-01")

    assert _day(client, "2026-11-18") == {"Stretch": "todo"}  # Wednesday
    assert _day(client, "2026-11-17") == {}  # Tuesday
    assert _day(client, "2026-11-16") == {"Stretch": "missed"}  # a past Monday, unchecked


def test_a_step_is_not_due_before_it_starts(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-11-01")
    _step(client, routine, area)  # starts today

    assert _day(client, "2026-11-17") == {}
    assert _day(client, "2026-11-18") == {"Stretch": "todo"}


def test_changing_the_schedule_from_a_date_keeps_the_past(
    client: TestClient, area: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    _step(client, routine, area, starts_on="2026-11-16")

    changed = client.post(
        f"/api/routines/{routine['id']}/schedule",
        json={"scope": "following", "rrule": "FREQ=WEEKLY;BYDAY=MO", "starts_on": "2026-11-20"},
    ).json()

    assert [row["starts_on"] for row in changed["schedules"]] == ["2026-11-16", "2026-11-20"]
    assert _day(client, "2026-11-19") == {"Stretch": "todo"}  # still daily before the change
    assert _day(client, "2026-11-20") == {}  # Friday, not a Monday
    assert _day(client, "2026-11-23") == {"Stretch": "todo"}


def test_changing_the_schedule_again_on_the_same_date_replaces_it(client: TestClient) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    url = f"/api/routines/{routine['id']}/schedule"
    body = {"scope": "following", "starts_on": "2026-11-20"}

    client.post(url, json={**body, "rrule": "FREQ=WEEKLY;BYDAY=MO"})
    response = client.post(url, json={**body, "rrule": "FREQ=WEEKLY;BYDAY=TU"})

    assert response.status_code == 200
    assert [row["rrule"] for row in response.json()["schedules"]] == [
        "FREQ=DAILY",
        "FREQ=WEEKLY;BYDAY=TU",
    ]


def test_changing_the_whole_schedule_rewrites_the_past(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    _step(client, routine, area, starts_on="2026-11-16")

    body = client.post(
        f"/api/routines/{routine['id']}/schedule",
        json={"scope": "all", "rrule": "FREQ=WEEKLY;BYDAY=MO"},
    ).json()

    assert body["schedules"] == [{"rrule": "FREQ=WEEKLY;BYDAY=MO", "starts_on": "2026-11-16"}]
    assert _day(client, "2026-11-17") == {}


# ---------- Checking off ----------


def test_checking_a_step_done_skipped_and_back(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    step = _step(client, routine, area, starts_on="2026-11-16")

    assert _check(client, step, "2026-11-18").json()["status"] == "done"
    assert _check(client, step, "2026-11-17", "skipped").json()["status"] == "skipped"
    assert _day(client) == {"Stretch": "done"}

    cleared = client.delete(f"/api/routine-steps/{step['id']}/days/2026-11-17").json()

    assert cleared["status"] == "missed"  # a past day with nothing checked
    assert client.delete(f"/api/routine-steps/{step['id']}/days/2026-11-17").status_code == 404


@pytest.mark.parametrize(
    ("day", "status", "code"),
    [("2026-11-19", "done", 422), ("2026-11-15", "done", 422), ("2026-11-19", "skipped", 200)],
)
def test_checking_is_validated(
    client: TestClient, area: int, day: str, status: str, code: int
) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    step = _step(client, routine, area, starts_on="2026-11-16")

    # Future days can be skipped but not done; days before the step started aren't due
    assert _check(client, step, day, status).status_code == code


def test_skipping_a_day_skips_every_unchecked_step(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    stretch = _step(client, routine, area, "Stretch", starts_on="2026-11-16")
    _step(client, routine, area, "Meditate", starts_on="2026-11-16")
    _check(client, stretch, "2026-11-18")

    response = client.post(f"/api/routines/{routine['id']}/days/2026-11-18/skip")

    assert {item["title"]: item["status"] for item in response.json()} == {
        "Stretch": "done",
        "Meditate": "skipped",
    }


def test_day_view_filters_and_hides_archived(
    client: TestClient, session: Session, area: int
) -> None:
    project = make_project(session, make_life_area(session, "Career"))
    routine = _routine(client, starts_on="2026-11-16")
    _step(client, routine, area, "Stretch", starts_on="2026-11-16")
    in_project = {"title": "Plan day", "project_id": project.id, "starts_on": "2026-11-16"}
    assert client.post(f"/api/routines/{routine['id']}/steps", json=in_project).status_code == 201
    archived = _step(client, routine, area, "Old", starts_on="2026-11-16")
    client.post(f"/api/routine-steps/{archived['id']}/archive")

    assert _day(client, life_area_id=area) == {"Stretch": "todo"}
    assert _day(client, project_id=project.id) == {"Plan day": "todo"}

    client.post(f"/api/routines/{routine['id']}/archive")
    assert _day(client) == {}


# ---------- Pausing ----------


def test_paused_days_are_never_missed(
    client: TestClient, area: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    step = _step(client, routine, area, starts_on="2026-11-16")
    _check(client, step, "2026-11-16")
    _check(client, step, "2026-11-17")

    paused = client.post(f"/api/routines/{routine['id']}/pause").json()
    assert paused["is_paused"] is True
    assert _day(client) == {}  # paused from today

    _set_today(monkeypatch, "2026-11-21")
    resumed = client.post(f"/api/routines/{routine['id']}/resume").json()

    assert resumed["is_paused"] is False
    assert _day(client, "2026-11-19") == {}  # paused, so not missed
    assert _day(client, "2026-11-21") == {"Stretch": "todo"}
    assert _get_step(client, routine, step)["current_streak"] == 2  # the pause didn't break it


def test_resuming_a_routine_resumes_its_steps(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    step = _step(client, routine, area, starts_on="2026-11-16")
    client.post(f"/api/routine-steps/{step['id']}/pause")
    client.post(f"/api/routines/{routine['id']}/pause")

    client.post(f"/api/routines/{routine['id']}/resume")

    assert _get_step(client, routine, step)["is_paused"] is False


def test_a_resumed_step_waits_for_its_paused_routine(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-11-16")
    step = _step(client, routine, area, starts_on="2026-11-16")
    client.post(f"/api/routine-steps/{step['id']}/pause")
    client.post(f"/api/routines/{routine['id']}/pause")

    client.post(f"/api/routine-steps/{step['id']}/resume")

    assert _day(client) == {}


# ---------- Streaks ----------


def test_streaks_count_done_days_and_reset_on_a_miss(client: TestClient, area: int) -> None:
    routine = _routine(client, starts_on="2026-11-10")
    step = _step(client, routine, area, starts_on="2026-11-10")
    for day in ("2026-11-10", "2026-11-11", "2026-11-12"):  # 3 in a row
        _check(client, step, day)
    # 13th missed, which resets the run
    _check(client, step, "2026-11-14")
    _check(client, step, "2026-11-15", "skipped")  # neither counts nor breaks
    _check(client, step, "2026-11-16")
    _check(client, step, "2026-11-17")
    # Today (18th) still to do, which doesn't break it

    found = _get_step(client, routine, step)

    assert (found["current_streak"], found["best_streak"]) == (3, 3)


# ---------- Steps ----------


def test_a_step_needs_an_owner_and_inherits_a_projects_area(
    client: TestClient, session: Session
) -> None:
    project = make_project(session, make_life_area(session))
    routine = _routine(client)

    missing = client.post(f"/api/routines/{routine['id']}/steps", json={"title": "Run"})
    in_project = client.post(
        f"/api/routines/{routine['id']}/steps", json={"title": "Run", "project_id": project.id}
    )

    assert missing.status_code == 422
    assert in_project.json()["life_area_id"] == project.life_area_id


def test_archiving_a_routine_can_be_undone(client: TestClient, area: int) -> None:
    routine = _routine(client)
    _step(client, routine, area)

    change = client.post(f"/api/routines/{routine['id']}/archive").json()
    assert client.get("/api/routines").json() == []
    client.post(f"/api/undo/{change['batch_id']}")

    assert [item["id"] for item in client.get("/api/routines").json()] == [routine["id"]]


def test_an_archived_routine_cant_get_new_steps(client: TestClient, area: int) -> None:
    routine = _routine(client)
    client.post(f"/api/routines/{routine['id']}/archive")

    response = client.post(
        f"/api/routines/{routine['id']}/steps", json={"title": "Run", "life_area_id": area}
    )

    assert response.status_code == 409


def test_deleting_a_routine_deletes_its_steps(client: TestClient, area: int) -> None:
    routine = _routine(client)
    step = _step(client, routine, area)

    assert client.delete(f"/api/routines/{routine['id']}").status_code == 204
    assert client.patch(f"/api/routine-steps/{step['id']}", json={}).status_code == 404


# ---------- Database rules ----------


def test_one_open_pause_per_routine(client: TestClient, session: Session) -> None:
    routine = _routine(client)
    session.add_all(
        [
            RoutinePause(routine_id=routine["id"], starts_on=TODAY),
            RoutinePause(routine_id=routine["id"], starts_on=TODAY),
        ]
    )

    with pytest.raises(IntegrityError):
        session.commit()


def test_a_closed_pause_doesnt_block_a_new_one(client: TestClient, session: Session) -> None:
    routine = _routine(client)
    session.add_all(
        [
            RoutinePause(routine_id=routine["id"], starts_on=TODAY, ends_on=TODAY),
            RoutinePause(routine_id=routine["id"], starts_on=TODAY),
        ]
    )
    session.commit()


def test_one_log_per_step_per_day(client: TestClient, session: Session, area: int) -> None:
    step = _step(client, _routine(client), area)
    session.add_all(
        [
            RoutineLog(routine_step_id=step["id"], date=TODAY, status="done"),
            RoutineLog(routine_step_id=step["id"], date=TODAY, status="skipped"),
        ]
    )

    with pytest.raises(IntegrityError):
        session.commit()
