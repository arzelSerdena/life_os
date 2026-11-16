from sqlalchemy.orm import Session

from app import clock
from app.models import AppSettings
from app.schemas.app_settings import SettingsUpdate

SETTINGS_ID = 1


def get_settings(session: Session) -> AppSettings:
    """The settings row, created with the defaults on first read."""
    settings = session.get(AppSettings, SETTINGS_ID)
    if settings is None:
        settings = AppSettings(id=SETTINGS_ID)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


def update_settings(session: Session, data: SettingsUpdate) -> AppSettings:
    settings = get_settings(session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    session.commit()
    session.refresh(settings)
    clock.set_day_ends_at(settings.day_ends_at)
    return settings


def apply_day_ends_at(session: Session) -> None:
    """Make `clock.today()` follow the stored setting. Runs before every request; it only
    reads, so a GET never writes the settings row."""
    settings = session.get(AppSettings, SETTINGS_ID)
    clock.set_day_ends_at(settings.day_ends_at if settings else 0)
