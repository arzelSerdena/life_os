"""Import every model here so Alembic autogenerate can see it through `Base.metadata`."""

from app.models.base import Base, BaseMixin
from app.models.life_area import LifeArea

__all__ = ["Base", "BaseMixin", "LifeArea"]
