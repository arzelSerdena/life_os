import { type APIRequestContext, expect } from "@playwright/test";

// Seeds and checks data through the real API (via the dev server's /api proxy).

let counter = 0;
/** A title no other test uses, since the tests share one database. */
export const unique = (title: string) => `${title} ${Date.now().toString(36)}${counter++}`;

async function send<T>(
  request: APIRequestContext,
  method: "get" | "post",
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request[method](path, { data });
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

export type Area = { id: number; title: string };
export type Project = {
  id: number;
  life_area_id: number;
  title: string;
  status: string;
  archived_at: string | null;
};
export type Task = { id: number; title: string; status: string; archived_at: string | null };

export const createArea = (request: APIRequestContext, title: string, color = "blue") =>
  send<Area>(request, "post", "/api/life-areas", { title, color });

export const createProject = (request: APIRequestContext, area: Area, title: string) =>
  send<Project>(request, "post", "/api/projects", { life_area_id: area.id, title });

export const createTask = (request: APIRequestContext, project: Project, title: string) =>
  send<Task>(request, "post", "/api/tasks", { project_id: project.id, title });

/** A task with any fields: an owner (project_id or life_area_id), priority, dates. */
export const postTask = (request: APIRequestContext, body: Record<string, unknown>) =>
  send<Task>(request, "post", "/api/tasks", body);

/** The server's today ("YYYY-MM-DD"), which follows Settings › Day ends at. */
export const serverToday = async (request: APIRequestContext) =>
  (await send<{ today: string }>(request, "get", "/api/week")).today;

/** A date `days` after `day`, both "YYYY-MM-DD". */
export const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const getProject = (request: APIRequestContext, id: number) =>
  send<Project>(request, "get", `/api/projects/${id}`);

export const getTask = (request: APIRequestContext, id: number) =>
  send<Task>(request, "get", `/api/tasks/${id}`);

export const listProjects = (request: APIRequestContext) =>
  send<Project[]>(request, "get", "/api/projects");

export type Routine = { id: number; title: string };
export type RoutineStep = { id: number; title: string };

export const createRoutine = (request: APIRequestContext, body: Record<string, unknown>) =>
  send<Routine>(request, "post", "/api/routines", body);

export const createRoutineStep = (
  request: APIRequestContext,
  routine: Routine,
  body: Record<string, unknown>,
) => send<RoutineStep>(request, "post", `/api/routines/${routine.id}/steps`, body);

export type Section = { id: number; title: string };

export const createSection = (request: APIRequestContext, project: Project, title: string) =>
  send<Section>(request, "post", `/api/projects/${project.id}/sections`, { title });

/** Every task, with its fields and subtasks, for checking what a screen created. */
export const listTasks = (request: APIRequestContext) =>
  send<Record<string, unknown>[]>(request, "get", "/api/tasks?include_cancelled=true");

export const listTemplates = (request: APIRequestContext) =>
  send<Record<string, unknown>[]>(request, "get", "/api/task-templates");

export type CalendarEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
};

export const postEvent = (request: APIRequestContext, body: Record<string, unknown>) =>
  send<CalendarEvent>(request, "post", "/api/events", body);

export const getEvent = (request: APIRequestContext, id: number) =>
  send<CalendarEvent>(request, "get", `/api/events/${id}`);

/** Every event, with its fields, for checking what a screen created. */
export const listEvents = (request: APIRequestContext) =>
  send<Record<string, unknown>[]>(request, "get", "/api/events?include_cancelled=true");

/** The Monday of the week holding `day` (weeks start on Monday). */
export const mondayOf = (day: string) =>
  addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
