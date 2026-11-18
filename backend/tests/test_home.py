"""Home: today's tasks and events, routines today, Log today, Needs a push and Coming up.
Today is pinned to Saturday 14 November 2026; its week is Nov 9 to 15."""

from datetime import date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import LifeArea, Project, Task
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 14)


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def area(session: Session) -> LifeArea:
    return make_life_area(session, "Career")


def noon(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 12)


def day(offset: int) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


def home(client: TestClient) -> dict[str, Any]:
    response = client.get("/api/home")
    assert response.status_code == 200, response.text
    return response.json()


def add(session: Session, *rows: Any) -> None:
    session.add_all(rows)
    session.commit()


def titles(rows: list[dict[str, Any]], key: str = "title") -> list[str]:
    return [row[key] for row in rows]


def post(client: TestClient, url: str, body: dict[str, Any]) -> dict[str, Any]:
    response = client.post(url, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def metric(client: TestClient, area: LifeArea, title: str, **fields: Any) -> dict[str, Any]:
    body = {"title": title, "aggregation": "sum", "life_area_id": area.id, **fields}
    return post(client, "/api/metrics", body)


def target(client: TestClient, found: dict[str, Any], **fields: Any) -> None:
    post(client, f"/api/metrics/{found['id']}/targets", {"start_date": "2026-11-01", **fields})


def log(client: TestClient, found: dict[str, Any], on: str, value: float) -> None:
    post(client, f"/api/metrics/{found['id']}/entries", {"date": on, "value": value})


def test_with_nothing_yet_home_is_empty_and_names_nothing_for_setup(client: TestClient) -> None:
    data = home(client)

    assert data["today"] == "2026-11-14"
    assert data["setup"] == {"life_area": None, "routine": None, "task": None}
    assert data["overdue"] == data["tasks"] == data["completed"] == data["routines"] == []
    assert data["inbox"] == 0
    assert data["coming_up"]["range"] == {"start": "2026-11-15", "end": "2026-11-21"}


def test_setup_names_the_first_area_routine_and_task(
    client: TestClient, session: Session, area: LifeArea
) -> None:
    make_life_area(session, "Health")
    add(session, Task(title="Buy groceries"), Task(title="Later"))

    setup = home(client)["setup"]
    assert setup == {"life_area": "Career", "routine": None, "task": "Buy groceries"}


def test_today_lists_overdue_tasks_apart_from_those_placed_today_and_those_done_today(
    client: TestClient, session: Session, area: LifeArea
) -> None:
    owned = {"life_area_id": area.id}
    add(
        session,
        Task(title="Update resume", due_date=date(2026, 11, 4), **owned),
        # Overdue even though it is scheduled later: listed once, under Overdue.
        Task(
            title="Late but scheduled",
            due_date=TODAY - timedelta(days=1),
            scheduled_date=TODAY + timedelta(days=2),
            **owned,
        ),
        Task(
            title="Draft the pitch",
            scheduled_date=TODAY,
            due_date=TODAY + timedelta(days=1),
            **owned,
        ),
        Task(title="Due today", due_date=TODAY, **owned),
        Task(title="Buy groceries", scheduled_date=TODAY),
        Task(title="Tomorrow", scheduled_date=TODAY + timedelta(days=1), **owned),
        Task(title="Unscheduled", **owned),
        Task(
            title="Run 5 km", status="done", completed_at=noon(TODAY), scheduled_date=TODAY, **owned
        ),
        Task(
            title="Done yesterday",
            status="done",
            completed_at=noon(TODAY - timedelta(days=1)),
            **owned,
        ),
        Task(
            title="Cancelled",
            status="cancelled",
            cancelled_at=noon(TODAY),
            scheduled_date=TODAY,
            **owned,
        ),
        Task(title="Archived", scheduled_date=TODAY, archived_at=noon(TODAY), **owned),
    )

    data = home(client)

    assert titles(data["overdue"]) == ["Update resume", "Late but scheduled"]
    assert titles(data["tasks"]) == ["Draft the pitch", "Due today", "Buy groceries"]
    assert titles(data["completed"]) == ["Run 5 km"]
    assert data["inbox"] == 1  # Buy groceries has no owner


def test_unfinished_tasks_from_past_days_roll_over_to_today(
    client: TestClient, session: Session, area: LifeArea
) -> None:
    add(
        session,
        Task(title="Yesterday", scheduled_date=TODAY - timedelta(days=1), life_area_id=area.id),
    )

    data = home(client)

    assert titles(data["tasks"]) == ["Yesterday"]
    assert data["tasks"][0]["scheduled_date"] == "2026-11-14"


def test_events_project_due_dates_and_deadlines_for_today_and_the_next_7_days(
    client: TestClient, session: Session, area: LifeArea
) -> None:
    for title, start, end in [
        ("Hackathon weekend", day(0), day(1)),
        ("Demo rehearsal", day(0), None),
        ("Study group", day(5), None),
        ("Too far", day(8), None),
    ]:
        post(
            client,
            "/api/events",
            {"title": title, "start_date": start, "end_date": end, "life_area_id": area.id},
        )
    make_project(session, area, "Due today", due_date=TODAY)
    make_project(session, area, "Kitchen deep clean", due_date=TODAY + timedelta(days=1))
    make_project(
        session,
        area,
        "Done",
        due_date=TODAY + timedelta(days=2),
        status="done",
        completed_at=noon(TODAY),
    )
    savings = metric(client, area, "Savings")
    target(client, savings, kind="reach_by", target_value=100, end_date=day(0))
    runs = metric(client, area, "Runs")
    target(client, runs, kind="reach_by", target_value=3, end_date=day(3))
    met = metric(client, area, "Met already")
    target(client, met, kind="reach_by", target_value=1, end_date=day(2))
    log(client, met, day(0), 1)

    data = home(client)

    assert titles(data["events"]) == ["Demo rehearsal", "Hackathon weekend"]
    assert titles(data["projects_due"]) == ["Due today"]
    assert titles(data["deadlines"]) == ["Savings"]
    coming = data["coming_up"]
    assert titles(coming["events"]) == ["Hackathon weekend", "Study group"]
    assert titles(coming["projects"]) == ["Kitchen deep clean"]
    assert [(row["title"], row["day"]) for row in coming["deadlines"]] == [("Runs", day(3))]


def test_routines_today_list_each_routine_with_its_due_steps(
    client: TestClient, area: LifeArea
) -> None:
    steps = [{"title": t, "life_area_id": area.id} for t in ("LeetCode", "Read")]
    evening = post(
        client, "/api/routines", {"title": "Evening", "starts_on": "2026-11-01", "steps": steps}
    )
    post(
        client,
        "/api/routines",
        {
            "title": "Mondays",
            "starts_on": "2026-11-01",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "steps": [{"title": "Plan", "life_area_id": area.id}],
        },
    )
    leetcode, read = evening["steps"]
    for offset in (-3, -2, -1, 0):
        client.put(
            f"/api/routine-steps/{leetcode['id']}/days/{day(offset)}", json={"status": "done"}
        )
    feeds = metric(client, area, "Reading days", source="routine_step", routine_step_id=read["id"])

    (routine,) = home(client)["routines"]

    assert routine["title"] == "Evening"
    assert [(s["title"], s["status"], s["streak"]) for s in routine["steps"]] == [
        ("LeetCode", "done", 4),
        ("Read", "todo", 0),
    ]
    assert routine["steps"][1]["metric"] == {"id": feeds["id"], "title": "Reading days"}


def test_log_today_lists_manual_metrics_with_a_daily_or_weekly_target_and_no_entry_today(
    client: TestClient, area: LifeArea
) -> None:
    water = metric(client, area, "Water", unit="glasses")
    target(client, water, kind="per_period", period="day", target_value=8)
    for offset, value in [(-5, 8), (-4, 9), (-3, 2), (-2, 8), (-1, 8), (-6, 8)]:
        log(client, water, day(offset), value)  # Mon to Fri; Sunday is last week
    study = metric(client, area, "Study hours", format="duration")
    target(client, study, kind="per_period", period="week", target_value=600)
    log(client, study, day(-2), 360)
    log(client, study, day(-7), 500)  # last week
    logged = metric(client, area, "Logged today")
    target(client, logged, kind="per_period", period="day", target_value=1)
    log(client, logged, day(0), 1)
    monthly = metric(client, area, "Monthly")
    target(client, monthly, kind="per_period", period="month", target_value=5)
    metric(client, area, "No target")

    data = home(client)

    assert [
        (row["title"], row["value"], row["days_met"], row["days_counted"]) for row in data["log"]
    ] == [
        ("Water", None, 4, 5),
        ("Study hours", 360, 0, 0),
    ]
    assert data["log"][1]["target_period"] == "week"
    # A metric in Log today isn't repeated under Needs a push.
    assert "Study hours" not in titles(data["push_metrics"])


def test_needs_a_push_lists_metrics_behind_their_current_target(
    client: TestClient, session: Session, area: LifeArea
) -> None:
    project = make_project(session, area, "Resume", start_date=date(2026, 9, 1))
    applications = metric(client, area, "Job applications")
    target(client, applications, kind="per_period", period="month", target_value=5)
    log(client, applications, day(-3), 1)
    replies = metric(client, area, "Recruiter replies", life_area_id=None, project_id=project.id)
    target(client, replies, kind="per_period", period="month", target_value=2)
    on_track = metric(client, area, "On track")
    target(client, on_track, kind="per_period", period="month", target_value=2)
    log(client, on_track, day(-1), 2)
    daily = metric(client, area, "Daily")
    target(client, daily, kind="per_period", period="day", target_value=1)

    rows = home(client)["push_metrics"]

    assert [(row["title"], row["value"], row["ends_on"]) for row in rows] == [
        ("Job applications", 1, "2026-11-30"),
        ("Recruiter replies", None, "2026-11-30"),
    ]
    assert rows[1]["project_id"] == project.id


def test_needs_a_push_lists_projects_due_soon_stalled_or_with_no_next_step_once_each(
    client: TestClient, session: Session, area: LifeArea
) -> None:
    started = {"start_date": date(2026, 9, 1)}
    due = make_project(
        session, area, "Hackathon prep", due_date=TODAY + timedelta(days=6), **started
    )
    stalled = make_project(session, area, "Reading challenge", **started)
    idle = make_project(session, area, "Life OS app", **started)
    planned = make_project(session, area, "Planned", **started)
    make_project(session, area, "Later", due_date=TODAY + timedelta(days=30), **started)

    def task(project: Project, **fields: Any) -> Task:
        return Task(
            title="Task",
            project_id=project.id,
            life_area_id=area.id,
            created_at=noon(date(2026, 9, 1)),
            **fields,
        )

    add(
        session,
        task(due),
        task(due),
        task(due),
        task(stalled),
        task(idle, status="done", completed_at=noon(TODAY - timedelta(days=2))),
        task(idle, scheduled_date=TODAY + timedelta(days=10)),
        task(planned, status="done", completed_at=noon(TODAY - timedelta(days=1))),
        task(planned, scheduled_date=TODAY + timedelta(days=2)),
    )

    rows = home(client)["push_projects"]

    assert [(row["title"], row["reason"], row["open"]) for row in rows] == [
        ("Hackathon prep", "due", 3),
        ("Reading challenge", "stalled", 1),
        ("Life OS app", "no_next_step", 1),
        ("Later", "no_next_step", 0),
    ]
    assert rows[1]["days"] == (TODAY - date(2026, 9, 1)).days


def test_logging_an_entry_can_be_undone(client: TestClient, area: LifeArea) -> None:
    water = metric(client, area, "Water")
    target(client, water, kind="per_period", period="day", target_value=8)

    change = post(client, f"/api/metrics/{water['id']}/entries", {"value": 8})
    assert change["entry"]["date"] == "2026-11-14"
    assert home(client)["log"] == []

    response = client.post(f"/api/undo/{change['batch_id']}")
    assert response.status_code == 200, response.text
    assert client.get(f"/api/metrics/{water['id']}/entries").json() == []
    assert titles(home(client)["log"]) == ["Water"]
