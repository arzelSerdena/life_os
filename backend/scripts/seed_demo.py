"""Seed an isolated demo SQLite database with realistic sample data across all Life OS screens.

Usage (from `backend/`):
    uv run python scripts/seed_demo.py
    uv run python scripts/seed_demo.py --db data/demo.db
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.orm import Session, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import create_db_engine  # noqa: E402
from app.models import (  # noqa: E402
    AppSettings,
    Event,
    EventException,
    LifeArea,
    Metric,
    MetricEntry,
    MetricTarget,
    Project,
    ProjectSection,
    Routine,
    RoutineLog,
    RoutinePause,
    RoutineSchedule,
    RoutineStep,
    Subtask,
    Task,
    TaskTemplate,
    TaskTemplateSubtask,
)

DEFAULT_DEMO_DB = BACKEND_DIR / "data" / "demo.db"


def _utc_days_ago(days: int, hour: int = 10) -> datetime:
    dt = datetime.now(UTC) - timedelta(days=days)
    return dt.replace(hour=hour, minute=0, second=0, microsecond=0, tzinfo=None)


def _remove_db_files(db_path: Path) -> None:
    for suffix in ("", "-wal", "-shm"):
        candidate = Path(f"{db_path}{suffix}")
        if candidate.exists():
            try:
                candidate.unlink()
            except PermissionError as exc:
                print(
                    f"Cannot overwrite {candidate} because it is in use "
                    "(stop the running `just demo` server first).",
                    file=sys.stderr,
                )
                raise SystemExit(1) from exc


def _run_migrations(database_url: str) -> None:
    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    alembic_cfg.attributes["database_url"] = database_url
    command.upgrade(alembic_cfg, "head")


def seed_demo_data(session: Session, today: date) -> None:
    """Populate a fresh database with realistic sample entries across every feature."""
    # 1. App settings
    session.add(
        AppSettings(
            id=1,
            open_on_start="home",
            time_format="12h",
            day_ends_at=0,
            auto_backup=False,
            keep_backups=14,
        )
    )

    # 2. Life areas (all 6 palette colors + 1 archived)
    health = LifeArea(
        title="Health & Fitness",
        vision="Build steady energy, strength, and endurance without burning out.",
        notes="Training log, sleep habits, and medical checkups.",
        color="teal",
        sort_order=0,
    )
    work = LifeArea(
        title="Work & Career",
        vision="Ship thoughtful product work with calm, focused execution.",
        notes="Key deliverables, team rituals, and career growth.",
        color="blue",
        sort_order=1,
    )
    home = LifeArea(
        title="Home & Errands",
        vision="Keep our living space calm, tidy, and easy to maintain.",
        notes="Maintenance, groceries, and household organization.",
        color="ochre",
        sort_order=2,
    )
    finance = LifeArea(
        title="Finance & Admin",
        vision="Automate savings and keep paperwork effortless.",
        notes="Bills, taxes, investments, and monthly budget reviews.",
        color="plum",
        sort_order=3,
    )
    learning = LifeArea(
        title="Learning & Creative",
        vision="Stay curious through reading, writing, and side experiments.",
        notes="Books, courses, and creative notes.",
        color="terracotta",
        sort_order=4,
    )
    social = LifeArea(
        title="Relationships & Social",
        vision="Be present for family and close friends.",
        notes="Birthdays, trips, and catch-ups.",
        color="rose",
        sort_order=5,
    )
    archived_area = LifeArea(
        title="Old Side Hustle",
        vision="Archived consulting experiments from last year.",
        color="blue",
        sort_order=6,
        archived_at=_utc_days_ago(45),
    )
    session.add_all([health, work, home, finance, learning, social, archived_area])
    session.flush()

    # 3. Projects & sections
    launch = Project(
        life_area_id=work.id,
        title="Q4 Product Launch",
        notes=(
            "## Launch goals\n"
            "- Ship v2 onboarding flow\n"
            "- Publish release notes & migration guide\n"
            "- Coordinate beta customer check-ins"
        ),
        start_date=today - timedelta(days=21),
        due_date=today + timedelta(days=14),
        status="active",
        sort_order=0,
    )
    portfolio = Project(
        life_area_id=work.id,
        title="Portfolio Website Refresh",
        notes="Update case studies and simplify the contact page.",
        start_date=today - timedelta(days=7),
        due_date=today + timedelta(days=30),
        status="active",
        sort_order=1,
    )
    perf_review = Project(
        life_area_id=work.id,
        title="Annual Performance Review",
        notes="Completed self-assessment and peer feedback.",
        start_date=today - timedelta(days=40),
        due_date=today - timedelta(days=12),
        status="done",
        completed_at=_utc_days_ago(10),
        sort_order=2,
    )
    half_marathon = Project(
        life_area_id=health.id,
        title="Half Marathon Training",
        notes="12-week progressive build toward race day. Keep easy runs truly easy.",
        start_date=today - timedelta(days=30),
        due_date=today + timedelta(days=45),
        status="active",
        sort_order=0,
    )
    kitchen = Project(
        life_area_id=home.id,
        title="Kitchen Organization",
        notes="Streamline pantry jars and label spice drawers.",
        start_date=today - timedelta(days=10),
        due_date=today + timedelta(days=10),
        status="active",
        sort_order=0,
    )
    guest_room = Project(
        life_area_id=home.id,
        title="Guest Room Murphy Bed",
        notes="Decided to keep the existing daybed instead.",
        start_date=today - timedelta(days=35),
        due_date=today - timedelta(days=5),
        status="cancelled",
        cancelled_at=_utc_days_ago(20),
        sort_order=1,
    )
    spanish_archived = Project(
        life_area_id=learning.id,
        title="Spanish B1 Intensive",
        notes="Paused and archived after finishing the autumn cohort.",
        start_date=today - timedelta(days=90),
        due_date=today - timedelta(days=20),
        status="active",
        archived_at=_utc_days_ago(15),
        sort_order=0,
    )
    tax_filing = Project(
        life_area_id=finance.id,
        title="Annual Tax Filing",
        notes="Filed federal and state returns with accountant.",
        start_date=today - timedelta(days=280),
        due_date=today - timedelta(days=230),
        status="done",
        completed_at=_utc_days_ago(232),
        sort_order=0,
    )
    spring_refresh = Project(
        life_area_id=home.id,
        title="Spring Balcony & Closet Refresh",
        notes="Repotted patio herbs and donated winter coats.",
        start_date=today - timedelta(days=210),
        due_date=today - timedelta(days=175),
        status="done",
        completed_at=_utc_days_ago(176),
        sort_order=2,
    )
    ten_k_prep = Project(
        life_area_id=health.id,
        title="10K City Run Prep",
        notes="Finished in 47:20!",
        start_date=today - timedelta(days=165),
        due_date=today - timedelta(days=105),
        status="done",
        completed_at=_utc_days_ago(105),
        sort_order=1,
    )
    session.add_all(
        [
            launch,
            portfolio,
            perf_review,
            half_marathon,
            kitchen,
            guest_room,
            spanish_archived,
            tax_filing,
            spring_refresh,
            ten_k_prep,
        ]
    )
    session.flush()

    sec_design = ProjectSection(project_id=launch.id, title="Design & Spec", sort_order=0)
    sec_eng = ProjectSection(project_id=launch.id, title="Engineering", sort_order=1)
    sec_prep = ProjectSection(project_id=launch.id, title="Launch Prep", sort_order=2)
    sec_content = ProjectSection(project_id=portfolio.id, title="Content", sort_order=0)
    sec_build = ProjectSection(project_id=portfolio.id, title="Build", sort_order=1)
    sec_mileage = ProjectSection(project_id=half_marathon.id, title="Base Mileage", sort_order=0)
    sec_gear = ProjectSection(project_id=half_marathon.id, title="Gear & Nutrition", sort_order=1)
    sec_declutter = ProjectSection(project_id=kitchen.id, title="Declutter", sort_order=0)
    sec_storage = ProjectSection(project_id=kitchen.id, title="Storage", sort_order=1)
    session.add_all(
        [
            sec_design,
            sec_eng,
            sec_prep,
            sec_content,
            sec_build,
            sec_mileage,
            sec_gear,
            sec_declutter,
            sec_storage,
        ]
    )
    session.flush()

    # 4. Task templates (reusable + recurring)
    tmpl_kickoff = TaskTemplate(
        life_area_id=work.id,
        title="Weekly Project Kickoff",
        notes="Standard Monday checklist for any active project.",
        priority="medium",
        subtasks=[
            TaskTemplateSubtask(title="Review open blockers", sort_order=0),
            TaskTemplateSubtask(title="Pick top 3 outcomes for the week", sort_order=1),
            TaskTemplateSubtask(title="Share status note with team", sort_order=2),
        ],
    )
    tmpl_plants = TaskTemplate(
        life_area_id=home.id,
        title="Water indoor plants",
        notes="Check soil moisture on the fiddle leaf fig and monstera first.",
        priority="low",
        rrule="FREQ=WEEKLY;BYDAY=WE,SU",
        repeat_from="schedule",
        starts_on=today - timedelta(days=14),
    )
    tmpl_inbox_zero = TaskTemplate(
        life_area_id=work.id,
        title="Weekly inbox zero & desk reset",
        notes="Clear downloads folder, archive handled threads, wipe desk.",
        priority="medium",
        due_offset_days=0,
        due_time=time(16, 30),
        rrule="FREQ=WEEKLY;BYDAY=FR",
        repeat_from="schedule",
        starts_on=today - timedelta(days=21),
        subtasks=[
            TaskTemplateSubtask(title="Archive handled email threads", sort_order=0),
            TaskTemplateSubtask(title="Clear desktop & Downloads", sort_order=1),
        ],
    )
    tmpl_rent = TaskTemplate(
        life_area_id=finance.id,
        title="Pay monthly rent & utilities",
        priority="high",
        due_offset_days=2,
        rrule="FREQ=MONTHLY;BYMONTHDAY=1",
        repeat_from="schedule",
        starts_on=today - timedelta(days=60),
    )
    tmpl_flashcards_paused = TaskTemplate(
        life_area_id=learning.id,
        title="Daily spaced-repetition flashcards",
        priority="low",
        rrule="FREQ=DAILY",
        repeat_from="completion",
        starts_on=today - timedelta(days=30),
        paused_at=_utc_days_ago(5),
    )
    session.add_all([tmpl_kickoff, tmpl_plants, tmpl_inbox_zero, tmpl_rent, tmpl_flashcards_paused])
    session.flush()

    # 5. Tasks (Inbox, Today, Overdue, Next 7 days, Later, Unscheduled, Completed, Cancelled)
    tasks: list[Task] = [
        # Inbox (no life_area_id, no project_id)
        Task(
            title="Look up ergonomic split keyboard reviews",
            notes="Compare Corne vs. Glove80.",
            priority="low",
            sort_order=0,
        ),
        Task(
            title="Pick up dry cleaning before Friday",
            priority="medium",
            due_date=today + timedelta(days=1),
            sort_order=1,
        ),
        Task(
            title="Send Sam the Ramen recipe link",
            priority="none",
            scheduled_date=today,
            sort_order=2,
        ),
        Task(
            title="Research weekend cabin rentals for January",
            priority="none",
            sort_order=3,
        ),
        # Overdue (open tasks with past due_date)
        Task(
            life_area_id=finance.id,
            title="Submit dental insurance reimbursement",
            notes="Receipt PDF is in `Documents/Receipts`.",
            priority="high",
            due_date=today - timedelta(days=2),
            sort_order=0,
        ),
        Task(
            life_area_id=home.id,
            title="Replace kitchen water filter cartridge",
            priority="medium",
            due_date=today - timedelta(days=1),
            sort_order=1,
        ),
        Task(
            life_area_id=work.id,
            project_id=launch.id,
            section_id=sec_design.id,
            title="Finalize empty-state copy for onboarding",
            priority="high",
            due_date=today - timedelta(days=1),
            sort_order=2,
        ),
        # Today (scheduled_date == today or due_date == today)
        Task(
            life_area_id=work.id,
            project_id=launch.id,
            section_id=sec_eng.id,
            title="Review PR for notification preferences API",
            notes="Check migration rollback and rate-limit edge cases.",
            priority="high",
            scheduled_date=today,
            due_date=today,
            due_time=time(15, 0),
            sort_order=0,
            subtasks=[
                Subtask(
                    title="Verify schema constraints",
                    status="done",
                    completed_at=_utc_days_ago(0, 9),
                    sort_order=0,
                ),
                Subtask(title="Test 409 conflict response", status="todo", sort_order=1),
                Subtask(title="Approve & merge", status="todo", sort_order=2),
            ],
        ),
        Task(
            life_area_id=health.id,
            project_id=half_marathon.id,
            section_id=sec_mileage.id,
            title="Tempo run: 8 km at threshold pace",
            notes="1.5 km warmup, 5 km steady, 1.5 km cooldown.",
            priority="medium",
            scheduled_date=today,
            sort_order=1,
        ),
        Task(
            life_area_id=home.id,
            project_id=kitchen.id,
            section_id=sec_storage.id,
            title="Label glass pantry jars",
            priority="low",
            scheduled_date=today,
            sort_order=2,
        ),
        Task(
            life_area_id=social.id,
            title="Reply to Maya about Saturday brunch",
            priority="medium",
            scheduled_date=today,
            sort_order=3,
        ),
        # Next 7 days
        Task(
            life_area_id=work.id,
            project_id=launch.id,
            section_id=sec_prep.id,
            title="Draft customer release announcement",
            priority="high",
            scheduled_date=today + timedelta(days=1),
            due_date=today + timedelta(days=3),
            sort_order=0,
            subtasks=[
                Subtask(title="Outline 3 headline features", status="todo", sort_order=0),
                Subtask(title="Record 45-second walkthrough clip", status="todo", sort_order=1),
            ],
        ),
        Task(
            life_area_id=finance.id,
            title="Reconcile credit card statements",
            priority="medium",
            scheduled_date=today + timedelta(days=1),
            sort_order=1,
        ),
        Task(
            life_area_id=work.id,
            project_id=portfolio.id,
            section_id=sec_content.id,
            title="Write case study for Life OS architecture",
            priority="medium",
            scheduled_date=today + timedelta(days=2),
            sort_order=0,
        ),
        Task(
            life_area_id=health.id,
            project_id=half_marathon.id,
            section_id=sec_gear.id,
            title="Order replacement running insoles",
            priority="low",
            scheduled_date=today + timedelta(days=2),
            sort_order=1,
        ),
        Task(
            life_area_id=home.id,
            title="Drop off recycling & glass bottles",
            priority="low",
            scheduled_date=today + timedelta(days=3),
            sort_order=0,
        ),
        Task(
            life_area_id=learning.id,
            title="Finish chapter 6 of Designing Data-Intensive Applications",
            priority="medium",
            scheduled_date=today + timedelta(days=4),
            sort_order=0,
        ),
        Task(
            life_area_id=health.id,
            project_id=half_marathon.id,
            section_id=sec_mileage.id,
            title="Long run: 16 km easy aerobic",
            priority="high",
            scheduled_date=today + timedelta(days=5),
            sort_order=0,
        ),
        Task(
            life_area_id=social.id,
            title="Call Mom & Dad for weekly catch-up",
            priority="medium",
            scheduled_date=today + timedelta(days=6),
            sort_order=0,
        ),
        # Later (beyond 7 days)
        Task(
            life_area_id=work.id,
            project_id=launch.id,
            section_id=sec_prep.id,
            title="Run full staging smoke test before launch",
            priority="high",
            scheduled_date=today + timedelta(days=11),
            due_date=today + timedelta(days=12),
            sort_order=0,
        ),
        Task(
            life_area_id=finance.id,
            title="Review quarterly index fund allocation",
            priority="medium",
            scheduled_date=today + timedelta(days=16),
            sort_order=0,
        ),
        # Unscheduled (no scheduled_date, no due_date)
        Task(
            life_area_id=work.id,
            project_id=portfolio.id,
            section_id=sec_build.id,
            title="Add dark-mode screenshot previews",
            priority="low",
            sort_order=0,
        ),
        Task(
            life_area_id=work.id,
            project_id=launch.id,
            section_id=sec_eng.id,
            title="Benchmark SQLite backup export speed",
            priority="medium",
            sort_order=1,
        ),
        Task(
            life_area_id=home.id,
            project_id=kitchen.id,
            section_id=sec_declutter.id,
            title="Donate duplicate baking trays",
            priority="none",
            sort_order=0,
        ),
        Task(
            life_area_id=learning.id,
            title="Try baking sourdough focaccia on a Sunday",
            priority="none",
            sort_order=0,
        ),
        # Completed tasks (some today, some recent)
        Task(
            life_area_id=work.id,
            project_id=launch.id,
            section_id=sec_design.id,
            title="Approve final onboarding illustrations",
            priority="medium",
            scheduled_date=today,
            status="done",
            completed_at=_utc_days_ago(0, 9),
            sort_order=4,
        ),
        Task(
            life_area_id=health.id,
            title="Book annual blood panel & physical",
            priority="high",
            scheduled_date=today - timedelta(days=1),
            status="done",
            completed_at=_utc_days_ago(1, 14),
            sort_order=0,
        ),
        Task(
            life_area_id=home.id,
            project_id=kitchen.id,
            section_id=sec_declutter.id,
            title="Clear expired spices from top shelf",
            priority="low",
            scheduled_date=today - timedelta(days=3),
            status="done",
            completed_at=_utc_days_ago(3, 18),
            sort_order=1,
        ),
        Task(
            life_area_id=work.id,
            project_id=perf_review.id,
            title="Submit self-reflection & 2027 goals",
            priority="high",
            due_date=today - timedelta(days=12),
            status="done",
            completed_at=_utc_days_ago(12, 16),
            sort_order=0,
        ),
        Task(
            life_area_id=finance.id,
            title="Renew renter's insurance policy",
            priority="high",
            due_date=today - timedelta(days=7),
            status="done",
            completed_at=_utc_days_ago(8, 11),
            sort_order=0,
        ),
        # Cancelled tasks
        Task(
            life_area_id=work.id,
            project_id=portfolio.id,
            section_id=sec_build.id,
            title="Build custom WebGL hero background",
            notes="Too heavy on mobile; sticking with crisp typography instead.",
            priority="low",
            status="cancelled",
            cancelled_at=_utc_days_ago(4, 15),
            sort_order=1,
        ),
        Task(
            life_area_id=home.id,
            project_id=guest_room.id,
            title="Measure wall clearance for Murphy bed",
            priority="medium",
            status="cancelled",
            cancelled_at=_utc_days_ago(20, 12),
            sort_order=0,
        ),
        # Recurring template occurrences
        Task(
            life_area_id=home.id,
            template_id=tmpl_plants.id,
            occurrence_date=today - timedelta(days=3),
            title="Water indoor plants",
            priority="low",
            scheduled_date=today - timedelta(days=3),
            status="done",
            completed_at=_utc_days_ago(3, 8),
        ),
        Task(
            life_area_id=home.id,
            template_id=tmpl_plants.id,
            occurrence_date=today,
            title="Water indoor plants",
            priority="low",
            scheduled_date=today,
            status="todo",
        ),
        Task(
            life_area_id=work.id,
            template_id=tmpl_inbox_zero.id,
            occurrence_date=today + timedelta(days=(4 - today.weekday()) % 7),
            title="Weekly inbox zero & desk reset",
            priority="medium",
            scheduled_date=today + timedelta(days=(4 - today.weekday()) % 7),
            due_date=today + timedelta(days=(4 - today.weekday()) % 7),
            due_time=time(16, 30),
            status="todo",
            subtasks=[
                Subtask(title="Archive handled email threads", status="todo", sort_order=0),
                Subtask(title="Clear desktop & Downloads", status="todo", sort_order=1),
            ],
        ),
    ]

    # Add ~1 year of historical completed tasks (2 per week over the past 52 weeks)
    historical_templates = [
        (work.id, None, "Ship weekly engineering changelog", "medium"),
        (health.id, ten_k_prep.id, "Interval track session: 6x800m", "high"),
        (home.id, None, "Deep-clean fridge & restock staples", "low"),
        (finance.id, None, "Categorize monthly expenses & receipts", "medium"),
        (learning.id, None, "Summarize book notes into evergreen page", "low"),
        (social.id, None, "Plan weekend coffee catch-up", "none"),
    ]
    for week in range(2, 53):
        base_days = week * 7
        for slot in range(2):
            idx = (week * 2 + slot) % len(historical_templates)
            area_id, proj_id, title, prio = historical_templates[idx]
            done_offset = base_days + slot * 3
            tasks.append(
                Task(
                    life_area_id=area_id,
                    project_id=proj_id,
                    title=f"{title} (W{53 - week})",
                    priority=prio,
                    scheduled_date=today - timedelta(days=done_offset),
                    status="done",
                    completed_at=_utc_days_ago(done_offset, 16),
                    sort_order=slot,
                )
            )

    session.add_all(tasks)
    session.flush()

    # 6. Routines, schedules, steps, logs, pauses
    morning = Routine(
        title="Morning Routine",
        notes="Start the day hydrated, mobile, and clear on priorities.",
        sort_order=0,
    )
    evening = Routine(
        title="Evening Wind-Down",
        notes="Close loops so tomorrow starts clean.",
        sort_order=1,
    )
    weekend = Routine(
        title="Weekend Reset",
        notes="Keep food, budget, and workspace ready for Monday.",
        sort_order=2,
    )
    archived_routine = Routine(
        title="Old Morning Pages",
        notes="Archived after switching to evening journaling.",
        sort_order=3,
        archived_at=_utc_days_ago(25),
    )
    session.add_all([morning, evening, weekend, archived_routine])
    session.flush()

    session.add_all(
        [
            RoutineSchedule(
                routine_id=morning.id, rrule="FREQ=DAILY", starts_on=today - timedelta(days=300)
            ),
            RoutineSchedule(
                routine_id=evening.id, rrule="FREQ=DAILY", starts_on=today - timedelta(days=270)
            ),
            RoutineSchedule(
                routine_id=weekend.id,
                rrule="FREQ=WEEKLY;BYDAY=SA,SU",
                starts_on=today - timedelta(days=300),
            ),
            RoutineSchedule(
                routine_id=archived_routine.id,
                rrule="FREQ=DAILY",
                starts_on=today - timedelta(days=330),
            ),
        ]
    )

    step_water = RoutineStep(
        routine_id=morning.id,
        life_area_id=health.id,
        title="Drink 500 ml water + electrolytes",
        starts_on=today - timedelta(days=300),
        sort_order=0,
    )
    step_stretch = RoutineStep(
        routine_id=morning.id,
        life_area_id=health.id,
        title="15 min mobility & stretch",
        starts_on=today - timedelta(days=300),
        sort_order=1,
    )
    step_plan = RoutineStep(
        routine_id=morning.id,
        life_area_id=work.id,
        title="Review Today list & pick top 3",
        starts_on=today - timedelta(days=300),
        sort_order=2,
    )
    step_read = RoutineStep(
        routine_id=morning.id,
        life_area_id=learning.id,
        title="Read 15 pages with coffee",
        starts_on=today - timedelta(days=180),
        sort_order=3,
    )

    step_kitchen = RoutineStep(
        routine_id=evening.id,
        life_area_id=home.id,
        title="10-minute kitchen counter reset",
        starts_on=today - timedelta(days=270),
        sort_order=0,
    )
    step_journal = RoutineStep(
        routine_id=evening.id,
        life_area_id=learning.id,
        title="Journal 3 highlights from today",
        starts_on=today - timedelta(days=270),
        sort_order=1,
    )
    step_screens = RoutineStep(
        routine_id=evening.id,
        life_area_id=health.id,
        title="Screens off by 10:30 PM",
        starts_on=today - timedelta(days=270),
        sort_order=2,
    )

    step_mealprep = RoutineStep(
        routine_id=weekend.id,
        life_area_id=health.id,
        title="Grocery run & lunch prep",
        starts_on=today - timedelta(days=300),
        sort_order=0,
    )
    step_budget = RoutineStep(
        routine_id=weekend.id,
        life_area_id=finance.id,
        title="Review weekly spending & upcoming bills",
        starts_on=today - timedelta(days=300),
        sort_order=1,
    )
    step_old_pages = RoutineStep(
        routine_id=archived_routine.id,
        life_area_id=learning.id,
        title="Write 3 longhand morning pages",
        starts_on=today - timedelta(days=330),
        sort_order=0,
    )
    session.add_all(
        [
            step_water,
            step_stretch,
            step_plan,
            step_read,
            step_kitchen,
            step_journal,
            step_screens,
            step_mealprep,
            step_budget,
            step_old_pages,
        ]
    )
    session.flush()

    # Historical pauses on evening routine
    session.add_all(
        [
            RoutinePause(
                routine_id=evening.id,
                starts_on=today - timedelta(days=16),
                ends_on=today - timedelta(days=13),
            ),
            RoutinePause(
                routine_id=evening.id,
                starts_on=today - timedelta(days=125),
                ends_on=today - timedelta(days=118),
            ),
        ]
    )

    # Routine logs for the last 300 days (leaving 2 morning steps + evening steps to-do today)
    routine_logs: list[RoutineLog] = []
    for offset in range(1, 301):
        day = today - timedelta(days=offset)
        if offset % 19 != 0:
            routine_logs.append(RoutineLog(routine_step_id=step_water.id, date=day, status="done"))
        routine_logs.append(
            RoutineLog(
                routine_step_id=step_stretch.id,
                date=day,
                status="skipped" if offset % 7 == 4 else "done",
            )
        )
        routine_logs.append(
            RoutineLog(
                routine_step_id=step_plan.id,
                date=day,
                status="skipped" if offset % 9 == 0 else "done",
            )
        )
        if offset <= 180 and offset % 6 != 0:
            routine_logs.append(RoutineLog(routine_step_id=step_read.id, date=day, status="done"))
        paused_evening = (today - timedelta(days=16) <= day < today - timedelta(days=13)) or (
            today - timedelta(days=125) <= day < today - timedelta(days=118)
        )
        if offset <= 270 and not paused_evening:
            routine_logs.append(
                RoutineLog(routine_step_id=step_kitchen.id, date=day, status="done")
            )
            if offset % 3 != 0:
                routine_logs.append(
                    RoutineLog(routine_step_id=step_journal.id, date=day, status="done")
                )
            routine_logs.append(
                RoutineLog(
                    routine_step_id=step_screens.id,
                    date=day,
                    status="skipped" if offset % 5 == 0 else "done",
                )
            )
        if day.weekday() in (5, 6):
            routine_logs.append(
                RoutineLog(routine_step_id=step_mealprep.id, date=day, status="done")
            )
            routine_logs.append(RoutineLog(routine_step_id=step_budget.id, date=day, status="done"))

    # Mark 2 morning steps done today so Today shows partial progress
    routine_logs.extend(
        [
            RoutineLog(routine_step_id=step_water.id, date=today, status="done"),
            RoutineLog(routine_step_id=step_stretch.id, date=today, status="done"),
        ]
    )
    session.add_all(routine_logs)

    # 7. Events (one-off, timed, all-day, multi-day, repeating + exception)
    ev_standup = Event(
        life_area_id=work.id,
        project_id=launch.id,
        title="Team Standup",
        notes="Quick 15-minute sync on blockers.",
        start_date=today - timedelta(days=270),
        start_time=time(9, 30),
        end_time=time(9, 50),
        location="Huddle Room / Zoom",
        rrule="FREQ=WEEKLY;BYDAY=MO,TH",
    )
    ev_run_club = Event(
        life_area_id=health.id,
        project_id=half_marathon.id,
        title="Saturday Run Club",
        start_date=today - timedelta(days=270),
        start_time=time(7, 30),
        end_time=time(8, 45),
        location="Riverside Park",
        rrule="FREQ=WEEKLY;BYDAY=SA",
    )
    events = [
        ev_standup,
        ev_run_club,
        Event(
            life_area_id=work.id,
            project_id=launch.id,
            title="Product Sync with Design",
            notes="Walk through onboarding edge cases.",
            start_date=today,
            start_time=time(14, 0),
            end_time=time(14, 45),
            location="Zoom",
        ),
        Event(
            life_area_id=health.id,
            title="Physio Check-in",
            start_date=today,
            start_time=time(17, 30),
            end_time=time(18, 15),
            location="Downtown Physio Clinic",
        ),
        Event(
            life_area_id=health.id,
            title="Dentist Cleaning",
            start_date=today + timedelta(days=1),
            start_time=time(9, 0),
            end_time=time(10, 0),
            location="Oak Street Dental",
        ),
        Event(
            life_area_id=social.id,
            title="Dinner with Alex & Priya",
            start_date=today + timedelta(days=2),
            start_time=time(19, 0),
            end_time=time(21, 0),
            location="Bistro Verde",
        ),
        Event(
            life_area_id=work.id,
            title="Q4 Planning Offsite",
            notes="All-day roadmap & architecture workshops.",
            start_date=today + timedelta(days=3),
            end_date=today + timedelta(days=5),
            location="Mountain View Lodge",
        ),
        Event(
            life_area_id=social.id,
            title="Winter Trip to Kyoto",
            notes="Flights & ryokan confirmed.",
            start_date=today + timedelta(days=24),
            end_date=today + timedelta(days=29),
            location="Kyoto, Japan",
        ),
        Event(
            life_area_id=finance.id,
            title="Monthly Budget Review",
            start_date=today - timedelta(days=300),
            start_time=time(18, 0),
            end_time=time(18, 45),
            rrule="FREQ=MONTHLY;BYMONTHDAY=28",
        ),
        # Multi-day & milestone events spread across the year
        Event(
            life_area_id=work.id,
            title="Q1 Architecture Summit",
            start_date=today - timedelta(days=260),
            end_date=today - timedelta(days=257),
            location="Seattle",
        ),
        Event(
            life_area_id=social.id,
            title="Spring Family Lake Weekend",
            start_date=today - timedelta(days=190),
            end_date=today - timedelta(days=187),
            location="Lake Tahoe",
        ),
        Event(
            life_area_id=health.id,
            project_id=ten_k_prep.id,
            title="City 10K Race Day",
            start_date=today - timedelta(days=105),
            start_time=time(7, 0),
            end_time=time(10, 0),
            location="Civic Center",
        ),
        Event(
            life_area_id=learning.id,
            title="Design Systems Workshop",
            start_date=today - timedelta(days=60),
            end_date=today - timedelta(days=59),
            location="Downtown Studio",
        ),
        Event(
            life_area_id=health.id,
            project_id=half_marathon.id,
            title="Half Marathon Race Day",
            start_date=today + timedelta(days=45),
            start_time=time(6, 30),
            end_time=time(10, 30),
            location="Bayfront Course",
        ),
        Event(
            life_area_id=work.id,
            title="Q1 Roadmap Kickoff",
            start_date=today + timedelta(days=75),
            end_date=today + timedelta(days=77),
            location="HQ",
        ),
    ]
    session.add_all(events)
    session.flush()

    # Shift one future standup occurrence via EventException if it falls in the next 7 days
    for offset in range(1, 8):
        candidate = today + timedelta(days=offset)
        if candidate.weekday() in (0, 3):
            session.add(
                EventException(
                    event_id=ev_standup.id,
                    occurrence_date=candidate,
                    start_time=time(10, 0),
                    end_time=time(10, 20),
                    notes="Moved 30 mins later for all-hands.",
                )
            )
            break

    # 8. Metrics, entries, and targets
    m_running = Metric(
        life_area_id=health.id,
        project_id=half_marathon.id,
        title="Running Distance",
        notes="Weekly mileage buildup toward half marathon.",
        format="number",
        unit="km",
        source="manual",
        aggregation="sum",
        direction="higher",
        sort_order=0,
    )
    m_weight = Metric(
        life_area_id=health.id,
        title="Body Weight",
        format="number",
        unit="kg",
        source="manual",
        aggregation="latest",
        direction="lower",
        sort_order=1,
    )
    m_deep_work = Metric(
        life_area_id=work.id,
        title="Deep Work",
        notes="Uninterrupted focus blocks.",
        format="duration",
        unit=None,
        source="manual",
        aggregation="sum",
        direction="higher",
        sort_order=0,
    )
    m_savings = Metric(
        life_area_id=finance.id,
        title="Monthly Savings",
        format="currency",
        unit="USD",
        source="manual",
        aggregation="sum",
        direction="higher",
        sort_order=0,
    )
    m_stretch_rate = Metric(
        life_area_id=health.id,
        title="Morning Stretch Consistency",
        format="percent",
        unit=None,
        source="routine_step",
        routine_step_id=step_stretch.id,
        aggregation="average",
        direction="higher",
        sort_order=2,
    )
    session.add_all([m_running, m_weight, m_deep_work, m_savings, m_stretch_rate])
    session.flush()

    metric_entries: list[MetricEntry] = []

    # 1 year of running entries (3 runs/week for 52 weeks)
    run_distances = [5.2, 7.5, 10.5, 6.0, 8.2, 12.0, 5.5, 9.0, 13.5]
    for week in range(52):
        for slot, day_offset in enumerate((1, 3, 6)):
            days_ago = week * 7 + day_offset
            if days_ago > 364:
                continue
            val = run_distances[(week * 3 + slot) % len(run_distances)]
            metric_entries.append(
                MetricEntry(
                    metric_id=m_running.id,
                    date=today - timedelta(days=days_ago),
                    value=val,
                    note="Long run" if slot == 2 else None,
                )
            )

    # 1 year of weekly body weight entries (gentle trend 77.6 -> 73.4 kg)
    for week in range(52, 0, -1):
        val = round(73.4 + (week / 52) * 4.2 + ((week % 3) - 1) * 0.15, 1)
        metric_entries.append(
            MetricEntry(metric_id=m_weight.id, date=today - timedelta(days=week * 7), value=val)
        )
    metric_entries.append(MetricEntry(metric_id=m_weight.id, date=today, value=73.4))

    # 1 year of weekday deep work entries (minutes)
    deep_work_mins = [120, 150, 90, 180, 135, 165, 105]
    for offset in range(365):
        day = today - timedelta(days=offset)
        if day.weekday() < 5:
            metric_entries.append(
                MetricEntry(
                    metric_id=m_deep_work.id,
                    date=day,
                    value=deep_work_mins[offset % len(deep_work_mins)],
                )
            )

    # 12 months of savings entries
    savings_vals = [1400, 1550, 1300, 1650, 1500, 1750, 1450, 1600, 1500, 1700, 1600, 1550]
    for month_idx, val in enumerate(savings_vals):
        days_ago = (11 - month_idx) * 30 + 2
        metric_entries.append(
            MetricEntry(metric_id=m_savings.id, date=today - timedelta(days=days_ago), value=val)
        )

    session.add_all(
        [
            *metric_entries,
            # Targets
            MetricTarget(
                metric_id=m_running.id,
                kind="per_period",
                target_value=25.0,
                period="week",
                start_date=today - timedelta(days=365),
            ),
            MetricTarget(
                metric_id=m_weight.id,
                kind="reach_by",
                target_value=72.0,
                start_date=today - timedelta(days=365),
                end_date=today + timedelta(days=45),
            ),
            MetricTarget(
                metric_id=m_deep_work.id,
                kind="per_period",
                target_value=120.0,
                period="day",
                start_date=today - timedelta(days=365),
            ),
            MetricTarget(
                metric_id=m_savings.id,
                kind="per_period",
                target_value=1500.0,
                period="month",
                start_date=today - timedelta(days=365),
            ),
            MetricTarget(
                metric_id=m_stretch_rate.id,
                kind="per_period",
                target_value=80.0,
                period="week",
                start_date=today - timedelta(days=300),
            ),
        ]
    )

    session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create and seed an isolated Life OS demo database."
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DEMO_DB,
        help=f"Path to the SQLite database file (default: {DEFAULT_DEMO_DB})",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow overwriting the main life_os.db if explicitly targeted.",
    )
    args = parser.parse_args()

    db_path = args.db.resolve()
    if db_path.name == "life_os.db" and not args.force:
        print(
            f"Refusing to overwrite {db_path} without --force. Use the default demo.db instead.",
            file=sys.stderr,
        )
        sys.exit(1)

    db_path.parent.mkdir(parents=True, exist_ok=True)
    _remove_db_files(db_path)

    database_url = f"sqlite:///{db_path.as_posix()}"
    os.environ["LIFE_OS_DATABASE_URL"] = database_url

    _run_migrations(database_url)

    engine = create_db_engine(database_url)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        with SessionLocal() as session:
            seed_demo_data(session, date.today())
    finally:
        engine.dispose()

    print(f"Seeded demo database at {db_path}")


if __name__ == "__main__":
    main()
