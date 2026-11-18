from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BackupRead(BaseModel):
    """A backup file in the backup folder. `created_at` is the local wall-clock time it was
    taken, from its file name."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    created_at: datetime
    size: int = Field(description="Bytes")


class BackupFailureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    at: datetime = Field(description="Local wall-clock time")
    message: str


class BackupsRead(BaseModel):
    """The backup folder and what is in it, newest first."""

    folder: str
    folder_found: bool
    backups: list[BackupRead]
    last_failure: BackupFailureRead | None = Field(
        description="The last backup that failed, if none has worked since"
    )
    auto_backup_hour: int = Field(description="Automatic backups run daily from this hour")


class RestoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str


class RestoreRead(BaseModel):
    restored: BackupRead
    current_data_backup: BackupRead = Field(
        description="The backup of the data the restore replaced"
    )


class OpenFolderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    folder: Literal["backups", "database"]


class AboutRead(BaseModel):
    version: str
    database_path: str
