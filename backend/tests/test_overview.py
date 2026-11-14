from datetime import date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import clock
from app.models import (
    LifeArea,
    Metric,
    MetricEntry,
    MetricTarget,
    Routine,
    RoutineLog,
    RoutineSchedule,
    RoutineStep,
    Task,
)
from app.services.overview import DateRange, period_range, previous_range
from tests.factories import make_life_area, make_project

TODAY = date(2026, 11, 14)  # a Saturday in Q4
URL = "/api/life-areas/overview"


@pytest.fixture(autouse=True)
def pinned_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clock, "today", lambda: TODAY)


def noon(day: date) -> datetime:
    """Midday UTC falls on the same local date in every time zone people live in."""
    return datetime(day.year, day.month, day.day, 12)


def overview(client: TestClient, period: str = "quarter", day: date = TODAY) -> dict[str, Any]:
    response = client.get(URL, params={"period": period, "date": day.isoformat()})
    assert response.status_code == 200, response.text
    return response.json()


def add(session: Session, *rows: Any) -> None:
    session.add_all(rows)
    session.commit()


def done_task(area: LifeArea, day: date, **fields: Any) -> Task:
    return Task(life_area_id=area.id, title="Task", status="done", completed_at=noon(day), **fields)


def metric(session: Session, area: LifeArea, title: str = "Distance", **fields: Any) -> Metric:
    row = Metric(life_area_id=area.id, title=title, aggregation="sum", **fields)
    add(session, row)
    return row


def entries(metric: Metric, *values: tuple[date, float]) -> list[MetricEntry]:
    return [MetricEntry(metric_id=metric.id, date=day, value=value) for day, value in values]


def outcome_of(data: dict[str, Any], title: str) -> dict[str, Any]:
    return next(item for item in data["outcomes"] if item["title"] == title)


# ---------- Periods ----------


@pytest.mark.parametrize(
    ("period", "start", "end", "previous_start", "previous_end"),
    [
        ("week", date(2026, 11, 9), date(2026, 11, 15), date(2026, 11, 2), date(2026, 11, 8)),
        ("month", date(2026, 11, 1), date(2026, 11, 30), date(2026, 10, 1), date(2026, 10, 31)),
        ("quarter", date(2026, 10, 1), date(2026, 12, 31), date(2026, 7, 1), date(2026, 9, 30)),
        ("year", date(2026, 1, 1), date(2026, 12, 31), date(2025, 1, 1), date(2025, 12, 31)),
    ],
)
def test_periods_are_calendar_periods(
    period: str, start: date, end: date, previous_start: date, previous_end: date
) -> None:
    current = period_range(period, TODAY)

    assert current == DateRange(start, end)
    assert previous_range(period, current) == DateRange(previous_start, previous_end)


def test_the_response_names_the_period_and_lists_active_areas(
    client: TestClient, session: Session
) -> None:
    make_life_area(session, "Career", sort_order=1)
    make_life_area(session, "Health", sort_order=0)
    make_life_area(session, "Old", archived_at=noon(TODAY))

    data = overview(client, "month")

    assert data["period"] == "month"
    assert data["range"] == {"start": "2026-11-01", "end": "2026-11-30"}
    assert data["previous_range"] == {"start": "2026-10-01", "end": "2026-10-31"}
    assert data["today"] == "2026-11-14"
    assert [area["title"] for area in data["life_areas"]] == ["Health", "Career"]


def test_period_defaults_to_this_quarter(client: TestClient) -> None:
    response = client.get(URL)

    assert response.json()["range"] == {"start": "2026-10-01", "end": "2026-12-31"}


def test_an_unknown_period_is_rejected(client: TestClient) -> None:
    assert client.get(URL, params={"period": "decade"}).status_code == 422


# ---------- Effort ----------


def test_effort_counts_done_tasks_by_area_in_both_periods(
    client: TestClient, session: Session
) -> None:
    career = make_life_area(session, "Career")
    health = make_life_area(session, "Health")
    project = make_project(session, career)
    add(
        session,
        done_task(career, date(2026, 10, 2)),
        done_task(career, TODAY, project_id=project.id),
        done_task(career, date(2026, 9, 30)),  # previous quarter
        done_task(health, date(2026, 11, 1)),
        done_task(health, date(2026, 11, 2), archived_at=noon(TODAY)),  # archived: hidden
        Task(title="Inbox", status="done", completed_at=noon(TODAY)),  # no area
        Task(life_area_id=health.id, title="Open"),
    )

    data = overview(client)

    assert data["effort"] == [
        {"life_area_id": career.id, "done": 2, "previous_done": 1},
        {"life_area_id": health.id, "done": 1, "previous_done": 0},
    ]


# ---------- Outcomes ----------


