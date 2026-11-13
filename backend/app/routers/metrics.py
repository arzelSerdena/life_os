from datetime import date
from typing import Any

from fastapi import APIRouter, status

from app.db import SessionDep
from app.models import Metric, MetricTarget
from app.schemas.common import ErrorResponse
from app.schemas.metric import (
    EntryCreate,
    EntryRead,
    EntryUpdate,
    MetricChange,
    MetricCreate,
    MetricMove,
    MetricRead,
    MetricUpdate,
    PeriodRead,
    TargetCreate,
    TargetRead,
    TargetReplace,
)
from app.services import metric_targets
from app.services import metrics as service

router = APIRouter(prefix="/api", tags=["metrics"])

NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
CONFLICT: dict[int | str, dict[str, Any]] = {409: {"model": ErrorResponse}}


def _period(result: metric_targets.PeriodResult | None) -> PeriodRead | None:
    if result is None:
        return None
    return PeriodRead(
        start=result.start,
        end=result.end,
        value=result.value,
        status=result.status,  # type: ignore[arg-type]
    )


def _target(metric: Metric, target: MetricTarget) -> TargetRead:
    state = metric_targets.evaluate(metric, target)
    return TargetRead(
        id=target.id,
        metric_id=target.metric_id,
        kind=target.kind,  # type: ignore[arg-type]
        target_value=target.target_value,
        period=target.period,  # type: ignore[arg-type]
        start_date=target.start_date,
        end_date=target.end_date,
        state=state.state,  # type: ignore[arg-type]
        value=state.value,
        current_period=_period(state.current_period),
        recent_periods=[p for p in map(_period, state.recent_periods) if p is not None],
        met_periods=state.met_periods,
        missed_periods=state.missed_periods,
    )


def _read(metric: Metric) -> MetricRead:
    return MetricRead(
        id=metric.id,
        life_area_id=metric.life_area_id,
        project_id=metric.project_id,
        title=metric.title,
        notes=metric.notes,
        unit=metric.unit,
        aggregation=metric.aggregation,  # type: ignore[arg-type]
        direction=metric.direction,  # type: ignore[arg-type]
        sort_order=metric.sort_order,
        archived_at=metric.archived_at,
        created_at=metric.created_at,
        updated_at=metric.updated_at,
        targets=[_target(metric, target) for target in metric.targets],
    )


# ---------- Metrics ----------


@router.get("/metrics")
def list_metrics(
    session: SessionDep,
    life_area_id: int | None = None,
    project_id: int | None = None,
    include_archived: bool = False,
) -> list[MetricRead]:
    """Metrics with their targets and how each target is going."""
    found = service.list_metrics(
        session,
        life_area_id=life_area_id,
        project_id=project_id,
        include_archived=include_archived,
    )
    return [_read(metric) for metric in found]


@router.post("/metrics", status_code=status.HTTP_201_CREATED, responses=CONFLICT)
def create_metric(session: SessionDep, data: MetricCreate) -> MetricRead:
    return _read(service.create_metric(session, data))


@router.get("/metrics/{metric_id}", responses=NOT_FOUND)
def get_metric(session: SessionDep, metric_id: int) -> MetricRead:
    return _read(service.get_metric(session, metric_id))


@router.patch("/metrics/{metric_id}", responses=NOT_FOUND)
def update_metric(session: SessionDep, metric_id: int, data: MetricUpdate) -> MetricRead:
    return _read(service.update_metric(session, metric_id, data))


@router.post("/metrics/{metric_id}/move", responses={**NOT_FOUND, **CONFLICT})
def move_metric(session: SessionDep, metric_id: int, data: MetricMove) -> MetricChange:
    metric, batch_id = service.move_metric(session, metric_id, data)
    return MetricChange(metric=_read(metric), batch_id=batch_id)


@router.post("/metrics/{metric_id}/archive", responses=NOT_FOUND)
def archive_metric(session: SessionDep, metric_id: int) -> MetricChange:
    metric, batch_id = service.archive_metric(session, metric_id)
    return MetricChange(metric=_read(metric), batch_id=batch_id)


@router.post("/metrics/{metric_id}/unarchive", responses={**NOT_FOUND, **CONFLICT})
def unarchive_metric(session: SessionDep, metric_id: int) -> MetricChange:
    metric, batch_id = service.unarchive_metric(session, metric_id)
    return MetricChange(metric=_read(metric), batch_id=batch_id)


@router.delete("/metrics/{metric_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_metric(session: SessionDep, metric_id: int) -> None:
    """Delete the metric with all its entries and targets."""
    service.delete_metric(session, metric_id)


# ---------- Entries ----------


@router.get("/metrics/{metric_id}/entries", responses=NOT_FOUND)
def list_metric_entries(
    session: SessionDep, metric_id: int, first: date | None = None, last: date | None = None
) -> list[EntryRead]:
    entries = service.list_entries(session, metric_id, first, last)
    return [EntryRead.model_validate(entry) for entry in entries]


@router.post(
    "/metrics/{metric_id}/entries",
    status_code=status.HTTP_201_CREATED,
    responses={**NOT_FOUND, **CONFLICT},
)
def create_metric_entry(session: SessionDep, metric_id: int, data: EntryCreate) -> EntryRead:
    return EntryRead.model_validate(service.add_entry(session, metric_id, data))


@router.patch("/metric-entries/{entry_id}", responses={**NOT_FOUND, **CONFLICT})
def update_metric_entry(session: SessionDep, entry_id: int, data: EntryUpdate) -> EntryRead:
    return EntryRead.model_validate(service.update_entry(session, entry_id, data))


@router.delete(
    "/metric-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND
)
def delete_metric_entry(session: SessionDep, entry_id: int) -> None:
    service.delete_entry(session, entry_id)


# ---------- Targets ----------


@router.post(
    "/metrics/{metric_id}/targets",
    status_code=status.HTTP_201_CREATED,
    responses={**NOT_FOUND, **CONFLICT},
)
def create_metric_target(session: SessionDep, metric_id: int, data: TargetCreate) -> TargetRead:
    target = service.add_target(session, metric_id, data)
    return _target(service.get_metric(session, metric_id), target)


@router.post("/metric-targets/{target_id}/replace", responses={**NOT_FOUND, **CONFLICT})
def replace_metric_target(session: SessionDep, target_id: int, data: TargetReplace) -> TargetRead:
    """Change a target: it ends yesterday and the changed one starts today."""
    target = service.replace_target(session, target_id, data)
    return _target(service.get_metric(session, target.metric_id), target)


@router.delete(
    "/metric-targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND
)
def delete_metric_target(session: SessionDep, target_id: int) -> None:
    service.delete_target(session, target_id)
