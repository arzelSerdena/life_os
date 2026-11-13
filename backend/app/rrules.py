"""Repeat rules in iCalendar RRULE format, for dates (no times).

The start and end of a series live in their own columns (starts_on, ends_on), so a rule
may not carry DTSTART, UNTIL or COUNT. That keeps "this and following" a simple split.
"""

from datetime import date, datetime, time
from typing import cast

from dateutil.rrule import rrule, rrulestr

FREQUENCIES = ("DAILY", "WEEKLY", "MONTHLY", "YEARLY")
BLOCKED_PARTS = {"DTSTART", "UNTIL", "COUNT"}


def normalize(rule: str) -> str:
    """Validate a rule and return it in a canonical form. Raises ValueError if invalid."""
    text = rule.strip()
    if text.upper().startswith("RRULE:"):
        text = text[len("RRULE:") :]

    parts: dict[str, str] = {}
    for part in filter(None, text.split(";")):
        key, separator, value = part.partition("=")
        if not separator or not key.strip() or not value.strip():
            raise ValueError(f"'{part}' isn't a valid part of a repeat rule.")
        parts[key.strip().upper()] = value.strip().upper()

    if parts.get("FREQ") not in FREQUENCIES:
        raise ValueError("A repeat rule needs FREQ set to DAILY, WEEKLY, MONTHLY or YEARLY.")
    if blocked := sorted(BLOCKED_PARTS & parts.keys()):
        raise ValueError(
            f"Use starts_on and ends_on for the start and end, not {', '.join(blocked)}."
        )

    normalized = ";".join(f"{key}={value}" for key, value in parts.items())
    try:
        _rule(normalized, date(2026, 1, 1))
    except (ValueError, TypeError) as error:
        raise ValueError(f"Invalid repeat rule: {error}") from error
    return normalized


def dates_between(
    rule: str, starts_on: date, ends_on: date | None, first: date, last: date
) -> list[date]:
    """The series' dates from first to last, both included."""
    low = max(first, starts_on)
    high = last if ends_on is None else min(last, ends_on)
    if low > high:
        return []
    occurrences = _rule(rule, starts_on).between(_midnight(low), _midnight(high), inc=True)
    return [occurrence.date() for occurrence in occurrences]


def next_after(rule: str, day: date, ends_on: date | None) -> date | None:
    """The rule's first date after `day`, counting from `day` (for "repeat from completion")."""
    following = _rule(rule, day).after(_midnight(day), inc=False)
    if following is None:
        return None
    next_day = following.date()
    return None if ends_on is not None and next_day > ends_on else next_day


def _rule(rule: str, start: date) -> rrule:
    return cast(rrule, rrulestr(rule, dtstart=_midnight(start)))


def _midnight(day: date) -> datetime:
    return datetime.combine(day, time())
