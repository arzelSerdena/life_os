from datetime import date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import LifeArea, Project, Task, TaskTemplate
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 14)  # a Saturday, in Q4


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


def noon(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 12)


def overview(client: TestClient, period: str = "quarter", day: date = TODAY) -> dict[str, Any]:
    response = client.get(
        "/api/projects/overview", params={"period": period, "date": day.isoformat()}
    )
    assert response.status_code == 200, response.text
    return response.json()


def task(project: Project, title: str = "Task", **fields: Any) -> Task:
    fields.setdefault("created_at", noon(date(2026, 9, 1)))
    if fields.get("status") == "done":
        fields.setdefault("completed_at", noon(TODAY))
    return Task(project_id=project.id, life_area_id=project.life_area_id, title=title, **fields)


def add(session: Session, *rows: Any) -> None:
    session.add_all(rows)
    session.commit()


def old_project(session: Session, area: LifeArea, title: str, **fields: Any) -> Project:
    fields.setdefault("start_date", date(2026, 9, 1))
    return make_project(session, area, title, **fields)


def test_with_no_projects_everything_is_empty(client: TestClient) -> None:
    data = overview(client)

    assert data["has_projects"] is False
    assert data["range"] == {"start": "2026-10-01", "end": "2026-12-31"}
    assert data["previous_range"] == {"start": "2026-07-01", "end": "2026-09-30"}
    assert data["totals"]["done"] == 0
    assert data["projects"] == []
    # One point per week up to today: Oct 1 to 4 (clipped), then from each Monday to Nov 9.
    assert len(data["buckets"]) == 7


