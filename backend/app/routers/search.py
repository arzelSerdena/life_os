from typing import Annotated

from fastapi import APIRouter, Query

from app.db import SessionDep
from app.schemas.search import SearchHitRead
from app.services import search as service

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search")
def search(
    session: SessionDep,
    q: Annotated[str, Query(max_length=200)],
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> list[SearchHitRead]:
    """Life areas, projects, routines and tasks whose title contains `q` (case-insensitive),
    up to `limit` of each, in that order; titles starting with `q` first. Archived items and
    cancelled tasks are left out. A blank `q` finds nothing."""
    return [SearchHitRead.of(hit) for hit in service.search(session, q, limit)]
