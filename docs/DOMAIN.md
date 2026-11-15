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
| **Entry**          | One value for a metric on a date: typed in, or derived from a routine step's days.                       |
| **Target**         | What a metric aims for: reach a value by a date, or hit a value every period.                            |
| **Routine**        | A set of steps due on the days its schedule says (daily by default). Has no owner.                       |
| **Routine step**   | One action in a routine.                                                                                  |
| **Routine log**    | The record of a step on a given day: done or skipped.                                                     |
| **Full day**       | A day on which every due step of a routine was done (section 6).                                          |
| **Run**            | A routine's full days in a row: current run, best run, longest run.                                       |
| **Streak**         | One routine step's done days in a row. Never used for a whole routine.                                    |
| **Inbox**          | Tasks and task templates with no life area. The Inbox screen lists the open tasks among them.            |
| **Unscheduled**    | The Tasks view of open tasks that have a life area but no scheduled date.                                 |
| **Overdue**        | An open task whose due date is before today. Listed in Today.                                             |
| **Today**          | The local date, shifted by the `day_ends_at` setting (section 8).                                        |
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

These belong to their parent outright and are deleted with it: subtasks, template subtasks, event exceptions, metric entries and targets, routine schedules, pauses and logs. Section 4 has the full delete rules.

A metric can also be fed by a routine step (section 7). That is a link, not ownership: the metric keeps its own owner, which may differ from the step's.

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

**Confirming.** One confirm dialog serves every cascade and every delete with contents. Previews (cascade and delete) return per-item rows grouped by effect, not only counts: each group is one of cancelled, ends from today, archived, deleted, kept or stops updating, and each row carries the item's name, kind, owner colour and a date or meta line. An archive or status change with nothing going with it applies at once with the undo toast; Delete always asks. Archiving a life area shows the undo toast after the confirmation too.

