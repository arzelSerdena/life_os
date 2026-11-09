from alembic import command
from alembic.config import Config

from app.config import BACKEND_DIR


def test_migrations_apply_and_match_the_models(database_url: str) -> None:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["database_url"] = database_url

    command.upgrade(config, "head")

    # Fails if a model changed without a matching migration.
    command.check(config)
