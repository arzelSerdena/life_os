import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { AreaPageRead, RoutineRead, TaskRead } from "../../client/types.gen";
import { emptyAreaPage, lifeArea, renderApp } from "../../test-utils";

const career = lifeArea({ id: 1, title: "Career", color: "blue", notes: "Aim for a senior role." });

function task(overrides: Partial<TaskRead>): TaskRead {
  return {
    id: 1,
    life_area_id: 1,
    project_id: null,
    section_id: null,
    template_id: null,
    occurrence_date: null,
    title: "Task",
    notes: null,
    status: "todo",
    priority: "none",
    scheduled_date: null,
    due_date: null,
    due_time: null,
    completed_at: null,
    cancelled_at: null,
    archived_at: null,
    sort_order: 0,
    rollover_count: 0,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    subtasks: [],
    ...overrides,
  } as TaskRead;
}

const resumeTask = task({
  id: 2,
  title: "Update resume",
  due_date: "2026-11-04",
  project_id: 7,
  section_id: 5,
  priority: "high",
  notes: "Bring the PDF",
  subtasks: [
    { id: 21, task_id: 2, title: "Add projects section", status: "done" },
    { id: 22, task_id: 2, title: "Fix formatting", status: "todo" },
  ] as TaskRead["subtasks"],
});
const resumeProject = {
  id: 7,
  life_area_id: 1,
  title: "Resume & portfolio",
  sections: [{ id: 5, project_id: 7, title: "Resume" }],
  progress: { done: 3, total: 5 },
};

let page: AreaPageRead;
let requests: { method: string; path: string; body: unknown }[];

const morningRoutine: RoutineRead = {
  id: 4,
  title: "Morning",
  notes: null,
  sort_order: 0,
  is_paused: false,
  archived_at: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
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
      sort_order: 0,
      is_paused: false,
      current_streak: 3,
      best_streak: 5,
      archived_at: null,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  requests = [];
  page = emptyAreaPage(career, {
    contents: {
      active_projects: 1,
      open_tasks: 2,
      upcoming_events: 0,
      metrics: 0,
      routine_steps: 1,
      has_items: true,
    },
    projects: [
      {
        id: 7,
        title: "Resume & portfolio",
        status: "active",
        start: "2026-10-01",
        due_date: "2026-11-30",
        completed_on: null,
        done: 3,
        total: 5,
      },
    ],
    routines: [
      {
        routine_id: 1,
        title: "Evening routine",
        rrule: "FREQ=DAILY",
        total_steps: 5,
        steps: [
          {
            step_id: 1,
            title: "Practice LeetCode",
            project_id: null,
            days: Array(92).fill("done"),
          },
        ],
      },
    ],
    overdue_tasks: [task({ id: 2, title: "Update resume", due_date: "2026-11-04", project_id: 7 })],
    agenda_tasks: [task({ id: 3, title: "Draft the pitch", scheduled_date: "2026-11-14" })],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      const body =
        request.method === "GET" ? undefined : await request.json().catch(() => undefined);
      requests.push({ method: request.method, path: url.pathname, body });
      if (url.pathname === "/api/life-areas") return json([career]);
      if (url.pathname === "/api/life-areas/1") return json(career);
      if (url.pathname === "/api/life-areas/1/page") return json(page);
      if (url.pathname === "/api/metrics") return json({ id: 9, ...(body as object) }, 201);
      if (url.pathname === "/api/routines") return json([morningRoutine]);
      if (url.pathname === "/api/tasks/2" && request.method === "GET") return json(resumeTask);
      if (url.pathname === "/api/projects/7") return json(resumeProject);
      return json({}, 200);
    }),
  );
});

test("shows the area's projects, routines, lists and agenda", async () => {
  renderApp("/areas/1");

  expect(await screen.findByRole("heading", { name: "Career" })).toBeInTheDocument();
  const projects = await screen.findByRole("region", { name: "Projects" });
  expect(projects).toHaveTextContent("Resume & portfolio");
  expect(projects).toHaveTextContent("Due Nov 30 · in 16 days");
  expect(projects).toHaveTextContent("3 / 5");

  const routines = screen.getByRole("region", { name: "Routines" });
  expect(routines).toHaveTextContent("1 of its 5 steps is in Career");
  expect(routines).toHaveTextContent("Daily");

  expect(screen.getByRole("tab", { name: /Needs attention/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Resume & portfolio · Overdue 10 days");

  const agenda = screen.getByRole("region", { name: "Agenda" });
  expect(agenda).toHaveTextContent("Overdue");
  expect(agenda).toHaveTextContent("TodaySat, Nov 14");
  expect(within(agenda).getByText("Draft the pitch")).toBeInTheDocument();
});

test("clicking a task opens it in the detail panel", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");

  const lists = await screen.findByRole("region", { name: "Area lists" });
  expect(within(lists).queryByRole("tab", { name: "Notes" })).not.toBeInTheDocument();
  await user.click(within(lists).getByRole("button", { name: "Update resume" }));

  const panel = await screen.findByRole("complementary", { name: "Details" });
  expect(await within(panel).findByRole("textbox", { name: "Title" })).toHaveValue("Update resume");
  await waitFor(() =>
    expect(within(panel).getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
      "Career/Resume & portfolio/Resume",
    ),
  );
  expect(within(panel).getByRole("button", { name: "Due date" })).toHaveTextContent(
    "Nov 4 · Overdue",
  );
  expect(within(panel).getByRole("button", { name: "Priority" })).toHaveTextContent("High");
  expect(within(panel).getByRole("region", { name: "Subtasks" })).toHaveTextContent("1/2");
  expect(within(panel).getByText("Bring the PDF")).toBeInTheDocument();

  await user.click(within(panel).getByRole("checkbox", { name: "Fix formatting" }));
  await user.click(within(panel).getByRole("button", { name: "Mark Update resume done" }));

  await waitFor(() =>
    expect(requests).toEqual(
      expect.arrayContaining([
        { method: "PATCH", path: "/api/subtasks/22", body: { status: "done" } },
        { method: "POST", path: "/api/tasks/2/complete", body: undefined },
      ]),
    ),
  );
});

test("checking a task in the agenda completes it", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");

  await user.click(await screen.findByRole("checkbox", { name: "Mark Draft the pitch done" }));

  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "POST",
      path: "/api/tasks/3/complete",
      body: undefined,
    }),
  );
});

