from datetime import date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import (
    Event,
    Metric,
    Project,
    Routine,
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
    client: TestClient, project: Project, period: str = "quarter", day: date = TODAY
) -> dict[str, Any]:
    response = client.get(
        f"/api/projects/{project.id}/page", params={"period": period, "date": day.isoformat()}
    )
    assert response.status_code == 200, response.text
    return response.json()


def add(session: Session, *rows: Any) -> None:
    session.add_all(rows)
    session.commit()


def test_a_missing_project_returns_404(client: TestClient) -> None:
    assert client.get("/api/projects/999/page").status_code == 404


def test_a_new_project_has_no_items_and_no_pace_without_a_due_date(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    project = make_project(session, area, "Portfolio site", start_date=date(2026, 11, 14))

    data = page(client, project)

    assert data["project"]["title"] == "Portfolio site"
    assert data["life_area"]["title"] == "Career"
    assert data["contents"]["has_items"] is False
    assert data["metrics"] == data["routines"] == data["events"] == []
    assert [item["title"] for item in data["projects"]] == ["Portfolio site"]
    assert data["pace"] is None
    assert data["pace_status"] is None


def test_lists_hold_only_the_projects_own_items(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Career")
    project = make_project(session, area, "Resume")
    other = make_project(session, area, "Hackathon")
    add(
        session,
        Task(life_area_id=area.id, project_id=project.id, title="Late", due_date=date(2026, 11, 4)),
        Task(life_area_id=area.id, project_id=project.id, title="Someday"),
        Task(life_area_id=area.id, project_id=other.id, title="Other project"),
        Task(life_area_id=area.id, title="Area only"),
        TaskTemplate(
            life_area_id=area.id,
            project_id=project.id,
            title="Weekly update",
            rrule="FREQ=WEEKLY",
            starts_on=date(2026, 11, 1),
        ),
        Metric(life_area_id=area.id, project_id=project.id, title="Pieces", aggregation="sum"),
        Metric(life_area_id=area.id, title="Applications", aggregation="sum"),
        Event(
            life_area_id=area.id,
            project_id=project.id,
            title="Mock interview",
            start_date=date(2026, 11, 20),
        ),
        Event(
            life_area_id=area.id,
            title="Career fair",
            start_date=date(2026, 11, 21),
        ),
    )

    data = page(client, project)

    assert [task["title"] for task in data["overdue_tasks"]] == ["Late"]
    assert [task["title"] for task in data["unscheduled_tasks"]] == ["Someday"]
    assert [template["title"] for template in data["recurring"]] == ["Weekly update"]
    assert [metric["title"] for metric in data["metrics"]] == ["Pieces"]
    assert [event["title"] for event in data["events"]] == ["Mock interview"]
    assert data["contents"]["open_tasks"] == 2
    assert data["contents"]["has_items"] is True


def test_routines_list_only_the_projects_steps(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Career")
    project = make_project(session, area, "Resume")
    routine = Routine(title="Weekly reset")
    add(session, routine)
    add(session, RoutineSchedule(routine_id=routine.id, starts_on=date(2026, 11, 1)))
    add(
        session,
        RoutineStep(
            routine_id=routine.id,
            life_area_id=area.id,
            project_id=project.id,
            title="Post an update",
            starts_on=date(2026, 11, 1),
        ),
        RoutineStep(
            routine_id=routine.id, life_area_id=area.id, title="Inbox zero", starts_on=TODAY
        ),
    )

    (group,) = page(client, project, "week")["routines"]

    assert group["total_steps"] == 2
    assert [row["title"] for row in group["steps"]] == ["Post an update"]


@pytest.mark.parametrize(
    ("done", "status"),
    [(3, "on_pace"), (4, "ahead"), (1, "behind")],
)
def test_pace_compares_tasks_done_with_time_passed(
    client: TestClient, session: Session, done: int, status: str
) -> None:
    area = make_life_area(session, "Career")
    # Oct 31 to Nov 30: 14 of 30 days have passed, so about 47% of the time.
    project = make_project(
        session, area, "Resume", start_date=date(2026, 10, 31), due_date=date(2026, 11, 30)
    )
    add(
        session,
        *[
            Task(
                life_area_id=area.id,
                project_id=project.id,
                title=f"Task {index}",
                **(
                    {"status": "done", "completed_at": noon(date(2026, 11, 1))}
                    if index < done
                    else {}
                ),
            )
            for index in range(6)
        ],
    )

    data = page(client, project)

    assert data["pace"] == pytest.approx(14 / 30)
    assert data["pace_status"] == status
    assert (data["projects"][0]["done"], data["projects"][0]["total"]) == (done, 6)
