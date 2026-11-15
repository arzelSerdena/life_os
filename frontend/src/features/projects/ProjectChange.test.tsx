import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { CascadeItemRead, ProjectRead } from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { lifeArea, renderApp } from "../../test-utils";

const career = lifeArea({ id: 1, title: "Career", color: "blue" });

const active = {
  id: 7,
  life_area_id: 1,
  title: "Resume & portfolio",
  notes: null,
  due_date: null,
  status: "active",
  archived_at: null,
  created_at: "2026-11-01T00:00:00Z",
  sections: [
    { id: 1, project_id: 7, title: "Resume", sort_order: 0 },
    { id: 2, project_id: 7, title: "Portfolio", sort_order: 1 },
  ],
  progress: { done: 3, total: 5 },
  has_items: true,
} as unknown as ProjectRead;

const item = (kind: CascadeItemRead["kind"], id: number, effect: CascadeItemRead["effect"]) => ({
  kind,
  id,
  title: `${kind} ${id}`,
  effect,
});

const finishPreview = [
  item("task", 1, "cancel"),
  item("task", 2, "cancel"),
  item("event", 3, "cancel"),
  item("event", 4, "end_series"),
  item("task_template", 5, "archive"),
  item("routine_step", 6, "archive"),
  item("metric", 7, "archive"),
  item("metric", 8, "archive"),
];

const archivePreview = [
  ...[1, 2, 3, 4, 5].map((id) => item("task", id, "archive")),
  item("event", 3, "archive"),
  item("metric", 7, "archive"),
];

let project: ProjectRead;
let requests: { method: string; path: string; search: string }[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const writes = () => requests.filter((r) => r.method !== "GET").map((r) => r.path);

beforeEach(() => {
  requests = [];
  project = active;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      requests.push({ method: request.method, path: url.pathname, search: url.search });
      if (request.method === "POST") {
        if (url.pathname.startsWith("/api/undo/")) return json({ restored_items: 9 });
        return json({ project, batch_id: "batch-1" });
      }
      switch (url.pathname) {
        case "/api/life-areas":
          return json([career]);
        case "/api/life-areas/1":
          return json(career);
        case "/api/projects/7":
          return json(project);
        case "/api/projects/7/preview":
          return json({
            items: url.searchParams.get("action") === "archive" ? archivePreview : finishPreview,
          });
        default:
          return json([]);
      }
    }),
  );
});

afterEach(() => {
  act(() => {
    useChangeToast.getState().dismiss();
    useDetailPanel.getState().close();
  });
});

async function openMenu() {
  renderApp("/areas/archived");
  act(() => useDetailPanel.getState().open({ kind: "project", id: 7 }));
  const panel = await screen.findByRole("complementary", { name: "Details" });
  await within(panel).findByRole("textbox", { name: "Title" });
  const user = userEvent.setup();
  await user.click(within(panel).getByRole("button", { name: "More actions" }));
  return user;
}

test("completing a project lists what it cancels and archives, and Undo restores it", async () => {
  const user = await openMenu();
  await user.click(await screen.findByRole("menuitem", { name: "Complete project" }));

  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent("Complete Resume & portfolio?");
  await waitFor(() =>
    expect(dialog).toHaveTextContent("2 tasks are still open. Completing the project also:"),
  );
  expect(dialog).toHaveTextContent("cancels 2 open tasks");
  expect(dialog).toHaveTextContent("cancels 1 upcoming event");
  expect(dialog).toHaveTextContent("ends 1 repeating event from today");
  expect(dialog).toHaveTextContent(
    "archives 1 recurring task, 1 routine step and 2 metrics, with their entries and targets kept",
  );
  expect(writes()).toEqual([]);
  await user.click(within(dialog).getByRole("button", { name: "Complete project" }));

  const toast = (await screen.findByText("Completed “Resume & portfolio”")).closest(
    "[role=status]",
  ) as HTMLElement;
  expect(writes()).toEqual(["/api/projects/7/complete"]);
  await user.click(within(toast).getByRole("button", { name: "Undo" }));

  await waitFor(() => expect(writes()).toEqual(["/api/projects/7/complete", "/api/undo/batch-1"]));
  expect(screen.queryByText("Completed “Resume & portfolio”")).not.toBeInTheDocument();
});

test("cancelling a project uses the same confirmation", async () => {
  const user = await openMenu();
  await user.click(await screen.findByRole("menuitem", { name: "Cancel project" }));

  const dialog = await screen.findByRole("alertdialog");
  await waitFor(() => expect(dialog).toHaveTextContent("Cancelling the project also:"));
  await user.click(within(dialog).getByRole("button", { name: "Cancel project" }));

  await screen.findByText("Cancelled “Resume & portfolio”");
  expect(writes()).toEqual(["/api/projects/7/cancel"]);
});

test("archiving a project lists everything archived with it", async () => {
  const user = await openMenu();
  await user.click(await screen.findByRole("menuitem", { name: "Archive project" }));

  const dialog = await screen.findByRole("alertdialog");
  await waitFor(() => expect(dialog).toHaveTextContent("5 tasks in 2 sections"));
  expect(dialog).toHaveTextContent("1 event");
  expect(dialog).toHaveTextContent("1 metric, with its entries and targets kept");
  expect(dialog).toHaveTextContent("Nothing is deleted.");
  await user.click(within(dialog).getByRole("button", { name: "Archive project" }));

  await screen.findByText("Archived “Resume & portfolio”");
  expect(writes()).toEqual(["/api/projects/7/archive"]);
});

test("a finished project can be reopened", async () => {
  project = { ...active, status: "done" };
  const user = await openMenu();
  expect(screen.queryByRole("menuitem", { name: "Complete project" })).not.toBeInTheDocument();
  await user.click(await screen.findByRole("menuitem", { name: "Reopen project" }));
  await waitFor(() => expect(writes()).toEqual(["/api/projects/7/reopen"]));
});

test("an archived project can only be restored", async () => {
  project = { ...active, archived_at: "2026-11-15T00:00:00Z" };
  const user = await openMenu();
  expect(screen.queryByRole("menuitem", { name: "Archive project" })).not.toBeInTheDocument();
  await user.click(await screen.findByRole("menuitem", { name: "Restore project" }));
  await waitFor(() => expect(writes()).toEqual(["/api/projects/7/unarchive"]));
});
