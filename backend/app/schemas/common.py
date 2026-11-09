from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints


def _mark_as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC)


# SQLite returns naive datetimes. Marking them as UTC makes the API output end in "Z".
UtcDatetime = Annotated[datetime, AfterValidator(_mark_as_utc)]

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Notes = Annotated[str, StringConstraints(max_length=50_000)]


class ErrorResponse(BaseModel):
    detail: str
