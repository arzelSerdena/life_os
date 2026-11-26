"""add start and end time to routines

Revision ID: 76725818fafe
Revises: c0a0af1d1d36
Create Date: 2026-11-26 16:34:10.671522

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "76725818fafe"
down_revision: str | Sequence[str] | None = "c0a0af1d1d36"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table(
        "routines", schema=None, table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.add_column(sa.Column("start_time", sa.Time(), nullable=True))
        batch_op.add_column(sa.Column("end_time", sa.Time(), nullable=True))
        batch_op.create_check_constraint(
            "end_time_needs_start", "end_time IS NULL OR start_time IS NOT NULL"
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table(
        "routines", schema=None, table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint("end_time_needs_start", type_="check")
        batch_op.drop_column("end_time")
        batch_op.drop_column("start_time")
