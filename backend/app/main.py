from typing import Literal

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel
from sqlalchemy import text

from app.db import SessionDep
from app.errors import ConflictError, NotFoundError, UnprocessableError
from app.routers import events, life_areas, routines, task_templates, tasks, undo, week


def _operation_id(route: APIRoute) -> str:
    """Use the function name, so the generated client gets names like `listLifeAreas`."""
    return route.name


app = FastAPI(title="Life OS API", generate_unique_id_function=_operation_id)
app.include_router(life_areas.router)
app.include_router(tasks.router)
app.include_router(task_templates.router)
app.include_router(events.router)
app.include_router(week.router)
app.include_router(routines.router)
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