**Restoring** an archived life area, project or routine restores it and the items its last archive took with it (a routine's steps); items archived on their own before that stay archived, and so does a step whose owning area or project is still inactive. Restore is refused (409) while the parent is archived. Reopening a finished project only makes it active again; undo is how its cancelled items come back.

Undo groups the batch's rows by entity and restores all fields of one entity in a **single UPDATE**. Status and timestamp must change together or the CHECK constraint fails.

`status_changes` records field changes, plus tasks a change created: finishing a "repeat from completion" task creates the next occurrence in the same batch, and undo removes it again if it is unchanged since. Its scope is status changes, cascades, unlinks and series cancellations. Series edits, which split series and regenerate occurrences, ask for confirmation instead and can't be undone.

AI agents may call the same service-layer operations, but cascades always require the user's confirmation.

### Deleting

Deleting is permanent. Deletes are hard deletes and are never recorded in `status_changes`, so undo doesn't cover them; undoing an earlier change to a deleted item is refused (409). Archiving is the reversible way to retire something.

Where the screen shows an undo toast, the frontend waits about 6 seconds before it sends the `DELETE`. Undo in the toast just cancels the request, so the backend needs no undo for deletes. A pending delete is hidden from every list, Home included.

| Item | Delete rule | Confirmation |
| --- | --- | --- |
| Life area, project | Only when nothing belongs to it; otherwise 409. A project's sections go with it. | Red confirmation |
| Section | Its tasks and templates move to unsectioned first. | Red confirmation |
| One-off task | Deletes it and its subtasks. | Undo toast |
| Recurring occurrence | Can't be deleted, only cancelled, or it would be generated again. | — |
| Task template, recurring task | Deletes the template, its checklist and its open (to-do) occurrences. Done and cancelled occurrences stay as plain tasks: `template_id` and `occurrence_date` are cleared. Tasks made from it by hand stay, without the link. | Red confirmation with counts |
| Event, one-off | Deletes it and its exceptions. | Red confirmation |
| Event, repeating | This one: cancels the occurrence (an exception). This and following: ends the series the day before and deletes later exceptions; from the first occurrence it deletes the series. All: deletes the event and its exceptions. | Series dialog |
| Metric | Deletes it with its entries and targets. | Red confirmation with counts |
| Metric entry, metric target, subtask | Deletes it. | Undo toast |
| Routine | Deletes it with its schedules, pauses, steps and logs. Refused (409) while any of its steps feeds a metric. | Red confirmation with counts |
| Routine step | Deletes it with its logs and pauses. Refused (409) while it feeds a metric; the message names the metric. | Red confirmation with counts |

The counts come from `GET .../delete-preview` on task templates, metrics, routines and routine steps. A routine's or step's preview also lists the metrics that block the delete.

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
- **Deleting a template** deletes its checklist and its open occurrences. Done and cancelled occurrences and tasks made from it by hand stay as plain tasks, without the link. See "Deleting" in section 4.

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
- A step can feed a metric (section 7). While it does, neither the step nor its routine can be deleted.
- **Streaks** belong to one step and are calculated, never stored: the step's done due days in a row. A missed day resets the count; skipped days, paused days and today (still to do) neither count nor break it.
- **Full days and runs** belong to the routine. A full day is a due day on which every due step was done. Skipped steps are left out of the day; a day with every step skipped, a paused day and today are neutral (they neither count nor break a run). A day with a missed step breaks the run. A **run** is full days in a row: the current run, the best run (with its dates) and, across routines, the longest run. When the current run is 0, the best run is shown first. "Streak" is never used for a routine.
- **Restoring** a routine brings back the steps its archive took (section 4).
- Routines are ordered by `routines.sort_order`, set by dragging in the Plan sidebar.

---

## 7. Metrics

- A metric belongs to a life area or a project. Its **aggregation** says how a period's entries combine: `sum` (distance), `average` (sleep) or `latest` (body weight). Its **direction** says whether higher or lower is better.
- Entries are typed in, for today or an earlier day, never a future one. Several per day are allowed.
- **Format** says how values are shown: `number` (the default), `currency`, `percent` or `duration`. What `unit` means depends on it:
  - number: an optional suffix of 1–20 characters ("km", "pages", "times");
  - currency: an ISO 4217 code, required, `PHP` by default;
  - percent and duration: no unit. A duration is stored in minutes, a percent from 0 to 100.
- The API returns raw numbers with the format and unit; the screen formats them (`Intl.NumberFormat`): ₱1,500, ₱100K on tiles, 35%, 1 h 30 m.
- The New metric form offers presets that only fill in format and unit: Number, Money, Percentage, Time, Distance (km/mi), Weight (kg/lb), Pages, Chapters, Times. Presets aren't stored.
- Format and unit can change later. Changing the format without a unit resets the unit to that format's default. Stored values are never converted.
- **Current value**: a new manual metric may come with its current value, which becomes its first entry, dated today, in the same transaction.

### Routine-step metrics

- A metric's **source** is `manual` (typed entries) or `routine_step`. It is set when the metric is created and can't change.
- A routine-step metric stores no entries. They are derived on read from the step's logs, one per due day: done counts, a missed day counts as nothing, and skipped days, paused days and days that aren't due are left out. Today counts only once it's done. Typing an entry for it is refused (409).
- Its aggregation is `sum` (days done; format number, unit `days`) or `average` (completion rate; format percent, 0–100). `latest` isn't allowed. A done day is worth 1 for a sum and 100 for an average.
- Targets work as for any metric: "5 days per week", or "80% per month".
- The metric has its own owner, which may differ from the step's.
- Archiving the step (or its routine) keeps the metric's history but adds no new days. The archive day counts only if it was done.
- Deleting the step, or its routine, is refused (409) while the metric uses it.
- A habit like "run 3 times a week" is still a metric with a weekly target; it can now be fed by a routine step instead of typed entries.
- A **reach-by** target has a deadline: "70 kg by June 1". It is in progress, met or missed. The value compared is the metric's entries from the target's start date, combined by its aggregation.
- A **per-period** target repeats: "20 km per week". It shows progress for the current period and met or missed for past ones. An empty end date means it is ongoing.
- Periods are calendar periods. Weeks start on Monday.
- Changing a target ends the old one yesterday and starts a new one today, so history is kept. A target that starts today or later is simply edited instead. A metric can't have two overlapping targets of the same kind, but it can have one of each.
- A target's state is **upcoming** before its start date. A reach-by target is then **in progress**, **met** or **missed**. A per-period target reports its current period (met or in progress), its recent periods (met or missed), counts of each, and **ended** once its end date has passed.
- Changing a metric's aggregation or direction changes how all its targets are judged, past ones included.

---

## 8. Scheduling and derived values

- **Placement rule**, everywhere (Tasks boards, Calendar, agendas, Home): a task sits on its scheduled date; if it has none, on its due date; if neither, it is Unscheduled. **Overdue** = an open task whose due date is before today; it is listed in Today. Tasks have no start time or duration.
- **Calendar**: Week and Month are FullCalendar day grids (untimed); Quarter and Year are a linear calendar (one row per month). Projects show as bars from `start_date` (or the day they were created) to `due_date` in Quarter and Year; a project with no due date has no bar.
- Day columns load from one call:
  - `GET /api/week` returns Unscheduled plus seven day columns, Monday to Sunday, optionally for one life area or project.
  - **Unscheduled** holds every to-do task with neither a scheduled nor a due date, from every life area and the Inbox.
  - Each day holds the tasks the placement rule puts on it (done ones included, cancelled ones only on request), its event occurrences, and its due routine steps with their status (to-do, done, skipped or missed). A multi-day event appears on every day it covers, with its real start and end dates.
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
  - **Projects**: tasks done across each area's active projects (as project progress counts them) against pace, the share of those projects' time that has passed. A project's time runs from its start date (or its creation, if it has none) to its due date; without a due date it counts toward progress but not pace. Within 5 points of pace counts as on pace.
  - **Routine steps done**: per area, each Monday-to-Sunday week's done steps out of those due up to today. Skipped days aren't due; paused days never are.
  - **Wins**: projects finished in the period, per-period targets met in periods that ended in it (grouped per target), and reach-by targets reached in it, newest first.

- An **area page** (`GET /api/life-areas/{id}/page?period=&date=`) shows one area over a calendar period, including its projects' tasks and events:
  - **Metrics**: the area's own metrics, as in the overview's Outcomes. **Projects**: active ones and those finished in the period.
  - **Routines**: each routine with steps in the area, and each such step's status for every day: done, skipped, missed, paused, to-do (today), upcoming or not due.
  - **Task lists**: needs attention (overdue, or rolled over 3 or more times), unscheduled, recurring (templates with a repeat rule), and completed in the period (the newest 100).
  - **Agenda**: from today, or the period's start if later, to its end (nothing for a past period): open tasks scheduled or due in it, events, project due dates, and reach-by target deadlines not yet met.
  - **Contents**: the counts an archive would affect, and whether anything still belongs to the area. Deleting is only offered when nothing does.

- A **routine page** (`GET /api/routines/{id}/page?period=&date=`) shows one routine over a calendar period:
  - **Totals**: completion rate (done ÷ (done + missed)), full days out of due days, the current and best run with their dates, missed and skipped.
  - **Step days**: each step's status for every day: done, skipped, missed, paused, to do (today), upcoming, not due, or not started (before the step's `starts_on`).
  - **History**: the schedules and pauses that touch the period, and each step's completion (done of done + missed).
  - An archived routine reads the same way, read-only, opened on the period that holds its archive date; its current run is the final run.
