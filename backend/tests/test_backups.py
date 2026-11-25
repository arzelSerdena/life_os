import contextlib
import csv
import io
import sqlite3
import zipfile
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.models import LifeArea
from app.services import backups
from tests.factories import make_life_area

MONDAY_2PM = datetime(2026, 11, 16, 14, 0)


@pytest.fixture(autouse=True)
def no_failure_left_over() -> Iterator[None]:
    """The last failure is kept in the module, so keep one test's out of the next."""
    yield
    backups._last_failure = None  # pyright: ignore[reportPrivateUsage]


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    return f"sqlite:///{(tmp_path / 'test.db').as_posix()}"


@pytest.fixture
def database(tmp_path: Path, session: Session) -> Path:
    """The test database, stamped with the current migration like a real one."""
    path = tmp_path / "test.db"
    command.stamp(backups._alembic_config(path), "head")  # pyright: ignore[reportPrivateUsage]
    return path


@pytest.fixture
def folder(tmp_path: Path) -> Path:
    return tmp_path / "backups"


def _at(monkeypatch: pytest.MonkeyPatch, moment: datetime) -> None:
    monkeypatch.setattr(clock, "now", lambda: moment)


def _titles(path: Path) -> list[str]:
    with contextlib.closing(sqlite3.connect(path)) as db:
        return [row[0] for row in db.execute("SELECT title FROM life_areas ORDER BY id")]


def _back_up_at(client: TestClient, monkeypatch: pytest.MonkeyPatch, moment: datetime) -> str:
    _at(monkeypatch, moment)
    response = client.post("/api/backups")
    assert response.status_code == 201
    return response.json()["name"]


def test_no_backups_yet(client: TestClient, database: Path, folder: Path) -> None:
    body = client.get("/api/backups").json()

    assert body == {
        "folder": str(folder),
        "folder_found": True,
        "backups": [],
        "last_failure": None,
        "auto_backup_hour": 3,
    }


