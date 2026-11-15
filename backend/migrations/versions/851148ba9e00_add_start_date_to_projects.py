"""add start date to projects

Revision ID: 851148ba9e00
Revises: b7c1d2e3f4a5
Create Date: 2026-11-15 14:17:04.868299

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "851148ba9e00"
down_revision: str | Sequence[str] | None = "b7c1d2e3f4a5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Autogenerate misses the CHECK, so it is added by hand. The table is rebuilt, so it
    # must keep AUTOINCREMENT.
    with op.batch_alter_table(
        "projects", schema=None, table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.add_column(sa.Column("start_date", sa.Date(), nullable=True))
        batch_op.create_check_constraint(
            op.f("ck_projects_due_after_start"),
            "start_date IS NULL OR due_date IS NULL OR due_date >= start_date",
        )


def downgrade() -> None:
    with op.batch_alter_table(
        "projects", schema=None, table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint(op.f("ck_projects_due_after_start"), type_="check")
        batch_op.drop_column("start_date")
