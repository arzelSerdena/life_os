-- =====================================================================
-- Life OS schema (SQLite)
-- Remember: run PRAGMA foreign_keys = ON; on every application connection.
--
-- This is the reference for tables not built yet. Once a table has a
-- SQLAlchemy model, the model is the source of truth.
--
-- Rules enforced here (not only in the service layer):
--   * Status <-> timestamp match: e.g. (status = 'done') = (completed_at IS NOT NULL)
--   * An item's life area equals its project's life area: composite FK
--     (project_id, life_area_id) -> projects(id, life_area_id) ON UPDATE CASCADE,
--     so moving a project to another life area moves its items with it.
--     SQLite skips a composite FK while any of its columns is NULL, so items
--     that may have no life area (tasks, task templates) also CHECK that a
--     project link comes with a life area.
--   * A task's / task template's section belongs to its project: composite FK
--     (section_id, project_id) -> project_sections(id, project_id).
--
-- Every primary key uses AUTOINCREMENT, so a deleted row's id is never
-- reused. status_changes refers to rows by id.
--
-- updated_at: the DEFAULT only fills it on INSERT. SQLAlchemy's base mixin
-- sets it on every UPDATE (onupdate=func.now()).
--
-- Known convention exceptions (kept on purpose, revisit if needed):
--   * routine_logs has created_at only (no updated_at)
--   * status_changes has changed_at only (no created_at/updated_at)
-- =====================================================================


-- ---------------------------------------------------------------------
-- LIFE AREAS
-- A container: it shows what it owns and records no progress.
-- Statuses: active, archived (archived = archived_at is set)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "life_areas" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"vision" TEXT CHECK(vision IS NULL OR length(vision) <= 2000),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"color" TEXT,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ---------------------------------------------------------------------
-- PROJECTS
-- Statuses: active, done, cancelled (+ archived via archived_at)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "projects" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"life_area_id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"due_date" DATE,
	"status" TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'done', 'cancelled')),
	"completed_at" DATETIME,
	"cancelled_at" DATETIME,
	"archived_at" DATETIME,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CHECK((status = 'done') = (completed_at IS NOT NULL)),
	CHECK((status = 'cancelled') = (cancelled_at IS NOT NULL)),
	-- Target of the composite FKs that keep items in their project's life area
	UNIQUE("id", "life_area_id"),
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_projects_life_area" ON "projects" ("life_area_id");


-- ---------------------------------------------------------------------
-- PROJECT SECTIONS
-- Plain groupings inside a project: no status, no dates. A section never
-- moves to another project. Deleting one first moves its tasks and
-- task templates to the project's unsectioned list (the service does this:
-- SQLite's ON DELETE SET NULL on a composite FK would also clear project_id).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "project_sections" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"project_id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	-- Target of the composite FKs on tasks / task_templates
	UNIQUE("id", "project_id"),
	FOREIGN KEY ("project_id") REFERENCES "projects"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_project_sections_project" ON "project_sections" ("project_id");


