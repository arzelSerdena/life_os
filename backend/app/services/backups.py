"""Backups of the database: Back up now, the daily automatic backup, and Restore from backup.

A backup is a copy made with SQLite's online backup API, so it is consistent even while
the app is writing. Each file is named by the local time it was taken
(`life_os-2026-11-18-030000.db`), which is how backups are listed, dated and kept.
"""

import contextlib
import logging
import os
import re
import sqlite3
import subprocess
import sys
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.util import CommandError
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app import clock
from app.config import BACKEND_DIR
from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.models import AppSettings
from app.services.app_settings import get_settings

logger = logging.getLogger(__name__)

AUTO_BACKUP_HOUR = 3
WRITE_FAILED = "couldn't write to the backup folder"
NOT_A_BACKUP = "This file isn't a Life OS backup."
_NAME = re.compile(r"^life_os-(\d{4}-\d{2}-\d{2}-\d{6})\.db$")
_NAME_TIME = "%Y-%m-%d-%H%M%S"
# Restore keeps these: they are how the app is set up, not the data being restored.
_KEPT_SETTINGS = (
    "open_on_start",
    "time_format",
    "day_ends_at",
    "auto_backup",
    "keep_backups",
    "backup_folder",
)


@dataclass(frozen=True)
class Backup:
    name: str
    created_at: datetime
    size: int


@dataclass(frozen=True)
class BackupFailure:
    at: datetime
    message: str


@dataclass(frozen=True)
class BackupsStatus:
    folder: Path
    folder_found: bool
    backups: list[Backup]
    last_failure: BackupFailure | None


# The last backup that failed. Kept in memory: after a restart, the folder shows the rest.
_last_failure: BackupFailure | None = None
# One backup or restore at a time; the automatic backup runs in its own thread.
_lock = threading.Lock()


def _engine(session: Session) -> Engine:
    bind = session.get_bind()
    return bind if isinstance(bind, Engine) else bind.engine


def database_path(session: Session) -> Path:
    database = _engine(session).url.database
    if not database or database == ":memory:":
        raise ConflictError("Backups need a database file.")
    return Path(database).resolve()


def _folder(session: Session, settings: AppSettings) -> Path:
    if settings.backup_folder:
        return Path(settings.backup_folder)
    return database_path(session).parent / "backups"


def _folder_found(settings: AppSettings, folder: Path) -> bool:
    """A chosen folder must exist; the default one is created with the first backup."""
    return settings.backup_folder is None or folder.is_dir()


def list_backups(folder: Path) -> list[Backup]:
    """The backup files in a folder, newest first. Other files are left out."""
    if not folder.is_dir():
        return []
    backups = []
    for path in folder.iterdir():
        match = _NAME.match(path.name)
        if match and path.is_file():
            created_at = datetime.strptime(match[1], _NAME_TIME)
            backups.append(Backup(path.name, created_at, path.stat().st_size))
    return sorted(backups, key=lambda backup: backup.created_at, reverse=True)


def get_status(session: Session) -> BackupsStatus:
    settings = get_settings(session)
    folder = _folder(session, settings)
    backups = list_backups(folder)
    failure = _last_failure
    if failure and backups and backups[0].created_at >= failure.at:
        failure = None
    return BackupsStatus(folder, _folder_found(settings, folder), backups, failure)


def _read_only(path: Path) -> sqlite3.Connection:
    """Opens a database without creating it when it doesn't exist."""
    return sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)


def _copy_database(source: Path, target: Path) -> None:
    with (
        contextlib.closing(_read_only(source)) as source_db,
        contextlib.closing(sqlite3.connect(target)) as target_db,
    ):
        source_db.backup(target_db)


def _back_up(database: Path, folder: Path, keep: int | None) -> Backup:
    """Writes a backup, then deletes all but the newest `keep` backups when it is set."""
    global _last_failure
    now = clock.now().replace(microsecond=0)
    path = folder / f"life_os-{now.strftime(_NAME_TIME)}.db"
    # Written under another name first, so a failed backup never looks like a backup.
    partial = path.with_name(f"{path.name}.part")
    try:
        folder.mkdir(parents=True, exist_ok=True)
        _copy_database(database, partial)
        partial.replace(path)
    except (OSError, sqlite3.Error) as error:
        logger.exception("Backup to %s failed", folder)
        with contextlib.suppress(OSError):
            partial.unlink(missing_ok=True)
        _last_failure = BackupFailure(at=now, message=WRITE_FAILED)
        raise ConflictError(f"Backup failed: {WRITE_FAILED}.") from error
    _last_failure = None
    if keep is not None:
        for old in list_backups(folder)[keep:]:
            with contextlib.suppress(OSError):
                (folder / old.name).unlink()
    return Backup(path.name, now, path.stat().st_size)


def _keep(settings: AppSettings) -> int | None:
    """Keep last applies while automatic backups are on."""
    return settings.keep_backups if settings.auto_backup else None


