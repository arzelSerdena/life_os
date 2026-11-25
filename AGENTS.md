# Workspace Agent Instructions (Life OS)

## Project Context
See [CLAUDE.md](file:///c:/projects/life_os/CLAUDE.md) for full project stack, architecture, commands, and domain rules.

## Subtask & Model Delegation Guidelines
When spinning up subagents, background jobs, or swarms:
- Always evaluate task complexity and explicitly choose the `Model` parameter according to the [model-delegation](file:///c:/projects/life_os/.agents/skills/model-delegation/SKILL.md) skill:
  - `flash_lite`: Bulk log parsing, search filtering, repetitive trivial jobs.
  - `flash`: Browser automation, standard code edits, running builds and test suites.
  - `pro`: Deep architectural reasoning, complex multi-file debugging, schema design.
- Direct single-turn workspace actions (file editing, running commands) stay on the active chat model unless delegation is explicitly warranted.