- The **Routines overview** (`GET /api/routines/overview?period=&date=`) shows the same totals across all active routines (the longest run names its routine), each routine's daily share of due steps done, the 3 most-missed steps in the period, and **Pick up**: steps whose run of 4 or more done days ended with a miss this week.
- **Home** (`GET /api/home`) covers today only, with no period:
  - **Today**: open tasks the placement rule puts on today, plus overdue tasks; events that cover today; project due dates and reach-by target deadlines that fall today; tasks completed today.
  - **Routines today**: routine steps due today with their status and step streak.
  - **Log today**: manual metrics, from any owner, with a per-day or per-week target and no entry today, with the period's progress.
  - **Needs a push**: the Inbox count; projects due within 7 days, stalled (nothing done in 14 or more days) or with no next step (nothing scheduled in the next 7 days); metrics behind target.
  - **Coming up**: the next 7 days' events, project due dates and target deadlines.
  - **Header done count**: today's tasks (overdue included) plus today's due routine steps, with skipped steps left out of both counts.
  - **First run**: the setup message shows until there is a life area and at least one task or routine.
  - Quick add on Home creates a task scheduled today with no owner (so it is also in the Inbox).
- **Finished & archived** lists archived life areas, done, cancelled or archived projects, and archived routines. Areas and projects are deleted only when empty; a routine is deleted through the confirm dialog unless one of its steps feeds a metric.

### Today and settings

- Settings live in a single-row `settings` table: `open_on_start` (home, tasks or calendar), `time_format` (12h or 24h), `day_ends_at` (an hour from 0 to 4), `auto_backup`, `keep_backups` (7, 14 or 30) and `backup_folder`. Window layout (sidebar width, card sizes) stays in the browser's `localStorage`.
- **Day ends at** shifts "today": until that hour, the previous date is still today. It applies to Home, rollover, routine logs (which day a check-off counts for), completed dates and streaks and runs. The backend reads today from `app.clock.today()`, which applies the setting.
- **Restore from backup** replaces the data with a chosen backup, after a confirmation that shows its date and size; the app backs up the current data first.

### Time and text

- `scheduled_date`, `due_date` and similar are local calendar dates. Event times are local "floating" times with no time zone.
- `_at` datetimes are UTC.
- Times are 12-hour by default (`time_format`); a 12-hour time on the hour drops ":00" (10 AM, 7 – 9 PM). A multi-day event says "Until 3 PM" on its last day.
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
| A metric's unit fits its format                       | CHECK                                                          | validates first, fills defaults          |
| Routine-step metric: has a step, sum or average, fixed format | CHECK                                                  | validates first                          |
| No typed entries on a routine-step metric             | —                                                              | enforced here only                       |
| A step feeding a metric isn't deleted                 | foreign key from `metrics.routine_step_id`                     | refuses first, naming the metric         |
| One open pause per routine or step                    | partial unique index                                           | validates first                          |
| One routine log per step per date                     | unique index                                                   | —                                        |
| Ids are never reused                                  | `AUTOINCREMENT` on every table                                 | —                                        |
| One settings row                                      | CHECK (`id = 1`)                                               | creates it with defaults on first read   |
| No new items under an inactive parent                 | —                                                              | enforced here only                       |
| Cascades, unlinks, undo                               | —                                                              | enforced here only                       |
| Repeat generation and series edits                    | —                                                              | enforced here only                       |

---

## 10. Open questions

None at the moment. When the spec leaves a question unsettled, add it here, then move the answer into the sections above and the decision log once it's decided.
