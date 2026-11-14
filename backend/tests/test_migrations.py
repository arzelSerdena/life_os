from alembic import command
from alembic.config import Config
from sqlalchemy import CheckConstraint, inspect, text

from app.config import BACKEND_DIR
from app.db import create_db_engine
from app.models import Base


def _config(database_url: str) -> Config:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["database_url"] = database_url
    return config


def _upgrade_to_head(database_url: str) -> Config:
    config = _config(database_url)
    command.upgrade(config, "head")
    return config


def test_migrations_apply_and_match_the_models(database_url: str) -> None:
    config = _upgrade_to_head(database_url)

    # Fails if a model changed without a matching migration.
    command.check(config)


def test_migrations_keep_every_check_constraint(database_url: str) -> None:
    """Alembic's check doesn't compare CHECK constraints, so compare them here."""
    _upgrade_to_head(database_url)
    engine = create_db_engine(database_url)
    inspector = inspect(engine)

    for table in Base.metadata.sorted_tables:
        expected = {
            constraint.name
            for constraint in table.constraints
            if isinstance(constraint, CheckConstraint)
        }
        actual = {constraint["name"] for constraint in inspector.get_check_constraints(table.name)}
        assert actual == expected, table.name

    engine.dispose()


def test_every_table_uses_autoincrement_ids(database_url: str) -> None:
    """Deleted ids must never be reused, because status_changes refers to rows by id."""
    _upgrade_to_head(database_url)
    engine = create_db_engine(database_url)

    with engine.connect() as connection:
        for table in Base.metadata.sorted_tables:
            assert table.dialect_kwargs.get("sqlite_autoincrement") is True, table.name
            create_sql = connection.execute(
                text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :name"),
                {"name": table.name},
            ).scalar_one()
            assert "AUTOINCREMENT" in create_sql, table.name

    engine.dispose()


def test_autoincrement_migration_keeps_existing_life_areas(database_url: str) -> None:
    config = _config(database_url)
    command.upgrade(config, "a4001c9d8a81")
    engine = create_db_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO life_areas (title, color) VALUES ('Health', '#10B981')")
        )
    engine.dispose()

    command.upgrade(config, "head")

    # Ids deleted before this migration can't be protected: SQLite kept no record of
    # them. Nothing referred to life area ids then, so only reuse from now on matters.
    engine = create_db_engine(database_url)
    with engine.begin() as connection:
        rows = connection.execute(text("SELECT id, title, color FROM life_areas")).all()
        connection.execute(text("INSERT INTO life_areas (title) VALUES ('Temporary')"))
        connection.execute(text("DELETE FROM life_areas WHERE title = 'Temporary'"))
        connection.execute(text("INSERT INTO life_areas (title) VALUES ('New')"))
        new_id = connection.execute(
            text("SELECT id FROM life_areas WHERE title = 'New'")
        ).scalar_one()
    engine.dispose()

    assert [tuple(row) for row in rows] == [(1, "Health", "#10B981")]
    assert new_id == 3  # not 2, which belonged to the deleted row


def test_migrations_downgrade_and_upgrade_again(database_url: str) -> None:
    config = _upgrade_to_head(database_url)

    command.downgrade(config, "base")
    command.upgrade(config, "head")
    command.check(config)
