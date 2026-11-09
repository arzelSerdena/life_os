from alembic import command
from alembic.config import Config
from sqlalchemy import CheckConstraint, inspect

from app.config import BACKEND_DIR
from app.db import create_db_engine
from app.models import Base


def _upgrade_to_head(database_url: str) -> Config:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["database_url"] = database_url
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
