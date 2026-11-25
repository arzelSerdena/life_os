import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { AreaPageRead, EntryRead, MetricRead } from "../../client/types.gen";
import { emptyAreaPage, lifeArea, renderApp } from "../../test-utils";

const health = lifeArea({ id: 1, title: "Health", color: "teal" });

let metric: MetricRead;
let entries: EntryRead[];
let page: AreaPageRead;
let requests: { method: string; path: string; body: unknown }[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  requests = [];
  metric = {
    id: 10,
    life_area_id: 1,
    project_id: null,
    title: "Running distance",
    notes: null,
    format: "number",
    unit: "km",
    source: "manual",
    routine_step_id: null,
    aggregation: "sum",
    direction: "higher",
    sort_order: 0,
    archived_at: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    targets: [
      {
        id: 20,
        metric_id: 10,
        kind: "per_period",
        target_value: 20,
        period: "week",
        start_date: "2026-11-02",
        end_date: null,
        state: "in_progress",
        value: 5,
        current_period: {
          start: "2026-11-02",
          end: "2026-11-08",
          value: 5,
          status: "in_progress",
        },
        recent_periods: [],
        met_periods: 0,
        missed_periods: 0,
      },
    ],
  };
  entries = [
    {
      id: 101,
      metric_id: 10,
      date: "2026-11-05",
      value: 5,
      note: "Morning jog",
      created_at: "2026-11-05T07:00:00Z",
      updated_at: "2026-11-05T07:00:00Z",
    },
  ];
  page = emptyAreaPage(health, {
    contents: {
      active_projects: 0,
      open_tasks: 0,
      upcoming_events: 0,
      metrics: 1,
      routine_steps: 0,
      has_items: true,
    },
    metrics: [
      {
        metric_id: 10,
        life_area_id: 1,
        title: "Running distance",
        format: "number",
        unit: "km",
        source: "manual",
        aggregation: "sum",
        direction: "higher",
        chart: "per_period",
        value: 5,
        previous_value: null,
        status: "on_track",
        target: {
          id: 20,
          kind: "per_period",
          target_value: 20,
          period: "week",
          start_date: "2026-11-02",
          end_date: null,
        },
        met_periods: 0,
        finished_periods: 0,
        points: [
          {
            start: "2026-11-02",
            end: "2026-11-08",
            value: 5,
            is_current: true,
            status: "in_progress",
          },
        ],
      },
    ],
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const { pathname } = new URL(request.url, "http://localhost");
      const method = request.method;
      const body =
        method === "GET" || method === "DELETE"
          ? undefined
          : await request.json().catch(() => undefined);
      if (method !== "GET") requests.push({ method, path: pathname, body });

      if (pathname === "/api/life-areas") return json([health]);
      if (pathname === "/api/life-areas/1") return json(health);
      if (pathname === "/api/life-areas/1/page") return json(page);
      if (pathname === "/api/projects") return json([]);
      if (pathname === "/api/routines") return json([]);
      if (pathname === "/api/metrics/10" && method === "GET") return json(metric);
      if (pathname === "/api/metrics/10" && method === "PATCH") {
        metric = { ...metric, ...(body as Partial<MetricRead>) };
        return json(metric);
      }
      if (pathname === "/api/metrics/10/archive" && method === "POST") {
        metric = { ...metric, archived_at: "2026-11-18T00:00:00Z" };
        return json({ metric, batch_id: "batch-archive-1" });
      }
      if (pathname === "/api/metrics/10/entries" && method === "GET") return json(entries);
      if (pathname === "/api/metrics/10/entries" && method === "POST") {
        const created: EntryRead = {
          id: 102,
          metric_id: 10,
          date: (body as { date?: string }).date ?? "2026-11-18",
          value: (body as { value: number }).value,
          note: (body as { note?: string }).note ?? null,
          created_at: "2026-11-18T08:00:00Z",
          updated_at: "2026-11-18T08:00:00Z",
        };
        entries = [...entries, created];
        return json({ entry: created, batch_id: "batch-entry-1" }, 201);
      }
      if (pathname === "/api/metric-targets/20/replace" && method === "POST") {
        return json({ ...metric.targets[0], ...(body as Record<string, unknown>) });
      }
      if (pathname === "/api/metric-targets/20" && method === "DELETE") {
        metric = { ...metric, targets: [] };
        return new Response(null, { status: 204 });
      }
      if (pathname === "/api/undo/batch-archive-1" && method === "POST") {
        metric = { ...metric, archived_at: null };
        return json({ restored: 1 });
      }
      return json({});
    }),
  );
});

