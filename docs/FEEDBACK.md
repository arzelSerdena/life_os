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

| #   | Date       | Kind     | Sev | Screen          | Summary                                          | Status | Branch / PR | Notes                                       |
| --- | ---------- | -------- | --- | --------------- | ------------------------------------------------ | ------ | ----------- | ------------------------------------------- |
| 1   | 2026-11-18 | friction | —   | Right-click     | Review the right-click menu's design (no mock-up) | open   | #70         | Flagged for review in the PR                |
| 2   | 2026-11-18 | friction | —   | Command palette | Review the `Ctrl K` palette's design              | open   | #69         | Flagged for review in the PR                |

## Notes

### 2026-11-18

- [friction] Right-click menus — review the design in daily use; no mock-up draws it (#70).
- [friction] Command palette — review the design in daily use (#69).

## Summary

Fill this in at the end of the daily-use period: what worked, the top problems, and what to change before Phase 7.
