# Workspace Agent Instructions (Life OS)

## Project Context
See [CLAUDE.md](file:///c:/projects/life_os/CLAUDE.md) for full project stack, architecture, commands, and domain rules.

## Session & Task Handoff
- **Always add to handoff**: At the completion of any task or feature, immediately update [docs/LOG.md](file:///c:/projects/life_os/docs/LOG.md) under the current date with:
  - **Done**: What was implemented, files changed, and tests/checks verified.
  - **Next**: Immediate next tasks or open items for the next session or agent to pick up.

## Subtask & Model Delegation Guidelines
When spinning up subagents, background jobs, or swarms:
- Always evaluate task complexity and explicitly choose the `Model` parameter according to the [model-delegation](file:///c:/projects/life_os/.agents/skills/model-delegation/SKILL.md) skill:
  - `flash_lite`: Bulk log parsing, search filtering, repetitive trivial jobs.
  - `flash`: Browser automation, standard code edits, running builds and test suites.
  - `pro`: Deep architectural reasoning, complex multi-file debugging, schema design.
- Direct single-turn workspace actions (file editing, running commands) stay on the active chat model unless delegation is explicitly warranted.
