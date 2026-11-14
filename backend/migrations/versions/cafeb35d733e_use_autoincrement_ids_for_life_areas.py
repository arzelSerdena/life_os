"""use autoincrement ids for life areas

Revision ID: cafeb35d733e
Revises: a4001c9d8a81
Create Date: 2026-11-13 14:27:08.412019

SQLite can only add AUTOINCREMENT by rebuilding the table. The full table is
spelled out here, so the rebuild keeps every CHECK constraint, and so this
migration stays correct when the model changes later.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cafeb35d733e"
down_revision: str | Sequence[str] | None = "a4001c9d8a81"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _life_areas_table() -> sa.Table:
    return sa.Table(
        "life_areas",
        sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("vision", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("color", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("length(title) BETWEEN 1 AND 200", name="ck_life_areas_title_length"),
        sa.CheckConstraint(
            "notes IS NULL OR length(notes) <= 50000", name="ck_life_areas_notes_length"
        ),
        sa.CheckConstraint(
            "vision IS NULL OR length(vision) <= 2000", name="ck_life_areas_vision_length"
        ),
    )


def _rebuild_life_areas(*, autoincrement: bool) -> None:
    with op.batch_alter_table(
        "life_areas",
        copy_from=_life_areas_table(),
        recreate="always",
        table_kwargs={"sqlite_autoincrement": autoincrement},
    ):
        pass


def upgrade() -> None:
    _rebuild_life_areas(autoincrement=True)


def downgrade() -> None:
    _rebuild_life_areas(autoincrement=False)
