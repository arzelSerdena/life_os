---
name: model-delegation
description: Rules, heuristics, and execution patterns for delegating subtasks, subagents, and background jobs across model tiers (flash_lite, flash, pro).
---

# Model Delegation Strategy

When delegating tasks to subagents (`invoke_subagent`), workflow scripts (`run_workflow`), or swarms (`/swarm`), match task complexity to the minimum sufficient model tier to optimize speed, token economics, and reasoning depth.

## Model Tiers & Allocation Matrix

| Tier | Model ID / Value | Best For | Typical Tasks |
| :--- | :--- | :--- | :--- |
| **Light** | `flash_lite` | High-volume, trivial, deterministic parsing | Log scanning, file listing, regex/grep aggregations, repetitive JSON extraction, simple formatting. |
| **Balanced** | `flash` | Standard operations, execution, browser workflows | Running test suites, routine refactoring, UI verification, browser interactions, writing boilerplate from clear specs. |
| **Heavy Reasoning** | `pro` | Complex architecture, high ambiguity, hard bugs | Root cause analysis of multi-service failures, database migration planning, schema design, security audits, non-trivial algorithmic logic. |
| **Direct / Default** | `inherit` | Context continuation | Inherits the active conversation model when context continuity is paramount. |

## Delegation Rules

1. **Do not over-provision**: If a task does not require multi-step abstract reasoning or architectural synthesis, default to `flash` or `flash_lite`.
2. **Deterministic & Scriptable First**: If a task can be achieved cleanly with shell commands (`git`, `pytest`, `pnpm test`), execute directly without delegating to an expensive model.
3. **Escalation Path**:
   - Start investigation / exploration on `flash` or `flash_lite`.
   - Escalate to `pro` only if the solution space is ambiguous or initial fix attempts fail.
