"""The app's idea of "today" and "now". Tests replace these to pin the time."""

from datetime import UTC, date, datetime


def today() -> date:
    """The local calendar date. The backend runs on the user's own machine."""
    return date.today()


def now() -> datetime:
    """The local wall-clock time, naive. Event times are floating local times."""
    return datetime.now()


def local_date(moment: datetime) -> date:
    """The local calendar date of a naive UTC timestamp."""
    return moment.replace(tzinfo=UTC).astimezone().date()
