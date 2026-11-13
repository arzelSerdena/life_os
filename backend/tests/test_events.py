from datetime import date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import Event
from app.models.base import utc_now
from tests.factories import make_life_area, make_project

URL = "/api/events"
TODAY = date(2026, 11, 16)  # a Monday


@pytest.fixture(autouse=True)
def pinned_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)
    monkeypatch.setattr(clock, "now", lambda: datetime(2026, 11, 16, 12, 0))


@pytest.fixture
def area(session: Session) -> int:
    return make_life_area(session).id


def _create(client: TestClient, area: int, title: str = "Gym", **fields: Any) -> dict[str, Any]:
    body = {"title": title, "start_date": "2026-11-16", "life_area_id": area, **fields}
    response = client.post(URL, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _weekly(client: TestClient, area: int, **fields: Any) -> dict[str, Any]:
    return _create(client, area, rrule="FREQ=WEEKLY", start_time="18:00", **fields)


def _occurrences(
    client: TestClient, first: str = "2026-11-16", last: str = "2026-12-13", **params: Any
) -> list[dict[str, Any]]:
    response = client.get(f"{URL}/occurrences", params={"first": first, "last": last, **params})
    assert response.status_code == 200, response.text
    return response.json()


def _days(client: TestClient, **params: Any) -> list[str]:
    return [occurrence["start_date"] for occurrence in _occurrences(client, **params)]


def _post(client: TestClient, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    response = client.post(f"{URL}{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


# ---------- Creating ----------


def test_a_projects_event_inherits_its_life_area(client: TestClient, session: Session) -> None:
    project = make_project(session, make_life_area(session))

    response = client.post(
        URL, json={"title": "Race", "start_date": "2026-12-06", "project_id": project.id}
    )

    assert response.json()["life_area_id"] == project.life_area_id


def test_an_event_needs_an_owner(client: TestClient) -> None:
    response = client.post(URL, json={"title": "Race", "start_date": "2026-12-06"})

    assert response.status_code == 422


def test_no_events_under_an_archived_life_area(client: TestClient, session: Session) -> None:
    archived = make_life_area(session, archived_at=utc_now())

    response = client.post(
        URL, json={"title": "Race", "start_date": "2026-12-06", "life_area_id": archived.id}
    )

    assert response.status_code == 409


@pytest.mark.parametrize(
    "fields",
    [
        {"end_date": "2026-11-15"},
        {"end_time": "10:00"},
        {"start_time": "10:00", "end_time": "09:00"},
        {"repeat_ends_on": "2026-12-01"},
        {"rrule": "FREQ=WEEKLY", "repeat_ends_on": "2026-11-01"},
        {"rrule": "FREQ=WEEKLY;COUNT=3"},
        {"location": "x" * 301},
    ],
)
def test_create_rejects_invalid_timing(
    client: TestClient, area: int, fields: dict[str, Any]
) -> None:
    body = {"title": "Gym", "start_date": "2026-11-16", "life_area_id": area, **fields}

    assert client.post(URL, json=body).status_code == 422


def test_an_overnight_event_may_end_at_an_earlier_time(client: TestClient, area: int) -> None:
    body = _create(client, area, end_date="2026-11-17", start_time="22:00", end_time="06:00")

    assert body["end_time"] == "06:00:00"


# ---------- Occurrences ----------


def test_a_weekly_series_expands_within_the_range(client: TestClient, area: int) -> None:
    _weekly(client, area, repeat_ends_on="2026-12-01")

    assert _days(client) == ["2026-11-16", "2026-11-23", "2026-11-30"]


def test_a_multi_day_occurrence_overlapping_the_start_is_included(
    client: TestClient, area: int
) -> None:
    _create(client, area, "Trip", start_date="2026-11-13", end_date="2026-11-17")

    (trip,) = _occurrences(client)

    assert (trip["start_date"], trip["end_date"]) == ("2026-11-13", "2026-11-17")


@pytest.mark.parametrize(
    ("first", "last"), [("2026-11-20", "2026-11-16"), ("2026-01-01", "2027-01-02")]
)
def test_occurrences_reject_bad_ranges(client: TestClient, first: str, last: str) -> None:
    response = client.get(f"{URL}/occurrences", params={"first": first, "last": last})

    assert response.status_code == 422


def test_past_and_upcoming_are_calculated(client: TestClient, area: int) -> None:
    _create(client, area, "Yesterday", start_date="2026-11-15")
    _create(client, area, "This morning", start_time="08:00", end_time="09:00")
    _create(client, area, "Tonight", start_time="19:00")
    _create(client, area, "All day today")

    past = {o["title"]: o["is_past"] for o in _occurrences(client, first="2026-11-15")}

    assert past == {
        "Yesterday": True,
        "This morning": True,
        "Tonight": False,
        "All day today": False,
    }


# ---------- This occurrence ----------


def test_changing_one_occurrence_leaves_the_others(client: TestClient, area: int) -> None:
    event = _weekly(client, area)

    _post(client, f"/{event['id']}/occurrences/2026-11-23/edit", {"scope": "this", "title": "Legs"})

    titles = [(o["title"], o["is_changed"]) for o in _occurrences(client, last="2026-11-30")]
    assert titles == [("Gym", False), ("Legs", True), ("Gym", False)]


def test_moving_one_occurrence_to_another_week(client: TestClient, area: int) -> None:
    event = _weekly(client, area)

    _post(
        client,
        f"/{event['id']}/occurrences/2026-11-23/edit",
        {"scope": "this", "start_date": "2026-12-10"},
    )

    assert _days(client, first="2026-11-16", last="2026-11-29") == ["2026-11-16"]
    moved = _occurrences(client, first="2026-12-10", last="2026-12-10")
    assert [(o["start_date"], o["occurrence_date"]) for o in moved] == [
        ("2026-12-10", "2026-11-23")
    ]


def test_cancelling_and_restoring_one_occurrence(client: TestClient, area: int) -> None:
    event = _weekly(client, area)

    cancel = _post(client, f"/{event['id']}/occurrences/2026-11-23/cancel", {"scope": "this"})

    assert cancel["batch_id"] is None  # restored by removing the change, not by undo
    assert _days(client, last="2026-11-30") == ["2026-11-16", "2026-11-30"]
    shown = _occurrences(client, last="2026-11-30", include_cancelled=True)
    assert [o["is_cancelled"] for o in shown] == [False, True, False]

    assert client.delete(f"{URL}/{event['id']}/occurrences/2026-11-23").status_code == 200
    assert _days(client, last="2026-11-30") == ["2026-11-16", "2026-11-23", "2026-11-30"]


@pytest.mark.parametrize(
    ("body", "status_code"),
    [
        ({"scope": "this", "rrule": "FREQ=DAILY"}, 422),
        ({"scope": "following", "start_date": "2026-11-24"}, 422),
        ({"scope": "this", "start_time": "19:00", "end_time": "18:30"}, 422),
    ],
)
def test_occurrence_edits_are_validated(
    client: TestClient, area: int, body: dict[str, Any], status_code: int
) -> None:
    event = _weekly(client, area)

    response = client.post(f"{URL}/{event['id']}/occurrences/2026-11-23/edit", json=body)

    assert response.status_code == status_code


def test_occurrence_actions_need_a_real_occurrence(client: TestClient, area: int) -> None:
    one_off = _create(client, area)
    series = _weekly(client, area)

    not_repeating = client.post(
        f"{URL}/{one_off['id']}/occurrences/2026-11-16/cancel", json={"scope": "this"}
    )
    wrong_day = client.post(
        f"{URL}/{series['id']}/occurrences/2026-11-17/cancel", json={"scope": "this"}
    )

    assert (not_repeating.status_code, wrong_day.status_code) == (422, 404)


# ---------- This and following / All ----------


def test_editing_following_splits_the_series(
    client: TestClient, area: int, session: Session
) -> None:
    event = _weekly(client, area)
    _post(client, f"/{event['id']}/occurrences/2026-12-07/edit", {"scope": "this", "title": "Legs"})

    new = _post(
        client,
        f"/{event['id']}/occurrences/2026-11-30/edit",
        {"scope": "following", "start_time": "07:00"},
    )

    assert (new["start_date"], new["start_time"]) == ("2026-11-30", "07:00:00")
    original = session.get(Event, event["id"])
    assert original is not None and str(original.repeat_ends_on) == "2026-11-29"
    times = [(o["start_date"], o["start_time"], o["title"]) for o in _occurrences(client)]
    assert times == [
        ("2026-11-16", "18:00:00", "Gym"),
        ("2026-11-23", "18:00:00", "Gym"),
        ("2026-11-30", "07:00:00", "Gym"),
        ("2026-12-07", "07:00:00", "Gym"),  # timing changed, so the one-off title went
    ]


def test_editing_following_from_the_first_occurrence_is_edit_all(
    client: TestClient, area: int
) -> None:
    event = _weekly(client, area)

    body = _post(
        client,
        f"/{event['id']}/occurrences/2026-11-16/edit",
        {"scope": "following", "title": "Run"},
    )

    assert body["id"] == event["id"]


def test_editing_all_keeps_one_off_changes_unless_the_timing_changes(
    client: TestClient, area: int
) -> None:
    event = _weekly(client, area)
    _post(client, f"/{event['id']}/occurrences/2026-11-23/edit", {"scope": "this", "title": "Legs"})
    _post(client, f"/{event['id']}/occurrences/2026-11-30/cancel", {"scope": "this"})

    _post(
        client, f"/{event['id']}/occurrences/2026-11-16/edit", {"scope": "all", "location": "Gym A"}
    )
    kept = [o["title"] for o in _occurrences(client, last="2026-11-30")]

    _post(
        client,
        f"/{event['id']}/occurrences/2026-11-16/edit",
        {"scope": "all", "start_time": "07:00"},
    )
    after = [(o["title"], o["location"]) for o in _occurrences(client, last="2026-11-30")]

    assert kept == ["Gym", "Legs"]
    assert after == [("Gym", "Gym A"), ("Gym", "Gym A")]  # the 30th stays cancelled


def test_cancelling_following_ends_the_series_and_can_be_undone(
    client: TestClient, area: int
) -> None:
    event = _weekly(client, area)

    change = _post(client, f"/{event['id']}/occurrences/2026-11-30/cancel", {"scope": "following"})

    assert change["event"]["repeat_ends_on"] == "2026-11-29"
    assert _days(client) == ["2026-11-16", "2026-11-23"]
    client.post(f"/api/undo/{change['batch_id']}")
    assert len(_days(client)) == 4


def test_cancelling_all_cancels_the_series_and_can_be_undone(client: TestClient, area: int) -> None:
    event = _weekly(client, area)

    change = _post(client, f"/{event['id']}/occurrences/2026-11-23/cancel", {"scope": "all"})

    assert change["event"]["cancelled_at"] is not None
    assert _days(client) == []
    edit = client.post(f"{URL}/{event['id']}/occurrences/2026-11-23/edit", json={"scope": "all"})
    assert edit.status_code == 409
    client.post(f"/api/undo/{change['batch_id']}")
    assert len(_days(client)) == 4


def test_removing_the_rule_makes_a_one_off_event(client: TestClient, area: int) -> None:
    event = _weekly(client, area, repeat_ends_on="2026-12-31")
    _post(client, f"/{event['id']}/occurrences/2026-11-23/cancel", {"scope": "this"})

    body = client.patch(f"{URL}/{event['id']}", json={"rrule": None}).json()

    assert (body["rrule"], body["repeat_ends_on"]) == (None, None)
    assert _days(client) == ["2026-11-16"]


# ---------- One-off events ----------


def test_cancelling_a_one_off_event_and_bringing_it_back(client: TestClient, area: int) -> None:
    event = _create(client, area)

    change = _post(client, f"/{event['id']}/cancel")

    assert client.post(f"{URL}/{event['id']}/cancel").status_code == 409
    assert _days(client) == []
    _post(client, f"/{event['id']}/uncancel")
    assert _days(client) == ["2026-11-16"]
    assert change["batch_id"]


def test_archived_events_are_hidden(client: TestClient, area: int) -> None:
    event = _create(client, area)

    _post(client, f"/{event['id']}/archive")

    assert _days(client) == []
    assert client.get(URL).json() == []
    assert len(client.get(URL, params={"include_archived": True}).json()) == 1


def test_moving_an_event_into_a_project(client: TestClient, session: Session, area: int) -> None:
    other = make_life_area(session, "Career")
    project = make_project(session, other)
    event = _create(client, area)

    moved = _post(client, f"/{event['id']}/move", {"project_id": project.id})

    assert (moved["event"]["life_area_id"], moved["event"]["project_id"]) == (other.id, project.id)
    assert client.post(f"{URL}/{event['id']}/move", json={}).status_code == 422


def test_moving_a_project_moves_its_events(client: TestClient, session: Session) -> None:
    health, career = make_life_area(session, "Health"), make_life_area(session, "Career")
    project = make_project(session, health)
    event = client.post(
        URL, json={"title": "Race", "start_date": "2026-12-06", "project_id": project.id}
    ).json()

    project.life_area_id = career.id
    session.commit()

    assert client.get(f"{URL}/{event['id']}").json()["life_area_id"] == career.id


def test_deleting_an_event_removes_its_changes(client: TestClient, area: int) -> None:
    event = _weekly(client, area)
    _post(client, f"/{event['id']}/occurrences/2026-11-23/cancel", {"scope": "this"})

    assert client.delete(f"{URL}/{event['id']}").status_code == 204
    assert client.get(f"{URL}/{event['id']}").status_code == 404


def test_one_off_changes_after_a_split_move_to_the_new_series(
    client: TestClient, area: int
) -> None:
    event = _weekly(client, area)
    _post(client, f"/{event['id']}/occurrences/2026-12-07/edit", {"scope": "this", "title": "Legs"})
    _post(client, f"/{event['id']}/occurrences/2026-12-14/cancel", {"scope": "this"})

    new = _post(
        client,
        f"/{event['id']}/occurrences/2026-11-30/edit",
        {"scope": "following", "location": "Gym B"},
    )

    shown = _occurrences(client, last="2026-12-14", include_cancelled=True)
    later = [(o["event_id"], o["start_date"], o["title"], o["is_cancelled"]) for o in shown[2:]]
    assert later == [
        (new["id"], "2026-11-30", "Gym", False),
        (new["id"], "2026-12-07", "Legs", False),
        (new["id"], "2026-12-14", "Gym", True),
    ]