def test_only_active_area_owned_metrics_are_outcomes(client: TestClient, session: Session) -> None:
    career = make_life_area(session, "Career")
    project = make_project(session, career)
    metric(session, career, "Applications")
    metric(session, career, "Portfolio pieces", project_id=project.id)
    metric(session, career, "Old", archived_at=noon(TODAY))

    data = overview(client)

    assert [item["title"] for item in data["outcomes"]] == ["Applications"]


def test_a_weekly_target_plots_each_week_and_counts_the_weeks_met(
    client: TestClient, session: Session
) -> None:
    health = make_life_area(session)
    run = metric(session, health, "Distance run", unit="km")
    add(
        session,
        MetricTarget(
            metric_id=run.id,
            kind="per_period",
            target_value=20,
            period="week",
            start_date=date(2026, 10, 26),
        ),
        *entries(
            run,
            (date(2026, 10, 27), 21),  # week of Oct 26: met
            (date(2026, 11, 3), 12),  # week of Nov 2: missed
            (date(2026, 11, 10), 18),  # this week, 6 of 7 days in: on pace for 20
        ),
    )

    item = outcome_of(overview(client), "Distance run")

    assert item["chart"] == "per_period"
    assert item["target"]["period"] == "week"
    assert [(p["start"], p["value"], p["status"], p["is_current"]) for p in item["points"]] == [
        ("2026-10-26", 21, "met", False),
        ("2026-11-02", 12, "missed", False),
        ("2026-11-09", 18, "in_progress", True),
    ]
    assert item["value"] == 18
    assert item["previous_value"] == 12
    assert (item["met_periods"], item["finished_periods"]) == (1, 2)
    assert item["status"] == "on_track"


def test_a_weekly_sum_behind_its_pace_is_behind(client: TestClient, session: Session) -> None:
    health = make_life_area(session)
    hours = metric(session, health, "Study hours")
    add(
        session,
        MetricTarget(
            metric_id=hours.id,
            kind="per_period",
            target_value=10,
            period="week",
            start_date=date(2026, 11, 9),
        ),
        *entries(hours, (date(2026, 11, 10), 6)),
    )

    assert outcome_of(overview(client), "Study hours")["status"] == "behind"


def test_a_spending_limit_is_on_track_while_under_it(client: TestClient, session: Session) -> None:
    finance = make_life_area(session, "Finance")
    spending = metric(session, finance, "Spending", direction="lower")
    add(
        session,
        MetricTarget(
            metric_id=spending.id,
            kind="per_period",
            target_value=15000,
            period="month",
            start_date=date(2026, 10, 1),
        ),
        *entries(spending, (date(2026, 10, 5), 14000), (date(2026, 11, 5), 6500)),
    )

    item = outcome_of(overview(client), "Spending")

    # Under the limit so far, but the month isn't over, so it isn't met yet.
    assert [p["status"] for p in item["points"]] == ["met", "in_progress"]
    assert item["status"] == "on_track"


def test_a_reach_by_target_counts_from_its_start_and_compares_with_the_time_passed(
    client: TestClient, session: Session
) -> None:
    finance = make_life_area(session, "Finance")
    savings = metric(session, finance, "Savings")
    add(
        session,
        MetricTarget(
            metric_id=savings.id,
            kind="reach_by",
            target_value=30000,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 12, 31),
        ),
        *entries(savings, (date(2026, 10, 10), 5000), (date(2026, 11, 2), 5500)),
    )

    item = outcome_of(overview(client), "Savings")

    assert item["chart"] == "reach_by"
    assert [(p["start"], p["value"]) for p in item["points"]] == [
        ("2026-10-01", 5000),
        ("2026-11-01", 10500),
    ]
    assert item["value"] == 10500
    # 35% of the way there with 48% of the time gone.
    assert item["status"] == "behind"


def test_a_reach_by_target_for_lower_values_measures_progress_from_the_first_entry(
    client: TestClient, session: Session
) -> None:
    health = make_life_area(session)
    weight = Metric(
        life_area_id=health.id, title="Body weight", aggregation="latest", direction="lower"
    )
    add(session, weight)
    add(
        session,
        MetricTarget(
            metric_id=weight.id,
            kind="reach_by",
            target_value=70,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 12, 31),
        ),
        *entries(weight, (date(2026, 10, 1), 76), (date(2026, 11, 13), 72.5)),
    )

    # 3.5 of 6 kg lost (58%) with 48% of the time gone.
    assert outcome_of(overview(client), "Body weight")["status"] == "on_track"