-- ---------------------------------------------------------------------
-- TASK TEMPLATES
-- Reusable task content, as in Notion. Creating a task from a template
-- copies its title, notes, priority, owner and subtasks; later template
-- edits don't change tasks already created.
-- With a repeat rule (rrule) the template is a recurring task and generates
-- occurrences; without one it is applied by hand.
-- Statuses: active, paused (paused_at, repeating only), archived (archived_at)
-- repeat_from: 'schedule' follows the calendar rule; 'completion' creates the
-- next occurrence from the date the previous one was finished.
-- due_offset_days: a created task is due this many days after its
-- occurrence date (repeating) or creation date (by hand).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "task_templates" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"life_area_id" INTEGER CHECK(project_id IS NULL OR life_area_id IS NOT NULL),
	"project_id" INTEGER,
	"section_id" INTEGER CHECK(section_id IS NULL OR project_id IS NOT NULL),
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"priority" TEXT NOT NULL DEFAULT 'none' CHECK(priority IN ('high', 'medium', 'low', 'none')),
	"due_offset_days" INTEGER CHECK(due_offset_days IS NULL OR due_offset_days >= 0),
	"due_time" TIME CHECK(due_time IS NULL OR due_offset_days IS NOT NULL),
	"rrule" TEXT,
	"repeat_from" TEXT NOT NULL DEFAULT 'schedule' CHECK(repeat_from IN ('schedule', 'completion')),
	"starts_on" DATE,
	"ends_on" DATE CHECK(ends_on IS NULL OR ends_on >= starts_on),
	"paused_at" DATETIME,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	-- Schedule columns only make sense on a repeating template
	CHECK((rrule IS NULL) = (starts_on IS NULL)),
	CHECK(rrule IS NOT NULL OR (ends_on IS NULL AND paused_at IS NULL AND repeat_from = 'schedule')),
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id", "life_area_id") REFERENCES "projects"("id", "life_area_id")
	ON UPDATE CASCADE ON DELETE NO ACTION,
	FOREIGN KEY ("section_id", "project_id") REFERENCES "project_sections"("id", "project_id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_task_templates_life_area" ON "task_templates" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_task_templates_project" ON "task_templates" ("project_id", "life_area_id");
CREATE INDEX IF NOT EXISTS "idx_task_templates_section" ON "task_templates" ("section_id", "project_id");


-- ---------------------------------------------------------------------
-- TASK TEMPLATE SUBTASKS
-- The checklist copied onto every task created from the template.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "task_template_subtasks" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"template_id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY ("template_id") REFERENCES "task_templates"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_task_template_subtasks_template" ON "task_template_subtasks" ("template_id");


-- ---------------------------------------------------------------------
-- TASKS
-- Statuses: todo, done, cancelled (+ archived via archived_at)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"life_area_id" INTEGER CHECK(project_id IS NULL OR life_area_id IS NOT NULL),
	"project_id" INTEGER,
	"section_id" INTEGER CHECK(section_id IS NULL OR project_id IS NOT NULL),
	"template_id" INTEGER,
	-- Set only on occurrences of a repeating template. A task created by hand
	-- from a template keeps template_id for reference, with no occurrence_date.
	"occurrence_date" DATE CHECK(occurrence_date IS NULL OR template_id IS NOT NULL),
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"status" TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'done', 'cancelled')),
	"priority" TEXT NOT NULL DEFAULT 'none' CHECK(priority IN ('high', 'medium', 'low', 'none')),
	"scheduled_date" DATE,
	"due_date" DATE,
	"due_time" TIME CHECK(due_time IS NULL OR due_date IS NOT NULL),
	"completed_at" DATETIME,
	"cancelled_at" DATETIME,
	"archived_at" DATETIME,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"rollover_count" INTEGER NOT NULL DEFAULT 0 CHECK(rollover_count >= 0),
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CHECK((status = 'done') = (completed_at IS NOT NULL)),
	CHECK((status = 'cancelled') = (cancelled_at IS NOT NULL)),
	FOREIGN KEY ("template_id") REFERENCES "task_templates"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id", "life_area_id") REFERENCES "projects"("id", "life_area_id")
	ON UPDATE CASCADE ON DELETE NO ACTION,
	FOREIGN KEY ("section_id", "project_id") REFERENCES "project_sections"("id", "project_id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_tasks_life_area" ON "tasks" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_project" ON "tasks" ("project_id", "life_area_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_section" ON "tasks" ("section_id", "project_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_scheduled_date" ON "tasks" ("scheduled_date");
CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks" ("due_date");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tasks_occurrence" ON "tasks" ("template_id", "occurrence_date");


-- ---------------------------------------------------------------------
-- SUBTASKS
-- Statuses: todo, done, cancelled (cancelled when the task is done/cancelled/archived)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subtasks" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"task_id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"status" TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'done', 'cancelled')),
	"completed_at" DATETIME,
	"cancelled_at" DATETIME,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CHECK((status = 'done') = (completed_at IS NOT NULL)),
	CHECK((status = 'cancelled') = (cancelled_at IS NOT NULL)),
	FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_subtasks_task" ON "subtasks" ("task_id");


