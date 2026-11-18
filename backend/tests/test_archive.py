"""Finished & archived: archived areas, finished or archived projects and archived
routines, newest first."""

from datetime import date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import Metric, Project, Task, TaskTemplate
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 18)


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


def archive(client: TestClient) -> dict[str, Any]:
    response = client.get("/api/archive")
    assert response.status_code == 200, response.text
    return response.json()


def post(client: TestClient, url: str) -> None:
    response = client.post(url)
    assert response.status_code == 200, response.text


def add(session: Session, *rows: Any) -> None:
    session.add_all(rows)
    session.commit()


def task(project: Project, title: str, **fields: Any) -> Task:
    return Task(project_id=project.id, life_area_id=project.life_area_id, title=title, **fields)


def test_nothing_finished_or_archived_lists_nothing(client: TestClient, session: Session) -> None:
    area = make_life_area(session)
    make_project(session, area, "Active")

    assert archive(client) == {"areas": [], "projects": [], "routines": []}


def test_an_area_row_counts_what_restoring_it_brings_back(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Language")
    project = make_project(session, area, "N4 exam")
    add(
        session,
        task(project, "Kanji"),
        Task(life_area_id=area.id, title="Read"),
        # Archived on its own before the area: it stays archived after a restore.
        Task(life_area_id=area.id, title="Old", archived_at=datetime(2026, 10, 1)),
        Metric(title="Words", life_area_id=area.id, aggregation="sum"),
    )
    post(client, f"/api/life-areas/{area.id}/archive")
    empty = make_life_area(session, "Side projects")
    post(client, f"/api/life-areas/{empty.id}/archive")

    rows = archive(client)["areas"]

    # Newest first; the ids break the tie between two archives in the same second.
    assert [row["title"] for row in rows] == ["Side projects", "Language"]
    language = rows[1]
    assert (language["projects"], language["tasks"], language["metrics"]) == (1, 2, 1)
    assert language["has_items"] is True
    assert language["archived_on"] == TODAY.isoformat()
    assert rows[0]["has_items"] is False
    assert (rows[0]["projects"], rows[0]["tasks"], rows[0]["metrics"]) == (0, 0, 0)


def test_projects_list_done_cancelled_and_archived_with_their_task_counts(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session)
    make_project(session, area, "Active")
    run = make_project(session, area, "Couch to 5K")
    stretch = TaskTemplate(title="Stretch", life_area_id=area.id, project_id=run.id)
    add(session, stretch)
    add(
        session,
        task(run, "Week 1", status="done", completed_at=datetime(2026, 11, 1)),
        task(run, "Week 2"),
        # Recurring occurrences don't count.
        task(
            run,
            "Stretch",
            status="done",
            completed_at=datetime(2026, 11, 1),
            template_id=stretch.id,
            occurrence_date=date(2026, 11, 1),
        ),
    )
    post(client, f"/api/projects/{run.id}/complete")
    paint = make_project(session, area, "Kitchen repaint")
    post(client, f"/api/projects/{paint.id}/cancel")
    blog = make_project(session, area, "Old blog")
    post(client, f"/api/projects/{blog.id}/archive")

    rows = archive(client)["projects"]

    assert [row["title"] for row in rows] == ["Old blog", "Kitchen repaint", "Couch to 5K"]
    blog_row, paint_row, run_row = rows
    assert blog_row["status"] == "active" and blog_row["archived_at"] is not None
    assert paint_row["status"] == "cancelled" and paint_row["archived_at"] is None
    # The open task was cancelled with the project and still counts.
    assert (run_row["done"], run_row["total"], run_row["has_items"]) == (1, 2, True)
    assert run_row["on"] == TODAY.isoformat()
    assert paint_row["has_items"] is False


def test_a_project_archived_with_its_area_is_listed_and_cant_be_restored_alone(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session)
    project = make_project(session, area, "Etsy shop")
    post(client, f"/api/life-areas/{area.id}/archive")

    (row,) = archive(client)["projects"]
    assert row["id"] == project.id

    response = client.post(f"/api/projects/{project.id}/unarchive")
    assert response.status_code == 409


def _routine(client: TestClient, area: int, steps: list[str]) -> dict[str, Any]:
    body = {
        "title": "Study sprint",
        "starts_on": "2026-11-09",
        "steps": [{"title": step, "life_area_id": area} for step in steps],
    }
    response = client.post("/api/routines", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_an_archived_routine_lists_its_steps_best_run_and_metrics(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session).id
    routine = _routine(client, area, ["Anki", "Read"])
    anki, read = routine["steps"]
    # Four full days, a miss, then two more.
    for offset in range(7):
        day = date(2026, 11, 9) + timedelta(days=offset)
        for step in (anki, read):
            status = "done" if offset != 4 or step is read else None
            if status:
                url = f"/api/routine-steps/{step['id']}/days/{day.isoformat()}"
                assert client.put(url, json={"status": status}).status_code == 200
    body = {
        "title": "Reading days",
        "aggregation": "sum",
        "source": "routine_step",
        "routine_step_id": read["id"],
        "life_area_id": area,
    }
    assert client.post("/api/metrics", json=body).status_code == 201
    post(client, f"/api/routines/{routine['id']}/archive")

    (row,) = archive(client)["routines"]

    assert (row["title"], row["rrule"], row["steps"]) == ("Study sprint", "FREQ=DAILY", 2)
    assert row["archived_on"] == TODAY.isoformat()
    assert row["schedule_starts_on"] == "2026-11-09"
    assert row["best_run"] == 4
    assert row["feeds"] == ["Reading days"]
    # A step feeds a metric, so the routine can't be deleted.
    assert client.delete(f"/api/routines/{routine['id']}").status_code == 409
