import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ProjectRead } from "../../client/types.gen";
import { today } from "../../period";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { emptyAreaPage, emptyProjectPage, lifeArea, renderApp } from "../../test-utils";

const career = lifeArea({ id: 1, title: "Career", color: "blue", sort_order: 0 });
const health = lifeArea({ id: 2, title: "Health", color: "teal", sort_order: 1 });

const project = (overrides: Partial<ProjectRead>) =>
  ({
    id: 7,
    life_area_id: 1,
    title: "Resume & portfolio",
    notes: null,
    start_date: null,
    due_date: null,
    status: "active",
    archived_at: null,
    sort_order: 0,
    created_at: "2026-11-01T00:00:00Z",
    sections: [],
    progress: { done: 0, total: 0 },
    has_items: false,
    ...overrides,
  }) as ProjectRead;

let projects: ProjectRead[];
let posts: { path: string; body: unknown }[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  posts = [];
  projects = [
    project({ id: 8, life_area_id: 2, title: "5K training" }),
    project({ id: 7, title: "Resume & portfolio" }),
    project({ id: 9, title: "Old job hunt", status: "done" }),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/api/projects") {
        const body = await request.json();
        posts.push({ path: url.pathname, body });
        return json(project({ id: 20, ...body }), 201);
      }
      switch (url.pathname) {
        case "/api/archive":
          return json({ areas: [], projects: [], routines: [] });
        case "/api/life-areas":
          return json([career, health]);
        case "/api/life-areas/1":
          return json(career);
        case "/api/life-areas/1/page":
          return json(emptyAreaPage(career));
        case "/api/projects":
          return json(projects);
        case "/api/projects/20":
          return json(project({ id: 20, title: "Portfolio site" }));
        case "/api/projects/20/page":
          return json(emptyProjectPage(career, project({ id: 20, title: "Portfolio site" })));
        default:
          return json([]);
      }
    }),
  );
});

afterEach(() => {
  act(() => useDetailPanel.getState().close());
});

test("the sidebar lists active projects in area order", async () => {
  renderApp("/areas/archived");
  const nav = await screen.findByRole("navigation", { name: "Projects" });

  await waitFor(() =>
    expect(
      within(nav)
        .getAllByRole("link")
        .map((row) => row.textContent),
    ).toEqual(["Resume & portfolio", "5K training"]),
  );
  expect(within(nav).getByRole("link", { name: "5K training" })).toHaveAttribute(
    "href",
    "/areas/projects/8",
  );
});

test("New project needs a name and an area, starts today and opens the new project", async () => {
  renderApp("/areas/archived");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "New project" }));

  const dialog = await screen.findByRole("dialog", { name: "New project" });
  const create = within(dialog).getByRole("button", { name: "Create project" });
  expect(create).toBeDisabled();
  expect(create.parentElement).toHaveAttribute("title", "Enter a name");
  await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "Portfolio site");
  expect(create.parentElement).toHaveAttribute("title", "Choose a life area");
  expect(within(dialog).getByLabelText("Start")).toHaveValue(today());

  await user.click(within(dialog).getByRole("radio", { name: "Career" }));
  await user.type(within(dialog).getByRole("textbox", { name: "Notes" }), "Two case studies");
  await user.click(create);

  await waitFor(() =>
    expect(posts).toEqual([
      {
        path: "/api/projects",
        body: {
          life_area_id: 1,
          title: "Portfolio site",
          start_date: today(),
          due_date: null,
          notes: "Two case studies",
        },
      },
    ]),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "New project" })).not.toBeInTheDocument(),
  );
  // A new project opens its page.
  expect(await screen.findByRole("heading", { name: "Portfolio site" })).toBeInTheDocument();
});

test("the due date can't be before the start", async () => {
  renderApp("/areas/archived");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "New project" }));
  const dialog = await screen.findByRole("dialog", { name: "New project" });
  await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "Portfolio site");
  await user.click(within(dialog).getByRole("radio", { name: "Health" }));
  const start = within(dialog).getByLabelText("Start");
  await user.clear(start);
  await user.type(start, "2026-12-01");
  await user.type(within(dialog).getByLabelText("Due"), "2026-11-30");
  await user.click(within(dialog).getByRole("button", { name: "Create project" }));

  expect(await within(dialog).findByText("Due can't be before the start.")).toBeInTheDocument();
  expect(posts).toEqual([]);
});

test("Add → Project on an area page chooses that area", async () => {
  renderApp("/areas/1");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Add" }));
  await user.click(await screen.findByRole("menuitem", { name: "Project" }));

  const dialog = await screen.findByRole("dialog", { name: "New project" });
  expect(within(dialog).getByRole("radio", { name: "Career" })).toBeChecked();
});
