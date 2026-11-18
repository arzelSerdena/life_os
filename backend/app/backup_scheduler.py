"""Runs the daily automatic backup while the server is up."""

import asyncio
import logging

from app.db import get_session_factory
from app.services.backups import back_up_if_due

logger = logging.getLogger(__name__)

# How often to check whether today's backup is due. Checking, not backing up: there is
# one automatic backup a day.
CHECK_EVERY_SECONDS = 15 * 60


def _back_up_if_due() -> None:
    try:
        with get_session_factory()() as session:
            back_up_if_due(session)
    except Exception:
        logger.exception("The automatic backup check failed")


async def run_backup_scheduler() -> None:
    while True:
        await asyncio.to_thread(_back_up_if_due)
        await asyncio.sleep(CHECK_EVERY_SECONDS)
