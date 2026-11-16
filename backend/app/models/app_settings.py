from sqlalchemy import Boolean, CheckConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AUTOINCREMENT, Base, BaseMixin


class AppSettings(BaseMixin, Base):
    """The one row (id = 1) of app settings. Named so it doesn't clash with
    `app.config.Settings`, the server's environment config."""

    __tablename__ = "settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="single_row"),
        CheckConstraint("open_on_start IN ('home', 'tasks', 'calendar')", name="open_on_start"),
        CheckConstraint("time_format IN ('12h', '24h')", name="time_format"),
        CheckConstraint("day_ends_at BETWEEN 0 AND 4", name="day_ends_at"),
        CheckConstraint("auto_backup IN (0, 1)", name="auto_backup"),
        CheckConstraint("keep_backups IN (7, 14, 30)", name="keep_backups"),
        AUTOINCREMENT,
    )

    open_on_start: Mapped[str] = mapped_column(Text, default="home", server_default="home")
    time_format: Mapped[str] = mapped_column(Text, default="12h", server_default="12h")
    day_ends_at: Mapped[int] = mapped_column(default=0, server_default="0")
    auto_backup: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    keep_backups: Mapped[int] = mapped_column(default=14, server_default="14")
    # NULL means the default folder next to the database.
    backup_folder: Mapped[str | None] = mapped_column(Text)
