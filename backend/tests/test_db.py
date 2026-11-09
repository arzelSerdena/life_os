from datetime import datetime

import pytest
from sqlalchemy import Engine, String, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.db import create_db_engine
from app.models.base import BaseMixin


class _TestBase(DeclarativeBase):
    """Separate from the app's Base so this test table never reaches migrations."""


class _Item(BaseMixin, _TestBase):
    __tablename__ = "items"

    title: Mapped[str] = mapped_column(String(200))


def _foreign_keys_setting(engine: Engine) -> int:
    with engine.connect() as connection:
        return connection.execute(text("PRAGMA foreign_keys")).scalar_one()


def test_foreign_keys_are_on_for_every_new_connection(engine: Engine) -> None:
    assert _foreign_keys_setting(engine) == 1

    engine.dispose()  # the next connection is brand new, not reused from the pool

    assert _foreign_keys_setting(engine) == 1


def test_foreign_key_violation_is_rejected(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE parent (id INTEGER PRIMARY KEY)"))
        connection.execute(
            text("CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id REFERENCES parent(id))")
        )

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("INSERT INTO child (parent_id) VALUES (999)"))


def test_foreign_keys_can_be_left_off_for_migrations(database_url: str) -> None:
    engine = create_db_engine(database_url, enforce_foreign_keys=False)

    assert _foreign_keys_setting(engine) == 0

    engine.dispose()


def test_mixin_sets_timestamps_on_insert(engine: Engine, session: Session) -> None:
    _TestBase.metadata.create_all(engine)

    item = _Item(title="First")
    session.add(item)
    session.commit()

    assert isinstance(item.created_at, datetime)
    assert isinstance(item.updated_at, datetime)


def test_mixin_refreshes_updated_at_on_update(engine: Engine, session: Session) -> None:
    _TestBase.metadata.create_all(engine)
    old_time = datetime(2020, 1, 1)
    item = _Item(title="First", created_at=old_time, updated_at=old_time)
    session.add(item)
    session.commit()

    session.execute(update(_Item).where(_Item.id == item.id).values(title="Second"))
    session.commit()

    created_at, updated_at = session.execute(
        select(_Item.created_at, _Item.updated_at).where(_Item.id == item.id)
    ).one()
    assert created_at == old_time
    assert updated_at > old_time
