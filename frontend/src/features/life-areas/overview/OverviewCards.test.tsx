import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { OverviewRead } from "../../../client/types.gen";
import { emptyOverview, lifeArea, renderApp } from "../../../test-utils";

const career = lifeArea({ id: 1, title: "Career", color: "blue" });
const health = lifeArea({ id: 2, title: "Health", color: "rose" });

const overview: OverviewRead = emptyOverview([career, health], {
  effort: [
    { life_area_id: 1, done: 3, previous_done: 1 },
    { life_area_id: 2, done: 1, previous_done: 1 },
  ],
  outcomes: [
    {
      metric_id: 10,
      life_area_id: 1,
      title: "Job applications",
      unit: null,
      aggregation: "sum",
      direction: "higher",
      target: {
        id: 1,
        kind: "per_period",
        target_value: 5,
        period: "month",
        start_date: "2026-10-01",
        end_date: null,
      },
      chart: "per_period",
      points: [
        { start: "2026-10-01", end: "2026-10-31", value: 5, status: "met", is_current: false },
        {
          start: "2026-11-01",
          end: "2026-11-30",
          value: 1,
          status: "in_progress",
          is_current: true,
        },
      ],
      value: 1,
      previous_value: 5,
      status: "behind",
      met_periods: 1,
      finished_periods: 1,
    },
    {
      metric_id: 11,
      life_area_id: 2,
      title: "Electricity use",
      unit: "kWh",
      aggregation: "sum",
      direction: "lower",
      target: null,
      chart: "none",
      points: [
        { start: "2026-10-01", end: "2026-10-31", value: 240, status: null, is_current: false },
        { start: "2026-11-01", end: "2026-11-30", value: 182, status: null, is_current: true },
      ],
      value: 182,
      previous_value: 240,
      status: "improving",
      met_periods: 0,
      finished_periods: 0,
    },
  ],
  projects: [
    {
      life_area_id: 1,
      active_projects: 1,
      done: 1,
      total: 4,
      pace: 0.48,
      pace_status: "behind",
    },
    { life_area_id: 2, active_projects: 0, done: 0, total: 0, pace: null, pace_status: null },
  ],
  routines: [
    { life_area_id: 1, steps: 0, routines: 0, due: 0, done: 0, weeks: [] },
    {
      life_area_id: 2,
      steps: 1,
      routines: 1,
      due: 10,
      done: 9,
      weeks: [
        {
          start: "2026-11-02",
          end: "2026-11-08",
          due: 5,
          done: 5,
          is_current: false,
          is_upcoming: false,
        },
        {
          start: "2026-11-09",
          end: "2026-11-15",
          due: 5,
          done: 4,
          is_current: true,
          is_upcoming: false,
        },
        {
          start: "2026-11-16",
          end: "2026-11-22",
          due: 0,
          done: 0,
          is_current: false,
          is_upcoming: true,
        },
      ],
    },
  ],
  wins: [
    {
      kind: "target_periods_met",
      life_area_id: 1,
      title: "Calls",
      day: "2026-11-08",
      project_id: null,
      metric_id: 12,
      target_value: 2,
      unit: null,
      direction: "higher",
      period: "week",
      times: 2,
    },
    {
      kind: "project_finished",
      life_area_id: 1,
      title: "Interview prep",
      day: "2026-10-30",
      project_id: 3,
      metric_id: null,
      target_value: null,
      unit: null,
      direction: null,
      period: null,
      times: 1,
    },
  ],
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 10, 14), toFake: ["Date"] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) =>
      json(new URL(request.url).pathname.endsWith("/overview") ? overview : [career, health]),
    ),
  );
});

test("Effort splits completed tasks by area and compares shares with the last period", async () => {
  renderApp();

  const effort = await screen.findByRole("region", { name: "Effort" });
  expect(effort).toHaveTextContent("Where your completed tasks went in Q4 · 4 in total");
  expect(effort).toHaveTextContent("75%");
  expect(within(effort).getByText("3 tasks · +25 pts vs Q3")).toBeInTheDocument();
  expect(within(effort).getByText("1 task · −25 pts vs Q3")).toBeInTheDocument();
});

test("Outcomes groups metric tiles by area with their value, target and summary", async () => {
  renderApp();

  const outcomes = await screen.findByRole("region", { name: "Outcomes" });
  expect(outcomes).toHaveTextContent("2 metrics owned by 2 areas · 1 on track or met, 1 behind");
  const applications = within(outcomes).getByRole("article", { name: "Job applications" });
  expect(applications).toHaveTextContent("of 5 this month");
  expect(applications).toHaveTextContent("1 of 1 month met");
  const electricity = within(outcomes).getByRole("article", { name: "Electricity use" });
  expect(electricity).toHaveTextContent("182kWhthis month so far");
  expect(electricity).toHaveTextContent("Lower is better · down from October");
});

test("the Outcomes menu filters out metrics that are behind", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderApp();

  const outcomes = await screen.findByRole("region", { name: "Outcomes" });
  await user.click(within(outcomes).getByRole("button", { name: "Sort and filter Outcomes" }));
  await user.click(await screen.findByRole("menuitemcheckbox", { name: "Behind" }));
  // The menu stays open for more changes; while open it hides the page from screen readers.
  expect(screen.getByRole("menuitemcheckbox", { name: "Behind" })).not.toBeChecked();
  await user.keyboard("{Escape}");

  expect(
    within(outcomes).queryByRole("article", { name: "Job applications" }),
  ).not.toBeInTheDocument();
  expect(within(outcomes).getByRole("article", { name: "Electricity use" })).toBeInTheDocument();
});

test("Projects, routine steps and wins summarize each area", async () => {
  renderApp();

  const projects = await screen.findByRole("region", { name: "Projects" });
  expect(projects).toHaveTextContent(
    "1 active project in 1 area · 0 ahead of pace, 1 behind, 0 on pace",
  );
  expect(projects).toHaveTextContent("25%23 pts behind pace");

  const routines = screen.getByRole("region", { name: "Routine steps done" });
  expect(routines).toHaveTextContent("90% of due steps done in Q4");
  expect(routines).toHaveTextContent("80%this week");

  const wins = screen.getByRole("region", { name: "Wins" });
  expect(wins).toHaveTextContent("2 in Q4");
  expect(within(wins).getByText("Weekly target met 2 times")).toBeInTheDocument();
  expect(within(wins).getByText("Project finished Oct 30")).toBeInTheDocument();
});
