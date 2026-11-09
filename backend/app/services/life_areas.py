from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ConflictError, NotFoundError
from app.models import LifeArea
from app.models.base import utc_now
from app.schemas.life_area import LifeAreaCreate, LifeAreaUpdate


def list_life_areas(session: Session, *, include_archived: bool = False) -> Sequence[LifeArea]:
    query = select(LifeArea).order_by(LifeArea.sort_order, LifeArea.id)
    if not include_archived:
        query = query.where(LifeArea.archived_at.is_(None))
    return session.scalars(query).all()


def get_life_area(session: Session, life_area_id: int) -> LifeArea:
    life_area = session.get(LifeArea, life_area_id)
    if life_area is None:
        raise NotFoundError(f"Life area {life_area_id} not found")
    return life_area


def create_life_area(session: Session, data: LifeAreaCreate) -> LifeArea:
    last_position = session.scalar(select(func.max(LifeArea.sort_order)))
    sort_order = 0 if last_position is None else last_position + 1

    life_area = LifeArea(**data.model_dump(), sort_order=sort_order)
    session.add(life_area)
    return _save(session, life_area)


def update_life_area(session: Session, life_area_id: int, data: LifeAreaUpdate) -> LifeArea:
    life_area = get_life_area(session, life_area_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(life_area, field, value)
    return _save(session, life_area)


def archive_life_area(session: Session, life_area_id: int) -> LifeArea:
    life_area = get_life_area(session, life_area_id)
    if life_area.archived_at is None:
        life_area.archived_at = utc_now()
    return _save(session, life_area)


def unarchive_life_area(session: Session, life_area_id: int) -> LifeArea:
    life_area = get_life_area(session, life_area_id)
    life_area.archived_at = None
    return _save(session, life_area)


def delete_life_area(session: Session, life_area_id: int) -> None:
    life_area = get_life_area(session, life_area_id)
    session.delete(life_area)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise ConflictError(
            f"Life area {life_area_id} still has items in it. Archive it instead."
        ) from error


def _save(session: Session, life_area: LifeArea) -> LifeArea:
    session.commit()
    session.refresh(life_area)  # picks up database-set values such as updated_at
    return life_area
