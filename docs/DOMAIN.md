# Life OS — Domain

The business rules of Life OS: what each thing is, who owns it, how its status changes, and what must always be true. Column-level detail is in `schema.sql`; once a table has a SQLAlchemy model, the model is the source of truth for its structure.

---

## 1. Vocabulary

| Term               | Meaning                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| **Life area**      | The top-level container. It shows what it owns and records no progress.                                  |
| **Project**        | A body of work inside a life area.                                                                        |
| **Section**        | A plain grouping of tasks inside a project. No status or dates.                                          |
| **Task**           | A single to-do with a priority. Can be placed on a day with `scheduled_date`.                            |
| **Priority**       | A task's importance: high, medium, low or none (the default). Not an entity.                             |
| **Subtask**        | A checklist item on a task. One level deep and never scheduled.                                          |
| **Task template**  | Reusable task content (title, notes, priority, owner, subtasks), as in Notion.                           |
| **Recurring task** | A task template with a repeat rule. It generates tasks.                                                   |
| **Occurrence**     | One generated instance of a repeating item: a task row, or a calculated event date.                      |
| **Event**          | Something happening on a date or date range. All-day when it has no start time. Can repeat.              |
| **Event exception**| A change to, or cancellation of, one occurrence of a repeating event.                                    |
| **Metric**         | Something measured over time, such as distance run or hours slept.                                       |
| **Entry**          | One logged value for a metric on a date.                                                                  |
| **Target**         | What a metric aims for: reach a value by a date, or hit a value every period.                            |
| **Routine**        | A set of steps due on the days its schedule says (daily by default). Has no owner.                       |
| **Routine step**   | One action in a routine.                                                                                  |
| **Routine log**    | The record of a step on a given day: done or skipped.                                                     |
| **Inbox**          | Tasks and task templates with no life area.                                                               |
| **Unlink**         | Clear an item's project link so it falls back to its life area.                                           |
| **Cascade**        | A change to one item that also changes the items it owns.                                                 |
| **Batch**          | The set of `status_changes` rows from one operation, sharing a `batch_id`. It is the unit of undo.        |

---

## 2. Ownership

```
Life area
├── Project
│   ├── Section ── groups ──> Tasks, Task templates
│   ├── Task ──< Subtask
│   ├── Task template ──< Template subtask; creates ──> Tasks
│   ├── Event ──< Event exception
│   ├── Metric ──< Entry, Target
│   └── Routine step
└── Task, Task template, Event, Metric, Routine step   (owned directly)

Inbox: Tasks and Task templates with no life area
Routine (no owner) ──< Schedule, Pause, Routine step ──< Routine log, Pause
```

### One rule for every owned item

Tasks, task templates, events, metrics and routine steps are each owned by **a project or a life area, never both**. Only tasks and task templates may have neither, which puts them in the Inbox.

- The item stores `life_area_id`, plus `project_id` when a project owns it.
- A project-owned item **inherits** its project's life area. `life_area_id` is a copy kept for fast filtering, not a second owner, and it always equals the project's.
- The **direct owner** is the project if one is set, otherwise the life area, otherwise the Inbox.
- **Unlinking** an item from its project leaves it owned by the project's life area.

| Item            | Must have                           | May have                    |
| --------------- | ----------------------------------- | --------------------------- |
| projects        | life area                           | —                           |
| project_sections| project (moves never)               | —                           |
| tasks           | —                                   | life area or project, section, template |
| task_templates  | —                                   | life area or project, section |
| events          | life area or project                | —                           |
| metrics         | life area or project                | —                           |
| routine_steps   | routine, life area or project       | —                           |

These belong to their parent outright and are deleted with it: subtasks, template subtasks, event exceptions, metric entries and targets, routine schedules, pauses and logs.

### Ownership invariants

