import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel
from sqlalchemy import text

from app.backup_scheduler import run_backup_scheduler
from app.config import get_settings
from app.db import SessionDep
from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.routers import (
    app_settings,
    archive,
    backups,
    events,
    home,
    life_areas,
    metrics,
    projects,
    routines,
    search,
    task_templates,
    tasks,
    undo,
    week,
)
from app.services.app_settings import apply_day_ends_at


def _operation_id(route: APIRoute) -> str:
    """Use the function name, so the generated client gets names like `listLifeAreas`."""
    return route.name


def _apply_settings(session: SessionDep) -> None:
    """Every request sees today as the `day_ends_at` setting defines it."""
    apply_day_ends_at(session)


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Runs the daily automatic backup in the background while the server is up."""
    scheduler = (
        asyncio.create_task(run_backup_scheduler()) if get_settings().backup_scheduler else None
    )
    yield
    if scheduler:
        scheduler.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await scheduler


app = FastAPI(
    title="Life OS API",
    lifespan=_lifespan,
    generate_unique_id_function=_operation_id,
    dependencies=[Depends(_apply_settings)],
)
app.include_router(app_settings.router)
app.include_router(archive.router)
app.include_router(backups.router)
app.include_router(home.router)
app.include_router(life_areas.router)
app.include_router(projects.router)
app.include_router(metrics.router)
app.include_router(tasks.router)
app.include_router(task_templates.router)
app.include_router(events.router)
app.include_router(week.router)
app.include_router(routines.router)
app.include_router(search.router)
app.include_router(undo.router)


@app.exception_handler(NotFoundError)
def handle_not_found(_request: Request, error: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(error)})


@app.exception_handler(ConflictError)
def handle_conflict(_request: Request, error: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": str(error)})


@app.exception_handler(UnprocessableError)
def handle_unprocessable(_request: Request, error: UnprocessableError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": str(error)}
    )


class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/api/health")
def health(session: SessionDep) -> HealthResponse:
    session.execute(text("SELECT 1"))
    return HealthResponse(status="ok")
