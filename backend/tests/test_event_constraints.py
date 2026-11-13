"""Event rules the database enforces on its own, so they hold even if the service is bypassed."""

from datetime import date, time
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Event, EventException
from tests.factories import make_life_area


def _event(life_area_id: int, **fields: Any) -> Event:
    return Event(
        **{"life_area_id": life_area_id, "title": "Gym", "start_date": date(2026, 11, 16), **fields}
    )


@pytest.mark.parametrize(
    "fields",
    [
        {"start_time": time(10), "end_time": time(9)},  # same day, no end date
        {"end_date": date(2026, 11, 16), "start_time": time(10), "end_time": time(9)},
        {"end_date": date(2026, 11, 15)},
        {"end_time": time(9)},  # no start time
        {"repeat_ends_on": date(2026, 12, 1)},  # no rule
        {"rrule": "FREQ=WEEKLY", "repeat_ends_on": date(2026, 11, 1)},
    ],
)
def test_invalid_events_are_rejected(session: Session, fields: dict[str, Any]) -> None:
    session.add(_event(make_life_area(session).id, **fields))

    with pytest.raises(IntegrityError):
        session.commit()


def test_an_overnight_event_is_allowed(session: Session) -> None:
    session.add(
        _event(
            make_life_area(session).id,
            end_date=date(2026, 11, 17),
            start_time=time(22),
            end_time=time(6),
        )
    )
    session.commit()


def test_one_exception_per_occurrence(session: Session) -> None:
    event = _event(make_life_area(session).id, rrule="FREQ=WEEKLY")
    event.exceptions = [
        EventException(occurrence_date=date(2026, 11, 23)),
        EventException(occurrence_date=date(2026, 11, 23), is_cancelled=True),
    ]
    session.add(event)

    with pytest.raises(IntegrityError):
        session.commit()
