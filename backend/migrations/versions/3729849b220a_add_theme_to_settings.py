"""add theme to settings

Revision ID: 3729849b220a
Revises: 76725818fafe
Create Date: 2026-11-26 16:57:21.251077

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3729849b220a"
down_revision: str | Sequence[str] | None = "76725818fafe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table(
        "settings", schema=None, table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.add_column(sa.Column("theme", sa.Text(), server_default="system", nullable=False))
        batch_op.create_check_constraint("theme", "theme IN ('system', 'light', 'dark')")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table(
        "settings", schema=None, table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint("theme", type_="check")
        batch_op.drop_column("theme")
