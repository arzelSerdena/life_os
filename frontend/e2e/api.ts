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

export const getProject = (request: APIRequestContext, id: number) =>
  send<Project>(request, "get", `/api/projects/${id}`);

export const getTask = (request: APIRequestContext, id: number) =>
  send<Task>(request, "get", `/api/tasks/${id}`);

export const listProjects = (request: APIRequestContext) =>
  send<Project[]>(request, "get", "/api/projects");
