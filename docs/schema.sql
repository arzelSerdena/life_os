-- =====================================================================
-- Life OS schema (SQLite)
-- Remember: run PRAGMA foreign_keys = ON; on every connection.
--
-- Rules enforced here (not only in the service layer):
--   * Status <-> timestamp match: e.g. (status = 'done') = (completed_at IS NOT NULL)
--   * A task's / recurring task's milestone belongs to its project
--     (composite FK (milestone_id, project_id) -> milestones(id, project_id)).
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
-- Statuses: active, archived (archived = archived_at is set)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "life_areas" (
	"id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"vision" TEXT CHECK(vision IS NULL OR length(vision) <= 2000),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"color" TEXT,
	"icon" TEXT,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);


-- ---------------------------------------------------------------------
-- PRIORITIES
-- Statuses: active, cancelled (+ archived via archived_at)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "priorities" (
	"id" INTEGER NOT NULL,
	"life_area_id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"status" TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
	"cancelled_at" DATETIME,
	"archived_at" DATETIME,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CHECK((status = 'cancelled') = (cancelled_at IS NOT NULL)),
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_priorities_life_area" ON "priorities" ("life_area_id");


-- ---------------------------------------------------------------------
-- GOALS
-- Statuses: active, achieved, cancelled (+ archived via archived_at)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "goals" (
	"id" INTEGER NOT NULL,
	"life_area_id" INTEGER NOT NULL,
	"priority_id" INTEGER,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"target_date" DATE,
	"status" TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'achieved', 'cancelled')),
	"achieved_at" DATETIME,
	"cancelled_at" DATETIME,
	"archived_at" DATETIME,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CHECK((status = 'achieved') = (achieved_at IS NOT NULL)),
	CHECK((status = 'cancelled') = (cancelled_at IS NOT NULL)),
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("priority_id") REFERENCES "priorities"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_goals_life_area" ON "goals" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_goals_priority" ON "goals" ("priority_id");


-- ---------------------------------------------------------------------
-- PROJECT GROUPS
-- Statuses: active, archived (archived = archived_at is set)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "group_projects" (
	"id" INTEGER NOT NULL,
	"life_area_id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_group_projects_life_area" ON "group_projects" ("life_area_id");


-- ---------------------------------------------------------------------
-- PROJECTS
-- Statuses: active, done, cancelled (+ archived via archived_at)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "projects" (
	"id" INTEGER NOT NULL,
	"life_area_id" INTEGER NOT NULL,
	"goal_id" INTEGER,
	"group_project_id" INTEGER,
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
	PRIMARY KEY("id"),
	CHECK((status = 'done') = (completed_at IS NOT NULL)),
	CHECK((status = 'cancelled') = (cancelled_at IS NOT NULL)),
	FOREIGN KEY ("group_project_id") REFERENCES "group_projects"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("goal_id") REFERENCES "goals"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_projects_life_area" ON "projects" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_projects_goal" ON "projects" ("goal_id");
CREATE INDEX IF NOT EXISTS "idx_projects_group" ON "projects" ("group_project_id");


-- ---------------------------------------------------------------------
-- MILESTONES
-- Statuses: active, achieved, cancelled (+ archived via archived_at)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" INTEGER NOT NULL,
	"project_id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"due_date" DATE,
	"status" TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'achieved', 'cancelled')),
	"achieved_at" DATETIME,
	"cancelled_at" DATETIME,
	"archived_at" DATETIME,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	CHECK((status = 'achieved') = (achieved_at IS NOT NULL)),
	CHECK((status = 'cancelled') = (cancelled_at IS NOT NULL)),
	-- Target of the composite FKs on tasks / recurring_tasks
	UNIQUE("id", "project_id"),
	FOREIGN KEY ("project_id") REFERENCES "projects"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_milestones_project" ON "milestones" ("project_id");


