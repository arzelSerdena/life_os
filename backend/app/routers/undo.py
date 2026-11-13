from typing import Any

from fastapi import APIRouter

from app.db import SessionDep
from app.schemas.common import ErrorResponse
from app.schemas.task import UndoResult
from app.services.history import undo_batch as undo

router = APIRouter(prefix="/api", tags=["undo"])

RESPONSES: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
}


@router.post("/undo/{batch_id}", responses=RESPONSES)
def undo_batch(session: SessionDep, batch_id: str) -> UndoResult:
    """Restore everything one change did, using the batch_id it returned."""
    return UndoResult(restored_items=undo(session, batch_id))
