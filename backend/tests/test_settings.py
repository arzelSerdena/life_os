from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import clock
from app.models import AppSettings, Task

DEFAULTS = {
    "open_on_start": "home",
    "time_format": "12h",
    "day_ends_at": 0,
    "auto_backup": True,
    "keep_backups": 14,
    "backup_folder": None,
}


def _utc(local: datetime) -> datetime:
    """The naive UTC timestamp of a local wall-clock time, as SQLite stores `_at` columns."""
    return local.astimezone(UTC).replace(tzinfo=None)


def test_first_read_creates_the_defaults(client: TestClient, session: Session) -> None:
    response = client.get("/api/settings")

    assert response.status_code == 200
    body = response.json()
    assert {key: body[key] for key in DEFAULTS} == DEFAULTS
    assert session.get(AppSettings, 1) is not None


def test_update_changes_only_the_fields_sent(client: TestClient) -> None:
    client.patch("/api/settings", json={"time_format": "24h", "backup_folder": "D:/Backups"})
    response = client.patch("/api/settings", json={"keep_backups": 30, "auto_backup": False})

    assert response.status_code == 200
    body = response.json()
    assert body["time_format"] == "24h"
    assert body["backup_folder"] == "D:/Backups"
    assert body["keep_backups"] == 30
    assert body["auto_backup"] is False
    assert client.get("/api/settings").json() == body


def test_null_backup_folder_means_the_default(client: TestClient) -> None:
    client.patch("/api/settings", json={"backup_folder": "D:/Backups"})

    response = client.patch("/api/settings", json={"backup_folder": None})

    assert response.json()["backup_folder"] is None


@pytest.mark.parametrize(
    "change",
    [
        {"open_on_start": "areas"},
        {"time_format": "am/pm"},
        {"day_ends_at": 5},
        {"day_ends_at": -1},
        {"keep_backups": 10},
        {"backup_folder": "   "},
        {"time_format": None},
        {"day_ends_at": None},
        {"theme": "dark"},
    ],
)
def test_invalid_changes_are_rejected(client: TestClient, change: dict[str, object]) -> None:
    response = client.patch("/api/settings", json=change)

    assert response.status_code == 422


def test_only_one_settings_row_can_exist(session: Session) -> None:
    session.add(AppSettings(id=1))
    session.commit()

    with pytest.raises(IntegrityError):
        session.execute(text("INSERT INTO settings (id) VALUES (2)"))


@pytest.mark.parametrize(
    ("column", "value"),
    [("day_ends_at", 5), ("keep_backups", 10), ("open_on_start", "areas"), ("auto_backup", 2)],
)
def test_the_database_rejects_values_outside_the_rules(
    session: Session, column: str, value: object
) -> None:
    with pytest.raises(IntegrityError):
        session.execute(
            text(f"INSERT INTO settings (id, {column}) VALUES (1, :value)"), {"value": value}
        )


@pytest.mark.parametrize(
    ("day_ends_at", "wall_clock", "expected"),
    [
        (0, datetime(2026, 11, 17, 0, 30), date(2026, 11, 17)),
        (2, datetime(2026, 11, 17, 1, 59), date(2026, 11, 16)),
        (2, datetime(2026, 11, 17, 2, 0), date(2026, 11, 17)),
        (4, datetime(2026, 11, 17, 3, 30), date(2026, 11, 16)),
    ],
)
def test_today_waits_for_the_day_to_end(
    monkeypatch: pytest.MonkeyPatch, day_ends_at: int, wall_clock: datetime, expected: date
) -> None:
    monkeypatch.setattr(clock, "now", lambda: wall_clock)
    clock.set_day_ends_at(day_ends_at)

    assert clock.today() == expected


def test_a_timestamp_before_the_day_end_counts_for_the_day_before() -> None:
    done_at = _utc(datetime(2026, 11, 17, 1, 30))

    assert clock.local_date(done_at) == date(2026, 11, 17)
    clock.set_day_ends_at(2)
    assert clock.local_date(done_at) == date(2026, 11, 16)
    assert clock.local_date(_utc(datetime(2026, 11, 17, 2, 0))) == date(2026, 11, 17)


def test_requests_follow_the_stored_setting(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Monday 1:30 AM: with the day ending at 3 AM, it's still Sunday, in last week.
    monkeypatch.setattr(clock, "now", lambda: datetime(2026, 11, 16, 1, 30))

    assert client.get("/api/week").json()["today"] == "2026-11-16"

    client.patch("/api/settings", json={"day_ends_at": 3})
    week = client.get("/api/week").json()

    assert week["today"] == "2026-11-15"
    assert week["week_start"] == "2026-11-09"


def test_rollover_waits_for_the_day_to_end(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """At 1 AM before a 2 AM day end, Sunday's task stays on Sunday."""
    monkeypatch.setattr(clock, "now", lambda: datetime(2026, 11, 16, 1, 0))
    session.add(AppSettings(id=1, day_ends_at=2))
    task = Task(title="Write journal", scheduled_date=date(2026, 11, 15))
    session.add(task)
    session.commit()

    week = client.get("/api/week", params={"start": "2026-11-15"}).json()

    sunday = next(day for day in week["days"] if day["day"] == "2026-11-15")
    assert [item["title"] for item in sunday["tasks"]] == ["Write journal"]
