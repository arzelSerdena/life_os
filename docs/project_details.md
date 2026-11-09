# Life OS — Project

**Life OS**, a personal desktop life-planning app (single user, local data).

---

## 1. Stack

### Backend (Python)

| Area                | Tool                                                        |
| ------------------- | ----------------------------------------------------------- |
| Language / env      | Python 3.12+, **uv**                                        |
| API                 | **FastAPI**, Uvicorn                                        |
| Validation / config | **Pydantic v2**, pydantic-settings                          |
| Database            | **SQLite**                                                  |
| ORM / migrations    | **SQLAlchemy 2.0** (separate Pydantic schemas), **Alembic** |
| Recurrence          | **python-dateutil** (RRULE)                                 |
| Admin / logging     | SQLAdmin, Loguru                                            |
| Testing             | pytest, pytest-asyncio, httpx, polyfactory, time-machine    |
| Quality             | Ruff, Pyright, pre-commit                                   |

### Frontend (TypeScript)

| Area                  | Tool                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Core                  | **React + TypeScript + Vite**, pnpm                                                                     |
| Styling / components  | **Tailwind CSS v4 + HeroUI v3** (use v3 docs only; no `HeroUIProvider`)                                 |
| Server data           | **TanStack Query** (+ Devtools)                                                                         |
| API client            | **Hey API** (`@hey-api/openapi-ts`): generates TS types and TanStack Query hooks from FastAPI's OpenAPI |
| Routing / local state | React Router, Zustand                                                                                   |
| Forms                 | React Hook Form + Zod                                                                                   |
| Drag and drop         | **dnd-kit** (core + sortable): week board, reordering                                                   |
| Dates / recurrence    | date-fns, rrule (JS)                                                                                    |
| Rich notes            | Markdown stored as text; editor: MDXEditor or Milkdown; display with react-markdown                     |
| Charts / icons        | recharts, lucide-react                                                                                  |
| Testing               | Vitest, React Testing Library, Playwright                                                               |
| Quality               | Biome                                                                                                   |

FullCalendar is **not** used. The week view is an untimed board (day columns), built with dnd-kit and HeroUI.

### AI (Phase 7)

Anthropic/OpenAI SDK · Instructor (structured outputs) · tenacity · sqlite-vec (embeddings) · Langfuse (tracing/evals) · Pydantic AI only after a hand-built agent.

### Desktop (Phase 8)

Tauri + FastAPI bundled with PyInstaller as a sidecar.

### Tooling

Git + GitHub, GitHub Actions (CI), `just` (task runner), Bruno (API testing), drawDB (schema design), DBeaver / DB Browser for SQLite (inspect the real DB).

---

## 2. Workflow (build roadmap)

Principles:

