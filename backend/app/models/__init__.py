"""Import every model here so Alembic autogenerate can see it through `Base.metadata`."""

from app.models.base import Base, BaseMixin

__all__ = ["Base", "BaseMixin"]