def back_up(session: Session) -> Backup:
    """Back up now."""
    settings = get_settings(session)
    folder = _folder(session, settings)
    if not _folder_found(settings, folder):
        raise ConflictError(f"Folder not found: {folder}")
    with _lock:
        return _back_up(database_path(session), folder, _keep(settings))


def last_auto_backup_time(now: datetime) -> datetime:
    """The latest 3 AM at or before `now`."""
    today = now.replace(hour=AUTO_BACKUP_HOUR, minute=0, second=0, microsecond=0)
    return today if now >= today else today - timedelta(days=1)


def back_up_if_due(session: Session) -> Backup | None:
    """The automatic backup: one a day, from 3 AM. When the app wasn't running at 3 AM, it
    runs the next time it is. Any backup since the last 3 AM counts."""
    settings = get_settings(session)
    folder = _folder(session, settings)
    if not settings.auto_backup or not _folder_found(settings, folder):
        return None
    with _lock:
        backups = list_backups(folder)
        if backups and backups[0].created_at >= last_auto_backup_time(clock.now()):
            return None
        with contextlib.suppress(ConflictError):
            return _back_up(database_path(session), folder, _keep(settings))
    return None


def _alembic_config(database: Path) -> Config:
    # Built without alembic.ini so its logging setup doesn't replace the server's.
    config = Config()
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations").replace("%", "%%"))
    config.set_main_option("path_separator", "os")
    config.attributes["database_url"] = f"sqlite:///{database.as_posix()}"
    return config


def _bring_up_to_date(database: Path) -> None:
    """Checks that a copied backup is a Life OS database, then migrates it to the current
    schema."""
    not_a_backup = UnprocessableError(NOT_A_BACKUP)
    try:
        with contextlib.closing(_read_only(database)) as db:
            if db.execute("PRAGMA quick_check").fetchone() != ("ok",):
                raise not_a_backup
            row = db.execute("SELECT version_num FROM alembic_version").fetchone()
    except sqlite3.Error as error:
        raise not_a_backup from error
    if row is None:
        raise not_a_backup

    config = _alembic_config(database)
    script = ScriptDirectory.from_config(config)
    try:
        known = script.get_revision(row[0]) is not None
    except CommandError:
        known = False
    if not known:
        raise ConflictError("This backup is from a newer version of Life OS.")
    if row[0] != script.get_current_head():
        command.upgrade(config, "head")


def restore(session: Session, name: str) -> tuple[Backup, Backup]:
    """Replaces the data with a backup, after backing up the current data. The settings
    stay as they are. Returns the backup restored and the backup of the replaced data."""
    settings = get_settings(session)
    kept = {field: getattr(settings, field) for field in _KEPT_SETTINGS}
    folder = _folder(session, settings)
    chosen = next((backup for backup in list_backups(folder) if backup.name == name), None)
    if chosen is None:
        raise NotFoundError("Backup not found")
    database = database_path(session)
    engine = _engine(session)

    with _lock:
        staged = database.with_name(f"{database.stem}.restoring.db")
        try:
            staged.unlink(missing_ok=True)
            Path(f"{staged}-wal").unlink(missing_ok=True)
            Path(f"{staged}-shm").unlink(missing_ok=True)
            try:
                _copy_database(folder / chosen.name, staged)
            except sqlite3.DatabaseError as error:
                raise UnprocessableError(NOT_A_BACKUP) from error
            _bring_up_to_date(staged)
            # Not trimmed to Keep last, so the restored backup can't be the one deleted.
            current = _back_up(database, folder, keep=None)
            with contextlib.closing(sqlite3.connect(database)) as db:
                db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            session.close()
            engine.dispose()
            Path(f"{database}-wal").unlink(missing_ok=True)
            Path(f"{database}-shm").unlink(missing_ok=True)
            _copy_database(staged, database)
        finally:
            engine.dispose()
            with contextlib.suppress(OSError):
                staged.unlink(missing_ok=True)
                Path(f"{staged}-wal").unlink(missing_ok=True)
                Path(f"{staged}-shm").unlink(missing_ok=True)

    restored_settings = get_settings(session)
    for field, value in kept.items():
        setattr(restored_settings, field, value)
    session.commit()
    return chosen, current


def _open_in_file_manager(path: Path) -> None:
    if sys.platform == "win32":
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


def open_folder(session: Session, folder: Literal["backups", "database"]) -> None:
    """Shows the backup folder, or the database's folder, in the file manager."""
    if folder == "backups":
        path = _folder(session, get_settings(session))
        if get_settings(session).backup_folder is None:
            path.mkdir(parents=True, exist_ok=True)
    else:
        path = database_path(session).parent
    if not path.is_dir():
        raise ConflictError(f"Folder not found: {path}")
    _open_in_file_manager(path)
