from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BaseMixin


class LifeArea(BaseMixin, Base):
    __tablename__ = "life_areas"
    __table_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("vision IS NULL OR length(vision) <= 2000", name="vision_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 50000", name="notes_length"),
    )

    title: Mapped[str] = mapped_column(Text)
    vision: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)
