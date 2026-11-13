"""The app's idea of "today". Tests replace it to pin the date."""

from datetime import date


def today() -> date:
    """The local calendar date. The backend runs on the user's own machine."""
    return date.today()
