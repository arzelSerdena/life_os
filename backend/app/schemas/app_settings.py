from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.common import UtcDatetime

OpenOnStart = Literal["home", "tasks", "calendar"]
TimeFormat = Literal["12h", "24h"]
DayEndsAt = Annotated[int, Field(ge=0, le=4)]
KeepBackups = Literal[7, 14, 30]
BackupFolder = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
]


class SettingsUpdate(BaseModel):
    """Only the fields sent are changed. Sending null for backup_folder means the default
    folder next to the database."""

    model_config = ConfigDict(extra="forbid")

    open_on_start: OpenOnStart | None = None
    time_format: TimeFormat | None = None
    day_ends_at: DayEndsAt | None = None
    auto_backup: bool | None = None
    keep_backups: KeepBackups | None = None
    backup_folder: BackupFolder | None = None

    @field_validator(
        "open_on_start", "time_format", "day_ends_at", "auto_backup", "keep_backups", mode="before"
    )
    @classmethod
    def _reject_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("This field can't be null")
        return value


class SettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    open_on_start: OpenOnStart
    time_format: TimeFormat
    day_ends_at: int
    auto_backup: bool
    keep_backups: KeepBackups
    backup_folder: str | None
    updated_at: UtcDatetime
