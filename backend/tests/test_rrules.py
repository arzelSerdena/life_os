from datetime import date

import pytest

from app import rrules


def test_normalize_uppercases_and_strips_the_prefix() -> None:
    assert rrules.normalize("rrule:freq=weekly;byday=mo,th") == "FREQ=WEEKLY;BYDAY=MO,TH"


@pytest.mark.parametrize(
    "rule",
    [
        "",
        "BYDAY=MO",  # no FREQ
        "FREQ=HOURLY",  # dates only
        "FREQ=WEEKLY;COUNT=5",
        "FREQ=WEEKLY;UNTIL=20261231",
        "DTSTART=20261116;FREQ=DAILY",
        "FREQ=WEEKLY;BYDAY=XX",
        "FREQ=WEEKLY;BYDAY",
    ],
)
def test_normalize_rejects_invalid_rules(rule: str) -> None:
    with pytest.raises(ValueError):
        rrules.normalize(rule)


def test_dates_between_respects_the_series_start_and_end() -> None:
    days = rrules.dates_between(
        "FREQ=WEEKLY;BYDAY=MO,TH",
        starts_on=date(2026, 11, 17),
        ends_on=date(2026, 11, 26),
        first=date(2026, 11, 1),
        last=date(2026, 12, 31),
    )

    assert days == [date(2026, 11, 19), date(2026, 11, 23), date(2026, 11, 26)]


def test_dates_between_counts_intervals_from_the_series_start() -> None:
    days = rrules.dates_between(
        "FREQ=WEEKLY;INTERVAL=2",
        starts_on=date(2026, 11, 2),
        ends_on=None,
        first=date(2026, 11, 16),
        last=date(2026, 11, 30),
    )

    assert days == [date(2026, 11, 16), date(2026, 11, 30)]


def test_next_after_counts_from_the_given_day() -> None:
    assert rrules.next_after("FREQ=WEEKLY;INTERVAL=6", date(2026, 11, 16), None) == date(
        2026, 12, 28
    )
    assert rrules.next_after("FREQ=WEEKLY", date(2026, 11, 16), date(2026, 11, 20)) is None