test("an area with items can't be deleted", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  await screen.findByRole("region", { name: "Projects" });

  await user.click(screen.getByRole("button", { name: "More actions for Career" }));

  expect(await screen.findByRole("menuitem", { name: /^Delete area/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(
    screen.getByText("Only empty areas can be deleted. Archive it instead."),
  ).toBeInTheDocument();
});

test("archiving asks first and lists what is archived with the area", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  await screen.findByRole("region", { name: "Projects" });

  await user.click(screen.getByRole("button", { name: "More actions for Career" }));
  await user.click(await screen.findByRole("menuitem", { name: "Archive area" }));
  const dialog = await screen.findByRole("alertdialog");

  expect(dialog).toHaveTextContent("1 active project");
  expect(dialog).toHaveTextContent("2 open tasks");
  expect(dialog).toHaveTextContent("1 routine step");
  expect(dialog).not.toHaveTextContent("upcoming event");
  await user.click(within(dialog).getByRole("button", { name: "Archive area" }));

  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "POST",
      path: "/api/life-areas/1/archive",
      body: undefined,
    }),
  );
});

test("New metric creates the metric and its target", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  await screen.findByRole("region", { name: "Projects" });

  await user.click(screen.getByRole("button", { name: "Add" }));
  await user.click(await screen.findByRole("menuitem", { name: "Metric" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Name"), "Job applications");
  await user.click(within(dialog).getByRole("radio", { name: "Every period" }));
  await user.type(within(dialog).getByLabelText("Target number"), "5");
  await user.click(within(dialog).getByRole("button", { name: "Create metric" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(requests).toContainEqual({
    method: "POST",
    path: "/api/metrics",
    body: {
      title: "Job applications",
      format: "number",
      unit: null,
      aggregation: "sum",
      direction: "higher",
      life_area_id: 1,
    },
  });
  const target = requests.find((r) => r.path === "/api/metrics/9/targets");
  expect(target?.body).toMatchObject({ kind: "per_period", target_value: 5, period: "month" });
});

test("New metric's presets set the format and unit, and the current value is sent", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  await screen.findByRole("region", { name: "Projects" });

  await user.click(screen.getByRole("button", { name: "Add" }));
  await user.click(await screen.findByRole("menuitem", { name: "Metric" }));
  const dialog = await screen.findByRole("dialog");
  const create = within(dialog).getByRole("button", { name: "Create metric" });
  expect(create).toBeDisabled();
  await user.type(within(dialog).getByLabelText("Name"), "Freelance income");
  expect(create).toBeEnabled();

  await user.click(within(dialog).getByRole("button", { name: "Measure as: Number" }));
  const money = await screen.findByRole("menuitem", { name: /Money/ });
  expect(money).toHaveTextContent("₱1,500");
  expect(screen.getByRole("menuitem", { name: /^Time(?!s)/ })).toHaveTextContent("1 h 30 m");
  await user.click(money);
  expect(within(dialog).getByRole("combobox", { name: "Currency" })).toHaveValue("PHP");
  await user.type(within(dialog).getByLabelText("Current value"), "12,500");
  await user.click(within(dialog).getByRole("radio", { name: "Reach by a date" }));
  await user.type(within(dialog).getByLabelText("Target number"), "100000");
  expect(create).toBeDisabled();
  await user.type(within(dialog).getByLabelText("Reach by"), "2026-12-31");
  await user.click(create);

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(requests).toContainEqual({
    method: "POST",
    path: "/api/metrics",
    body: {
      title: "Freelance income",
      format: "currency",
      unit: "PHP",
      aggregation: "sum",
      direction: "higher",
      current_value: 12500,
      life_area_id: 1,
    },
  });
  const target = requests.find((r) => r.path === "/api/metrics/9/targets");
  expect(target?.body).toMatchObject({
    kind: "reach_by",
    target_value: 100000,
    end_date: "2026-12-31",
  });
});

test("New metric can count a routine step's days, once a step is chosen", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  await screen.findByRole("region", { name: "Projects" });

  await user.click(screen.getByRole("button", { name: "Add" }));
  await user.click(await screen.findByRole("menuitem", { name: "Metric" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Name"), "Daily job search");
  await user.click(within(dialog).getByRole("radio", { name: "Routine step" }));
  expect(within(dialog).queryByLabelText("Current value")).not.toBeInTheDocument();
  const create = within(dialog).getByRole("button", { name: "Create metric" });
  expect(create).toBeDisabled();
  expect(
    within(dialog).getByText("Choose a routine step", { selector: ".sr-only" }),
  ).toBeInTheDocument();

  await user.click(within(dialog).getByRole("button", { name: /Routine step: Choose a step/ }));
  await user.click(await screen.findByRole("menuitem", { name: "Practice LeetCode" }));
  await user.click(within(dialog).getByRole("radio", { name: "Completion rate" }));
  await user.click(create);

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(requests).toContainEqual({
    method: "POST",
    path: "/api/metrics",
    body: {
      title: "Daily job search",
      source: "routine_step",
      routine_step_id: 1,
      aggregation: "average",
      direction: "higher",
      life_area_id: 1,
    },
  });
});
