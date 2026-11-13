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

**Next**

- Merge the Life Area screens once the Figma designs are ready.
- Phase 2: tasks, subtasks, recurring tasks, events and the week board.
