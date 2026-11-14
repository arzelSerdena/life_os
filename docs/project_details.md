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
| Testing             | pytest, pytest-asyncio, httpx2, polyfactory, time-machine   |
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
| **0** | Plan & domain design     | ✅ Relationships, statuses and schema settled (`schema.sql`). `docs/DOMAIN.md` written, tools installed, repo created                                                                                                                                                                                                                                                        | Domain doc written, tools installed                         |
| **1** | Foundations + Life Areas | ✅ uv project, GitHub Actions CI, config, DB engine (`PRAGMA foreign_keys=ON`), Alembic with `render_as_batch=True` (SQLite needs batch mode to alter tables/constraints), base mixin (`id`, `created_at`, `updated_at` with `onupdate=func.now()`), Life Area model/migration/schemas/service/router/tests; frontend setup (Vite, Tailwind v4, HeroUI v3, Hey API); app layout with sidebar; Life Area CRUD + archive | A life area created in the UI is saved                      |
| **2** | Execution slice          | Tasks (with priority), subtasks, **task templates** (Notion-style, with subtasks; a repeat rule makes a recurring task that generates occurrences, from schedule or completion), events (repeating, with exceptions); this / this and following / all edits; status engine v1 (task done/cancel → cancel subtasks); week endpoint (`GET /api/week`); rollover of unfinished one-off tasks; **week board** (Unscheduled + 7 day columns, drag between days); task drawer (subtasks checklist, Markdown notes); Inbox; repeat picker                                                                                            | I plan real weeks with it                                   |
| **3** | Routines slice           | Routines, schedules, routine steps, pauses, routine logs; "steps due on date X" from the schedule; check off steps on the board; pause/archive; streaks                                                                                                                                                                                                                                                                    | Daily routines work                                         |
| **4** | Projects & metrics       | Projects, sections, metrics, entries, targets; ownership rules (composite keys keep each item in its project's life area); **cascade engine v2** (preview → confirm → one transaction → `status_changes` batch → undo); sidebar tree; project page with sections | Every status rule works, is tested, and can be undone       |
| **5** | Progress & reviews       | Project progress and target state (derived, not stored); life area overview (a container, no progress); stats                                                                                                                                                                                                                                                                                         | Completing a task moves its project's progress |
| **6** | Integration & daily use  | FastAPI serves built frontend; `just` commands; automatic DB backups; 1–2 weeks of daily use + `docs/FEEDBACK.md`                                                                                                                                                                                                                                                                            | One command runs the app                                    |
| **7** | AI features              | LLM client + logging; natural-language task entry (structured output) + evals; "plan my week"; weekly review per life area; semantic search (sqlite-vec); hand-built agent with service-layer tools (cascades require my confirmation); cost/reliability                                                                                                                                         | AI features pass evals; app works with AI off               |
| **8** | Desktop                  | PyInstaller sidecar, Tauri shell, notifications, tray, global shortcut, installer                                                                                                                                                                                                                                                                                                                | Installed as my daily planner                               |
| **9** | Portfolio                | README, demo video, write-ups, maintenance                                                                                                                                                                                                                                                                                                                                                       | Repo ready to show                                          |

---

## 3. Database model

### Conventions

- `snake_case`, plural tables; primary key `id`; foreign keys `<parent>_id`
- Every table: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `created_at`, `updated_at` (DATETIME, UTC). The DB default only fills them on insert; the SQLAlchemy base mixin sets `updated_at` on every update (`onupdate=func.now()`)
  - Exceptions (on purpose, revisit if needed): `routine_logs` has only `created_at`; `status_changes` has only `changed_at`
- Types: `TEXT`, `INTEGER`, `DATE`, `TIME`, `DATETIME` (SQLite stores dates as ISO text)
- **Archiving is separate from status:** `archived_at` (NULL = visible)
- Status changes record a timestamp (`completed_at`, `cancelled_at`)
- Notes are **Markdown** in a `notes TEXT` column (max 50,000 chars)
- Dates (`scheduled_date`, `due_date`…) are local calendar values; `_at` datetimes are UTC

### Where the model lives

- **`docs/DOMAIN.md`**: what each item is, who owns it, status and cascade rules, repeating items, routines, metrics, and which rule the database or the service enforces.
- **`docs/schema.sql`**: every table, column and constraint, for tables not built yet.
- **SQLAlchemy models**: the source of truth for tables already built.

Summary: a life area contains projects; projects contain sections; tasks, task templates, events, metrics and routine steps belong to a project or a life area, never both, and inherit the project's life area. Tasks and task templates with no life area are the Inbox. Routines have no owner. Metrics have entries and targets.

---

## Decision log

- **2026-11-09** — Project name is **Life OS** (schema header said "DayFlow").
- **2026-11-09** — `updated_at` is set by the SQLAlchemy base mixin (`onupdate`); Alembic uses batch mode for SQLite.
- **2026-11-09** — Moved two service rules into the DB as well: status↔timestamp CHECKs, and the composite FK keeping a task's milestone inside its project (`ON UPDATE CASCADE`).
- **2026-11-09** — Kept as-is: `routine_logs` / `status_changes` timestamp exceptions; FK index coverage via composite unique indexes.
- **2026-11-10** — ~~Project groups only organize projects and are never an owner; a project can have both a goal and a group.~~ _Superseded 2026-11-13: priorities, goals and project groups were removed._
- **2026-11-10** — A cascade cancels children that have a cancelled state and archives those that don't (recurring tasks, routine steps; metrics since 2026-11-13).
- **2026-11-10** — Checking off, cancelling or archiving a task skips preview and confirmation, but is recorded in `status_changes` for undo.
- **2026-11-10** — ~~When a goal is achieved, cancel or unlink is chosen per child.~~ _Superseded 2026-11-13: priorities, goals and project groups were removed._
- **2026-11-10** — Archiving a task cancels its subtasks.
- **2026-11-10** — Pausing a routine pauses every step; resuming it resumes every step, including those paused individually beforehand. Archived steps stay archived. _Pauses are now recorded as date ranges in `routine_pauses` (2026-11-13)._
- **2026-11-10** — Rollover runs automatically on app launch and on local date change. It moves unfinished one-off tasks to today, adds 1 to `rollover_count` per move, leaves `due_date` alone and isn't recorded for undo.
- **2026-11-10** — All changes go through a branch and a squash-merged PR. CI moves from Phase 6 to Phase 1, so every feature PR is checked from the start.
- **2026-11-10** — Backend uses synchronous SQLAlchemy with `def` endpoints: a single user on SQLite gains nothing from async, and it keeps tests and the PyInstaller build simple. Python is pinned to 3.14 with uv.
- **2026-11-10** — Migrations run with `PRAGMA foreign_keys` off and a `foreign_key_check` afterwards, because batch mode's `DROP TABLE` would otherwise cascade-delete child rows. Every application connection still turns it on.
- **2026-11-10** — `httpx2` replaces `httpx` for tests, as Starlette's `TestClient` now requires. Test libraries are added when first needed.
- **2026-11-10** — Deleting a life area is permanent and refused with a 409 while items still belong to it; archiving is the normal way to retire one. Archiving can be reversed with unarchive, and a new life area goes to the end of the sort order.
- **2026-11-10** — Life areas have a color but no icon.
- **2026-11-10** — Any successful change refreshes all loaded data, which is simplest for one user with little data. Deleting asks for confirmation; archiving doesn't, because it can be reversed.
- **2026-11-10** — TypeScript is pinned to 6.x because Hey API needs the compiler API that TypeScript 7 removed. The generated client is committed, and CI fails if it is stale. In development Vite proxies `/api` to the backend, so no CORS setup is needed. The repo uses LF line endings on every OS.
- **2026-11-13** — Data model revised. Removed priorities, goals, project groups and milestones. Life areas are containers with no progress. Projects keep simple sections (no status or dates). Metrics, with entries and targets, take over measurable outcomes.
- **2026-11-13** — Tasks, recurring tasks, events, metrics and routine steps belong to a project or a life area, never both, and inherit the project's life area. The database enforces this with a composite key to `projects(id, life_area_id)` and `ON UPDATE CASCADE`, so moving a project moves its items.
- **2026-11-13** — Tasks and recurring tasks have a priority: high, medium, low or none (default), stored as text.
- **2026-11-13** — Targets are either "reach by a date" or "every period" (day, week, month, calendar periods, weeks start Monday). Changing a target ends it and starts a new one. Met or missed is derived.
- **2026-11-13** — Repeating events, recurring tasks and routines offer Google Calendar's three choices: this one, this and following, all. Events are expanded on read with exceptions (iCalendar style); recurring tasks keep materialized occurrences; routines keep schedule history in `routine_schedules`.
- **2026-11-13** — Recurring tasks can repeat from completion as well as from the schedule.
- **2026-11-13** — "X times per week" habits aren't a routine feature; a metric with a weekly target covers them.
- **2026-11-13** — Every table uses `AUTOINCREMENT`, so ids are never reused. Ids deleted before the life area migration could not be protected; nothing referred to them.
- **2026-11-13** — Kept on purpose: inclusive event end dates (convert only for iCalendar import/export), floating local event times with no time zone, and whole-number `sort_order`.
- **2026-11-13** — Routine pauses are date ranges in `routine_pauses`, so paused days never count as missed. Routines gain `archived_at`.
- **2026-11-13** — Nothing can be created in, moved into or restored into an archived life area or an inactive project (409).
- **2026-11-13** — A project cascade ends its repeating events from today instead of cancelling the whole series.
- **2026-11-13** — Undo covers field changes (status changes, cascades, unlinks). Series edits that create or remove rows ask for confirmation and can't be undone.
- **2026-11-13** — Task templates replace recurring tasks, as in Notion: one `task_templates` table holds title, notes, priority, default owner, subtasks and an optional due-date offset, and a template with a repeat rule is a recurring task. Creating a task copies the template; `tasks.template_id` keeps the link for reference.
- **2026-11-13** — A recurring occurrence can't be deleted, only cancelled, because a deleted occurrence would be generated again.
- **2026-11-13** — Projects, sections and templates get their tables in Phase 2 (no screens until Phase 4), so the tasks table is final from the start.
- **2026-11-13** — Repeat rules carry no `DTSTART`, `UNTIL` or `COUNT`; a series runs from `starts_on` to `ends_on`, which keeps "this and following" a simple split. "Ends after N times" becomes an end date.
- **2026-11-13** — Editing a template changes only tasks created later, as in Notion. Series edits from an occurrence also update unfinished occurrences (title, notes, priority, due date unless set by hand); checklist changes apply to new occurrences only.
- **2026-11-13** — Undo also removes tasks a change created, such as the next "repeat from completion" occurrence, if they are unchanged since. Series cancellations can be undone; series edits can't.
- **2026-11-13** — Deleting a template keeps tasks created from it by hand (the link is cleared); a recurring task with occurrences can only be archived.
- **2026-11-13** — Events end a series with a `repeat_ends_on` column, not `UNTIL` or `COUNT` in the rule, matching task templates. A same-day event can't end before it starts (a `CHECK`).
- **2026-11-13** — For events, "This one" can move an occurrence; "This and following" and "All" can't move dates. A timing or rule change keeps cancelled occurrences. One cancelled occurrence comes back by restoring it; cancelling a series is undone with undo.
- **2026-11-13** — Rollover moves from Phase 5 to Phase 2 and runs when the board loads a week, so unfinished tasks from past days never drop off the board. Rolled-over tasks go to the end of today's list.
- **2026-11-13** — The week board is one call, `GET /api/week`. Unscheduled holds every to-do task with no date; a multi-day event appears on each day it covers. Loading a week creates its recurring tasks, so a read changes data, which is safe because it never creates anything twice.
- **2026-11-13** — `POST /api/tasks/reorder` sets a day's whole order in one step, for drag and drop.
- **2026-11-13** — Routine steps get a `starts_on`, so a step added later has no missed days before it existed. Streaks: a miss resets, while skipped and paused days are neutral. Done is allowed up to today; skipped also on future days. The routines backend is built ahead of the Phase 2 screens because the screens won't change it.
- **2026-11-13** — Projects and sections get their API ahead of the screens. Project status changes and archiving wait for the cascade engine, since they change the project's tasks and events too. A project can be deleted only when empty; moving one is undoable. Progress counts one-off tasks that aren't cancelled or archived.
- **2026-11-13** — Metrics, entries and targets get their API ahead of the screens. Entries can't be in the future. Changing a target ends it yesterday and starts the new one today; a target starting today or later is edited in place. Target states: upcoming, in progress, met, missed, and ended for finished per-period targets.
- **2026-11-14** — A life area's color is a palette key (`blue`, `teal`, `rose`, `plum`, `ochre`, `terracotta`), not a hex value, so every area color role comes from the design tokens. A new area gets the first palette no active area uses. Older hex colors show as neutral until the area is edited.
- **2026-11-14** — `frontend/src/styles/tokens.css` is generated from `design/tokens/*.json` by `pnpm tokens`, and CI checks it is current. Area ramps and roles come from the token JSON itself.
- **2026-11-14** — The rail shows every group from the style guide; groups not built yet are disabled. The selected period (Week / Month / Quarter / Year, default Quarter) is kept app-wide in a Zustand store, so it stays the same when moving between the overview and area pages. Queries don't retry, because the API is local.
- **2026-11-14** — The New area pop-up has Name, Color and Vision; the Edit pop-up adds Notes (Markdown), and a new area's request leaves notes out. Quick-start chips (Career, Finance, Health, Personal, Relationships, Home) open it filled in. Following the presentation rules, the pop-ups and cards show no hints or explanatory subtitles. Until the overview API exists, the overview cards show their no-data state; their ghost actions (New project, New routine, Add metric), the card menus and Export as CSV wait for that data and those create flows.
- **2026-11-14** — `POST /api/life-areas/reorder` sets the area order (sidebar and every overview) in one transaction, like task reordering; areas not listed, such as archived ones, keep their order after the listed ones. The Reorder areas pop-up uses dnd-kit, with keyboard dragging.
- **2026-11-14** — The life areas overview loads from one call, `GET /api/life-areas/overview?period=&date=`, built ahead of its cards like `GET /api/week`. The API returns numbers and states; the screen writes the sentences. Rules are in `docs/DOMAIN.md` section 8. Pace uses a project's created date as its start until projects get a start date.
- **2026-11-14** — An area page loads from one call, `GET /api/life-areas/{id}/page`, which reuses the overview's metric rules. Archiving an area asks for confirmation only once the cascade engine archives its items; until then the page's archive stays as it is.
- **2026-11-14** — Cascade engine v2: one service plans each cascade (area archive; project complete, cancel and archive), so the preview and the change come from the same plan. Applying it runs in one transaction under one undo batch. Restoring an area or project brings back what its last archive took. Completing and cancelling share one cascade.
- **2026-11-14** — The detail panel's notes use Tiptap 3 with its official Markdown extension (`@tiptap/markdown`): notes are edited formatted and stored as Markdown, underline as `<u>`. Notes save on their own 600 ms after typing stops and when the panel closes, refreshing only that item's query; titles and chips save through the normal mutations, which refresh everything. The panel loads lazily, so the editor stays out of the main bundle. The panel's ⋯ menu offers View Markdown everywhere, Complete and Archive for tasks, and Archive for areas; project complete, cancel and archive come with their confirmations. Event, metric, routine and step chips only show values for now; their edits come with their forms. Clicking elsewhere on the page also closes the panel.

---
