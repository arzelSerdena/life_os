from pydantic import BaseModel

from app.services.search import SearchHit, SearchKind


class SearchHitRead(BaseModel):
    """One item the palette can jump to. `status` is set for projects and tasks. The life
    area fields describe the item's area (an area's own, for an area); a task in the Inbox
    has none. `project_*` is set for a task in a project."""

    kind: SearchKind
    id: int
    title: str
    status: str | None
    life_area_id: int | None
    life_area_title: str | None
    life_area_color: str | None
    project_id: int | None
    project_title: str | None

    @classmethod
    def of(cls, hit: SearchHit) -> SearchHitRead:
        return cls(**hit.__dict__)
