from fastapi import APIRouter

from app.db import SessionDep
from app.schemas.home import HomeRead
from app.services import home as service

router = APIRouter(prefix="/api", tags=["home"])


@router.get("/home")
def get_home(session: SessionDep) -> HomeRead:
    """Today, right now: today's tasks (overdue ones apart), events, project due dates and
    deadlines; the routine steps due today; manual metrics still to log today; what needs a
    push (the Inbox count, projects due soon, stalled or with no next step, and metrics
    behind target); and the next 7 days' events, project due dates and deadlines.

    Like the day boards, it first rolls unfinished tasks over to today and creates today's
    recurring tasks. Calling it again changes nothing."""
    return HomeRead.from_home(service.get_home(session))
