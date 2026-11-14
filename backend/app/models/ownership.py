"""Constraints shared by every item that a project or a life area can own."""

from sqlalchemy import CheckConstraint, ForeignKeyConstraint


def project_owner_keys(*, with_section: bool = False) -> tuple[ForeignKeyConstraint, ...]:
    """Keep the item in its project's life area, and its section inside its project.

    ON UPDATE CASCADE means moving a project to another life area moves its items too.
    """
    keys = [
        ForeignKeyConstraint(
            ["project_id", "life_area_id"],
            ["projects.id", "projects.life_area_id"],
            onupdate="CASCADE",
        )
    ]
    if with_section:
        keys.append(
            ForeignKeyConstraint(
                ["section_id", "project_id"],
                ["project_sections.id", "project_sections.project_id"],
            )
        )
    return tuple(keys)


def optional_owner_checks() -> tuple[CheckConstraint, ...]:
    """For items that may sit in the Inbox with no owner at all.

    SQLite skips a composite foreign key while any of its columns is NULL, so a project
    link must come with a life area or the key above would never be checked.
    """
    return (
        CheckConstraint(
            "project_id IS NULL OR life_area_id IS NOT NULL", name="project_needs_area"
        ),
        CheckConstraint(
            "section_id IS NULL OR project_id IS NOT NULL", name="section_needs_project"
        ),
    )


PRIORITY_CHECK = "priority IN ('high', 'medium', 'low', 'none')"
