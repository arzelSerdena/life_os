# Life OS — Domain

The business rules of Life OS: what each thing is, who owns it, how its status changes, and what must always be true. Written from `project_details.md`. Column-level detail is in `schema.sql`; once Phase 1 starts, the SQLAlchemy models are the source of truth for structure.

---

## 1. Vocabulary

| Term               | Meaning                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Life area**      | The top-level umbrella. Almost everything belongs to exactly one.                                          |
| **Priority**       | A focus within a life area. Organizes goals.                                                               |
| **Goal**           | An outcome to achieve, optionally under a priority.                                                        |
| **Project group**  | A way to group projects within a life area (`group_projects`).                                             |
| **Project**        | A body of work, optionally under a goal and/or in a group.                                                 |
| **Milestone**      | A section of a project. Tasks and recurring tasks can sit in one.                                          |
| **Task**           | A single to-do. Can be placed on a day with `scheduled_date`.                                              |
| **Subtask**        | A checklist item on a task. One level deep and never scheduled.                                            |
| **Recurring task** | A template with an RRULE that generates tasks.                                                             |
| **Occurrence**     | A task generated from a recurring task for a specific date.                                                |
| **Event**          | Something happening on a date or date range. All-day when it has no start time.                            |
| **Routine**        | A set of steps with an RRULE deciding which days they are due (daily by default). Has no owner.            |
| **Routine step**   | One action in a routine. Belongs to a life area and optionally to a goal or a project.                     |
| **Routine log**    | The record of a step on a given day: done or skipped. No row means still to-do.                            |
| **Inbox**          | Tasks and recurring tasks with no life area.                                                               |
| **Unlink**         | Clear an item's owner link so it falls back to its life area.                                              |
| **Cascade**        | A change to one item that also changes its children.                                                       |
| **Batch**          | The set of `status_changes` rows from one operation, sharing a `batch_id`. It is the unit of undo.         |

---

## 2. Ownership

- **Organizes** means an item shows the things it owns directly or through its children.
- **Can own** means an item can directly own another, but an item has only one owner at a time.
- The **direct owner** is the most specific filled link: project → goal → priority → life area → Inbox.

| Child           | Required owner                     | Optional owners                                   |
| --------------- | ---------------------------------- | ------------------------------------------------- |
| priorities      | life area                          | —                                                 |
| goals           | life area                          | priority                                          |
| group_projects  | life area                          | —                                                 |
| projects        | life area                          | goal                                              |
| milestones      | project                            | —                                                 |
| recurring_tasks | —                                  | life area, project, milestone                     |
| tasks           | —                                  | life area, project, milestone, recurring task     |
| subtasks        | task (deleted with it)             | —                                                 |
| events          | life area                          | project                                           |
| routines        | —                                  | —                                                 |
| routine_steps   | routine (deleted with it), life area | goal or project, not both                       |
| routine_logs    | routine step (deleted with it)     | —                                                 |

Priorities do **not** own projects, tasks or events. A priority page shows projects **through its goals**; that link is derived by a join and not stored.

Project groups do **not** own projects either. A group only organizes them, so a project can have both a goal and a group. Its direct owner is its goal, or its life area if it has no goal, and archiving a group clears the group link without changing that owner.

### Ownership invariants

1. Every item's `life_area_id` equals its owner's life area. Only tasks and recurring tasks may have none.
2. Moving an item updates its `life_area_id`.
3. A grouped project shares the group's life area.
4. A task's or recurring task's milestone belongs to its project, and a milestone link requires a project.
5. Moving a milestone to another project moves its tasks and recurring tasks with it. The database updates their `project_id`; the service updates their `life_area_id`.

---

## 3. Status

Archiving is separate from status: an item is archived when `archived_at` is set. Whenever a status is set, its timestamp is set with it (`completed_at`, `achieved_at`, `cancelled_at`), and clearing the status clears the timestamp.

### Lifecycle and effect on active children