-- ---------------------------------------------------------------------
-- EVENTS
-- Statuses: upcoming / past (calculated from dates), cancelled (cancelled_at)
-- + archived via archived_at
-- rrule NULL = one-off event. A repeating series runs from start_date until
-- repeat_ends_on (if set); the rule itself carries no DTSTART, UNTIL or COUNT.
-- Each occurrence keeps the series' length in days.
-- end_date is the last day of the event (inclusive).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "events" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"life_area_id" INTEGER NOT NULL,
	"project_id" INTEGER,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"start_date" DATE NOT NULL,
	"end_date" DATE CHECK(end_date IS NULL OR end_date >= start_date),
	"start_time" TIME,
	"end_time" TIME CHECK(end_time IS NULL OR start_time IS NOT NULL),
	"location" TEXT CHECK(location IS NULL OR length(location) <= 300),
	"rrule" TEXT,
	"repeat_ends_on" DATE CHECK(repeat_ends_on IS NULL OR (rrule IS NOT NULL AND repeat_ends_on >= start_date)),
	"cancelled_at" DATETIME,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	-- On a one-day event the end time can't be before the start time
	CHECK(end_time IS NULL OR (end_date IS NOT NULL AND end_date > start_date) OR end_time >= start_time),
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id", "life_area_id") REFERENCES "projects"("id", "life_area_id")
	ON UPDATE CASCADE ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_events_life_area" ON "events" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_events_project" ON "events" ("project_id", "life_area_id");
CREATE INDEX IF NOT EXISTS "idx_events_start_date" ON "events" ("start_date");