1. An item's `life_area_id` equals its project's life area. The database enforces this with a composite foreign key to `projects(id, life_area_id)`.
2. Moving a project to another life area moves all its items with it, through that key's `ON UPDATE CASCADE`.
3. A project-owned task or task template always has a life area (a `CHECK`), because the database skips the composite key while any of its columns is empty.
4. A section belongs to its item's project, and a section requires a project. Sections never move between projects. Moving a task to another project clears its section.
5. Deleting a section first moves its tasks and task templates to the project's unsectioned list. The service does this, because SQLite's `ON DELETE SET NULL` on a composite key would also clear `project_id`.
6. Nothing can be created in, moved into, or restored into an archived life area or a project that isn't active. Restore or reopen the parent first. The API answers 409.
7. Moving a project to another life area is one undoable change; the database carries every item in it along, and undo carries them back.
8. A project can only be deleted when nothing belongs to it; its sections go with it. Otherwise the API answers 409, as for life areas.

---

## 3. Status

Archiving is separate from status: an item is archived when `archived_at` is set. Whenever a status is set, its timestamp is set with it (`completed_at`, `cancelled_at`), and clearing the status clears the timestamp.

### Lifecycle and effect on owned items

| Item            | States                                       | Done or cancelled →                                                                 | Archived or paused →                          |
| --------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| Life area       | active, archived                             | —                                                                                   | archives everything it owns (with confirmation) |
| Project         | active, done, cancelled, archived            | cancels open tasks and upcoming events; archives task templates, routine steps and metrics (with confirmation) | archives everything it owns (with confirmation) |
| Section         | none                                         | —                                                                                   | —                                             |
| Task            | todo, done, cancelled (+ archived)           | cancels open subtasks                                                               | cancels open subtasks                         |
| Subtask         | todo, done, cancelled                        | —                                                                                   | —                                             |
| Task template   | active, paused (repeating), archived         | —                                                                                   | stops generating; existing occurrences stay   |
| Event           | upcoming, past (calculated), cancelled       | —                                                                                   | —                                             |
| Metric          | active, archived                             | —                                                                                   | entries and targets are kept                  |
| Routine         | active, paused, archived                     | —                                                                                   | pausing pauses every step                     |
| Routine step    | active, paused, archived                     | —                                                                                   | —                                             |

### Applying the effects

- **Items with no cancelled state** are archived when a cascade would cancel them: task templates, routine steps and metrics.
- **Repeating events in a cascade** end from today, as "this and following" does. Past occurrences stay as history, and one-off upcoming events are cancelled.
- **Archiving a task** cancels its open subtasks, the same as completing or cancelling it. Subtasks can't be archived.
- **Resuming a routine** resumes every step, including steps paused individually before the routine was. Archived steps stay archived.

### Visibility

- Archived items are hidden (`WHERE archived_at IS NULL`).
- Cancelled tasks are hidden by default, with a toggle to show them.

---

## 4. Cascades and undo

Every cascade follows the same steps:

1. **Preview** all affected items.
2. **Confirm** with the user.
3. **Apply** everything in one transaction.
4. **Record** each field change in `status_changes` under one `batch_id`.
5. **Undo** restores the whole batch.

**Exception: tasks.** When the user checks off, cancels or archives a task, it applies immediately with no preview or confirmation. The task and its subtask cascade are still applied in one transaction and recorded under one `batch_id`, so the change can be undone. This exception covers only the user's own actions.

Previews come from `GET /api/life-areas/{id}/archive/preview` and `GET /api/projects/{id}/preview?action=complete|cancel|archive`, which list every affected item and what happens to it (archive, cancel, or end the series from today). Archiving and status changes return the `batch_id` to undo.

**Restoring** an archived life area or project restores it and the items its last archive took with it; items archived on their own before that stay archived. Reopening a finished project only makes it active again; undo is how its cancelled items come back.

Undo groups the batch's rows by entity and restores all fields of one entity in a **single UPDATE**. Status and timestamp must change together or the CHECK constraint fails.

`status_changes` records field changes, plus tasks a change created: finishing a "repeat from completion" task creates the next occurrence in the same batch, and undo removes it again if it is unchanged since. Its scope is status changes, cascades, unlinks and series cancellations. Series edits, which split series and regenerate occurrences, ask for confirmation instead and can't be undone.

AI agents may call the same service-layer operations, but cascades always require the user's confirmation.

---

## 5. Repeating items

Repeat rules use the iCalendar `RRULE` format (python-dateutil in the backend, rrule.js in the frontend).

### Editing or cancelling: three choices

As in Google Calendar, changing or cancelling one occurrence of a repeating item offers **This one**, **This and following** or **All**.

