from fastapi import APIRouter, Response, status

from app.config import app_version
from app.db import SessionDep
from app.schemas.backups import (
    AboutRead,
    BackupFailureRead,
    BackupRead,
    BackupsRead,
    OpenFolderRequest,
    RestoreRead,
    RestoreRequest,
)
from app.services import backups as service
from app.services import export

router = APIRouter(prefix="/api", tags=["backups"])


@router.get("/backups")
def list_backups(session: SessionDep) -> BackupsRead:
    """The backup folder, whether it exists, its backups newest first, and the last failed
    backup when none has worked since."""
    backup_status = service.get_status(session)
    failure = backup_status.last_failure
    return BackupsRead(
        folder=str(backup_status.folder),
        folder_found=backup_status.folder_found,
        backups=[BackupRead.model_validate(backup) for backup in backup_status.backups],
        last_failure=BackupFailureRead.model_validate(failure) if failure else None,
        auto_backup_hour=service.AUTO_BACKUP_HOUR,
    )


@router.post("/backups", status_code=status.HTTP_201_CREATED)
def back_up_now(session: SessionDep) -> BackupRead:
    """Backs up the data now. While automatic backups are on, only the newest Keep last
    backups are kept. 409 when the folder is missing or can't be written to."""
    return BackupRead.model_validate(service.back_up(session))


@router.post("/backups/restore")
def restore_backup(session: SessionDep, data: RestoreRequest) -> RestoreRead:
    """Replaces all data with a backup, after backing up the current data. Settings stay as
    they are. An older backup is migrated to the current version first; 409 for a backup
    from a newer version."""
    restored, current = service.restore(session, data.name)
    return RestoreRead(
        restored=BackupRead.model_validate(restored),
        current_data_backup=BackupRead.model_validate(current),
    )


@router.post("/folders/open", status_code=status.HTTP_204_NO_CONTENT)
def open_folder(session: SessionDep, data: OpenFolderRequest) -> None:
    """Shows the backup folder or the database's folder in the file manager."""
    service.open_folder(session, data.folder)


@router.get(
    "/export",
    response_class=Response,
    responses={
        200: {
            "content": {"application/zip": {"schema": {"type": "string", "format": "binary"}}},
            "description": "A zip with one CSV per table",
        }
    },
)
def export_data(session: SessionDep) -> Response:
    name, content = export.export_zip(session)
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/about")
def get_about(session: SessionDep) -> AboutRead:
    return AboutRead(version=app_version(), database_path=str(service.database_path(session)))
