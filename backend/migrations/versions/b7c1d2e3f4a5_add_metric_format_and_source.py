"""add metric format and source

Revision ID: b7c1d2e3f4a5
Revises: 5ee4bc787cae
Create Date: 2026-11-14 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7c1d2e3f4a5"
down_revision: str | Sequence[str] | None = "5ee4bc787cae"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UNIT_FOR_FORMAT = (
    "(format = 'number' AND (unit IS NULL OR length(unit) BETWEEN 1 AND 20))"
    " OR (format = 'currency' AND unit IS NOT NULL AND unit GLOB '[A-Z][A-Z][A-Z]')"
    " OR (format IN ('percent', 'duration') AND unit IS NULL)"
)
ROUTINE_STEP_DISPLAY = (
    "source = 'manual'"
    " OR (aggregation = 'sum' AND format = 'number' AND unit = 'days')"
    " OR (aggregation = 'average' AND format = 'percent')"
)


def upgrade() -> None:
    """Upgrade schema.

    Existing metrics become manual numbers; their units already fit a number's suffix.
    """
    with op.batch_alter_table(
        "metrics", schema=None, table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.add_column(sa.Column("format", sa.Text(), server_default="number", nullable=False))
        batch_op.add_column(sa.Column("source", sa.Text(), server_default="manual", nullable=False))
        batch_op.add_column(sa.Column("routine_step_id", sa.Integer(), nullable=True))
        batch_op.drop_constraint(op.f("ck_metrics_unit_length"), type_="check")
        batch_op.create_check_constraint(
            op.f("ck_metrics_format_values"),
            "format IN ('number', 'currency', 'percent', 'duration')",
        )
        batch_op.create_check_constraint(op.f("ck_metrics_unit_for_format"), UNIT_FOR_FORMAT)
        batch_op.create_check_constraint(
            op.f("ck_metrics_source_values"), "source IN ('manual', 'routine_step')"
        )
        batch_op.create_check_constraint(
            op.f("ck_metrics_step_for_source"),
            "(source = 'routine_step') = (routine_step_id IS NOT NULL)",
        )
        batch_op.create_check_constraint(
            op.f("ck_metrics_routine_step_display"), ROUTINE_STEP_DISPLAY
        )
        batch_op.create_foreign_key(
            op.f("fk_metrics_routine_step_id_routine_steps"),
            "routine_steps",
            ["routine_step_id"],
            ["id"],
        )
        batch_op.create_index("idx_metrics_routine_step", ["routine_step_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema.

    Routine-step metrics can't exist without their source, so they are removed with
    their targets (foreign keys are off during migrations, so nothing cascades). Every
    other unit still fits the old 1-20 character rule.
    """
    step_metrics = "SELECT id FROM metrics WHERE source = 'routine_step'"
    op.execute(f"DELETE FROM metric_targets WHERE metric_id IN ({step_metrics})")
    op.execute(f"DELETE FROM metric_entries WHERE metric_id IN ({step_metrics})")
    op.execute("DELETE FROM metrics WHERE source = 'routine_step'")
    with op.batch_alter_table(
        "metrics", schema=None, table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_index("idx_metrics_routine_step")
        batch_op.drop_constraint(
            op.f("fk_metrics_routine_step_id_routine_steps"), type_="foreignkey"
        )
        batch_op.drop_constraint(op.f("ck_metrics_routine_step_display"), type_="check")
        batch_op.drop_constraint(op.f("ck_metrics_step_for_source"), type_="check")
        batch_op.drop_constraint(op.f("ck_metrics_source_values"), type_="check")
        batch_op.drop_constraint(op.f("ck_metrics_unit_for_format"), type_="check")
        batch_op.drop_constraint(op.f("ck_metrics_format_values"), type_="check")
        batch_op.create_check_constraint(
            op.f("ck_metrics_unit_length"), "unit IS NULL OR length(unit) BETWEEN 1 AND 20"
        )
        batch_op.drop_column("routine_step_id")
        batch_op.drop_column("source")
        batch_op.drop_column("format")
