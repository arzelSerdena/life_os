# Life OS — Log

## 2026-11-10

**Done**

- Finished Phase 0: domain rules written and open questions resolved.
- Set up the branch and PR workflow, and protected `main`.
- Started Phase 1 with the backend foundation: uv project, config, database engine, Alembic, base mixin, health endpoint, tests, pre-commit and CI.
- Added the Life Area backend: model, migration, schemas, service, API and tests.
- Set up the frontend: Vite, React, Tailwind v4, HeroUI v3, TanStack Query, Biome, Vitest, the generated Hey API client and a CI job.

**Next**

- App layout with sidebar and the Life Area screens, which finishes Phase 1.

## 2026-11-13

**Done**

- Revised the data model: removed priorities, goals, project groups and milestones; added project sections, task priority, metrics with entries and targets, repeating events with exceptions, routine schedules and pauses.
- Made the database enforce that items stay in their project's life area, and switched every table to `AUTOINCREMENT` ids (migration for `life_areas`).
- Chose Notion-style task templates (a template with a repeat rule is a recurring task).
- Started Phase 2 with the tasks backend: projects, sections and templates tables; tasks with priority, subtasks, Inbox, moves, status changes and undo.
- Added the task templates backend: templates with checklists, creating tasks from them, recurring tasks generated per week or from completion, and "this and following" / "all" edits and cancellations.
- Added the events backend: one-off and repeating events, occurrences for a date range, single-occurrence changes and cancellations, and "this and following" / "all".
- Added the week endpoint, rollover and task reordering. The Phase 2 backend is complete.
- Added the routines backend (Phase 3, built ahead while the designs are in progress): schedules with history, steps, checking off, skipping a day, pausing and streaks.
- Added due routine steps to each day of the week board.
- Added the projects and sections API (status changes and archiving come with the cascade engine).
- Added the metrics API: entries, reach-by and per-period targets, with met or missed calculated. Everything the screens won't reshape is now built.

**Next**

