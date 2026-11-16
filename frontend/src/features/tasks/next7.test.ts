import { expect, test } from "vitest";
import type { DayRead, OccurrenceRead, ProjectRead, RoutineStepDay } from "../../client/types.gen";
import { taskRead as task } from "../../test-utils";
import {
  applyDrop,
  buildDayColumns,
  canDrag,
  canDrop,
  dayTitles,
  eventTime,
  NO_DATE,
  next7Count,
  routineDays,
} from "./next7";

const TODAY = "2026-11-14"; // a Saturday

function day(date: string, overrides: Partial<DayRead> = {}): DayRead {
  return { day: date, tasks: [], events: [], routine_steps: [], ...overrides };
}
const WEEK = ["14", "15", "16", "17", "18", "19", "20"].map((n) => day(`2026-11-${n}`));

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

function event(overrides: Partial<OccurrenceRead>): OccurrenceRead {
  return {
    event_id: 1,
    occurrence_date: TODAY,
    life_area_id: 1,
    project_id: null,
    title: "Brunch",
    notes: null,
    start_date: TODAY,
    end_date: TODAY,
    start_time: null,
    end_time: null,
    location: null,
    is_repeating: false,
    is_cancelled: false,
    is_changed: false,
    is_past: false,
    ...overrides,
  };
}

const time = (value: string) => value.slice(0, 5);

test("columns are No date, then Today, Tomorrow and the weekdays", () => {
  const columns = buildDayColumns([], WEEK, [], TODAY);

  expect(columns.map((column) => [column.title, column.subtitle])).toEqual([
    ["No date", "Schedule"],
    ["Today", "Sat, Nov 14"],
    ["Tomorrow", "Sun, Nov 15"],
    ["Monday", "Nov 16"],
    ["Tuesday", "Nov 17"],
    ["Wednesday", "Nov 18"],
    ["Thursday", "Nov 19"],
    ["Friday", "Nov 20"],
  ]);
  expect(dayTitles("2026-11-14", TODAY).title).toBe("Today");
});

test("tasks sit by the placement rule; overdue ones are listed in Today only", () => {
  const scheduled = task({ scheduled_date: "2026-11-16", sort_order: 1 });
  const dueOnly = task({ due_date: "2026-11-16", sort_order: 0 });
  const someday = task({});
  const overdue = task({ due_date: "2026-11-10" });
  const overdueLater = task({ scheduled_date: "2026-11-17", due_date: "2026-11-12" });
  const cancelled = task({ scheduled_date: "2026-11-16", status: "cancelled" });

  const columns = buildDayColumns(
    [scheduled, dueOnly, someday, overdue, overdueLater, cancelled],
    WEEK,
    [],
    TODAY,
  );
  const byKey = Object.fromEntries(columns.map((column) => [column.key, column]));

  expect(byKey[NO_DATE].open).toEqual([someday]);
  expect(byKey[TODAY].overdue).toEqual([overdue, overdueLater]);
  expect(byKey[TODAY].count).toBe(2);
  expect(byKey["2026-11-16"].open).toEqual([dueOnly, scheduled]);
  expect(byKey["2026-11-17"].open).toEqual([]);
});

test("done tasks come after the open ones and don't count", () => {
  const open = task({ scheduled_date: TODAY });
  const done = task({
    scheduled_date: TODAY,
    status: "done",
    completed_at: "2026-11-14T08:00:00Z",
  });

  const [, today] = buildDayColumns([done, open], WEEK, [], TODAY);

  expect(today.open).toEqual([open]);
  expect(today.done).toEqual([done]);
  expect(today.count).toBe(1);
});

test("a day lists its routines, events in time order and projects due that day", () => {
  const days = WEEK.map((item) =>
    item.day === TODAY
      ? day(TODAY, {
          routine_steps: [
            step({ step_id: 1, status: "done" }),
            step({ step_id: 2 }),
            step({ step_id: 3, routine_id: 2, routine_title: "Evening" }),
          ],
          events: [
            event({ event_id: 1, title: "Dinner", start_time: "19:00:00" }),
            event({ event_id: 2, title: "Trip" }),
            event({ event_id: 3, title: "Gone", is_cancelled: true }),
          ],
        })
      : item,
  );
  const project = { id: 5, due_date: TODAY } as ProjectRead;

  const [, today] = buildDayColumns([], days, [project], TODAY);

  expect(today.routines.map((r) => [r.title, r.done, r.steps.length])).toEqual([
    ["Morning", 1, 2],
    ["Evening", 0, 1],
  ]);
  expect(today.events.map((e) => e.title)).toEqual(["Trip", "Dinner"]);
  expect(today.projects).toEqual([project]);
});

test("routineDays groups steps by routine", () => {
  expect(routineDays([], TODAY)).toEqual([]);
});

test("event times: all day, a range, and the first, middle and last day of a long event", () => {
  expect(eventTime(event({}), TODAY, time)).toBe("All day");
  expect(eventTime(event({ start_time: "11:00:00", end_time: "12:30:00" }), TODAY, time)).toBe(
    "11:00 – 12:30",
  );

  const trip = event({
    start_date: "2026-11-13",
    end_date: "2026-11-15",
    start_time: "18:00:00",
    end_time: "15:00:00",
  });
  expect(eventTime(trip, "2026-11-13", time)).toBe("From 18:00");
  expect(eventTime(trip, "2026-11-14", time)).toBe("All day");
  expect(eventTime(trip, "2026-11-15", time)).toBe("Until 15:00");
});

test("only open tasks that aren't overdue drag; No date refuses tasks with a due date", () => {
  expect(canDrag(task({}), TODAY)).toBe(true);
  expect(canDrag(task({ status: "done" }), TODAY)).toBe(false);
  expect(canDrag(task({ due_date: "2026-11-01" }), TODAY)).toBe(false);

  expect(canDrop(task({ due_date: "2026-11-16" }), NO_DATE)).toBe(false);
  expect(canDrop(task({ due_date: "2026-11-16" }), "2026-11-17")).toBe(true);
  expect(canDrop(task({}), NO_DATE)).toBe(true);
});

test("a drop reorders the listed tasks and reschedules only a moved one", () => {
  const a = task({ scheduled_date: TODAY, sort_order: 0 });
  const b = task({ scheduled_date: TODAY, sort_order: 1 });

  const reordered = applyDrop([a, b], [b.id, a.id]);
  expect(reordered.map((t) => [t.sort_order, t.scheduled_date])).toEqual([
    [1, TODAY],
    [0, TODAY],
  ]);

  const moved = applyDrop([a, b], [a.id], { taskId: a.id, day: "2026-11-16" });
  expect(moved[0].scheduled_date).toBe("2026-11-16");
  expect(moved[1]).toBe(b);
});

test("the sidebar counts open tasks on the seven days, overdue ones included", () => {
  const tasks = [
    task({ scheduled_date: TODAY }),
    task({ due_date: "2026-11-20" }),
    task({ due_date: "2026-11-01" }),
    task({ scheduled_date: "2026-11-21" }),
    task({}),
    task({ scheduled_date: TODAY, status: "done" }),
  ];

  expect(next7Count(tasks, WEEK, TODAY)).toBe(3);
});
