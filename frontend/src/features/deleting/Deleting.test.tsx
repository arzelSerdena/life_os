import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type {
  EventRead,
  MetricRead,
  ProjectRead,
  RoutineRead,
  TaskRead,
} from "../../client/types.gen";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { usePendingDeletes } from "../../stores/pendingDeleteStore";
import { lifeArea, renderApp } from "../../test-utils";

const career = lifeArea({ id: 1, title: "Career", color: "blue" });

const metric = {
  id: 9,
  life_area_id: 1,
  project_id: null,
  title: "Networking chats",
  notes: null,
  format: "number",
  unit: null,
  aggregation: "sum",
  direction: "higher",
  targets: [],
} as unknown as MetricRead;

const project = {
  id: 7,
  life_area_id: 1,
  title: "Resume & portfolio",
  notes: null,
  due_date: null,
  status: "active",
  created_at: "2026-11-01T00:00:00Z",
  sections: [],
  progress: { done: 0, total: 2 },
  has_items: true,
} as unknown as ProjectRead;

const task = {
  id: 2,
  life_area_id: 1,
  project_id: null,
  section_id: null,
  template_id: null,
  occurrence_date: null,
  title: "Update resume",
  notes: null,
  status: "todo",
  priority: "none",
  scheduled_date: null,
  due_date: null,
  archived_at: null,
  rollover_count: 0,
  subtasks: [{ id: 21, task_id: 2, title: "Fix formatting", status: "todo" }],
} as unknown as TaskRead;

const routine = {
  id: 4,
  title: "Morning",
  notes: null,
  is_paused: false,
  schedules: [],
  steps: [
    {
      id: 1,
      routine_id: 4,
      life_area_id: 1,
      project_id: null,
      title: "Practice LeetCode",
      notes: null,
      starts_on: "2026-11-01",
      is_paused: false,
      current_streak: 0,
      best_streak: 0,
    },
  ],
} as unknown as RoutineRead;

const standup = {
  id: 3,
  life_area_id: 1,
  project_id: null,
  title: "Standup",
  notes: null,
  start_date: "2026-11-02",
  end_date: null,
  start_time: null,
  end_time: null,
  location: null,
  rrule: "FREQ=WEEKLY;BYDAY=MO",
  cancelled_at: null,
} as unknown as EventRead;

let requests: { method: string; path: string; body: unknown }[];
let currentTask: TaskRead;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const writes = () => requests.filter((r) => r.method !== "GET");

beforeEach(() => {
  requests = [];
  currentTask = task;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      const body =
        request.method === "GET" ? undefined : await request.json().catch(() => undefined);
      requests.push({ method: request.method, path: url.pathname, body });
      if (request.method !== "GET") return new Response(null, { status: 204 });
      switch (url.pathname) {
        case "/api/life-areas":
          return json([career]);
        case "/api/life-areas/1":
          return json(career);
        case "/api/metrics/9":
          return json(metric);
        case "/api/metrics/9/delete-preview":
          return json({ entries: 9, targets: 1 });
        case "/api/projects/7":
          return json(project);
        case "/api/tasks/2":
          return json(currentTask);
        case "/api/routines/4":
          return json(routine);
        case "/api/routine-steps/1/delete-preview":
          return json({
            steps: 1,
            schedules: 1,
            pauses: 0,
            logs: 12,
            metrics: [{ id: 9, title: "Networking chats" }],
          });
        case "/api/events/3":
          return json(standup);
        case "/api/events/occurrences":
          return json([{ ...standup, event_id: 3, occurrence_date: "2026-11-16" }]);
        default:
          return json([]);
      }
    }),
  );
});

afterEach(() => {
  act(() => {
    for (const item of usePendingDeletes.getState().pending)
      usePendingDeletes.getState().undo(item.key);
    usePendingDeletes.setState({ pending: [], failure: null });
    useDetailPanel.getState().close();
  });
});

async function openPanel(
  target: Parameters<ReturnType<typeof useDetailPanel.getState>["open"]>[0],
) {
  renderApp("/areas/archived");
  act(() => useDetailPanel.getState().open(target));
  return screen.findByRole("complementary", { name: "Details" });
}

async function chooseFromMenu(panel: HTMLElement, name: RegExp | string) {
  const user = userEvent.setup();
  await user.click(await within(panel).findByRole("button", { name: "More actions" }));
  return { user, item: await screen.findByRole("menuitem", { name }) };
}

