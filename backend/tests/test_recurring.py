"""Recurring tasks: generating occurrences, repeating from completion, and series edits."""

from datetime import date, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.errors import UnprocessableError
from app.models import Task, TaskTemplate
from app.models.base import utc_now
from app.services import templates
from tests.factories import make_life_area

TODAY = date(2026, 11, 16)  # a Monday
WEEK_END = TODAY + timedelta(days=6)


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


def _template(client: TestClient, **fields: Any) -> dict[str, Any]:
    body = {"title": "Run", "rrule": "FREQ=DAILY", "starts_on": TODAY.isoformat(), **fields}
    response = client.post("/api/task-templates", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _occurrences(session: Session, template_id: int) -> list[Task]:
    session.expire_all()
    return list(
        session.scalars(
            select(Task).where(Task.template_id == template_id).order_by(Task.occurrence_date)
        )
    )


def _dates(session: Session, template_id: int) -> list[str]:
    return [str(task.occurrence_date) for task in _occurrences(session, template_id)]


def _generate(session: Session, first: date = TODAY, last: date = WEEK_END) -> int:
    return templates.generate_occurrences(session, first, last)


# ---------- Generating from the schedule ----------


def test_generates_the_weeks_occurrences_as_copies(client: TestClient, session: Session) -> None:
    life_area = make_life_area(session)
    template = _template(
        client,
        rrule="FREQ=WEEKLY;BYDAY=MO,TH",
        priority="high",
        notes="Easy pace",
        life_area_id=life_area.id,
        subtasks=["Stretch"],
        due_offset_days=1,
        due_time="20:00",
    )

    created = _generate(session)

    assert created == 2
    monday, thursday = _occurrences(session, template["id"])
    assert (monday.occurrence_date, thursday.occurrence_date) == (TODAY, date(2026, 11, 19))
    assert monday.scheduled_date == monday.occurrence_date
    assert (monday.title, monday.priority, monday.notes) == ("Run", "high", "Easy pace")
    assert monday.life_area_id == life_area.id
    assert [subtask.title for subtask in monday.subtasks] == ["Stretch"]
    assert (str(monday.due_date), str(monday.due_time)) == ("2026-11-17", "20:00:00")


def test_generation_starts_today_and_never_repeats_itself(
    client: TestClient, session: Session
) -> None:
    template = _template(client, starts_on="2026-11-01")

    first = _generate(session, date(2026, 11, 9), date(2026, 11, 18))
    again = _generate(session, date(2026, 11, 9), date(2026, 11, 18))

    assert (first, again) == (3, 0)
    assert _dates(session, template["id"]) == ["2026-11-16", "2026-11-17", "2026-11-18"]


def test_moved_and_cancelled_occurrences_are_never_recreated(
    client: TestClient, session: Session
) -> None:
    template = _template(client)
    _generate(session, TODAY, TODAY + timedelta(days=1))
    monday, tuesday = _occurrences(session, template["id"])
    client.patch(f"/api/tasks/{monday.id}", json={"scheduled_date": "2026-11-20"})
    client.post(f"/api/tasks/{tuesday.id}/cancel")

    assert _generate(session, TODAY, TODAY + timedelta(days=1)) == 0


@pytest.mark.parametrize(
    "setup",
    [
        lambda client, t: client.post(f"/api/task-templates/{t['id']}/pause"),
        lambda client, t: client.post(f"/api/task-templates/{t['id']}/archive"),
    ],
)
def test_paused_and_archived_templates_generate_nothing(
    client: TestClient, session: Session, setup: Any
) -> None:
    template = _template(client)
    setup(client, template)

    assert _generate(session) == 0


def test_generation_respects_the_series_end(client: TestClient, session: Session) -> None:
    template = _template(client, ends_on="2026-11-17")

    _generate(session)

    assert _dates(session, template["id"]) == ["2026-11-16", "2026-11-17"]


def test_nothing_is_generated_under_an_archived_life_area(
    client: TestClient, session: Session
) -> None:
    life_area = make_life_area(session)
    _template(client, life_area_id=life_area.id)
    life_area.archived_at = utc_now()
    session.commit()

    assert _generate(session) == 0


def test_plain_templates_generate_nothing(client: TestClient, session: Session) -> None:
    client.post("/api/task-templates", json={"title": "Pack"})

    assert _generate(session) == 0


def test_generation_rejects_a_backwards_range(session: Session) -> None:
    with pytest.raises(UnprocessableError):
        _generate(session, WEEK_END, TODAY)


# ---------- Repeating from completion ----------


def test_repeat_from_completion_starts_with_one_open_occurrence(
    client: TestClient, session: Session
) -> None:
    template = _template(
        client, rrule="FREQ=WEEKLY;INTERVAL=6", repeat_from="completion", subtasks=["Book"]
    )

    assert _dates(session, template["id"]) == ["2026-11-16"]
    (first,) = _occurrences(session, template["id"])
    assert [subtask.title for subtask in first.subtasks] == ["Book"]
    assert _generate(session) == 0  # week generation skips these


@pytest.mark.parametrize("action", ["complete", "cancel"])
def test_finishing_creates_the_next_occurrence_from_today(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch, action: str
) -> None:
    template = _template(
        client, rrule="FREQ=WEEKLY;INTERVAL=6", repeat_from="completion", starts_on="2026-11-10"
    )
    (first,) = _occurrences(session, template["id"])

    later = date(2026, 11, 20)
    monkeypatch.setattr(clock, "today", lambda: later)
    client.post(f"/api/tasks/{first.id}/{action}")

    assert _dates(session, template["id"]) == ["2026-11-16", "2027-01-01"]


def test_undo_removes_the_next_occurrence_again(client: TestClient, session: Session) -> None:
    template = _template(client, rrule="FREQ=WEEKLY", repeat_from="completion")
    (first,) = _occurrences(session, template["id"])
    change = client.post(f"/api/tasks/{first.id}/complete").json()

    response = client.post(f"/api/undo/{change['batch_id']}")

    assert response.status_code == 200
    (only,) = _occurrences(session, template["id"])
    assert (only.id, only.status) == (first.id, "todo")


def test_undo_keeps_a_next_occurrence_that_was_changed(
    client: TestClient, session: Session
) -> None:
    template = _template(client, rrule="FREQ=WEEKLY", repeat_from="completion")
    (first,) = _occurrences(session, template["id"])
    change = client.post(f"/api/tasks/{first.id}/complete").json()
    _, following = _occurrences(session, template["id"])
    client.patch(f"/api/tasks/{following.id}", json={"title": "Run far"})

    assert client.post(f"/api/undo/{change['batch_id']}").status_code == 409
    assert len(_occurrences(session, template["id"])) == 2


def test_completion_series_stops_at_its_end(client: TestClient, session: Session) -> None:
    template = _template(
        client, rrule="FREQ=WEEKLY", repeat_from="completion", ends_on="2026-11-20"
    )
    (first,) = _occurrences(session, template["id"])

    client.post(f"/api/tasks/{first.id}/complete")

    assert _dates(session, template["id"]) == ["2026-11-16"]


# ---------- This and following / All ----------


def _week(client: TestClient, session: Session, **fields: Any) -> tuple[dict[str, Any], list[Task]]:
    template = _template(client, **fields)
    _generate(session)
    return template, _occurrences(session, template["id"])


def test_edit_all_updates_unfinished_occurrences_only(client: TestClient, session: Session) -> None:
    template, days = _week(client, session)
    client.post(f"/api/tasks/{days[0].id}/complete")

    response = client.post(
        f"/api/tasks/{days[3].id}/series-edit",
        json={"scope": "all", "title": "Long run", "priority": "high"},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Long run"
    titles = [(task.title, task.priority) for task in _occurrences(session, template["id"])]
    assert titles[0] == ("Run", "none")  # done, so unchanged
    assert set(titles[1:]) == {("Long run", "high")}


def test_edit_following_splits_the_series(client: TestClient, session: Session) -> None:
    template, days = _week(client, session)
    client.post(f"/api/tasks/{days[5].id}/complete")  # Saturday, done

    new = client.post(
        f"/api/tasks/{days[3].id}/series-edit", json={"scope": "following", "title": "Long run"}
    ).json()

    assert new["id"] != template["id"]
    assert (new["starts_on"], new["ends_on"]) == ("2026-11-19", None)
    original = session.get(TaskTemplate, template["id"])
    assert original is not None and str(original.ends_on) == "2026-11-18"
    assert _dates(session, template["id"]) == ["2026-11-16", "2026-11-17", "2026-11-18"]
    moved = _occurrences(session, new["id"])
    assert [str(task.occurrence_date) for task in moved] == [
        "2026-11-19",
        "2026-11-20",
        "2026-11-21",
        "2026-11-22",
    ]
    assert [task.title for task in moved] == ["Long run", "Long run", "Run", "Long run"]
    assert {task.title for task in _occurrences(session, template["id"])} == {"Run"}
    assert _generate(session) == 0  # nothing created twice


def test_edit_following_from_the_first_occurrence_is_edit_all(
    client: TestClient, session: Session
) -> None:
    template, days = _week(client, session)

    body = client.post(
        f"/api/tasks/{days[0].id}/series-edit", json={"scope": "following", "title": "Jog"}
    ).json()

    assert body["id"] == template["id"]


def test_changing_the_rule_regenerates_unmoved_occurrences(
    client: TestClient, session: Session
) -> None:
    template, days = _week(client, session)
    client.patch(f"/api/tasks/{days[2].id}", json={"scheduled_date": "2026-11-25"})  # moved

    client.post(
        f"/api/tasks/{days[0].id}/series-edit",
        json={"scope": "all", "rrule": "FREQ=WEEKLY;BYDAY=MO,FR"},
    )
    _generate(session)

    assert _dates(session, template["id"]) == ["2026-11-16", "2026-11-18", "2026-11-20"]


def test_changing_the_due_offset_keeps_due_dates_set_by_hand(
    client: TestClient, session: Session
) -> None:
    template, days = _week(client, session, due_offset_days=0)
    client.patch(f"/api/tasks/{days[1].id}", json={"due_date": "2026-11-30"})

    client.post(f"/api/tasks/{days[0].id}/series-edit", json={"scope": "all", "due_offset_days": 2})

    due = [str(task.due_date) for task in _occurrences(session, template["id"])[:3]]
    assert due == ["2026-11-18", "2026-11-30", "2026-11-20"]


def test_checklist_changes_apply_to_new_occurrences(client: TestClient, session: Session) -> None:
    template, days = _week(client, session, subtasks=["Stretch"])

    client.post(
        f"/api/tasks/{days[0].id}/series-edit",
        json={"scope": "all", "subtasks": ["Stretch", "Hydrate"]},
    )
    _generate(session, TODAY, TODAY + timedelta(days=7))

    occurrences = _occurrences(session, template["id"])
    assert len(occurrences[0].subtasks) == 1
    assert [subtask.title for subtask in occurrences[-1].subtasks] == ["Stretch", "Hydrate"]


def test_series_actions_need_an_occurrence(client: TestClient) -> None:
    task = client.post("/api/tasks", json={"title": "One-off"}).json()

    response = client.post(f"/api/tasks/{task['id']}/series-edit", json={"scope": "all"})

    assert response.status_code == 422


def test_cancel_following_ends_the_series_and_can_be_undone(
    client: TestClient, session: Session
) -> None:
    template, days = _week(client, session)

    result = client.post(
        f"/api/tasks/{days[2].id}/series-cancel", json={"scope": "following"}
    ).json()

    assert result["template"]["ends_on"] == "2026-11-17"
    statuses = [task.status for task in _occurrences(session, template["id"])]
    assert statuses == [
        "todo",
        "todo",
        "cancelled",
        "cancelled",
        "cancelled",
        "cancelled",
        "cancelled",
    ]

    client.post(f"/api/undo/{result['batch_id']}")

    assert {task.status for task in _occurrences(session, template["id"])} == {"todo"}
    restored = session.get(TaskTemplate, template["id"])
    assert restored is not None and restored.ends_on is None


def test_cancel_all_archives_the_series_and_keeps_finished_ones(
    client: TestClient, session: Session
) -> None:
    template, days = _week(client, session)
    client.post(f"/api/tasks/{days[0].id}/complete")

    result = client.post(f"/api/tasks/{days[3].id}/series-cancel", json={"scope": "all"}).json()

    assert result["template"]["archived_at"] is not None
    statuses = [task.status for task in _occurrences(session, template["id"])]
    assert statuses[0] == "done"
    assert set(statuses[1:]) == {"cancelled"}
    assert (
        client.post(f"/api/tasks/{days[3].id}/series-edit", json={"scope": "all"}).status_code
        == 409
    )