def test_totals_count_one_off_project_tasks_in_the_period_and_the_one_before(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    project = old_project(session, area, "Resume")
    template = TaskTemplate(title="Weekly review", life_area_id=area.id, project_id=project.id)
    add(session, template)
    add(
        session,
        # Done in Q4: on time, late, and with no due date.
        task(project, "On time", status="done", due_date=date(2026, 11, 20), rollover_count=2),
        task(project, "Late", status="done", due_date=date(2026, 11, 1), rollover_count=1),
        task(project, "No due", status="done"),
        # Done in Q3.
        task(project, "Q3", status="done", completed_at=noon(date(2026, 9, 10))),
        # Not counted: an archived task, an Inbox task and a recurring occurrence.
        task(project, "Archived", status="done", archived_at=noon(TODAY)),
        Task(title="Inbox", status="done", completed_at=noon(TODAY)),
        task(
            project,
            "Occurrence",
            template_id=template.id,
            occurrence_date=TODAY,
            status="done",
        ),
    )

    data = overview(client)

    assert data["totals"] == {
        "done": 3,
        "done_with_due": 2,
        "done_on_time": 1,
        "rollovers": 3,
        "finished": 0,
        "finished_on_time": 0,
    }
    assert data["previous"]["done"] == 1


def test_open_and_overdue_are_counted_now_with_their_projects(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    resume = old_project(session, area, "Resume")
    hackathon = old_project(session, area, "Hackathon")
    add(
        session,
        task(resume, "Overdue", due_date=date(2026, 11, 10)),
        task(resume, "Open"),
        task(hackathon, "Overdue too", due_date=date(2026, 11, 13)),
        task(hackathon, "Due today", due_date=TODAY),
        task(hackathon, "Cancelled", status="cancelled", cancelled_at=noon(TODAY)),
    )

    data = overview(client)

    assert (data["open"], data["open_projects"]) == (4, 2)
    assert (data["overdue"], data["overdue_projects"]) == (2, 2)
    rows = {row["title"]: row for row in data["projects"]}
    assert (rows["Resume"]["open"], rows["Resume"]["overdue"]) == (2, 1)
    assert rows["Hackathon"]["total"] == 2  # the cancelled one doesn't count


def test_buckets_count_open_tasks_at_each_end(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Career")
    project = old_project(session, area, "Resume")
    add(
        session,
        task(project, "Done Nov 4", status="done", completed_at=noon(date(2026, 11, 4))),
        task(project, "Added Nov 11", created_at=noon(date(2026, 11, 11))),
    )

    data = overview(client, period="month")

    weeks = {bucket["start"]: bucket for bucket in data["buckets"]}
    assert list(weeks) == ["2026-11-01", "2026-11-02", "2026-11-09"]
    assert weeks["2026-11-01"]["open"] == 1
    assert weeks["2026-11-02"]["totals"]["done"] == 1
    assert weeks["2026-11-02"]["open"] == 0
    assert weeks["2026-11-09"]["open"] == 1


def test_projects_list_active_ones_and_those_finished_in_the_period(
    client: TestClient, session: Session
) -> None:
    career = make_life_area(session, "Career", sort_order=1)
    home = make_life_area(session, "Home", sort_order=0)
    old_project(session, career, "Resume", due_date=date(2026, 11, 30))
    old_project(
        session,
        career,
        "Interview prep",
        status="done",
        completed_at=noon(date(2026, 10, 30)),
        due_date=date(2026, 10, 31),
    )
    old_project(session, career, "Old", status="done", completed_at=noon(date(2026, 8, 1)))
    old_project(session, career, "Dropped", status="cancelled", cancelled_at=noon(TODAY))
    old_project(session, career, "Hidden", archived_at=noon(TODAY))
    old_project(session, home, "Room makeover")
    gone = make_life_area(session, "Gone", archived_at=noon(TODAY))
    old_project(session, gone, "In an archived area")

    data = overview(client)

    # Areas in order, then their projects in order.
    assert [row["title"] for row in data["projects"]] == [
        "Room makeover",
        "Resume",
        "Interview prep",
    ]
    finished = data["projects"][2]
    assert (finished["status"], finished["completed_on"]) == ("done", "2026-10-30")
    assert (data["totals"]["finished"], data["totals"]["finished_on_time"]) == (1, 1)
    assert data["has_projects"] is True


def test_pace_compares_progress_with_time_passed(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Career")
    # Half of its time has passed (Nov 4 to Nov 24).
    behind = make_project(
        session, area, "Behind", start_date=date(2026, 11, 4), due_date=date(2026, 11, 24)
    )
    ahead = make_project(
        session, area, "Ahead", start_date=date(2026, 11, 4), due_date=date(2026, 11, 24)
    )
    no_due = old_project(session, area, "No due")
    add(
        session,
        task(behind, status="done"),
        task(behind),
        task(behind),
        task(behind),
        task(ahead, status="done"),
        task(ahead, status="done"),
        task(ahead),
        task(no_due),
    )

    rows = {row["title"]: row for row in overview(client)["projects"]}

    assert rows["Behind"]["pace_status"] == "behind"
    assert rows["Ahead"]["pace_status"] == "ahead"
    assert rows["No due"]["pace_status"] is None


def test_due_next_lists_active_projects_due_by_the_end_of_the_period(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    later = old_project(session, area, "Later", due_date=date(2026, 12, 15))
    soon = old_project(session, area, "Soon", due_date=date(2026, 11, 20))
    late = old_project(session, area, "Late", due_date=date(2026, 11, 10))
    old_project(session, area, "Next year", due_date=date(2027, 1, 25))
    old_project(session, area, "No due")

    data = overview(client)

    assert data["due_next"] == [late.id, soon.id, later.id]


def test_stalled_projects_have_open_tasks_and_nothing_done_for_14_days(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Personal")
    reading = old_project(session, area, "Reading")
    makeover = old_project(session, area, "Makeover")
    busy = old_project(session, area, "Busy")
    new = make_project(session, area, "New", start_date=date(2026, 11, 10))
    add(
        session,
        task(reading, status="done", completed_at=noon(date(2026, 10, 20))),
        task(reading, scheduled_date=TODAY),
        task(makeover, status="done", completed_at=noon(date(2026, 10, 31))),
        task(makeover),
        task(busy, status="done", completed_at=noon(date(2026, 11, 12))),
        task(busy, scheduled_date=TODAY),
        task(new, scheduled_date=TODAY),
    )

    data = overview(client)

    assert data["stalled"] == [
        {"project_id": reading.id, "days": 25},
        {"project_id": makeover.id, "days": 14},
    ]
    # A stalled project isn't listed again under No next step.
    assert data["no_next_step"] == []


def test_no_next_step_means_nothing_placed_in_the_next_7_days(
    client: TestClient, session: Session
) -> None:
    area = make_life_area(session, "Career")
    unscheduled = old_project(session, area, "Unscheduled")
    far = old_project(session, area, "Far")
    overdue = old_project(session, area, "Overdue")
    week = old_project(session, area, "In a week")
    empty = make_project(session, area, "Empty", start_date=TODAY)
    all_done = old_project(session, area, "All done")
    recurring = old_project(session, area, "Recurring")
    template = TaskTemplate(title="Review", life_area_id=area.id, project_id=recurring.id)
    add(session, template)
    recent = noon(date(2026, 11, 12))
    add(
        session,
        *(
            task(project, status="done", completed_at=recent)
            for project in (unscheduled, far, overdue, week, all_done, recurring)
        ),
        task(unscheduled),
        task(unscheduled),
        task(far, scheduled_date=date(2026, 11, 21)),
        task(overdue, due_date=date(2026, 11, 1)),
        task(week, scheduled_date=date(2026, 11, 20)),
        task(recurring),
        task(recurring, template_id=template.id, occurrence_date=TODAY, scheduled_date=TODAY),
    )

    data = overview(client)

    assert data["no_next_step"] == [
        {"project_id": unscheduled.id, "open": 2},
        {"project_id": far.id, "open": 1},
        {"project_id": empty.id, "open": 0},
    ]


def test_a_past_period_still_lists_todays_open_counts(client: TestClient, session: Session) -> None:
    area = make_life_area(session, "Career")
    project = old_project(session, area, "Resume")
    add(session, task(project, "Open"))

    data = overview(client, period="quarter", day=date(2026, 8, 1))

    assert data["range"] == {"start": "2026-07-01", "end": "2026-09-30"}
    assert data["open"] == 1
    assert len(data["buckets"]) == 14