| | This one | This and following | All |
| --- | --- | --- | --- |
| **Event** | An exception: change or cancel just that occurrence | End the series the day before (`UNTIL`) and start a new series from this date with the changes. Cancelling only ends the series. | Change or cancel the series |
| **Recurring task** | Change or cancel that one task row | End the template the day before and start a new template from this date with the changes; cancelling only ends the series | Change the template and its unfinished occurrences; cancelling archives it |
| **Routine** | Skip the day: a skipped log for every step | A new schedule row from this date | Replace all schedule rows |

### Events

- A repeating event is one row with an `rrule`, running from `start_date` until `repeat_ends_on` if set. The rule follows the same limits as task templates: no `DTSTART`, `UNTIL` or `COUNT`. Occurrences are calculated when a range is viewed, never stored. A range covers at most 366 days, and includes multi-day occurrences that started earlier and single occurrences moved into it.
- An exception is keyed by the date the occurrence would normally fall on. It either cancels the occurrence or replaces some of its values. There is at most one exception per occurrence.
- Each occurrence keeps the series' length in days.
- **This one** can change any of an occurrence's values, including moving it to other dates. A one-off change or cancellation is undone by restoring the occurrence, which removes its exception.
- **This and following** and **All** change the series' title, notes, location, times or rule. They can't move dates; edit the event itself to move a whole series. Splitting moves later exceptions to the new series. Cancelling the series ("following" ends it, "all" cancels it) is one undoable batch.
- Cancelling a whole event, or every occurrence of a series, sets `cancelled_at`; uncancelling clears it.
- Changing **All**: changing the timing or the rule removes one-off changes, with a warning first, because their dates no longer line up. Cancelled occurrences stay cancelled. Changing other values (title, notes, location) keeps one-off changes. Removing the rule turns the series into a one-off event.

### Task templates and recurring tasks

A **task template** holds reusable task content, as in Notion: title, notes, priority, default owner, a checklist of subtasks, and an optional due-date offset. A template with a repeat rule is a **recurring task**; one without is applied by hand.

- **Creating a task from a template** copies everything onto a new task, including the subtasks. The task keeps `template_id` for reference. Later template edits don't change tasks already created, except through "This and following" or "All" on a recurring task.
- **Due dates**: with `due_offset_days`, a created task is due that many days after its occurrence date (recurring) or its creation date (by hand), at `due_time` if set.
- Occurrences of a recurring task are ordinary rows in `tasks`, identified by `(template_id, occurrence_date)`. Only occurrences have an `occurrence_date`.
- **Repeat from schedule** (the default): generate missing occurrences for the viewed week, from today forward.
- **Repeat from completion**: the template has one open occurrence at a time. Finishing or cancelling it creates the next one, counted from that day. Week generation skips these templates, and "This and following" means the same as "All".
- Never recreate an existing occurrence, even if it was moved or cancelled. For that reason an occurrence can't be deleted, only cancelled.
- Paused and archived templates create nothing. Only repeating templates can be paused.
- Done and cancelled occurrences never change. With "This and following" or "All", only the fields actually changed are copied to unfinished occurrences in range.
- When the rule or timing changes, unfinished occurrences that weren't moved are removed and generated again. Moved, done and cancelled occurrences stay.
- Recurring occurrences don't roll over.
- **Repeat rules** use `FREQ` of DAILY, WEEKLY, MONTHLY or YEARLY, without `DTSTART`, `UNTIL` or `COUNT`: the series runs from `starts_on` to `ends_on`. A picker's "ends after N times" is turned into an end date before saving.
- **Editing a template directly** changes only tasks created from then on, as in Notion. Editing the series from one of its occurrences ("This and following" or "All") also updates unfinished occurrences: their title, notes, priority and due date (unless the due date was changed by hand). Checklist changes apply to occurrences created afterwards.
- Removing the repeat rule turns a recurring task into a plain template and clears its schedule.
- **Deleting a template** keeps the tasks created from it by hand, without the link. A recurring task with occurrences can only be archived.

---

## 6. Routines