test("logs an entry directly from a metric tile on the Area page", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  const tile = await screen.findByRole("article", { name: "Running distance" });

  await user.click(within(tile).getByRole("button", { name: "Log entry for Running distance" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Value"), "7.5");
  await user.type(within(dialog).getByLabelText("Note"), "Evening run");
  await user.click(within(dialog).getByRole("button", { name: "Log entry" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(requests).toContainEqual(
    expect.objectContaining({
      method: "POST",
      path: "/api/metrics/10/entries",
      body: expect.objectContaining({ value: 7.5, note: "Evening run" }),
    }),
  );
  expect(await screen.findByText("Logged 7.5 km · Running distance")).toBeInTheDocument();
});

test("archives a metric from its detail panel menu with an undo toast", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  const tile = await screen.findByRole("article", { name: "Running distance" });

  await user.click(within(tile).getByRole("button", { name: "Running distance" }));
  const panel = await screen.findByRole("complementary", { name: "Details" });
  await user.click(await within(panel).findByRole("button", { name: "More actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Archive metric" }));

  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "POST",
      path: "/api/metrics/10/archive",
      body: undefined,
    }),
  );
  const toastMessage = await screen.findByText("Archived “Running distance”");
  const toast = toastMessage.closest("[role=status]") as HTMLElement;
  await user.click(within(toast).getByRole("button", { name: "Undo" }));
  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "POST",
      path: "/api/undo/batch-archive-1",
      body: undefined,
    }),
  );
});

test("edits all metric fields via the Edit metric modal and panel chips, and logs inline", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  const tile = await screen.findByRole("article", { name: "Running distance" });

  await user.click(within(tile).getByRole("button", { name: "Running distance" }));
  const panel = await screen.findByRole("complementary", { name: "Details" });

  // Inline entry log in detail panel
  await user.type(await within(panel).findByLabelText("Log value"), "3");
  await user.click(within(panel).getByRole("button", { name: "Log" }));
  await waitFor(() =>
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: "POST",
        path: "/api/metrics/10/entries",
        body: expect.objectContaining({ value: 3 }),
      }),
    ),
  );

  // Quick chip change for Direction
  await user.click(within(panel).getByRole("button", { name: "Direction" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Lower is better" }));
  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "PATCH",
      path: "/api/metrics/10",
      body: { direction: "lower" },
    }),
  );

  // Full Edit metric modal from target chip
  await user.click(within(panel).getByRole("button", { name: "Edit target" }));
  const dialog = await screen.findByRole("dialog");
  const nameInput = within(dialog).getByLabelText("Name");
  await user.clear(nameInput);
  await user.type(nameInput, "Weekly mileage");
  await user.selectOptions(within(dialog).getByLabelText("Unit"), "mi");
  await user.click(within(dialog).getByRole("radio", { name: "Average" }));
  const targetInput = within(dialog).getByLabelText("Target number");
  await user.clear(targetInput);
  await user.type(targetInput, "15");
  await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(requests).toContainEqual({
    method: "PATCH",
    path: "/api/metrics/10",
    body: {
      title: "Weekly mileage",
      format: "number",
      unit: "mi",
      aggregation: "average",
      direction: "lower",
    },
  });
  expect(requests).toContainEqual({
    method: "POST",
    path: "/api/metric-targets/20/replace",
    body: { target_value: 15, period: "week" },
  });
});
