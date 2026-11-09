from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_session

app = FastAPI(title="Life OS API")


class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/api/health")
def health(session: Annotated[Session, Depends(get_session)]) -> HealthResponse:
    session.execute(text("SELECT 1"))
    return HealthResponse(status="ok")