def test_back_up_now_copies_the_data(
    client: TestClient,
    session: Session,
    database: Path,
    folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    make_life_area(session, "Health")
    _at(monkeypatch, MONDAY_2PM)

    response = client.post("/api/backups")

    assert response.status_code == 201
    backup = response.json()
    assert backup["name"] == "life_os-2026-11-16-140000.db"
    assert backup["created_at"] == "2026-11-16T14:00:00"
    assert backup["size"] == (folder / backup["name"]).stat().st_size
    assert _titles(folder / backup["name"]) == ["Health"]
    assert client.get("/api/backups").json()["backups"] == [backup]


def test_backups_are_listed_newest_first_and_other_files_are_left_out(
    client: TestClient, database: Path, folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = _back_up_at(client, monkeypatch, datetime(2026, 11, 14, 3, 0))
    second = _back_up_at(client, monkeypatch, datetime(2026, 11, 15, 3, 0))
    (folder / "notes.txt").write_text("not a backup")

    names = [backup["name"] for backup in client.get("/api/backups").json()["backups"]]

    assert names == [second, first]


def test_only_the_newest_keep_last_backups_are_kept(
    client: TestClient, database: Path, folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    client.patch("/api/settings", json={"keep_backups": 7})
    names = [
        _back_up_at(client, monkeypatch, datetime(2026, 11, day, 3, 0)) for day in range(1, 10)
    ]

    listed = [backup["name"] for backup in client.get("/api/backups").json()["backups"]]

    assert listed == names[::-1][:7]


def test_keep_last_is_ignored_while_automatic_backups_are_off(
    client: TestClient, database: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    client.patch("/api/settings", json={"keep_backups": 7, "auto_backup": False})
    for day in range(1, 10):
        _back_up_at(client, monkeypatch, datetime(2026, 11, day, 3, 0))

    assert len(client.get("/api/backups").json()["backups"]) == 9


def test_a_chosen_folder_must_exist(client: TestClient, tmp_path: Path) -> None:
    missing = tmp_path / "nowhere"

    response = client.patch("/api/settings", json={"backup_folder": str(missing)})

    assert response.status_code == 422
    assert response.json()["detail"] == f"Folder not found: {missing}"


def test_a_missing_folder_is_reported_and_blocks_backups(
    client: TestClient, database: Path, tmp_path: Path
) -> None:
    chosen = tmp_path / "chosen"
    chosen.mkdir()
    client.patch("/api/settings", json={"backup_folder": str(chosen)})
    chosen.rmdir()

    status = client.get("/api/backups").json()
    response = client.post("/api/backups")

    assert status["folder"] == str(chosen)
    assert status["folder_found"] is False
    assert response.status_code == 409
    assert response.json()["detail"] == f"Folder not found: {chosen}"


def test_a_failed_backup_is_reported_until_one_works(
    client: TestClient, database: Path, folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(_source: Path, _target: Path) -> None:
        raise OSError("disk full")

    copy = backups._copy_database  # pyright: ignore[reportPrivateUsage]
    monkeypatch.setattr(backups, "_copy_database", fail)
    _at(monkeypatch, MONDAY_2PM)

    response = client.post("/api/backups")

    assert response.status_code == 409
    assert response.json()["detail"] == "Backup failed: couldn't write to the backup folder."
    assert client.get("/api/backups").json()["last_failure"] == {
        "at": "2026-11-16T14:00:00",
        "message": "couldn't write to the backup folder",
    }
    assert list(folder.iterdir()) == []

    monkeypatch.setattr(backups, "_copy_database", copy)
    _back_up_at(client, monkeypatch, datetime(2026, 11, 16, 14, 5))
    assert client.get("/api/backups").json()["last_failure"] is None


@pytest.mark.parametrize(
    ("latest", "now", "is_due"),
    [
        (None, datetime(2026, 11, 16, 1, 0), True),
        (datetime(2026, 11, 15, 3, 0), datetime(2026, 11, 16, 2, 59), False),
        (datetime(2026, 11, 15, 3, 0), datetime(2026, 11, 16, 3, 0), True),
        (datetime(2026, 11, 15, 22, 0), datetime(2026, 11, 16, 14, 0), True),
        (datetime(2026, 11, 16, 9, 0), datetime(2026, 11, 16, 23, 0), False),
    ],
)
def test_the_automatic_backup_runs_once_a_day_from_3_am(
    client: TestClient,
    session: Session,
    database: Path,
    monkeypatch: pytest.MonkeyPatch,
    latest: datetime | None,
    now: datetime,
    is_due: bool,
) -> None:
    if latest:
        _back_up_at(client, monkeypatch, latest)
    _at(monkeypatch, now)

    backup = backups.back_up_if_due(session)

    assert (backup is not None) == is_due
    if backup:
        assert backup.created_at == now


def test_no_automatic_backup_while_it_is_off(
    client: TestClient, session: Session, database: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    client.patch("/api/settings", json={"auto_backup": False})
    _at(monkeypatch, MONDAY_2PM)

    assert backups.back_up_if_due(session) is None


def test_restore_replaces_the_data_after_backing_it_up(
    client: TestClient,
    session: Session,
    database: Path,
    folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    make_life_area(session, "Health")
    old = _back_up_at(client, monkeypatch, datetime(2026, 11, 15, 3, 0))
    make_life_area(session, "Career")
    client.patch("/api/settings", json={"time_format": "24h"})
    _at(monkeypatch, MONDAY_2PM)

    response = client.post("/api/backups/restore", json={"name": old})

    assert response.status_code == 200
    body = response.json()
    assert body["restored"]["name"] == old
    assert body["current_data_backup"]["name"] == "life_os-2026-11-16-140000.db"
    assert _titles(folder / body["current_data_backup"]["name"]) == ["Health", "Career"]
    assert [area.title for area in session.scalars(select(LifeArea))] == ["Health"]
    assert client.get("/api/life-areas").status_code == 200
    # Settings are how the app is set up, so they stay as they were.
    assert client.get("/api/settings").json()["time_format"] == "24h"


def test_restore_migrates_a_backup_from_an_older_version(
    client: TestClient,
    session: Session,
    database: Path,
    folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    folder.mkdir()
    old = folder / "life_os-2026-11-01-030000.db"
    config = backups._alembic_config(old)  # pyright: ignore[reportPrivateUsage]
    command.upgrade(config, "f6a7b8c9d0e1")
    with contextlib.closing(sqlite3.connect(old)) as db:
        db.execute("INSERT INTO life_areas (title, color) VALUES ('Old area', 'blue')")
        db.commit()
    _at(monkeypatch, MONDAY_2PM)

    response = client.post("/api/backups/restore", json={"name": old.name})

    assert response.status_code == 200
    assert [area.title for area in session.scalars(select(LifeArea))] == ["Old area"]
    with contextlib.closing(sqlite3.connect(database)) as db:
        head = backups.ScriptDirectory.from_config(config).get_current_head()
        assert db.execute("SELECT version_num FROM alembic_version").fetchone() == (head,)


def test_restoring_a_missing_backup_is_a_404(client: TestClient, database: Path) -> None:
    response = client.post("/api/backups/restore", json={"name": "life_os-2026-11-01-030000.db"})

    assert response.status_code == 404


@pytest.mark.parametrize("name", ["../test.db", "test.db", "life_os-latest.db"])
def test_only_backup_files_in_the_folder_can_be_restored(
    client: TestClient, database: Path, name: str
) -> None:
    response = client.post("/api/backups/restore", json={"name": name})

    assert response.status_code == 404


def test_a_file_that_isnt_a_backup_is_refused(
    client: TestClient, session: Session, database: Path, folder: Path
) -> None:
    make_life_area(session, "Health")
    folder.mkdir()
    (folder / "life_os-2026-11-01-030000.db").write_bytes(b"not a database")

    response = client.post("/api/backups/restore", json={"name": "life_os-2026-11-01-030000.db"})

    assert response.status_code == 422
    assert response.json()["detail"] == "This file isn't a Life OS backup."
    assert [area.title for area in session.scalars(select(LifeArea))] == ["Health"]


def test_a_backup_from_a_newer_version_is_refused(
    client: TestClient, database: Path, folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    name = _back_up_at(client, monkeypatch, datetime(2026, 11, 15, 3, 0))
    with contextlib.closing(sqlite3.connect(folder / name)) as db:
        db.execute("UPDATE alembic_version SET version_num = 'ffffffffffff'")
        db.commit()

    response = client.post("/api/backups/restore", json={"name": name})

    assert response.status_code == 409
    assert response.json()["detail"] == "This backup is from a newer version of Life OS."


def test_export_has_one_csv_per_table(
    client: TestClient, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    make_life_area(session, "Health")
    _at(monkeypatch, MONDAY_2PM)

    response = client.get("/api/export")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert 'filename="life-os-2026-11-16.zip"' in response.headers["content-disposition"]
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert {"life_areas.csv", "tasks.csv", "settings.csv"} <= set(archive.namelist())
        rows = list(csv.DictReader(io.StringIO(archive.read("life_areas.csv").decode())))
    assert [row["title"] for row in rows] == ["Health"]


def test_about_shows_the_version_and_database(client: TestClient, database: Path) -> None:
    assert client.get("/api/about").json() == {
        "version": "0.1.0",
        "database_path": str(database.resolve()),
    }


def test_open_folder_shows_the_folder(
    client: TestClient, database: Path, folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    opened: list[Path] = []
    monkeypatch.setattr(backups, "_open_in_file_manager", opened.append)

    assert client.post("/api/folders/open", json={"folder": "backups"}).status_code == 204
    assert client.post("/api/folders/open", json={"folder": "database"}).status_code == 204

    assert opened == [folder, database.resolve().parent]


def test_open_folder_reports_a_missing_folder(
    client: TestClient, database: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(backups, "_open_in_file_manager", lambda _path: None)
    chosen = tmp_path / "chosen"
    chosen.mkdir()
    client.patch("/api/settings", json={"backup_folder": str(chosen)})
    chosen.rmdir()

    response = client.post("/api/folders/open", json={"folder": "backups"})

    assert response.status_code == 409


def test_restore_with_wal_mode(
    client: TestClient,
    session: Session,
    database: Path,
    folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with contextlib.closing(sqlite3.connect(database)) as db:
        assert db.execute("PRAGMA journal_mode=WAL").fetchone() == ("wal",)

    make_life_area(session, "Original Area")
    name = _back_up_at(client, monkeypatch, datetime(2026, 11, 15, 10, 0))

    make_life_area(session, "New Area Added Afterwards")
    assert _titles(database) == ["Original Area", "New Area Added Afterwards"]

    response = client.post("/api/backups/restore", json={"name": name})
    assert response.status_code == 200

    assert _titles(database) == ["Original Area"]
    with contextlib.closing(sqlite3.connect(database)) as db:
        assert db.execute("PRAGMA journal_mode").fetchone() == ("wal",)