| Entity          | Statuses                                                | Achieve/done → active children | Cancel/pause/archive → active children                 |
| --------------- | ------------------------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| Life area       | active, archived                                        | —                              | **archive children** (`life_area_id` can't be unlinked) |
| Priority        | active, cancelled, archived                             | —                              | unlink children                                        |
| Goal            | active, achieved, cancelled, archived                   | cancel or unlink (per child)    | unlink children                                       |
| Project         | active, done, cancelled, archived                       | cancel (with confirmation)     | cancel/archive children (with confirmation)            |
| Milestone       | active, achieved, cancelled, archived                   | cancel (with confirmation)     | cancel/archive children (with confirmation)            |
| Task            | todo, done, cancelled                                   | cancel subtasks                | cancel subtasks                                        |
| Event           | upcoming, past (calculated), cancelled                  | —                              | —                                                      |
| Routine step    | active, paused, archived (+ daily done/skipped in logs) | —                              | —                                                      |
| Routine         | active, paused                                          | —                              | pause steps                                            |
| Project group   | active, archived                                        | —                              | unlink projects                                        |
| Recurring task  | active, paused, archived                                | —                              | —                                                      |

### Applying the effects

- **Children with no cancelled state.** A child is cancelled if its entity has a cancelled state and archived if not. Recurring tasks and routine steps are therefore archived when a cascade would cancel them.
- **Goal achieved.** The user chooses cancel or unlink separately for each child.
- **Archiving a task** cancels its subtasks, the same as completing or cancelling it. Subtasks can't be archived.

### Visibility

- Archived items are hidden (`WHERE archived_at IS NULL`).
- Cancelled tasks are hidden by default, with a toggle to show them.

---

## 4. Cascades and undo

Every cascade follows the same steps:

1. **Preview** all affected items.
2. **Confirm** with the user.
3. **Apply** everything in one transaction.
4. **Record** each change in `status_changes` under one `batch_id`.
5. **Undo** restores the whole batch.

**Exception: tasks.** When the user checks off, cancels or archives a task, it applies immediately with no preview or confirmation. The task and its subtask cascade are still applied in one transaction and recorded under one `batch_id`, so the change can be undone. This exception covers only the user's own actions.

Undo groups the batch's rows by entity and restores all fields of one entity in a **single UPDATE**. Status and timestamp must change together or the CHECK constraint fails.

`status_changes` has no foreign keys because it records rows from many tables. Besides status changes, it records cascades and unlinks.

AI agents may call the same service-layer operations, but cascades always require the user's confirmation.

---

## 5. Recurring tasks

A recurring task is a template; its occurrences are ordinary rows in `tasks`, identified by `(recurring_task_id, occurrence_date)`.

- Generate missing occurrences for the viewed week, from today forward.
- Never recreate an existing occurrence, even if it was moved or cancelled.
- Paused and archived templates generate nothing.
- "Edit all future" updates only future unfinished occurrences.
- Recurring occurrences don't roll over.

---

## 6. Routines

- A routine's RRULE decides which dates its steps are due.
- A step is to-do on a due date until a log row marks it done or skipped. There is at most one log per step per date.
- Pausing a routine pauses every step. Resuming it resumes every step, including steps that were paused individually before the routine was. Archived steps stay archived.
- Routines have no life area of their own; each step has one, so one routine can span several life areas.

---

## 7. Scheduling and derived values

- The week view is an untimed board: Unscheduled plus seven day columns. Tasks have no start time or duration.
- Due dates are a date plus an optional time, and a due time requires a due date.
- Events are all-day when they have no start time. An end time requires a start time, and the end date can't be before the start date. Upcoming/past is calculated from dates.
- Unfinished one-off tasks roll over. A task qualifies if it is `todo`, not archived, not a recurring occurrence, and its `scheduled_date` is before today.
  - Rollover runs automatically on app launch and when the local date changes while the app is open.
  - The task's `scheduled_date` moves to today, however many days it missed, and `rollover_count` goes up by 1 per move.
  - `due_date` doesn't change, and rollovers aren't recorded for undo.
- Progress rollups are derived and never stored. Completing a task moves its project, goal and life-area progress.

### Time and text

- `scheduled_date`, `due_date` and similar are local calendar dates.
- `_at` datetimes are UTC.
- Titles are 1–200 characters.
- Notes are Markdown, up to 50,000 characters.

---

## 8. Where each rule is enforced

The service validates rules the database also enforces, so the API returns a clear 4xx instead of a database error.

| Rule                                                  | Database                                                      | Service                                  |
| ----------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| Foreign keys active                                   | `PRAGMA foreign_keys=ON` on every connection                  | —                                        |
| Allowed status values, text lengths                   | CHECK                                                         | validates first                          |
| Status matches its timestamp                          | CHECK                                                         | sets both in the same UPDATE             |
| Milestone requires a project                          | CHECK                                                         | validates first                          |
| Milestone belongs to the item's project               | composite FK to `milestones(id, project_id)`                  | validates first                          |
| Moving a milestone moves its tasks                    | `ON UPDATE CASCADE` for `project_id`                          | updates `life_area_id`                   |
| Routine step has a goal or a project, not both        | CHECK                                                         | validates first                          |
| Occurrence has both template and date, or neither     | CHECK                                                         | —                                        |
| One occurrence per template per date                  | unique index                                                  | never recreates existing occurrences     |
| One routine log per step per date                     | unique index                                                  | —                                        |
| Child's life area equals its owner's                  | —                                                             | enforced here only                       |
| Cascades, unlinks, undo                               | —                                                             | enforced here only                       |
| Recurring generation rules                            | —                                                             | enforced here only                       |

---

## 9. Open questions

None at the moment. When the spec leaves a question unsettled, add it here, then move the answer into the sections above and the decision log once it's decided.