- Phase 2 screens from the Figma designs: week board, task drawer, Inbox, repeat picker, undo toast, and restyling the Life Area screens (PR #5).
- The cascade engine, with its preview and confirm screens: project and life area status changes and archiving.

## 2026-11-14

**Done**

- Built the area page: `GET /api/life-areas/{id}/page` and its screen (metrics, timeline, projects, routine heatmap, task tabs, agenda, New metric pop-up, Add and ⋯ menus).
- Made the sidebar collapsible, resizable and responsive.
- Added the cascade engine: archiving an area archives everything in it, and completing, cancelling or archiving a project changes its items, each with a preview and one undo batch. The area page asks before archiving and lists what goes with it.
- Built the detail panel: one panel for areas, projects, tasks, recurring tasks, events, metrics, routines and routine steps, with an editable title, chips, subtasks and Markdown notes (floating toolbar, "/" menu, View Markdown, notes per event or per series). Edit area opens it; the Edit area pop-up and the area page's Notes tab are gone.
- Built the life areas overview: `GET /api/life-areas/overview` (effort, outcomes, projects against pace, routine steps done, wins) and its five cards, with the Outcomes sort and filter menu.
- Updated the data rules from the design chat: metric format and unit, metrics fed by a routine step (entries derived from its days), a current value on create, and delete rules for every item, with delete previews for the confirmation counts. Migration, tests and the regenerated client included.

- Added the UI style guide, the approved mock-ups and the design tokens under `design/`.
- Finished Phase 1 (PR #5): the app shell from the approved mock-ups (icon rail, Areas sidebar with LIFE AREAS heading and Archived areas), an area page header, archived areas, and the period switch. Area colors are now palette keys, and the token CSS is generated and checked in CI. Added the approved overview states: no areas, areas with no data, the New and Edit area pop-ups, the ⋯ menu and Reorder areas (with a reorder endpoint).

**Next**

- Card menus for Effort, Projects, Routine steps done and Wins, and Export as CSV, once their options are designed.
- Project complete, cancel and archive in the UI, with previews from the cascade engine.
- Create forms for tasks, events, projects and routine steps, which turn on the rest of the Add menu.
- Metric formatting on screen (`Intl.NumberFormat`), the New metric presets and current value, and delete confirmations and undo toasts that use the delete previews.
- The project page and projects overview, then the Phase 2 screens.
- The cascade engine, with its preview and confirm screens.

## 2026-11-15

**Done**

- Metric values are shown by the metric's format everywhere (tiles, timeline, agenda, wins and the detail panel): ₱1,500, ₱100K on tiles, 35%, 1 h 30 m.
- New metric form: Source (Manual entries or Routine step), Measure as presets, Unit or Currency, Current value, and a Create button that stays disabled and names what's missing.
- Delete in the detail panel's ⋯ menu for every item, last and in red. Metrics, recurring tasks, routines, steps, events, projects and areas ask first in a red confirmation with counts from the delete previews; a repeating event asks This event / This and following / All events; a step or routine that feeds a metric can't be deleted and the dialog names the metric. Projects and areas with items have Delete disabled (`has_items` added to projects).
- One-off tasks and subtasks delete behind an undo toast (6 s, Undo or Ctrl Z); a recurring occurrence offers Cancel task instead.

- Project Complete, Cancel, Archive, Reopen and Restore in the detail panel's ⋯ menu. Complete, Cancel and Archive confirm with what they do to the project's items (from the cascade preview), and the toast after them has Undo, which restores the whole batch.
- The sidebar stays docked at every window width; it no longer turns into a floating overlay below 1440 px.
- Projects can be created: the sidebar's new PROJECTS group lists active projects and its + opens New project (name, life area, start, due, notes); the area page's Add → Project opens it too. Projects gained an optional start date (migration included).

**Next**

- Undo-toast deletes for metric entries and targets, once a screen lists them.
- Card menus for Effort, Projects, Routine steps done and Wins, and Export as CSV, once their options are designed (only the Outcomes menu is).
- The remaining create forms (tasks, events, projects, routine steps), the project page and the projects overview.

## 2026-11-16

**Done**

- Finished the UI design phase: every screen is approved (`design/html_mockups/approved-*.html`, 14 screens), with the UX review fixes applied by `review_fixes.py` and `review_fixes2.py`. Removed the leftover drafts.
- Brought the docs in line with the approved designs (decision log entries dated 2026-11-16 in `project_details.md`):
  1. Calendar: Week and Month use FullCalendar's day-grid view (no time grid); Quarter and Year are a custom linear calendar. Stack table, roadmap and `CLAUDE.md` updated.
  2. Placement rule (scheduled date, else due date, else Unscheduled) and Overdue (open, past due date, listed in Today): `DOMAIN.md` sections 1 and 8, `CLAUDE.md`.
  3. Inbox stays "open tasks with no life area"; new Unscheduled view for tasks with an area but no scheduled date; Inbox hover actions and keys.
  4. Projects show as bars from start (or creation) to due date in Quarter and Year.
  5. On-the-hour 12-hour times drop ":00".
  6. Routines: full day, run (current, best, longest) and streak (one step only) in `DOMAIN.md` sections 1 and 6.
  7. Navigation: rail Home, Tasks, Calendar, Plan, Settings; the Plan sidebar with LIFE AREAS, PROJECTS, ROUTINES and Finished & archived.
  8. One destination per entity: projects open their project page, which gets a Board view; the Tasks sidebar drops PROJECTS and Archived.
  9. Routines and steps never open the detail panel; they are edited on their page.
  10. Routine page and Routines overview reads: `DOMAIN.md` section 8 (`GET /api/routines/{id}/page`, `GET /api/routines/overview`).
  11. Home reads, done count, quick add and first run: `DOMAIN.md` section 8 (`GET /api/home`).
  12. One ConfirmDialog for every cascade and delete with contents; previews return per-item rows grouped by effect: `DOMAIN.md` section 4.
  13. Settings: single-row `settings` table (added to `schema.sql`), Day ends at shifting "today", Restore from backup: `DOMAIN.md` section 8.
  14. Finished & archived: tabs, restore and reopen with undo, read-only panels and routine page, delete rules, routine restore brings back its steps: `DOMAIN.md` sections 4 and 8.
  15. Settled points: New area pop-up without "optional" or the Vision hint; area archive shows the undo toast; start date edited from the date-range chip; pending deletes hidden everywhere; browser tests for New project and project status actions.
- Roadmap updated: the new screens are placed in Phases 2–6.

- Small fixes to the built screens: the rail's Areas is now Plan (`LayoutGrid`) and Archived areas is Finished & archived; the New area pop-up lost "optional" and the Vision placeholder; archiving an area shows the undo toast (Archived “Career”); the sidebar collapses to an overlay below 1440 px again (PR #28 reverted) and the app's minimum size is 1280 × 720; the accent is neutral (primary buttons, the area Add button, the toast's Undo, checkboxes in menus and notes), with Low priority neutral in the tokens; no text below 11 px; every control has a 24 × 24 px hit area (`hit-24` utility, 24 px icon buttons, wrapped checkboxes) and a focus ring.

- The placement rule in the backend: the week board, task lists, the area page's Unscheduled tab and agenda, new-task positions and reordering use `Task.placement_date` (scheduled date, else due date). New `/api/tasks` filters: `date_from`/`date_to` (renamed), `unscheduled` (neither date), `overdue`, `status`, `with_life_area`; reorder takes `day`.

- One confirm dialog: every preview (area archive; project complete, cancel and archive; template, metric, routine and step deletes; the new `GET /api/events/{id}/delete-preview`) returns `groups` of per-item rows by effect (cancelled, ends from today, archived, deleted, kept), each with its kind, title, owner colour and its data as fields (dates, times, rule, counts, routine or owner). `features/confirming/ConfirmDialog.tsx` replaces `DeleteDialog` and the old looks of `ProjectChangeDialog` and `ArchiveAreaDialog`: 480 px, a group folds after 3 rows with "+n more", the list scrolls at 360 px with shadows, a skeleton while loading, and a footer line (restore, undo, or Can't be undone in red). An archive or status change with nothing listed applies at once with the undo toast. Confirmed deletes show a toast without Undo ("Deleted “X” · Can't be undone"); complete and cancel add "· 2 tasks cancelled".

- Action buttons are solid: the accent, or the area's 500 colour inside an area. The area page's Add split button and its "Add metric" empty-state button use the new `button--area` class (`styles/heroui-theme.css`); Restore (Finished & archived) and Try again (query errors) are solid accent. Style guide updated (Current rules and the Nov 16 Colour section).

- Browser tests (Playwright, `pnpm e2e`, a new `e2e` CI job): `frontend/e2e/projects.spec.ts` covers New project (create and open, due before start) and the project status actions (complete with Undo, cancel with Go back, reopen, archive and restore) against a real API on a fresh temporary database (`e2e/start-api.mjs`, ports 8100 and 5180).

- The sidebar is docked and shown by default at every window width again; it no longer floats as an overlay below 1440 px (the overlay from PR #31 is removed). Hiding with Ctrl B or the hide button and resizing still work. Style guide updated (Current rules and the Nov 16 Components section).

- Settings backend: the single-row `settings` table (model `AppSettings`, migration), `GET /api/settings` (creates the defaults on first read) and `PATCH /api/settings`. `app.clock.today()` and `clock.local_date()` apply `day_ends_at`: every request reads the stored hour first, so Home, rollover, routine logs, completed dates and streaks all follow it.

- Applied the settings migration to the real database (backup kept as `backend/data/life_os.before-settings.db`).

- Tasks group, first part: the rail's Tasks opens it, with its sidebar (ALL, Inbox, Today, Unscheduled, Next 7 days, Routines; Completed and Cancelled at the bottom; open-task counts) and the All, Today, Unscheduled, Completed and Cancelled boards. Priority | Area switch, columns one fifth of the board wide, collapsible subgroups, Today's red Overdue subgroup, project cards leading their subgroup, and task cards (area checkbox, flags for High and Medium, repeat, notes, rollovers, due date and time, project, subtask toggle with checkable subtasks). Checking off shows the undo toast; clicking a card opens the detail panel. Browser tests in `frontend/e2e/tasks.spec.ts`.

- Action buttons are never black: primary buttons (the accent) are brand 700 again, matching the approved mock-ups; inside an area they stay the area's 500 colour. Token, theme comment and style guide (doc and `design/STYLE_GUIDE.md`) updated.

- Inbox (`/tasks/inbox`): open tasks with no life area, oldest first, beside a container that files them, with Areas | Calendar | Priority (remembered). Drag a card onto an area or a project, a day in the month grid, or a priority; or use the card's hover actions (Area ▾ with each area's active projects, Today, Date with the date field and Today / Tomorrow / Next week) or the keys `A`, `T`, `D`. Every filing shows the undo toast (Moved “X” · Career, Scheduled “X” · Today, Set “X” · High priority). `PATCH /api/tasks/{id}` now records its changes (all but notes) under an undo batch and returns `TaskChange`, like `/move`. Browser tests in `frontend/e2e/inbox.spec.ts`.

- Next 7 days (`/tasks/next-7-days`): No date plus today and the six days after it. Each day lists its routines (progress ring, done / total, steps with round checkboxes in the area colour; today's unfinished routines start open, and days that haven't come can't be checked), then events (the area tint, "All day", "11 AM – 12:30 PM", or "From 6 PM" / "Until 3 PM" for a multi-day event), project due dates and tasks, with done tasks last; Today starts with the red Overdue subgroup. Drag a task inside a day to reorder it (`POST /api/tasks/reorder`), or to another day to schedule it there, with the undo toast (Scheduled “X” · Tomorrow); the slot and the +1 counter follow the pointer. New `GET /api/days?start&count` (default today, 7 days) places tasks as the week board does; the Tasks group now loads it instead of `/api/week`, so rollover and recurring tasks cover the whole rolling range. Browser tests in `frontend/e2e/next7.spec.ts`.

- Routines board (`/tasks/routines`): one column per routine, in routine order, with today's progress ring, the done / due-today counter and the schedule as the data line ("Daily", "Sundays"; "· Paused since Nov 10" when paused). Each step is a card with a round checkbox in its area colour (checks today off; grey and disabled when not due today), the title, its next due day when that isn't today ("Sun, Nov 22"), the last seven days as squares (done, skipped, missed, today, paused, not due, blank before the step started) and the done count ("6/7"). New `GET /api/routines/history?end&count` (default the last 7 days; 1–371) gives every active routine and step with a state per day and the next due day, ready for the routine page and the Routines overview. The sidebar's Routines row is now a link. Browser tests in `frontend/e2e/routines.spec.ts`.

- Filter-and-sort menu on the Tasks boards (`features/tasks/FilterMenu.tsx`, rules in `filters.ts`): the header's sliders icon, with an accent dot while filters hide something, opens Subgroup and Sort by, then PRIORITY, LIFE AREAS and SHOW checkboxes and Clear filters. All, Today and Unscheduled subgroup by Area or None (Priority group) or Project, Priority or None (Area group) and sort by Manual, Priority, Date, Due date or Created; hidden priorities and areas take their columns with them; Show completed / cancelled lists finished tasks last. Next 7 days adds Area or Priority subgroups and Show events, routine steps, project due dates, completed and cancelled. The Inbox sorts by Created, Priority or Due date and filters by priority; Completed and Cancelled filter by priority and area. Choices are remembered per view; "No tasks match the filters." with Clear filters when they hide everything. Browser tests in `frontend/e2e/filters.spec.ts`.

- Fixed Undo after dragging a task to a day that already has tasks in Next 7 days: the reorder that follows the move changed `sort_order`, and Undo refused with 409. Undo now ignores later position changes and still restores the old position.

- New task and the pickers (`features/tasks/NewTaskModal.tsx`, rules in `newTask.ts`; shared pickers in `features/pickers/`). New task (brand 700) on All, Today, Unscheduled, Inbox and Next 7 days, and in "No tasks yet."; the column + (always shown) and the subgroup + (on hover) open it pre-filled with their priority, area, project or day (Today also schedules it today). The pop-up has Title, then the Owner (search, Inbox, areas with their projects), Section (when the project has sections), Priority (flags, Do / Schedule / Delegate / Eliminate), Scheduled, Due and Repeat chips, and Add subtask rows; Enter creates, Esc cancels. The date picker types dates ("fri", "nov 20", "+3d") with the match as one row and outlined on the grid, has Today / Tomorrow / Next week icon buttons and the month, and now also serves the detail panel's due and scheduled chips. Repeat offers the presets from the task's date and Custom (every n days/weeks/months/years, weekdays, from schedule or completion, ends never / on a date / after n times). A repeat rule creates a recurring task (`POST /api/task-templates`). No backend changes. Browser tests in `frontend/e2e/new-task.spec.ts`.

**Next** (code, one branch and PR each, in this order)

- Phase 2 screens: Calendar Week and Month (FullCalendar day grid), `Ctrl N` quick add (opens New task through `useNewTask().open()`; the pop-up is already rendered by the app shell).
- The owner and section pickers in the detail panel's breadcrumb, and the date picker in the Inbox's Date hover action, which still use the older controls.
- `e2e/next7.spec.ts` "dragging a task onto another in the same day reorders the day" fails when repeated against one database (`--repeat-each=3`, also on `main`); a single run passes. Worth a look.
- Phase 3 to 6 screens as in the roadmap: routine page and Routines overview, project page with Board view, projects overview, Finished & archived, Calendar Quarter and Year, Home, Settings with Restore from backup, `Ctrl K` palette and shortcuts.
