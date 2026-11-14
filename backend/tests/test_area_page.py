from datetime import date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import (
    LifeArea,
    Metric,
    MetricTarget,
    Routine,
    RoutineLog,
    RoutinePause,
    RoutineSchedule,
    RoutineStep,
    Task,
    TaskTemplate,
)
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 14)  # a Saturday


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


def noon(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 12)


def page(
    client: TestClient, area: LifeArea, period: str = "quarter", day: date = TODAY
) -> dict[str, Any]:
    response = client.get(
        f"/api/life-areas/{area.id}/page", params={"period": period, "date": day.isoformat()}
    )
    assert response.status_code == 200, response.text
    return response.json()


def add(session: Session, *rows: Any) -> None:
    session.add_all(rows)
    session.commit()


def test_a_missing_area_returns_404(client: TestClient) -> None:
    assert client.get("/api/life-areas/999/page").status_code == 404


def test_an_empty_area_has_no_items_and_can_be_deleted(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")

    data = page(client, area)

    assert data["contents"] == {
        "active_projects": 0,
        "open_tasks": 0,
        "upcoming_events": 0,
        "metrics": 0,
        "routine_steps": 0,
        "has_items": False,
    }
    assert data["metrics"] == data["projects"] == data["routines"] == []
    assert data["agenda_range"] == {"start": "2026-11-14", "end": "2026-12-31"}


def test_contents_count_what_an_archive_would_affect(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Career")
    make_project(session, area)
    make_project(session, area, "Old", status="done", completed_at=noon(date(2026, 1, 5)))
    add(
        session,
        Task(life_area_id=area.id, title="Open"),
        Task(life_area_id=area.id, title="Done", status="done", completed_at=noon(TODAY)),
        Metric(life_area_id=area.id, title="Hours", aggregation="sum"),
    )

    contents = page(client, area)["contents"]

    assert contents["active_projects"] == 1
    assert contents["open_tasks"] == 1
    assert contents["metrics"] == 1
    assert contents["has_items"] is True


def test_metrics_are_the_areas_own(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Career")
    project = make_project(session, area)
    add(
        session,
        Metric(life_area_id=area.id, title="Applications", aggregation="sum"),
        Metric(life_area_id=area.id, project_id=project.id, title="Pages", aggregation="sum"),
    )

    assert [m["title"] for m in page(client, area)["metrics"]] == ["Applications"]


def test_projects_are_active_ones_and_those_finished_in_the_period(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    active = make_project(
        session, area, "Resume", created_at=noon(date(2026, 10, 2)), due_date=date(2026, 11, 30)
    )
    make_project(session, area, "Prep", status="done", completed_at=noon(date(2026, 10, 30)))
    make_project(session, area, "Last year", status="done", completed_at=noon(date(2025, 3, 1)))
    add(
        session,
        Task(life_area_id=area.id, project_id=active.id, title="A"),
        Task(
            life_area_id=area.id,
            project_id=active.id,
            title="B",
            status="done",
            completed_at=noon(TODAY),
        ),
    )

    projects = page(client, area)["projects"]

    assert [(p["title"], p["status"], p["completed_on"]) for p in projects] == [
        ("Resume", "active", None),
        ("Prep", "done", "2026-10-30"),
    ]
    assert projects[0] | {"id": 0} == {
        "id": 0,
        "title": "Resume",
        "status": "active",
        "start": "2026-10-02",
        "due_date": "2026-11-30",
        "completed_on": None,
        "done": 1,
        "total": 2,
    }


def test_routine_steps_show_a_status_for_every_day(client: TestClient, session: Session) -> None:
    area = make_life_area(session)
    other = make_life_area(session, "Other")
    routine = Routine(title="Morning")
    add(session, routine)
    stretch = RoutineStep(
        routine_id=routine.id, life_area_id=area.id, title="Stretch", starts_on=date(2026, 11, 9)
    )
    read = RoutineStep(
        routine_id=routine.id, life_area_id=area.id, title="Read", starts_on=date(2026, 11, 12)
    )
    elsewhere = RoutineStep(
        routine_id=routine.id, life_area_id=other.id, title="Call", starts_on=date(2026, 11, 9)
    )
    add(session, RoutineSchedule(routine_id=routine.id, starts_on=date(2026, 11, 1)))
    add(session, stretch, read, elsewhere)
    add(
        session,
        RoutineLog(routine_step_id=stretch.id, date=date(2026, 11, 9), status="done"),
        RoutineLog(routine_step_id=stretch.id, date=date(2026, 11, 10), status="skipped"),
        RoutinePause(
            routine_step_id=stretch.id, starts_on=date(2026, 11, 11), ends_on=date(2026, 11, 13)
        ),
    )

    (group,) = page(client, area, "week")["routines"]

    assert (group["title"], group["rrule"], group["total_steps"]) == ("Morning", "FREQ=DAILY", 3)
    assert {row["title"]: row["days"] for row in group["steps"]} == {
        "Stretch": ["done", "skipped", "paused", "paused", "missed", "todo", "upcoming"],
        "Read": ["not_due", "not_due", "not_due", "missed", "missed", "todo", "upcoming"],
    }


def test_task_lists_and_the_agenda(client: TestClient, session: Session) -> None:
    area = make_life_area(session)
    other = make_life_area(session, "Other")
    add(
        session,
        Task(life_area_id=area.id, title="Late", due_date=date(2026, 11, 4)),
        Task(
            life_area_id=area.id,
            title="Slipping",
            scheduled_date=TODAY,
            rollover_count=3,
        ),
        Task(life_area_id=area.id, title="Someday"),
        Task(life_area_id=area.id, title="Friday", scheduled_date=date(2026, 11, 20)),
        Task(life_area_id=area.id, title="Due", due_date=date(2026, 12, 3)),
        Task(life_area_id=area.id, title="Next year", scheduled_date=date(2027, 1, 4)),
        Task(life_area_id=area.id, title="Shipped", status="done", completed_at=noon(TODAY)),
        Task(life_area_id=other.id, title="Not ours"),
        TaskTemplate(
            life_area_id=area.id,
            title="Weekly review",
            rrule="FREQ=WEEKLY",
            starts_on=date(2026, 11, 1),
        ),
        TaskTemplate(life_area_id=area.id, title="One-off template"),
    )
    metric = Metric(life_area_id=area.id, title="Books", aggregation="sum")
    add(session, metric)
    add(
        session,
        MetricTarget(
            metric_id=metric.id,
            kind="reach_by",
            target_value=12,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        ),
    )

    data = page(client, area)

    def titles(key: str) -> list[str]:
        return [item["title"] for item in data[key]]

    assert titles("overdue_tasks") == ["Late"]
    assert titles("rolled_over_tasks") == ["Slipping"]
    assert titles("unscheduled_tasks") == ["Late", "Someday", "Due"]
    assert titles("recurring") == ["Weekly review"]
    assert titles("completed_tasks") == ["Shipped"]
    assert sorted(titles("agenda_tasks")) == ["Due", "Friday", "Slipping"]
    assert data["deadlines"] == [
        {
            "metric_id": metric.id,
            "title": "Books",
            "day": "2026-12-31",
            "target_value": 12,
            "unit": None,
        }
    ]


def test_a_past_period_has_no_agenda(client: TestClient, session: Session) -> None:
    area = make_life_area(session)

    data = page(client, area, "month", date(2026, 9, 10))

    assert data["range"] == {"start": "2026-09-01", "end": "2026-09-30"}
    assert data["agenda_range"] is None
    assert data["agenda_tasks"] == []