-- ---------------------------------------------------------------------
-- RECURRING TASKS (templates that generate rows in tasks)
-- Statuses: active, paused (paused_at), archived (archived_at)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "recurring_tasks" (
	"id" INTEGER NOT NULL,
	"life_area_id" INTEGER,
	"project_id" INTEGER,
	"milestone_id" INTEGER CHECK(milestone_id IS NULL OR project_id IS NOT NULL),
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"rrule" TEXT NOT NULL,
	"starts_on" DATE NOT NULL,
	"ends_on" DATE CHECK(ends_on IS NULL OR ends_on >= starts_on),
	"due_time" TIME,
	"paused_at" DATETIME,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	-- Milestone must belong to the same project. ON UPDATE CASCADE: moving a
	-- milestone to another project moves its recurring tasks with it.
	FOREIGN KEY ("milestone_id", "project_id") REFERENCES "milestones"("id", "project_id")
	ON UPDATE CASCADE ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_recurring_tasks_life_area" ON "recurring_tasks" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_recurring_tasks_project" ON "recurring_tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_recurring_tasks_milestone" ON "recurring_tasks" ("milestone_id", "project_id");


-- ---------------------------------------------------------------------
-- TASKS
-- Statuses: todo, done, cancelled (+ archived via archived_at)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" INTEGER NOT NULL,
	"life_area_id" INTEGER,
	"project_id" INTEGER,
	"milestone_id" INTEGER CHECK(milestone_id IS NULL OR project_id IS NOT NULL),
	"recurring_task_id" INTEGER,
	"occurrence_date" DATE CHECK((recurring_task_id IS NULL) = (occurrence_date IS NULL)),
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"status" TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'done', 'cancelled')),
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
	PRIMARY KEY("id"),
	CHECK((status = 'done') = (completed_at IS NOT NULL)),
	CHECK((status = 'cancelled') = (cancelled_at IS NOT NULL)),
	FOREIGN KEY ("recurring_task_id") REFERENCES "recurring_tasks"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	-- Milestone must belong to the same project. ON UPDATE CASCADE: moving a
	-- milestone to another project moves its tasks with it.
	FOREIGN KEY ("milestone_id", "project_id") REFERENCES "milestones"("id", "project_id")
	ON UPDATE CASCADE ON DELETE NO ACTION,
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_tasks_life_area" ON "tasks" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_project" ON "tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_milestone" ON "tasks" ("milestone_id", "project_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_scheduled_date" ON "tasks" ("scheduled_date");
CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks" ("due_date");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tasks_occurrence" ON "tasks" ("recurring_task_id", "occurrence_date");


-- ---------------------------------------------------------------------
-- SUBTASKS
-- Statuses: todo, done, cancelled (cancelled when the task is done/cancelled)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subtasks" (
	"id" INTEGER NOT NULL,
	"task_id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"status" TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'done', 'cancelled')),
	"completed_at" DATETIME,
	"cancelled_at" DATETIME,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
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
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "events" (
	"id" INTEGER NOT NULL,
	"life_area_id" INTEGER NOT NULL,
	"project_id" INTEGER,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"start_date" DATE NOT NULL,
	"end_date" DATE CHECK(end_date IS NULL OR end_date >= start_date),
	"start_time" TIME,
	"end_time" TIME CHECK(end_time IS NULL OR start_time IS NOT NULL),
	"location" TEXT CHECK(location IS NULL OR length(location) <= 300),
	"cancelled_at" DATETIME,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_events_life_area" ON "events" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_events_project" ON "events" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_events_start_date" ON "events" ("start_date");


-- ---------------------------------------------------------------------
-- ROUTINES
-- Statuses: active, paused (paused_at)
-- rrule decides which days the routine's steps are due (default: daily)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "routines" (
	"id" INTEGER NOT NULL,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"rrule" TEXT NOT NULL DEFAULT 'FREQ=DAILY',
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"paused_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);


-- ---------------------------------------------------------------------
-- ROUTINE STEPS
-- Statuses: active, paused (paused_at), archived (archived_at)
-- Daily to-do / done lives in routine_logs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "routine_steps" (
	"id" INTEGER NOT NULL,
	"routine_id" INTEGER NOT NULL,
	"life_area_id" INTEGER NOT NULL,
	"goal_id" INTEGER CHECK(NOT (goal_id IS NOT NULL AND project_id IS NOT NULL)),
	"project_id" INTEGER,
	"title" TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
	"notes" TEXT CHECK(notes IS NULL OR length(notes) <= 50000),
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"paused_at" DATETIME,
	"archived_at" DATETIME,
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	FOREIGN KEY ("routine_id") REFERENCES "routines"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY ("life_area_id") REFERENCES "life_areas"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("goal_id") REFERENCES "goals"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY ("project_id") REFERENCES "projects"("id")
	ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_routine_steps_routine" ON "routine_steps" ("routine_id");
CREATE INDEX IF NOT EXISTS "idx_routine_steps_life_area" ON "routine_steps" ("life_area_id");
CREATE INDEX IF NOT EXISTS "idx_routine_steps_goal" ON "routine_steps" ("goal_id");
CREATE INDEX IF NOT EXISTS "idx_routine_steps_project" ON "routine_steps" ("project_id");


-- ---------------------------------------------------------------------
-- ROUTINE LOGS
-- One row per step per day it was checked. No row = still to-do.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "routine_logs" (
	"id" INTEGER NOT NULL,
	"routine_step_id" INTEGER NOT NULL,
	"date" DATE NOT NULL,
	"status" TEXT NOT NULL CHECK(status IN ('done', 'skipped')),
	"created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id"),
	FOREIGN KEY ("routine_step_id") REFERENCES "routine_steps"("id")
	ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_routine_logs_step_date" ON "routine_logs" ("routine_step_id", "date");


-- ---------------------------------------------------------------------
-- STATUS CHANGES
-- History of status changes, cascades and unlinks, so a batch can be undone.
-- No foreign keys on purpose: it records rows from many tables.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "status_changes" (
	"id" INTEGER NOT NULL,
	"batch_id" TEXT NOT NULL,
	"entity_type" TEXT NOT NULL CHECK(entity_type IN (
		'life_area', 'priority', 'goal', 'group_project', 'project', 'milestone',
		'recurring_task', 'task', 'subtask', 'event', 'routine', 'routine_step')),
	"entity_id" INTEGER NOT NULL,
	"field" TEXT NOT NULL,
	"old_value" TEXT,
	"new_value" TEXT,
	"changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);

CREATE INDEX IF NOT EXISTS "idx_status_changes_batch" ON "status_changes" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_status_changes_entity" ON "status_changes" ("entity_type", "entity_id");
