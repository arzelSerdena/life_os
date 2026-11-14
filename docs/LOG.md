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