-- ---------------------------------------------------------------------
-- EVENT EXCEPTIONS
-- Changes to one occurrence of a repeating event, keyed by the date that
-- occurrence would normally fall on (iCalendar's RECURRENCE-ID).
-- is_cancelled = 1 removes the occurrence; otherwise each non-NULL column
-- replaces the series' value for that occurrence.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "event_exceptions" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"event_id" INTEGER NOT NULL,
	"occurrence_date" DATE NOT NULL,
	"is_cancelled" INTEGER NOT NULL DEFAULT 0 CHECK(is_cancelled IN (0, 1)),
	"title" TEXT CHECK(title IS NULL OR length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"start_date" DATE,
	"end_date" DATE CHECK(end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
	"start_time" TIME,
	"end_time" TIME,
	"location" TEXT CHECK(location IS NULL OR length(location) <= 300),
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY ("event_id") REFERENCES "events"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_event_exceptions_occurrence" ON "event_exceptions" ("event_id", "occurrence_date");


-- ---------------------------------------------------------------------
-- METRICS
-- Something measured over time, owned by a life area or a project.
-- Statuses: active, archived (archived_at). Archiving keeps entries and targets.
-- aggregation: how a period's entries combine ('sum' for distance,
-- 'average' for sleep, 'latest' for body weight).
-- direction: whether a higher or lower value is better.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "metrics" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"life_area_id" INTEGER NOT NULL,
	"project_id" INTEGER,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"unit" TEXT CHECK(unit IS NULL OR length(unit) BETWEEN 1 AND 20),
	"aggregation" TEXT NOT NULL CHECK(aggregation IN ('sum', 'average', 'latest')),
	"direction" TEXT NOT NULL DEFAULT 'higher' CHECK(direction IN ('higher', 'lower')),
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id", "life_area_id") REFERENCES "projects"("id", "life_area_id")
	ON UPDATE CASCADE ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_metrics_life_area" ON "metrics" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_metrics_project" ON "metrics" ("project_id", "life_area_id");


-- ---------------------------------------------------------------------
-- METRIC ENTRIES
-- One logged value. Several per day are allowed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "metric_entries" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"metric_id" INTEGER NOT NULL,
	"date" DATE NOT NULL,
	"value" REAL NOT NULL,
	"note" TEXT CHECK(note IS NULL OR length(note) <= 500),
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY ("metric_id") REFERENCES "metrics"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_metric_entries_metric_date" ON "metric_entries" ("metric_id", "date");


-- ---------------------------------------------------------------------
-- METRIC TARGETS
-- kind 'reach_by': reach target_value by end_date ("70 kg by June 1").
-- kind 'per_period': reach target_value every period ("20 km per week");
--   end_date NULL means ongoing.
-- Met / missed is calculated from entries, never stored. Changing a target
-- ends the old one and starts a new one, so history is kept. The service
-- rejects two overlapping targets of the same kind on one metric.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "metric_targets" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"metric_id" INTEGER NOT NULL,
	"kind" TEXT NOT NULL CHECK(kind IN ('reach_by', 'per_period')),
	"target_value" REAL NOT NULL,
	"period" TEXT CHECK(period IN ('day', 'week', 'month')),
	"start_date" DATE NOT NULL,
	"end_date" DATE CHECK(end_date IS NULL OR end_date >= start_date),
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CHECK((kind = 'per_period') = (period IS NOT NULL)),
	CHECK(kind <> 'reach_by' OR end_date IS NOT NULL),
	FOREIGN KEY ("metric_id") REFERENCES "metrics"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_metric_targets_metric" ON "metric_targets" ("metric_id");


-- ---------------------------------------------------------------------
-- ROUTINES
-- Statuses: active, paused (an open row in routine_pauses), archived (archived_at)
-- Which days the steps are due comes from routine_schedules.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "routines" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ---------------------------------------------------------------------
-- ROUTINE SCHEDULES
-- A routine's repeat rule over time. Each row applies from starts_on until
-- the next row's starts_on, so changing the schedule never rewrites which
-- past days were due. Every routine has at least one row (daily by default).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "routine_schedules" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"routine_id" INTEGER NOT NULL,
	"rrule" TEXT NOT NULL DEFAULT 'FREQ=DAILY',
	"starts_on" DATE NOT NULL,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY ("routine_id") REFERENCES "routines"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_routine_schedules_start" ON "routine_schedules" ("routine_id", "starts_on");


-- ---------------------------------------------------------------------
-- ROUTINE STEPS
-- Statuses: active, paused (an open row in routine_pauses), archived (archived_at)
-- Owned by a life area or a project. Daily to-do / done lives in routine_logs.
-- Due from starts_on, so a step added later has no missed days before it existed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "routine_steps" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"routine_id" INTEGER NOT NULL,
	"life_area_id" INTEGER NOT NULL,
	"project_id" INTEGER,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"starts_on" DATE NOT NULL,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY ("routine_id") REFERENCES "routines"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id", "life_area_id") REFERENCES "projects"("id", "life_area_id")
	ON UPDATE CASCADE ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_routine_steps_routine" ON "routine_steps" ("routine_id");
CREATE INDEX IF NOT EXISTS "idx_routine_steps_life_area" ON "routine_steps" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_routine_steps_project" ON "routine_steps" ("project_id", "life_area_id");


-- ---------------------------------------------------------------------
-- ROUTINE PAUSES
-- When a routine or a single step was paused, so paused days never count
-- as missed. Covers starts_on up to, but not including, ends_on.
-- ends_on NULL = still paused. Exactly one of routine_id / routine_step_id.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "routine_pauses" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"routine_id" INTEGER,
	"routine_step_id" INTEGER,
	"starts_on" DATE NOT NULL,
	"ends_on" DATE CHECK(ends_on IS NULL OR ends_on >= starts_on),
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CHECK((routine_id IS NULL) <> (routine_step_id IS NULL)),
	FOREIGN KEY ("routine_id") REFERENCES "routines"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY ("routine_step_id") REFERENCES "routine_steps"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_routine_pauses_routine" ON "routine_pauses" ("routine_id");
CREATE INDEX IF NOT EXISTS "idx_routine_pauses_step" ON "routine_pauses" ("routine_step_id");
-- At most one open pause per routine and per step
CREATE UNIQUE INDEX IF NOT EXISTS "uq_routine_pauses_open_routine" ON "routine_pauses" ("routine_id") WHERE ends_on IS NULL AND routine_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_routine_pauses_open_step" ON "routine_pauses" ("routine_step_id") WHERE ends_on IS NULL AND routine_step_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- ROUTINE LOGS
-- One row per step per day it was checked. No row = still to-do, or
-- missed once the day is over (unless the step was paused).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "routine_logs" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"routine_step_id" INTEGER NOT NULL,
	"date" DATE NOT NULL,
	"status" TEXT NOT NULL CHECK(status IN ('done', 'skipped')),
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY ("routine_step_id") REFERENCES "routine_steps"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_routine_logs_step_date" ON "routine_logs" ("routine_step_id", "date");


-- ---------------------------------------------------------------------
-- STATUS CHANGES
-- Field-level history of status changes, cascades and unlinks, so a batch
-- can be undone. No foreign keys on purpose: it records rows from many tables.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "status_changes" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"batch_id" TEXT NOT NULL,
	"entity_type" TEXT NOT NULL CHECK(entity_type IN (
		'life_area', 'project', 'task_template', 'task', 'subtask', 'event',
		'metric', 'routine', 'routine_step')),
	"entity_id" INTEGER NOT NULL,
	"field" TEXT NOT NULL,
	"old_value" TEXT,
	"new_value" TEXT,
	"changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_status_changes_batch" ON "status_changes" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_status_changes_entity" ON "status_changes" ("entity_type", "entity_id");
