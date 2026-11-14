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

- Added the UI style guide, the approved mock-ups and the design tokens under `design/`.
- Finished Phase 1 (PR #5): the app shell from the approved mock-ups (icon rail, Areas sidebar with LIFE AREAS heading and Archived areas), an area page header, archived areas, and the period switch. Area colors are now palette keys, and the token CSS is generated and checked in CI. Added the approved overview states: no areas, areas with no data, the New and Edit area pop-ups, the ⋯ menu and Reorder areas (with a reorder endpoint).

**Next**

- Card menus for Effort, Projects, Routine steps done and Wins, and Export as CSV, once their options are designed.
- Project complete, cancel and archive in the UI, with previews from the cascade engine.
- Create forms for tasks, events, projects and routine steps, which turn on the rest of the Add menu.
- The project page and projects overview, then the Phase 2 screens.
- The cascade engine, with its preview and confirm screens.
