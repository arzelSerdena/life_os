# Life OS — Feedback

Notes from using the app every day (Phase 6: 1–2 weeks with `just app` on the real database). Write things down as they happen, then sort them in **Triage** and turn each one into a `fix/` or `feat/` branch.

## How to write a note

Add notes under today's date, newest date at the top. Each note is one line:

```text
- [kind] Screen — what happened or what you wanted. (sev)
```

**Kind**

- `bug`: something is wrong (wrong data, a crash, a broken layout, a console error).
- `friction`: it works, but it is slow, takes too many clicks, or is confusing.
- `idea`: something new you wanted, or a change to a rule.

**Severity** (bugs and friction only)

- `blocker`: stops daily use or risks data. Fix it before anything else.
- `annoying`: you notice it every day.
- `minor`: cosmetic or rare.

For a bug, add the steps if they aren't obvious, and the URL or a screenshot (`docs/feedback/<date>-<slug>.png`) if it helps. Note anything that looks like lost or wrong data at once, and check Settings › Backups before you change more.

**Screens** (as in `design/html_mockups/approved-*.html`): Home, Tasks (All, Today, Inbox, Unscheduled, Next 7 days, Routines, Completed, Cancelled), Calendar (Week, Month, Quarter, Year), Area, Areas overview, Project, Projects overview, Routine, Routines overview, Finished & archived, Settings, Detail panel, Pickers, Confirmations (previews, undo toasts). Also: Plan sidebar, Command palette (`Ctrl K`), Shortcuts (`?`), Right-click menus, `just app` / startup.

## Triage

Each note that will be acted on gets a row. **Status** is `open`, `branch` (being built), `done` (merged) or `won't` (with the reason in Notes).

| #   | Date       | Kind     | Sev   | Screen          | Summary                                                                                                   | Status | Branch / PR              | Notes                                                                                                                                                                                |
| --- | ---------- | -------- | ----- | --------------- | --------------------------------------------------------------------------------------------------------- | ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 2026-11-18 | friction | —     | Right-click     | Review the right-click menu's design (no mock-up)                                                         | open   | #70                      | Flagged for review in the PR                                                                                                                                                         |
| 2   | 2026-11-18 | friction | —     | Command palette | Review the `Ctrl K` palette's design                                                                      | open   | #69                      | Flagged for review in the PR                                                                                                                                                         |
| 3   | 2026-11-18 | friction | —     | Area            | No way to archive a metric                                                                                | done   | feat/metric-actions      | Added Archive/Restore metric to detail panel ⋯ menu and right-click menu with undo toast                                                                                             |
| 4   | 2026-11-18 | idea     | —     | Plan sidebar    | Reorder areas and projects by dragging them                                                               | open   |                          | Areas reorder today only in Reorder areas                                                                                                                                            |
| 5   | 2026-11-18 | bug      | —     | Pickers         | Date pickers start on Sunday, not Monday                                                                  | done   | #73                      | Weeks start on Monday (CLAUDE.md); the Calendar already does                                                                                                                         |
| 6   | 2026-11-18 | friction | —     | Area, Project   | No way to add a log to a metric                                                                           | done   | feat/metric-actions      | Quick-log `+` button on metric tiles, Log entry in right-click/⋯ menu, and inline entry logging + recent entries in Metric detail panel                                              |
| 7   | 2026-11-18 | friction | —     | Area, Project   | Only a metric's title can be edited                                                                       | done   | feat/metric-actions      | Interactive Aggregation & Direction chips + Edit metric modal (format/unit, aggregation, direction, target) from detail panel and right-click menu                                   |
| 8   | 2026-11-18 | idea     | —     | All pop-ups     | Clicking outside a pop-up with edits asks to discard them                                                 | open   |                          | Applies to New task, New event, New metric, etc.                                                                                                                                     |
| 9   | 2026-11-18 | idea     | —     | Tasks › Inbox   | The Inbox lists every open task that still needs sorting: no life area, no scheduled date, or no priority | done   | #73                      | Changes the rule in DOMAIN.md (Inbox = no life area): update it and the decision log. Also check Home's Needs a push count, the Inbox badge, and whether recurring occurrences count |
| 10  | 2026-11-18 | bug      | minor | `just app`      | Quitting with Ctrl C prints "recipe `serve` failed … exit code 1"                                         | done   | #73                      | Harmless: PowerShell reports any interrupted command as exit 1. Fix: ignore the exit in the recipe                                                                                   |

## Notes

### 2026-11-18

- [friction] Right-click menus — review the design in daily use; no mock-up draws it (#70).
- [friction] Command palette — review the design in daily use (#69).
- [friction] Area - no option to archive a metric
- [idea] Area sidebar - I want to be able to arrange Areas and Projects by dragging them
- [friction] Pickers - date pickers must also start with Monday
- [friction] Area, Projects - No way to add logs to metrics
- [friction] Area, Projects - No way to edits other metrics information aside from the title
- [friction] All - clicking out an input popup must have a confirm popup like exit without saving
- [bug] Tasks (Inbox) - unscheduled tasks doesn't show in inbox
- [idea] Tasks (Inbox) — show tasks with an area but no scheduled date, and tasks with no priority, in the Inbox too.
- [bug] `just app` / startup — quitting the app with Ctrl C printed "error: recipe `serve` failed on line 15 with exit code 1". (minor)

## Summary

Fill this in at the end of the daily-use period: what worked, the top problems, and what to change before Phase 7.