- Build in **vertical slices** (backend → tests → regenerate client → UI); the app is usable after every phase.
- **SQLAlchemy models are the source of truth** from Phase 1. drawDB was for design only; diagrams are generated from code/DB afterward.
- Every model change gets an **Alembic migration**; every AI prompt change gets an **eval run**.
- Commit after each working step; keep `docs/LOG.md` (what I did / what's next).

| Phase | Name                     | Key steps                                                                                                                                                                                                                                                                                                                                                                                        | Done when                                                   |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **0** | Plan & domain design     | ✅ Relationships, statuses and schema settled (`schema.sql`). Remaining: write `docs/DOMAIN.md` (rules below), install tools, create repo                                                                                                                                                                                                                                                        | Domain doc written, tools installed                         |
| **1** | Foundations + Life Areas | uv project, config, DB engine (`PRAGMA foreign_keys=ON`), Alembic with `render_as_batch=True` (SQLite needs batch mode to alter tables/constraints), base mixin (`id`, `created_at`, `updated_at` with `onupdate=func.now()`), Life Area model/migration/schemas/service/router/tests; frontend setup (Vite, Tailwind v4, HeroUI v3, Hey API); app layout with sidebar; Life Area CRUD + archive | A life area created in the UI is saved                      |
| **2** | Execution slice          | Tasks, subtasks, **recurring tasks** (template + generated occurrences), events; status engine v1 (task done/cancel → cancel subtasks); week agenda endpoint; **week board** (Unscheduled + 7 day columns, drag between days); task drawer (subtasks checklist, Markdown notes); Inbox; repeat picker                                                                                            | I plan real weeks with it                                   |
| **3** | Routines slice           | Routines, routine steps, routine logs; "steps due on date X" from RRULE; check off steps on the board; pause/archive; streaks                                                                                                                                                                                                                                                                    | Daily routines work                                         |
| **4** | Planning hierarchy       | Priorities, goals, project groups, projects, milestones; ownership validation; **cascade engine v2** (preview → confirm → one transaction → `status_changes` batch → undo); sidebar tree; project page with milestone sections; priority page shows projects through goals                                                                                                                       | Every status rule works, is tested, and can be undone       |
| **5** | Progress & reviews       | Progress rollups (derived, not stored); Life Area dashboard; rollover of unfinished one-off tasks; stats                                                                                                                                                                                                                                                                                         | Completing a task moves its project/goal/life-area progress |
| **6** | Integration & daily use  | FastAPI serves built frontend; `just` commands; automatic DB backups; CI; 1–2 weeks of daily use + `docs/FEEDBACK.md`                                                                                                                                                                                                                                                                            | One command runs the app                                    |
| **7** | AI features              | LLM client + logging; natural-language task entry (structured output) + evals; "plan my week"; weekly review per life area; semantic search (sqlite-vec); hand-built agent with service-layer tools (cascades require my confirmation); cost/reliability                                                                                                                                         | AI features pass evals; app works with AI off               |
| **8** | Desktop                  | PyInstaller sidecar, Tauri shell, notifications, tray, global shortcut, installer                                                                                                                                                                                                                                                                                                                | Installed as my daily planner                               |
| **9** | Portfolio                | README, demo video, write-ups, maintenance                                                                                                                                                                                                                                                                                                                                                       | Repo ready to show                                          |

---

## 3. Database model

### Conventions

- `snake_case`, plural tables; primary key `id`; foreign keys `<parent>_id`
- Every table: `created_at`, `updated_at` (DATETIME, UTC). The DB default only fills them on insert; the SQLAlchemy base mixin sets `updated_at` on every update (`onupdate=func.now()`)
  - Exceptions (on purpose, revisit if needed): `routine_logs` has only `created_at`; `status_changes` has only `changed_at`
- Types: `TEXT`, `INTEGER`, `DATE`, `TIME`, `DATETIME` (SQLite stores dates as ISO text)
- **Archiving is separate from status:** `archived_at` (NULL = visible)
- Status changes record a timestamp (`completed_at`, `achieved_at`, `cancelled_at`)
- Notes are **Markdown** in a `notes TEXT` column (max 50,000 chars)
- Dates (`scheduled_date`, `due_date`…) are local calendar values; `_at` datetimes are UTC

### Relationship definitions (from my graph)

- **organizes** = shows items it owns directly or through its children
- **can own** = can directly own the item, but only one owner at a time
- Every item stores `life_area_id` (the umbrella), which must equal its owner's life area. Only tasks and recurring tasks may have none (**Inbox**).
- Direct owner = most specific filled link: project → goal → priority → life area → Inbox

### Relationship map

```
life_areas
 ├──< priorities
 │     └──< goals (optional priority)
 ├──< goals
 │     ├──< projects (optional goal)
 │     └──< routine_steps (optional goal)
 ├──< group_projects ──< projects (optional group)
 ├──< projects
 │     ├──< milestones ──< tasks / recurring_tasks (sections)
 │     ├──< tasks
 │     ├──< recurring_tasks ──< tasks (generated occurrences)
 │     ├──< events
 │     └──< routine_steps (optional project)
 ├──< tasks ──< subtasks
 ├──< events
 └──< routine_steps

routines ──< routine_steps ──< routine_logs
status_changes (history for undo; no foreign keys)
```

| Child           | Owners (FK)                                                                        | Required? |
| --------------- | ---------------------------------------------------------------------------------- | --------- |
| priorities      | life_area                                                                          | ✅        |
| goals           | life_area ✅, priority (optional)                                                  |           |
| group_projects  | life_area                                                                          | ✅        |
| projects        | life_area ✅, goal, group_project (optional)                                       |           |
| milestones      | project                                                                            | ✅        |
| recurring_tasks | life_area, project, milestone (all optional)                                       |           |
| tasks           | life_area, project, milestone, recurring_task (all optional)                       |           |
| subtasks        | task (ON DELETE CASCADE)                                                           | ✅        |
| events          | life_area ✅, project (optional)                                                   |           |
| routines        | —                                                                                  |           |
| routine_steps   | routine ✅ (ON DELETE CASCADE), life_area ✅, goal or project (optional, not both) |           |
| routine_logs    | routine_step (ON DELETE CASCADE)                                                   | ✅        |

Priorities do **not** own projects/tasks/events. A priority page shows projects **through its goals** (derived by join, not stored).

### Tables and key fields

| Table           | Key fields (besides id, owners, timestamps)                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| life_areas      | title, vision, notes, color, icon, sort_order, archived_at                                                                                                           |
| priorities      | title, notes, status (active/cancelled), cancelled_at, archived_at, sort_order                                                                                       |
| goals           | title, notes, target_date, status (active/achieved/cancelled), achieved_at, cancelled_at, archived_at, sort_order                                                    |
| group_projects  | title, sort_order, archived_at                                                                                                                                       |
| projects        | title, notes, due_date, status (active/done/cancelled), completed_at, cancelled_at, archived_at, sort_order                                                          |
| milestones      | title, notes, due_date, status (active/achieved/cancelled), achieved_at, cancelled_at, archived_at, sort_order                                                       |
| recurring_tasks | title, notes, **rrule**, starts_on, ends_on, due_time, paused_at, archived_at                                                                                        |
| tasks           | title, notes, status (todo/done/cancelled), occurrence_date, scheduled_date, due_date, due_time, completed_at, cancelled_at, archived_at, sort_order, rollover_count |
| subtasks        | title, status (todo/done/cancelled), completed_at, cancelled_at, sort_order                                                                                          |
| events          | title, notes, start_date, end_date, start_time, end_time (no start_time = all-day), location, cancelled_at, archived_at                                              |
| routines        | title, notes, rrule (default `FREQ=DAILY`), sort_order, paused_at                                                                                                    |
| routine_steps   | title, notes, sort_order, paused_at, archived_at                                                                                                                     |
| routine_logs    | date, status (done/skipped); unique (routine_step_id, date); no row = to-do                                                                                          |
| status_changes  | batch_id, entity_type, entity_id, field, old_value, new_value, changed_at                                                                                            |

Design decisions: subtasks are a separate table (one level deep, not scheduled); the week view is untimed (no start time/duration on tasks); due dates use date + optional time; events' upcoming/past is calculated from dates.

### Constraints in the database

- Status values via CHECK; text length limits (title 1–200, notes ≤ 50,000)
- `milestone_id` requires `project_id` (tasks, recurring_tasks)
- **A task's / recurring task's milestone belongs to its project:** composite FK `(milestone_id, project_id)` → `milestones(id, project_id)` (milestones has `UNIQUE(id, project_id)`). `ON UPDATE CASCADE`: moving a milestone to another project moves its tasks and recurring tasks with it
- **Status timestamps match the status:** e.g. `(status = 'done') = (completed_at IS NOT NULL)` and `(status = 'cancelled') = (cancelled_at IS NOT NULL)` on priorities, goals, projects, milestones, tasks, subtasks
- Routine steps: not both `goal_id` and `project_id`
- `due_time` requires `due_date`; event `end_date ≥ start_date`; `end_time` requires `start_time`; `ends_on ≥ starts_on`
- `(recurring_task_id IS NULL) = (occurrence_date IS NULL)`; unique `(recurring_task_id, occurrence_date)`
- Indexes on all foreign keys plus `scheduled_date`, `due_date`, `start_date`

### Status rules (from my status table)

| Entity          | Statuses                                                | Achieve/done → active children | Cancel/pause/archive → active children                |
| --------------- | ------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| Life Area       | active, archived                                        | —                              | **archive children** (life_area_id can't be unlinked) |
| Priorities      | active, cancelled, archived                             | —                              | unlink children                                       |
| Goals           | active, achieved, cancelled, archived                   | cancel or unlink (I choose)    | unlink children                                       |
| Projects        | active, done, cancelled, archived                       | cancel (with confirmation)     | cancel/archive children (with confirmation)           |
| Milestones      | active, achieved, cancelled, archived                   | cancel (with confirmation)     | cancel/archive children (with confirmation)           |
| Tasks           | todo, done, cancelled                                   | cancel subtasks                | cancel subtasks                                       |
| Events          | upcoming, past (calculated), cancelled                  | —                              | —                                                     |
| Routine steps   | active, paused, archived (+ daily done/skipped in logs) | —                              | —                                                     |
| Routines        | active, paused                                          | —                              | pause steps                                           |
| Group projects  | active, archived                                        | —                              | unlink projects                                       |
| Recurring tasks | active, paused, archived                                | —                              | —                                                     |

### Rules enforced in the service layer

1. Child `life_area_id` = owner's life area; moving an item updates it; a grouped project shares the group's life area. Moving a milestone to another project: the DB moves its tasks' `project_id` (cascade); the service updates their `life_area_id`.
2. A task's milestone belongs to its project. _(Also enforced by the DB: composite FK. The service still validates first so the API returns a clear 4xx error instead of a DB error.)_
3. Status timestamps match the status. _(Also enforced by DB CHECKs. Set status and its timestamp in the same UPDATE.)_
4. **Unlink** = clear the owner link; the item falls back to its life area.
5. Cascades: preview all affected items → confirm → apply in one transaction → record in `status_changes` with a `batch_id` → undo restores the batch. Undo groups the batch's rows by entity and restores all fields of one entity in a single UPDATE (status + timestamp together, or the CHECK fails).
6. Recurring tasks: generate missing occurrences for the viewed week (from today forward); never recreate an existing occurrence (moved/cancelled); paused/archived templates generate nothing; "edit all future" updates only future unfinished occurrences; recurring occurrences don't roll over.
7. Archived items are hidden with `WHERE archived_at IS NULL`; cancelled tasks are hidden by default (toggle to show).
8. SQLite foreign keys are enabled on every connection.

---

## Decision log

- **2026-11-09** — Project name is **Life OS** (schema header said "DayFlow").
- **2026-11-09** — `updated_at` is set by the SQLAlchemy base mixin (`onupdate`); Alembic uses batch mode for SQLite.
- **2026-11-09** — Moved two service rules into the DB as well: status↔timestamp CHECKs, and the composite FK keeping a task's milestone inside its project (`ON UPDATE CASCADE`).
- **2026-11-09** — Kept as-is: `routine_logs` / `status_changes` timestamp exceptions; FK index coverage via composite unique indexes.

---
