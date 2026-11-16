"""The app's idea of "today" and "now". Tests replace these to pin the time.

"Today" follows the `day_ends_at` setting: until that hour, the previous date is still
today. `app.services.settings` sets it at the start of every request.
"""

from datetime import UTC, date, datetime, timedelta

_day_ends_at = 0


def set_day_ends_at(hour: int) -> None:
    """Set the hour (0 to 4) at which one day ends and the next begins."""
    global _day_ends_at
    _day_ends_at = hour


def day_ends_at() -> int:
    return _day_ends_at


def today() -> date:
    """The local calendar date, shifted by `day_ends_at`. The backend runs on the user's
    own machine."""
    return (now() - timedelta(hours=_day_ends_at)).date()


def now() -> datetime:
    """The local wall-clock time, naive. Event times are floating local times."""
    return datetime.now()


def local_date(moment: datetime) -> date:
    """The day a naive UTC timestamp counts for: its local date, shifted by `day_ends_at`
    like `today()`, so a task done at 1 AM before a 2 AM day end counts for the day before."""
    local = moment.replace(tzinfo=UTC).astimezone().replace(tzinfo=None)
    return (local - timedelta(hours=_day_ends_at)).date()