- A routine's steps are due on the days given by its schedule. Each schedule row applies from its `starts_on` until the next row starts, so changing the schedule never rewrites which past days were due. Every routine has at least one schedule row.
- A step is to-do on a due date until a log row marks it done or skipped, and missed once the day is over. There is at most one log per step per date.
- Pausing records a pause row for the routine or a single step. Paused days are not due, so they never count as missed. Resuming closes the open pause.
- Routines have no life area of their own; each step has one, so one routine can span several life areas.
- A step is due from its own `starts_on` (the day it was added, by default), so a step added to an existing routine has no missed days before it existed.
- **Changing the schedule**: "following" uses the new rule from a date (today by default) and keeps earlier rows; changing it again on the same date replaces that row. "All" replaces every row, so it also changes which past days were due.
- **Checking off**: a step can be marked done on a due day up to today, or skipped on any due day, future ones included. Unchecking returns it to to-do, or missed for a day that's over. Skipping a whole day skips every due step not already checked.
- **Pausing** starts today and resuming ends the pause today, so a day is either paused or due. Resuming a routine also resumes its steps; a step resumed on its own stays not due while its routine is paused.
- **Streaks** are calculated, never stored: done due days in a row. A missed day resets the count; skipped days, paused days and today (still to do) neither count nor break it.

---

## 7. Metrics

- A metric belongs to a life area or a project. Its **aggregation** says how a period's entries combine: `sum` (distance), `average` (sleep) or `latest` (body weight). Its **direction** says whether higher or lower is better.
- Entries are typed in, for today or an earlier day, never a future one. Several per day are allowed.
- A **reach-by** target has a deadline: "70 kg by June 1". It is in progress, met or missed. The value compared is the metric's entries from the target's start date, combined by its aggregation.
- A **per-period** target repeats: "20 km per week". It shows progress for the current period and met or missed for past ones. An empty end date means it is ongoing.
- Periods are calendar periods. Weeks start on Monday.
- Changing a target ends the old one yesterday and starts a new one today, so history is kept. A target that starts today or later is simply edited instead. A metric can't have two overlapping targets of the same kind, but it can have one of each.
- A target's state is **upcoming** before its start date. A reach-by target is then **in progress**, **met** or **missed**. A per-period target reports its current period (met or in progress), its recent periods (met or missed), counts of each, and **ended** once its end date has passed.
- Changing a metric's aggregation or direction changes how all its targets are judged, past ones included.

---

## 8. Scheduling and derived values

- The week view is an untimed board: Unscheduled plus seven day columns, Monday to Sunday. Tasks have no start time or duration.
  - One call (`GET /api/week`) returns the whole board, optionally for one life area or project.
  - **Unscheduled** holds every to-do task with no date, from every life area and the Inbox.
  - Each day holds its tasks (done ones included, cancelled ones only on request), its event occurrences, and its due routine steps with their status (to-do, done, skipped or missed). A multi-day event appears on every day it covers, with its real start and end dates.
  - Loading a week first runs rollover and creates the week's missing recurring tasks. Both are safe to repeat.
  - Reordering sets a day's (or Unscheduled's) whole order in one step; tasks not listed keep their order after the listed ones.
- Due dates are a date plus an optional time, and a due time requires a due date.
- Events are all-day when they have no start time. An end time requires a start time, and the end date (the last day, inclusive) can't be before the start date. Upcoming/past is calculated from dates.
- Unfinished one-off tasks roll over. A task qualifies if it is `todo`, not archived, not a recurring occurrence, and its `scheduled_date` is before today.
  - Rollover runs whenever the board loads a week, which happens on app launch and when the local date changes while the app is open.
  - Rolled-over tasks go to the end of today's list, keeping their order.
  - The task's `scheduled_date` moves to today, however many days it missed, and `rollover_count` goes up by 1 per move.
  - `due_date` doesn't change, and rollovers aren't recorded for undo.
- Derived values are never stored:
  - **Project progress**: done one-off tasks out of those that aren't cancelled or archived. Recurring occurrences don't count.
  - **Target state**: in progress, met or missed (see section 7).
  - **Life areas** have no progress.
