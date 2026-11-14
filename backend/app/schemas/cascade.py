from typing import Literal

from pydantic import BaseModel

from app.schemas.life_area import LifeAreaRead
from app.services import cascades as service

ItemKind = Literal["project", "task", "task_template", "event", "metric", "routine_step"]
Effect = Literal["archive", "cancel", "end_series"]


class CascadeItemRead(BaseModel):
    kind: ItemKind
    id: int
    title: str
    effect: Effect


class CascadePreview(BaseModel):
    """Everything a change would also do to the items inside, for the user to confirm.
    Applying it records one batch, which undo restores in one step."""

    items: list[CascadeItemRead]

    @classmethod
    def from_plan(cls, plan: service.Plan) -> CascadePreview:
        return cls(
            items=[
                CascadeItemRead(
                    kind=effect.kind,  # type: ignore[arg-type]
                    id=effect.item.id,  # type: ignore[attr-defined]
                    title=effect.title,
                    effect=effect.effect,  # type: ignore[arg-type]
                )
                for effect in plan.effects
            ]
        )


class LifeAreaChange(BaseModel):
    """The area after the change, and the batch to pass to undo (None if nothing changed)."""

    life_area: LifeAreaRead
    batch_id: str | None