test("deleting a metric asks first and lists what goes with it", async () => {
  const panel = await openPanel({ kind: "metric", id: 9 });
  await within(panel).findByRole("textbox", { name: "Title" });
  const { user, item } = await chooseFromMenu(panel, "Delete metric");
  await user.click(item);

  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent("Delete Networking chats?");
  await waitFor(() => expect(dialog).toHaveTextContent("9 entries"));
  expect(dialog).toHaveTextContent("1 target");
  expect(dialog).toHaveTextContent("This can't be undone.");
  expect(writes()).toEqual([]);
  await user.click(within(dialog).getByRole("button", { name: "Delete metric" }));

  await waitFor(() =>
    expect(screen.queryByRole("complementary", { name: "Details" })).not.toBeInTheDocument(),
  );
  expect(writes()).toEqual([{ method: "DELETE", path: "/api/metrics/9", body: undefined }]);
});

test("a step that feeds a metric can't be deleted, and the dialog names the metric", async () => {
  const panel = await openPanel({ kind: "step", id: 1, routineId: 4 });
  await within(panel).findByRole("textbox", { name: "Title" });
  const { user, item } = await chooseFromMenu(panel, "Delete step");
  await user.click(item);

  const dialog = await screen.findByRole("alertdialog");
  await waitFor(() => expect(dialog).toHaveTextContent("It feeds a metric: Networking chats."));
  expect(within(dialog).getByRole("button", { name: "Delete step" })).toBeDisabled();
});

test("a repeating event asks which events to delete", async () => {
  const panel = await openPanel({ kind: "event", id: 3, day: "2026-11-16" });
  await within(panel).findByRole("textbox", { name: "Title" });
  const { user, item } = await chooseFromMenu(panel, "Delete event");
  await user.click(item);

  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("radio", { name: "This and following" }));
  await user.click(within(dialog).getByRole("button", { name: "Delete event" }));

  await waitFor(() =>
    expect(writes()).toEqual([
      {
        method: "POST",
        path: "/api/events/3/occurrences/2026-11-16/delete",
        body: { scope: "following" },
      },
    ]),
  );
});

test("a project with items can't be deleted", async () => {
  const panel = await openPanel({ kind: "project", id: 7 });
  await within(panel).findByRole("textbox", { name: "Title" });
  const { item } = await chooseFromMenu(panel, /^Delete project/);

  expect(item).toHaveAttribute("aria-disabled", "true");
  expect(item).toHaveTextContent("Only empty projects can be deleted. Archive it instead.");
});

test("a recurring occurrence can only be cancelled", async () => {
  currentTask = { ...task, template_id: 5, occurrence_date: "2026-11-16" };
  const panel = await openPanel({ kind: "task", id: 2 });
  await within(panel).findByRole("textbox", { name: "Title" });
  const { user, item } = await chooseFromMenu(panel, "Cancel task");

  expect(screen.queryByRole("menuitem", { name: /Delete/ })).not.toBeInTheDocument();
  await user.click(item);
  await waitFor(() =>
    expect(writes()).toEqual([{ method: "POST", path: "/api/tasks/2/cancel", body: undefined }]),
  );
});

test("deleting a task waits behind an undo toast, and Undo cancels it", async () => {
  const panel = await openPanel({ kind: "task", id: 2 });
  await within(panel).findByRole("textbox", { name: "Title" });
  const { user, item } = await chooseFromMenu(panel, "Delete task");
  await user.click(item);

  const toast = await screen.findByRole("status");
  expect(toast).toHaveTextContent("Deleted “Update resume”");
  expect(screen.queryByRole("complementary", { name: "Details" })).not.toBeInTheDocument();
  await user.click(within(toast).getByRole("button", { name: "Undo" }));

  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(writes()).toEqual([]);
});

test("closing the toast deletes a subtask at once", async () => {
  const panel = await openPanel({ kind: "task", id: 2 });
  const subtasks = await within(panel).findByRole("region", { name: "Subtasks" });
  const user = userEvent.setup();
  await user.click(within(subtasks).getByRole("button", { name: "Delete Fix formatting" }));

  expect(within(subtasks).queryByText("Fix formatting")).not.toBeInTheDocument();
  const toast = (await screen.findByText(/Deleted “Fix formatting”/)).closest(
    "[role=status]",
  ) as HTMLElement;
  await user.click(within(toast).getByRole("button", { name: "Close" }));

  await waitFor(() =>
    expect(writes()).toEqual([{ method: "DELETE", path: "/api/subtasks/21", body: undefined }]),
  );
});