- The **life areas overview** (`GET /api/life-areas/overview?period=&date=`) compares the active areas over one calendar week, month, quarter or year, all derived on read:
  - **Effort**: done tasks per area by the local date they were completed, in the period and the one before. Archived tasks and Inbox tasks don't count.
  - **Outcomes**: area-owned, active metrics only (a project's metrics belong to its page), each charted by the latest target covering the period:
    - **Every period**: one point per target period that has started; the current one is in progress until it ends. Status is met; on track or behind against the time passed for higher-is-better sums; on track while under a lower-is-better limit; behind otherwise. A past view shows how its last period went.
    - **Reach by a date**: the value counted from the target's start at the end of each step (days in a week, weeks in a month, months in a quarter or year). Status is met, missed, or on track or behind: progress from the start (zero for a sum, the first entry otherwise) against the share of time passed.
    - **No target**: the value of each step, and improving, worsening or steady against the step before.
  - **Projects**: tasks done across each area's active projects (as project progress counts them) against pace, the share of those projects' time that has passed. A project's time runs from its creation to its due date; without a due date it counts toward progress but not pace. Within 5 points of pace counts as on pace.
  - **Routine steps done**: per area, each Monday-to-Sunday week's done steps out of those due up to today. Skipped days aren't due; paused days never are.
  - **Wins**: projects finished in the period, per-period targets met in periods that ended in it (grouped per target), and reach-by targets reached in it, newest first.

- An **area page** (`GET /api/life-areas/{id}/page?period=&date=`) shows one area over a calendar period, including its projects' tasks and events:
  - **Metrics**: the area's own metrics, as in the overview's Outcomes. **Projects**: active ones and those finished in the period.
  - **Routines**: each routine with steps in the area, and each such step's status for every day: done, skipped, missed, paused, to-do (today), upcoming or not due.
  - **Task lists**: needs attention (overdue, or rolled over 3 or more times), unscheduled, recurring (templates with a repeat rule), and completed in the period (the newest 100).
  - **Agenda**: from today, or the period's start if later, to its end (nothing for a past period): open tasks scheduled or due in it, events, project due dates, and reach-by target deadlines not yet met.
  - **Contents**: the counts an archive would affect, and whether anything still belongs to the area. Deleting is only offered when nothing does.

### Time and text

- `scheduled_date`, `due_date` and similar are local calendar dates. Event times are local "floating" times with no time zone.
- `_at` datetimes are UTC.
- Titles are 1–200 characters.
- Notes are Markdown, up to 50,000 characters.

---

## 9. Where each rule is enforced

The service validates rules the database also enforces, so the API returns a clear 4xx instead of a database error.

| Rule                                                  | Database                                                       | Service                                  |
| ----------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| Foreign keys active                                   | `PRAGMA foreign_keys=ON` on every application connection       | —                                        |
| Allowed values, text lengths                          | CHECK                                                          | validates first                          |
| Status matches its timestamp                          | CHECK                                                          | sets both in the same UPDATE             |
| Item's life area equals its project's                 | composite FK to `projects(id, life_area_id)`                   | validates first                          |
| Moving a project moves its items                      | `ON UPDATE CASCADE` on that key                                | —                                        |
| Project link requires a life area                     | CHECK (tasks, task templates)                                  | validates first                          |
| Section belongs to the item's project                 | composite FK to `project_sections(id, project_id)`             | validates first                          |
| Deleting a section keeps its tasks                    | blocks the delete while tasks use it                           | moves them to unsectioned first          |
| Occurrence date requires a template                   | CHECK                                                          | —                                        |
| Schedule columns only on repeating templates          | CHECK                                                          | validates first                          |
| One occurrence per template per date                  | unique index                                                   | never recreates or deletes occurrences   |
| One exception per event occurrence                    | unique index                                                   | —                                        |
| Target kind matches period and deadline               | CHECK                                                          | validates first                          |
| No overlapping targets of one kind                    | —                                                              | enforced here only                       |
| One open pause per routine or step                    | partial unique index                                           | validates first                          |
| One routine log per step per date                     | unique index                                                   | —                                        |
| Ids are never reused                                  | `AUTOINCREMENT` on every table                                 | —                                        |
| No new items under an inactive parent                 | —                                                              | enforced here only                       |
| Cascades, unlinks, undo                               | —                                                              | enforced here only                       |
| Repeat generation and series edits                    | —                                                              | enforced here only                       |

---

## 10. Open questions

None at the moment. When the spec leaves a question unsettled, add it here, then move the answer into the sections above and the decision log once it's decided.
