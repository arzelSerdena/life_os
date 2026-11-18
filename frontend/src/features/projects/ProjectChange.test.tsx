import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PreviewGroup, PreviewRow, ProjectRead } from "../../client/types.gen";
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

const task = (id: number, title: string, date?: string): PreviewRow => ({
  kind: "task",
  id,
  title,
  date,
});

const finishPreview: PreviewGroup[] = [
  {
    effect: "cancelled",
    rows: [
      { ...task(1, "Update resume", "2026-11-04"), overdue: true },
      task(2, "Ask Prof. Reyes for a reference", "2026-11-26"),
      { kind: "event", id: 3, title: "Mock interview", date: "2026-11-20", start_time: "14:00:00" },
    ],
  },
  {
    effect: "ends_from_today",
    rows: [
      {
        kind: "event",
        id: 4,
        title: "Portfolio check-in",
        rrule: "FREQ=WEEKLY;BYDAY=SU",
        last_date: "2026-11-08",
      },
    ],
  },
  {
    effect: "archived",
    rows: [
      { kind: "task_template", id: 5, title: "Check job boards", rrule: "FREQ=WEEKLY;BYDAY=MO" },
      { kind: "routine_step", id: 6, title: "Post one LinkedIn update", context: "Weekly reset" },
      {
        kind: "metric",
        id: 7,
        title: "Portfolio pieces",
        counts: [
          { of: "entries", count: 2 },
          { of: "targets", count: 1 },
        ],
      },
    ],
  },
];

const archivePreview: PreviewGroup[] = [
  {
    effect: "archived",
    rows: [1, 2, 3, 4, 5, 6].map((id) => task(id, `Task ${id}`)),
  },
];

let preview: { finish: PreviewGroup[]; archive: PreviewGroup[] };
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
  preview = { finish: finishPreview, archive: archivePreview };
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
        case "/api/archive":
          return json({ areas: [], projects: [], routines: [] });
        case "/api/life-areas":
          return json([career]);
        case "/api/life-areas/1":
          return json(career);
        case "/api/projects/7":
          return json(project);
        case "/api/projects/7/preview":
          return json({
            groups: url.searchParams.get("action") === "archive" ? preview.archive : preview.finish,
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

test("completing a project lists what it does by effect, and Undo restores it", async () => {
  const user = await openMenu();
  await user.click(await screen.findByRole("menuitem", { name: "Complete project" }));

  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent("Complete “Resume & portfolio”?");
  const cancelled = await within(dialog).findByRole("region", { name: "Cancelled" });
  expect(cancelled).toHaveTextContent("Update resumeNov 4");
  expect(within(cancelled).getByText("Nov 4")).toHaveClass("text-(--text-danger)");
  expect(cancelled).toHaveTextContent("Mock interviewFri, Nov 20 · 2 PM");
  expect(within(dialog).getByRole("region", { name: "Ends from today" })).toHaveTextContent(
    "Portfolio check-inEvery Sun · last on Nov 8",
  );
  const archived = within(dialog).getByRole("region", { name: "Archived" });
  expect(archived).toHaveTextContent("Check job boardsEvery Mon");
  expect(archived).toHaveTextContent("Post one LinkedIn updateWeekly reset");
  expect(archived).toHaveTextContent("Portfolio pieces2 entries · 1 target");
  expect(dialog).toHaveTextContent("You can undo this");
  expect(writes()).toEqual([]);
  await user.click(within(dialog).getByRole("button", { name: "Complete project" }));

  const message = "Completed “Resume & portfolio” · 2 tasks cancelled";
  const toast = (await screen.findByText(message)).closest("[role=status]") as HTMLElement;
  expect(writes()).toEqual(["/api/projects/7/complete"]);
  await user.click(within(toast).getByRole("button", { name: "Undo" }));

  await waitFor(() => expect(writes()).toEqual(["/api/projects/7/complete", "/api/undo/batch-1"]));
  expect(screen.queryByText(message)).not.toBeInTheDocument();
});

test("cancelling a project uses the same confirmation", async () => {
  const user = await openMenu();
  await user.click(await screen.findByRole("menuitem", { name: "Cancel project" }));

  const dialog = await screen.findByRole("alertdialog");
  await within(dialog).findByRole("region", { name: "Cancelled" });
  await user.click(within(dialog).getByRole("button", { name: "Cancel project" }));

  await screen.findByText("Cancelled “Resume & portfolio” · 2 tasks cancelled");
  expect(writes()).toEqual(["/api/projects/7/cancel"]);
});

test("archiving a project folds a long group after 3 rows", async () => {
  const user = await openMenu();
  await user.click(await screen.findByRole("menuitem", { name: "Archive project" }));

  const dialog = await screen.findByRole("alertdialog");
  const archived = await within(dialog).findByRole("region", { name: "Archived" });
  expect(within(archived).getAllByRole("listitem")).toHaveLength(3);
  await user.click(within(archived).getByRole("button", { name: "+3 more" }));
  expect(within(archived).getAllByRole("listitem")).toHaveLength(6);
  expect(dialog).toHaveTextContent("You can restore it from Finished & archived");
  await user.click(within(dialog).getByRole("button", { name: "Archive project" }));

  await screen.findByText("Archived “Resume & portfolio”");
  expect(writes()).toEqual(["/api/projects/7/archive"]);
});

test("an archive with nothing going with it applies at once", async () => {
  preview.archive = [];
  const user = await openMenu();
  await user.click(await screen.findByRole("menuitem", { name: "Archive project" }));

  await screen.findByText("Archived “Resume & portfolio”");
  expect(writes()).toEqual(["/api/projects/7/archive"]);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

test("Go back closes the dialog without changes", async () => {
  const user = await openMenu();
  await user.click(await screen.findByRole("menuitem", { name: "Complete project" }));
  const dialog = await screen.findByRole("alertdialog");
  await within(dialog).findByRole("region", { name: "Cancelled" });

  await user.click(within(dialog).getByRole("button", { name: "Go back" }));

  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(writes()).toEqual([]);
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
