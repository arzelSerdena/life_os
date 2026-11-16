from fastapi import APIRouter

from app.db import SessionDep
from app.models import AppSettings
from app.schemas.app_settings import SettingsRead, SettingsUpdate
from app.services import app_settings as service

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsRead)
def get_settings(session: SessionDep) -> AppSettings:
    """The app's settings, with the defaults until something is changed."""
    return service.get_settings(session)


@router.patch("", response_model=SettingsRead)
def update_settings(session: SessionDep, data: SettingsUpdate) -> AppSettings:
    return service.update_settings(session, data)
