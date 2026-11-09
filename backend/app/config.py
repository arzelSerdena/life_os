from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATABASE_PATH = BACKEND_DIR / "data" / "life_os.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LIFE_OS_",
        env_file=BACKEND_DIR / ".env",
        extra="ignore",
    )

    database_url: str = f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