def test_a_metric_without_a_target_compares_its_latest_step_with_the_one_before(
    client: TestClient, session: Session
) -> None:
    home = make_life_area(session, "Home")
    power = metric(session, home, "Electricity use", direction="lower")
    add(session, *entries(power, (date(2026, 10, 15), 240), (date(2026, 11, 10), 182)))

    item = outcome_of(overview(client), "Electricity use")

    assert item["chart"] == "none"
    assert item["target"] is None
    assert [(p["start"], p["value"]) for p in item["points"]] == [
        ("2026-10-01", 240),
        ("2026-11-01", 182),
    ]
    assert (item["value"], item["previous_value"]) == (182, 240)
    assert item["status"] == "improving"


# ---------- Projects ----------


def test_projects_compare_tasks_done_with_the_time_passed(
    client: TestClient, session: Session
) -> None:
    career = make_life_area(session, "Career")
    home = make_life_area(session, "Home")
    project = make_project(
        session, career, created_at=noon(date(2026, 10, 1)), due_date=date(2026, 12, 31)
    )
    make_project(session, career, "Paused idea")  # no due date: progress but no pace
    make_project(session, career, "Shipped", status="done", completed_at=noon(date(2026, 10, 20)))
    add(
        session,
        done_task(career, date(2026, 10, 5), project_id=project.id),
        *[Task(life_area_id=career.id, project_id=project.id, title="To do") for _ in range(3)],
    )

    data = overview(client)

    assert data["projects"] == [
        {
            "life_area_id": career.id,
            "active_projects": 2,
            "done": 1,
            "total": 4,
            "pace": pytest.approx(44 / 91),
            "pace_status": "behind",  # 25% done with 48% of the time gone
        },
        {
            "life_area_id": home.id,
            "active_projects": 0,
            "done": 0,
            "total": 0,
            "pace": None,
            "pace_status": None,
        },
    ]


# ---------- Routines ----------


def test_routine_weeks_count_due_steps_done(client: TestClient, session: Session) -> None:
    health = make_life_area(session)
    routine = Routine(title="Morning")
    add(session, routine)
    step = RoutineStep(
        routine_id=routine.id, life_area_id=health.id, title="Stretch", starts_on=date(2026, 11, 2)
    )
    add(session, RoutineSchedule(routine_id=routine.id, starts_on=date(2026, 11, 2)), step)
    add(
        session,
        *[
            RoutineLog(routine_step_id=step.id, date=date(2026, 11, day), status="done")
            for day in range(2, 7)
        ],
        RoutineLog(routine_step_id=step.id, date=date(2026, 11, 7), status="skipped"),
        RoutineLog(routine_step_id=step.id, date=date(2026, 11, 9), status="done"),
    )

    (area,) = overview(client, "month")["routines"]

    assert (area["steps"], area["routines"]) == (1, 1)
    weeks = [
        (w["start"], w["due"], w["done"], w["is_current"], w["is_upcoming"]) for w in area["weeks"]
    ]
    assert weeks == [
        ("2026-11-01", 0, 0, False, False),  # Sunday, before the step started
        ("2026-11-02", 6, 5, False, False),  # the skipped day isn't due; Nov 8 was missed
        ("2026-11-09", 6, 1, True, False),  # up to today
        ("2026-11-16", 0, 0, False, True),
        ("2026-11-23", 0, 0, False, True),
        ("2026-11-30", 0, 0, False, True),
    ]
    assert (area["due"], area["done"]) == (12, 6)


# ---------- Wins ----------


def test_wins_list_finished_projects_and_targets_met_newest_first(
    client: TestClient, session: Session
) -> None:
    career = make_life_area(session, "Career")
    make_project(
        session, career, "Interview prep", status="done", completed_at=noon(date(2026, 10, 30))
    )
    make_project(session, career, "Last year", status="done", completed_at=noon(date(2025, 5, 1)))
    calls = metric(session, career, "Calls")
    books = metric(session, career, "Books read")
    add(
        session,
        MetricTarget(
            metric_id=calls.id,
            kind="per_period",
            target_value=2,
            period="week",
            start_date=date(2026, 10, 19),
        ),
        *entries(
            calls,
            (date(2026, 10, 20), 2),  # met
            (date(2026, 10, 27), 1),  # missed
            (date(2026, 11, 3), 3),  # met, ends Nov 8
            (date(2026, 11, 10), 5),  # this week: not finished, so not a win yet
        ),
        MetricTarget(
            metric_id=books.id,
            kind="reach_by",
            target_value=3,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 12, 31),
        ),
        *entries(books, (date(2026, 10, 10), 1), (date(2026, 11, 1), 2)),
    )

    wins = overview(client)["wins"]

    assert [(w["kind"], w["title"], w["day"], w["times"]) for w in wins] == [
        ("target_periods_met", "Calls", "2026-11-08", 2),
        ("target_reached", "Books read", "2026-11-01", 1),
        ("project_finished", "Interview prep", "2026-10-30", 1),
    ]
    assert wins[0]["period"] == "week"
