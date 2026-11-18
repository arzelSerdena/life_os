import tomllib
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATABASE_PATH = BACKEND_DIR / "data" / "life_os.db"
DEFAULT_FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LIFE_OS_",
        env_file=BACKEND_DIR / ".env",
        extra="ignore",
    )

    database_url: str = f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
    # The daily automatic backup. Tests turn it off.
    backup_scheduler: bool = True
    # The built frontend the API serves outside /api (`pnpm build` writes it).
    frontend_dist: Path = DEFAULT_FRONTEND_DIST


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def app_version() -> str:
    with (BACKEND_DIR / "pyproject.toml").open("rb") as file:
        return tomllib.load(file)["project"]["version"]
