"""record routine logs for undo

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-17 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: str | Sequence[str] | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_TYPES = (
    "life_area",
    "project",
    "task_template",
    "task",
    "subtask",
    "event",
    "event_exception",
    "metric",
    "routine",
    "routine_step",
)
NEW_TYPES = (*OLD_TYPES, "routine_log")


def _check(types: tuple[str, ...]) -> str:
    return "entity_type IN (" + ", ".join(f"'{name}'" for name in types) + ")"


def upgrade() -> None:
    """status_changes may record routine logs, so checking off or skipping can be undone."""
    with op.batch_alter_table(
        "status_changes", table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint(op.f("ck_status_changes_entity_type_values"), type_="check")
        batch_op.create_check_constraint("entity_type_values", _check(NEW_TYPES))


def downgrade() -> None:
    op.execute("DELETE FROM status_changes WHERE entity_type = 'routine_log'")
    with op.batch_alter_table(
        "status_changes", table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint(op.f("ck_status_changes_entity_type_values"), type_="check")
        batch_op.create_check_constraint("entity_type_values", _check(OLD_TYPES))
