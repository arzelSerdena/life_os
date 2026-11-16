import { expect, test } from "vitest";
import type { DayRead, LifeAreaRead, RoutineStepDay } from "../../client/types.gen";
import { taskRead as task } from "../../test-utils";
import { buildColumns, tasksForView } from "./board";
import { filtersOn, openFirst, resolveFilters, sortTasks, taskShown } from "./filters";
import { buildDayColumns } from "./next7";

const TODAY = "2026-11-14";
const titles = (list: { title: string }[]) => list.map((item) => item.title);

test("defaults: subgroup by the group, Manual first, Next 7 days shows done tasks", () => {
  expect(resolveFilters("all", "priority", undefined)).toMatchObject({
    sort: "manual",
    subgroup: "area",
    show: { completed: false, cancelled: false },
  });
  expect(resolveFilters("all", "area", undefined).subgroup).toBe("project");
  expect(resolveFilters("inbox", "area", undefined).sort).toBe("created");
  expect(resolveFilters("next7", "days", undefined)).toMatchObject({
    subgroup: "none",
    show: { events: true, routines: true, projects: true, completed: true, cancelled: false },
  });
});

test("a stored choice the view doesn't offer falls back to the default", () => {
  const filters = resolveFilters("unscheduled", "priority", {
    sort: "due",
    subgroups: { priority: "project" },
  });
  expect(filters.sort).toBe("manual");
  expect(filters.subgroup).toBe("area");
});

test("filters are on when a priority or area is hidden or Show differs from the default", () => {
  expect(filtersOn("all", resolveFilters("all", "priority", { sort: "priority" }))).toBe(false);
  expect(filtersOn("all", resolveFilters("all", "priority", { hiddenPriorities: ["low"] }))).toBe(
    true,
  );
  expect(filtersOn("all", resolveFilters("all", "priority", { hiddenAreas: ["none"] }))).toBe(true);
  expect(filtersOn("next7", resolveFilters("next7", "days", { show: { completed: true } }))).toBe(
    false,
  );
  expect(filtersOn("next7", resolveFilters("next7", "days", { show: { events: false } }))).toBe(
    true,
  );
});

test("hidden priorities and areas filter tasks; No area hides tasks with no area", () => {
  const filters = resolveFilters("all", "priority", {
    hiddenPriorities: ["low"],
    hiddenAreas: ["none", 2],
  });
  expect(taskShown(filters, task({ life_area_id: 1, priority: "high" }))).toBe(true);
  expect(taskShown(filters, task({ life_area_id: 1, priority: "low" }))).toBe(false);
  expect(taskShown(filters, task({ life_area_id: 2 }))).toBe(false);
  expect(taskShown(filters, task({ life_area_id: null }))).toBe(false);
});

test("sorts keep the manual order to break ties; dates sort undated last", () => {
  const a = task({ title: "a", priority: "low", due_date: "2026-11-20" });
  const b = task({ title: "b", priority: "high", scheduled_date: "2026-11-15" });
  const c = task({ title: "c", priority: "high", due_date: "2026-11-16", due_time: "09:00:00" });
  const d = task({ title: "d", created_at: "2026-10-01T00:00:00Z" });
  const manual = [a, b, c, d];

  expect(titles(sortTasks(manual, "manual"))).toEqual(["a", "b", "c", "d"]);
  expect(titles(sortTasks(manual, "priority"))).toEqual(["b", "c", "a", "d"]);
  expect(titles(sortTasks(manual, "date"))).toEqual(["b", "c", "a", "d"]);
  expect(titles(sortTasks(manual, "due"))).toEqual(["c", "a", "b", "d"]);
  expect(titles(sortTasks(manual, "created"))).toEqual(["d", "a", "b", "c"]);
});

test("Show completed lists done tasks after the open ones", () => {
  const done = task({ title: "done", status: "done", completed_at: "2026-11-13T10:00:00Z" });
  const open = task({ title: "open" });
  expect(titles(tasksForView("all", [done, open], TODAY))).toEqual(["open"]);
  expect(titles(openFirst(tasksForView("all", [done, open], TODAY, { completed: true })))).toEqual([
    "open",
    "done",
  ]);
});

const AREAS = [
  { id: 1, title: "Career", color: "blue" },
  { id: 2, title: "Health", color: "rose" },
] as LifeAreaRead[];

test("the Area group can be subgrouped by priority, and counts are open tasks only", () => {
  const high = task({ title: "high", life_area_id: 1, priority: "high" });
  const none = task({ title: "none", life_area_id: 1 });
  const done = task({ title: "done", life_area_id: 1, status: "done" });
  const columns = buildColumns(
    "all",
    "area",
    [high, none, done],
    { today: TODAY, lifeAreas: AREAS, projects: [] },
    "priority",
  );
  const career = columns.find((column) => column.key === "area-1");
  expect(career?.count).toBe(2);
  expect(career?.subgroups.map((subgroup) => subgroup.label)).toEqual(["High", "No priority"]);
});

test("None as the subgroup gives one unnamed subgroup per column", () => {
  const columns = buildColumns(
    "all",
    "priority",
    [task({ life_area_id: 1 }), task({ life_area_id: 2 })],
    { today: TODAY, lifeAreas: AREAS, projects: [] },
    "none",
  );
  const none = columns.find((column) => column.key === "none");
  expect(none?.subgroups).toHaveLength(1);
  expect(none?.subgroups[0].label).toBe("");
  expect(none?.subgroups[0].tasks).toHaveLength(2);
});

function step(overrides: Partial<RoutineStepDay>): RoutineStepDay {
  return {
    step_id: 1,
    routine_id: 1,
    routine_title: "Morning",
    title: "Water",
    life_area_id: 1,
    project_id: null,
    day: TODAY,
    status: "todo",
    ...overrides,
  };
}

test("Next 7 days: Show and Life areas filter routine steps, done and cancelled tasks", () => {
  const days: DayRead[] = [
    {
      day: TODAY,
      tasks: [],
      events: [],
      routine_steps: [
        step({ step_id: 1 }),
        step({ step_id: 2, title: "Stretch", life_area_id: 2 }),
      ],
    },
  ];
  const tasks = [
    task({ title: "open", life_area_id: 1, scheduled_date: TODAY }),
    task({ title: "done", life_area_id: 1, scheduled_date: TODAY, status: "done" }),
    task({ title: "cancelled", life_area_id: 1, scheduled_date: TODAY, status: "cancelled" }),
    task({ title: "health", life_area_id: 2, scheduled_date: TODAY }),
  ];

  const [, today] = buildDayColumns(tasks, days, [], TODAY);
  expect(titles(today.open)).toEqual(["open", "health"]);
  expect(titles(today.done)).toEqual(["done"]);
  expect(today.routines[0].steps).toHaveLength(2);

  const filters = resolveFilters("next7", "days", {
    hiddenAreas: [2],
    show: { completed: false, cancelled: true },
  });
  const [, filtered] = buildDayColumns(tasks, days, [], TODAY, filters);
  expect(titles(filtered.open)).toEqual(["open"]);
  expect(titles(filtered.done)).toEqual(["cancelled"]);
  expect(filtered.routines[0].steps.map((item) => item.title)).toEqual(["Water"]);

  const noRoutines = resolveFilters("next7", "days", { show: { routines: false } });
  expect(buildDayColumns(tasks, days, [], TODAY, noRoutines)[1].routines).toEqual([]);
});
