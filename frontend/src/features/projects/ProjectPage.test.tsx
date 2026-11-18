import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ProjectPageRead, ProjectRead } from "../../client/types.gen";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { emptyProjectPage, lifeArea, renderApp, taskRead } from "../../test-utils";

const career = lifeArea({ id: 1, title: "Career", color: "blue" });

const project = (overrides: Partial<ProjectRead> = {}): ProjectRead => ({
  id: 7,
  life_area_id: 1,
  title: "Resume & portfolio",
  notes: null,
  start_date: "2026-10-20",
  due_date: "2026-11-30",
  status: "active",
  completed_at: null,
  cancelled_at: null,
  archived_at: null,
  sort_order: 0,
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
  sections: [{ id: 3, project_id: 7, title: "Resume", sort_order: 0 }],
  progress: { done: 3, total: 5 },
  has_items: true,
  ...overrides,
});

let page: ProjectPageRead;
let posts: string[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  posts = [];
  page = emptyProjectPage(career, project(), { pace: 26 / 41, pace_status: "on_pace" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "POST") {
        posts.push(url.pathname);
        return json({ title: "Portfolio", id: 4, project_id: 7, sort_order: 1 }, 201);
      }
      switch (url.pathname) {
        case "/api/life-areas":
          return json([career]);
        case "/api/projects":
          return json([page.project]);
        case "/api/projects/7":
          return json(page.project);
        case "/api/projects/7/page":
          return json(page);
        default:
          return json([]);
      }
    }),
  );
});

afterEach(() => {
  act(() => useDetailPanel.getState().close());
});

test("the header shows the area, status, dates and progress against pace", async () => {
  renderApp("/areas/projects/7");

  expect(await screen.findByRole("heading", { name: "Resume & portfolio" })).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByText("Oct 20 – Nov 30 · 16 days left")).toBeInTheDocument();
  expect(screen.getByText("60% · 3 of 5 tasks · on pace")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "60% done, 63% of the time passed" })).toBeInTheDocument();
});

test("a project with no due date says when it started", async () => {
  page = emptyProjectPage(
    career,
    project({ due_date: null, start_date: "2026-11-14", progress: { done: 0, total: 0 } }),
  );
  renderApp("/areas/projects/7");

  expect(await screen.findByText("Started Nov 14 · no due date")).toBeInTheDocument();
  expect(screen.getByText("No metrics yet.")).toBeInTheDocument();
  expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
  // The Routines card shows only while the project owns steps.
  expect(screen.queryByRole("heading", { name: "Routines" })).not.toBeInTheDocument();
});

test("task rows note their section", async () => {
  page = emptyProjectPage(career, project(), {
    overdue_tasks: [
      taskRead({
        title: "Update resume",
        life_area_id: 1,
        project_id: 7,
        section_id: 3,
        due_date: "2026-11-04",
      }),
    ],
    contents: { ...page.contents, open_tasks: 1 },
  });
  renderApp("/areas/projects/7");

  const lists = await screen.findByRole("tabpanel");
  expect(within(lists).getByText("Resume · Overdue 10 days")).toBeInTheDocument();
});

test("Edit project opens the detail panel; Delete waits for an empty project", async () => {
  const user = userEvent.setup();
  renderApp("/areas/projects/7");

  await user.click(
    await screen.findByRole("button", { name: "More actions for Resume & portfolio" }),
  );
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByRole("menuitem", { name: /Delete project/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(within(menu).getByText("Only empty projects can be deleted. Archive it instead."));
  await user.click(within(menu).getByRole("menuitem", { name: "Edit project" }));
  expect(useDetailPanel.getState().target).toEqual({ kind: "project", id: 7 });
});

test("Add › Section creates a section in the project", async () => {
  const user = userEvent.setup();
  renderApp("/areas/projects/7");

  await user.click(await screen.findByRole("button", { name: "Add" }));
  await user.click(await screen.findByRole("menuitem", { name: "Section" }));
  const dialog = await screen.findByRole("dialog", { name: "New section" });
  const create = within(dialog).getByRole("button", { name: "Create section" });
  expect(create).toBeDisabled();
  await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "Portfolio");
  await user.click(create);

  await waitFor(() => expect(posts).toEqual(["/api/projects/7/sections"]));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "New section" })).not.toBeInTheDocument(),
  );
});
