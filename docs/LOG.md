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

**Next** (code, one branch and PR each, in this order)

- `settings` table, model, migration and API; `app.clock.today()` applies `day_ends_at`.
- Phase 2 screens: Tasks group, New task, pickers, Calendar Week and Month (FullCalendar day grid), `Ctrl N` quick add.
- Phase 3 to 6 screens as in the roadmap: routine page and Routines overview, project page with Board view, projects overview, Finished & archived, Calendar Quarter and Year, Home, Settings with Restore from backup, `Ctrl K` palette and shortcuts.
