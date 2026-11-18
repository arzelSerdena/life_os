"""record metric entries for undo

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-18 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: str | Sequence[str] | None = "f6a7b8c9d0e1"
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
    "routine_log",
)
NEW_TYPES = (*OLD_TYPES[:8], "metric_entry", *OLD_TYPES[8:])


def _check(types: tuple[str, ...]) -> str:
    return "entity_type IN (" + ", ".join(f"'{name}'" for name in types) + ")"


def upgrade() -> None:
    """status_changes may record metric entries, so logging a value can be undone."""
    with op.batch_alter_table(
        "status_changes", table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint(op.f("ck_status_changes_entity_type_values"), type_="check")
        batch_op.create_check_constraint("entity_type_values", _check(NEW_TYPES))


def downgrade() -> None:
    op.execute("DELETE FROM status_changes WHERE entity_type = 'metric_entry'")
    with op.batch_alter_table(
        "status_changes", table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint(op.f("ck_status_changes_entity_type_values"), type_="check")
        batch_op.create_check_constraint("entity_type_values", _check(OLD_TYPES))
