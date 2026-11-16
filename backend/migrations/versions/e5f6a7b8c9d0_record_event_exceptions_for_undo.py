"""record event exceptions for undo

Revision ID: e5f6a7b8c9d0
Revises: 1ce58201dca6
Create Date: 2026-11-16 18:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | Sequence[str] | None = "1ce58201dca6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_TYPES = (
    "life_area",
    "project",
    "task_template",
    "task",
    "subtask",
    "event",
    "metric",
    "routine",
    "routine_step",
)
NEW_TYPES = (*OLD_TYPES[:6], "event_exception", *OLD_TYPES[6:])


def _check(types: tuple[str, ...]) -> str:
    return "entity_type IN (" + ", ".join(f"'{name}'" for name in types) + ")"


def upgrade() -> None:
    """status_changes may record event exceptions, so moving one occurrence can be undone."""
    with op.batch_alter_table(
        "status_changes", table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint(op.f("ck_status_changes_entity_type_values"), type_="check")
        batch_op.create_check_constraint("entity_type_values", _check(NEW_TYPES))


def downgrade() -> None:
    op.execute("DELETE FROM status_changes WHERE entity_type = 'event_exception'")
    with op.batch_alter_table(
        "status_changes", table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.drop_constraint(op.f("ck_status_changes_entity_type_values"), type_="check")
        batch_op.create_check_constraint("entity_type_values", _check(OLD_TYPES))
