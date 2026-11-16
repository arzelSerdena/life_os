from pydantic import BaseModel

from app.schemas.life_area import LifeAreaRead


class LifeAreaChange(BaseModel):
    """The area after the change, and the batch to pass to undo (None if nothing changed)."""

    life_area: LifeAreaRead
    batch_id: str | None
