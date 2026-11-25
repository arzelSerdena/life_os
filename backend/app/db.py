from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings


def _set_sqlite_pragmas(dbapi_connection: Any, _connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-64000")
    cursor.close()


def _enable_foreign_keys(dbapi_connection: Any, _connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def create_db_engine(
    url: str,
    *,
    enforce_foreign_keys: bool = True,
    **kwargs: Any,
) -> Engine:
    """Create an engine, enforcing foreign keys on every connection by default.

    Only migrations turn enforcement off: batch mode drops and recreates tables, and
    with foreign keys on, that DROP would fire ON DELETE CASCADE on child rows.
    """
    database = make_url(url).database
    if database and database != ":memory:":
        Path(database).parent.mkdir(parents=True, exist_ok=True)
    elif not database or database == ":memory:":
        kwargs.setdefault("poolclass", StaticPool)

    connect_args = kwargs.pop("connect_args", {})
    connect_args = {"check_same_thread": False, **connect_args}
    engine = create_engine(url, connect_args=connect_args, **kwargs)
    event.listen(engine, "connect", _set_sqlite_pragmas)
    if enforce_foreign_keys:
        event.listen(engine, "connect", _enable_foreign_keys)
    return engine


@lru_cache
def get_engine() -> Engine:
    return create_db_engine(get_settings().database_url)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    with get_session_factory()() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
