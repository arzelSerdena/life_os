import { expect, test } from "vitest";
import type { ProjectRead } from "../../client/types.gen";
import { lifeArea, taskRead as task } from "../../test-utils";
import { buildColumns, sidebarCounts, tasksForView } from "./board";

const TODAY = "2026-11-16";

const career = lifeArea({ id: 1, title: "Career", color: "blue", sort_order: 0 });
const finance = lifeArea({ id: 2, title: "Finance", color: "teal", sort_order: 1 });
const resume = {
  id: 7,
  life_area_id: 1,
  title: "Resume",
  sort_order: 0,
  status: "active",
  progress: { done: 1, total: 3 },
} as ProjectRead;
const context = { today: TODAY, lifeAreas: [career, finance], projects: [resume] };

test("Today holds open tasks placed today and overdue ones, nothing else", () => {
  const scheduledToday = task({ scheduled_date: TODAY });
  const dueToday = task({ due_date: TODAY });
  const overdue = task({ due_date: "2026-11-10" });
  // Scheduled today wins over a later due date (the placement rule).
  const scheduledOverDue = task({ scheduled_date: TODAY, due_date: "2026-11-20" });
  const tomorrow = task({ scheduled_date: "2026-11-17" });
  const doneToday = task({ scheduled_date: TODAY, status: "done" });

  const shown = tasksForView(
    "today",
    [scheduledToday, dueToday, overdue, scheduledOverDue, tomorrow, doneToday],
    TODAY,
  );
  expect(shown.map((t) => t.id).sort()).toEqual(
    [scheduledToday, dueToday, overdue, scheduledOverDue].map((t) => t.id).sort(),
  );
});

test("Unscheduled needs a life area and neither date; tasks with no area stay out", () => {
  const undated = task({ life_area_id: 1 });
  const dueOnly = task({ life_area_id: 1, due_date: "2026-11-20" });
  const inbox = task({});
  expect(tasksForView("unscheduled", [undated, dueOnly, inbox], TODAY)).toEqual([undated]);
  expect(sidebarCounts([undated, dueOnly, inbox], TODAY)).toEqual({
    all: 3,
    inbox: 3, // undated and dueOnly have no scheduled date, so they still need sorting
    today: 0,
    unscheduled: 1,
  });
});

test("Completed is newest first", () => {
  const older = task({ status: "done", completed_at: "2026-11-10T09:00:00Z" });
  const newer = task({ status: "done", completed_at: "2026-11-12T09:00:00Z" });
  expect(tasksForView("completed", [older, newer], TODAY)).toEqual([newer, older]);
});

test("Priority columns split by area in area order, with No area last", () => {
  const tasks = [
    task({ priority: "high" }),
    task({ priority: "high", life_area_id: 2 }),
    task({ priority: "high", life_area_id: 1 }),
    task({ priority: "low", life_area_id: 1 }),
  ];
  const columns = buildColumns("all", "priority", tasks, context);
  expect(columns.map((c) => [c.title, c.count])).toEqual([
    ["High", 3],
    ["Medium", 0],
    ["Low", 1],
    ["No priority", 0],
  ]);
  expect(columns[0].subgroups.map((s) => s.label)).toEqual(["Career", "Finance", "No area"]);
});

test("Area columns split by project, with the project leading and No project last", () => {
  const inProject = task({ life_area_id: 1, project_id: 7 });
  const loose = task({ life_area_id: 1 });
  const columns = buildColumns("all", "area", [loose, inProject], context);
  expect(columns.map((c) => c.title)).toEqual(["No area", "Career", "Finance"]);
  const careerColumn = columns[1];
  expect(careerColumn.subgroups.map((s) => [s.label, s.project?.id])).toEqual([
    ["Resume", 7],
    ["No project", undefined],
  ]);
});

test("Today puts overdue tasks in a red Overdue subgroup at the top of their column", () => {
  const overdue = task({ priority: "high", life_area_id: 1, due_date: "2026-11-10" });
  const now = task({ priority: "high", life_area_id: 1, scheduled_date: TODAY });
  const columns = buildColumns("today", "priority", [overdue, now], context);
  expect(columns[0].subgroups.map((s) => [s.label, s.danger ?? false, s.tasks])).toEqual([
    ["Overdue", true, [overdue]],
    ["Career", false, [now]],
  ]);
});

test("Unscheduled by area has no No area column; Completed has no subgroups", () => {
  expect(buildColumns("unscheduled", "area", [], context).map((c) => c.title)).toEqual([
    "Career",
    "Finance",
  ]);
  const done = task({ status: "done", life_area_id: 2, completed_at: "2026-11-12T09:00:00Z" });
  const columns = buildColumns("completed", "priority", [done], context);
  expect(columns.map((c) => c.title)).toEqual(["No area", "Career", "Finance"]);
  expect(columns[2].subgroups).toEqual([
    { key: "all", label: "", marker: { kind: "none" }, tasks: [done] },
  ]);
});
