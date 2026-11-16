import { expect, test } from "vitest";
import type { DayRead, OccurrenceRead, ProjectRead, RoutineStepDay } from "../../client/types.gen";
import { taskRead as task } from "../../test-utils";
import {
  agendaDays,
  agendaTitle,
  applyMove,
  buildEntries,
  type CalendarFilters,
  canMove,
  DEFAULT_FILTERS,
  type Entry,
  eventSpan,
  inboxPanelTasks,
  isFiltered,
  rangeLabel,
  routineTotals,
  shiftEvent,
  showsToday,
  spanLabel,
  stepAnchor,
  viewRange,
} from "./calendar";

const TODAY = "2026-11-14"; // a Saturday

function day(date: string, overrides: Partial<DayRead> = {}): DayRead {
  return { day: date, tasks: [], events: [], routine_steps: [], ...overrides };
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
    start_time: "11:00:00",
    end_time: "12:30:00",
    location: null,
    is_repeating: false,
    is_cancelled: false,
    is_changed: false,
    is_past: false,
    ...overrides,
  };
}

function step(overrides: Partial<RoutineStepDay>): RoutineStepDay {
  return {
    step_id: 1,
    routine_id: 1,
    routine_title: "Evening routine",
    title: "Read",
    life_area_id: 1,
    project_id: null,
    day: TODAY,
    status: "todo",
    ...overrides,
  };
}

const project = (overrides: Partial<ProjectRead>) =>
  ({
    id: 1,
    title: "Hackathon prep",
    life_area_id: 1,
    due_date: TODAY,
    ...overrides,
  }) as ProjectRead;

const filters = (change: Partial<CalendarFilters> = {}, show = {}): CalendarFilters => ({
  ...DEFAULT_FILTERS,
  ...change,
  show: { ...DEFAULT_FILTERS.show, ...show },
});

const time = (value: string) => value.slice(0, 5);
const keys = (entries: Entry[]) => entries.map((entry) => entry.key);

// ---------------------------------------------------------------- the shown range

test("a week runs Monday to Sunday around any of its days", () => {
  expect(viewRange("week", TODAY)).toEqual({ start: "2026-11-09", end: "2026-11-15", count: 7 });
  expect(viewRange("week", "2026-11-16")).toEqual({
    start: "2026-11-16",
    end: "2026-11-22",
    count: 7,
  });
});

test("a month takes the whole weeks that hold its days", () => {
  // November 2026 starts on a Sunday and ends on a Monday: six rows.
  expect(viewRange("month", TODAY)).toEqual({ start: "2026-10-26", end: "2026-12-06", count: 42 });
  // February 2027 starts on a Monday and ends on a Sunday: four rows.
  expect(viewRange("month", "2027-02-10")).toEqual({
    start: "2027-02-01",
    end: "2027-02-28",
    count: 28,
  });
});

test("stepping moves a whole week or month, across years", () => {
  expect(stepAnchor("week", TODAY, 1)).toBe("2026-11-16");
  expect(stepAnchor("week", TODAY, -1)).toBe("2026-11-02");
  expect(stepAnchor("month", TODAY, 2)).toBe("2027-01-01");
  expect(stepAnchor("month", "2026-01-31", -1)).toBe("2025-12-01");
});

test("the header names the range, with the year only when it isn't this year's", () => {
  expect(rangeLabel("week", TODAY, TODAY)).toBe("Nov 9 – 15");
  expect(rangeLabel("week", "2026-12-01", TODAY)).toBe("Nov 30 – Dec 6");
  expect(rangeLabel("week", "2026-12-30", TODAY)).toBe("Dec 28, 2026 – Jan 3, 2027");
  expect(rangeLabel("week", "2027-01-06", TODAY)).toBe("Jan 4 – 10, 2027");
  expect(rangeLabel("month", TODAY, TODAY)).toBe("November 2026");
});

test("Today shows only when today is out of view", () => {
  expect(showsToday("week", "2026-11-10", TODAY)).toBe(true);
  expect(showsToday("week", "2026-11-16", TODAY)).toBe(false);
  expect(showsToday("month", "2026-11-30", TODAY)).toBe(true);
  expect(showsToday("month", "2026-12-01", TODAY)).toBe(false);
});

// ---------------------------------------------------------------- entries

test("a day lists timed events by time, then routines, project due dates and tasks", () => {
  const days = [
    day(TODAY, {
      events: [
        event({ event_id: 2, title: "Dinner", start_time: "18:00:00" }),
        event({ event_id: 1, title: "Brunch", start_time: "11:00:00" }),
      ],
      routine_steps: [step({})],
      tasks: [
        task({ id: 3, title: "Done", status: "done", scheduled_date: TODAY }),
        task({ id: 2, title: "Second", sort_order: 1, scheduled_date: TODAY }),
        task({ id: 1, title: "First", sort_order: 0, scheduled_date: TODAY }),
      ],
    }),
  ];

  const entries = buildEntries(days, [project({})], filters());

  expect(keys([...entries].sort((a, b) => a.order - b.order))).toEqual([
    `event:1:${TODAY}`,
    `event:2:${TODAY}`,
    `routine:1:${TODAY}`,
    "project:1",
    "task:1",
    "task:2",
    "task:3",
  ]);
});

test("an event over several days is one entry, though every day it covers lists it", () => {
  const trip = event({
    title: "Trip",
    start_date: "2026-11-13",
    end_date: "2026-11-15",
    start_time: null,
  });
  const days = ["2026-11-13", TODAY, "2026-11-15"].map((date) => day(date, { events: [trip] }));

  const entries = buildEntries(days, [], filters());

  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ start: "2026-11-13", end: "2026-11-15" });
});

test("the sidebar's filters hide areas, priorities and kinds", () => {
  const days = [
    day(TODAY, {
      events: [event({ life_area_id: 2 })],
      routine_steps: [step({ life_area_id: 1 })],
      tasks: [
        task({ id: 1, life_area_id: 1, priority: "high", scheduled_date: TODAY }),
        task({ id: 2, life_area_id: null, priority: "none", scheduled_date: TODAY }),
        task({ id: 3, life_area_id: 1, status: "cancelled", scheduled_date: TODAY }),
      ],
    }),
  ];

  expect(keys(buildEntries(days, [], filters({ hiddenAreas: [2, "none"] })))).toEqual([
    `routine:1:${TODAY}`,
    "task:1",
  ]);
  expect(
    keys(
      buildEntries(
        days,
        [],
        filters({ hiddenPriorities: ["high"] }, { events: false, routines: false }),
      ),
    ),
  ).toEqual(["task:2"]);
  expect(keys(buildEntries(days, [], filters({}, { cancelled: true, tasks: true })))).toContain(
    "task:3",
  );
});

test("weekends off hide weekend days' entries, but not a bar that crosses them", () => {
  const sunday = "2026-11-15";
  const bar = event({ event_id: 2, start_date: "2026-11-13", end_date: sunday, start_time: null });
  const days = [
    day(sunday, {
      events: [bar, event({ start_date: sunday, end_date: sunday })],
      tasks: [task({ scheduled_date: sunday })],
    }),
  ];

  expect(keys(buildEntries(days, [], filters({}, { weekends: false })))).toEqual([
    `event:2:${TODAY}`,
  ]);
});

test("Month's routine ring counts every step due that day", () => {
  const days = [
    day(TODAY, { routine_steps: [step({ status: "done" }), step({ step_id: 2, routine_id: 2 })] }),
  ];

  const ring = routineTotals(days, filters()).get(TODAY);

  expect(ring).toMatchObject({ done: 1, total: 2 });
  expect(ring?.routines.map((routine) => routine.routineId)).toEqual([1, 2]);
  expect(routineTotals(days, filters({}, { routines: false })).size).toBe(0);
});

test("an event's span: one day, several days with times, or all day", () => {
  expect(eventSpan(event({}), time)).toBe("11:00 – 12:30");
  expect(eventSpan(event({ start_time: null, end_time: null }), time)).toBe("All day");
  expect(
    eventSpan(
      event({
        start_date: "2026-11-13",
        end_date: "2026-11-15",
        start_time: "18:00",
        end_time: "15:00",
      }),
      time,
    ),
  ).toBe("Fri 18:00 – Sun 15:00");
  expect(eventSpan(event({ end_date: "2026-11-15", start_time: null, end_time: null }), time)).toBe(
    "All day · until Nov 15",
  );
});

// ---------------------------------------------------------------- the agenda

test("the agenda lists each day's entries, bars first, a bar from before on the first day", () => {
  const range = viewRange("week", TODAY);
  const days = [
    day("2026-11-13", {
      events: [
        event({ event_id: 9, start_date: "2026-11-05", end_date: "2026-11-13", start_time: null }),
      ],
    }),
    day(TODAY, {
      tasks: [task({ id: 1, scheduled_date: TODAY })],
      events: [event({ event_id: 2, start_time: null })],
    }),
  ];

  const agenda = agendaDays(buildEntries(days, [], filters()), range);

  expect(agenda.map((item) => [item.day, keys(item.entries)])).toEqual([
    ["2026-11-09", [`event:9:${TODAY}`]],
    [TODAY, [`event:2:${TODAY}`, "task:1"]],
  ]);
});

test("agenda days are Today, Tomorrow, then the weekday", () => {
  expect(agendaTitle(TODAY, TODAY)).toEqual({ label: "Today", date: "Sat, Nov 14" });
  expect(agendaTitle("2026-11-15", TODAY)).toEqual({ label: "Tomorrow", date: "Sun, Nov 15" });
  expect(agendaTitle("2026-11-16", TODAY)).toEqual({ label: "Mon", date: "Nov 16" });
});

test("filters count as hiding something unless only Cancelled or Weekends changed", () => {
  expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
  expect(isFiltered(filters({}, { cancelled: true, weekends: false }))).toBe(false);
  expect(isFiltered(filters({ hiddenAreas: ["none"] }))).toBe(true);
  expect(isFiltered(filters({}, { completed: false }))).toBe(true);
});

// ---------------------------------------------------------------- the Inbox panel

test("the Inbox panel lists open tasks with no scheduled date, or no due date, oldest first", () => {
  const tasks = [
    task({ id: 1, created_at: "2026-11-02T00:00:00Z", due_date: TODAY }),
    task({ id: 2, created_at: "2026-11-01T00:00:00Z", scheduled_date: TODAY }),
    task({ id: 3, created_at: "2026-11-03T00:00:00Z" }),
    task({ id: 4, status: "done" }),
  ];

  expect(inboxPanelTasks(tasks, "scheduled").map((item) => item.id)).toEqual([1, 3]);
  expect(inboxPanelTasks(tasks, "due").map((item) => item.id)).toEqual([2, 3]);
});

// ---------------------------------------------------------------- moving things

test("open tasks and one-off events can be dragged; repeating events and routines can't", () => {
  const [taskEntry, done, oneOff, repeating, routine] = buildEntries(
    [
      day(TODAY, {
        tasks: [
          task({ id: 1, scheduled_date: TODAY }),
          task({ id: 2, status: "done", scheduled_date: TODAY }),
        ],
        events: [event({ event_id: 1 }), event({ event_id: 2, is_repeating: true })],
        routine_steps: [step({})],
      }),
    ],
    [],
    filters(),
  ).sort(
    (a, b) => (a.kind === "task" ? -1 : 0) - (b.kind === "task" ? -1 : 0) || a.order - b.order,
  );

  expect([taskEntry, done, oneOff, repeating, routine].map(canMove)).toEqual([
    true,
    false,
    true,
    false,
    false,
  ]);
});

test("a dragged event keeps its length; a one-day event keeps no end date", () => {
  expect(
    shiftEvent(event({ start_date: "2026-11-13", end_date: "2026-11-15" }), "2026-11-20"),
  ).toEqual({
    start_date: "2026-11-20",
    end_date: "2026-11-22",
  });
  expect(shiftEvent(event({}), "2026-11-20")).toEqual({ start_date: "2026-11-20", end_date: null });
});

test("a move shows at once: the task on its new day, the event on every day it covers", () => {
  const brunch = event({});
  const todo = task({ id: 5, scheduled_date: TODAY });
  const days = [
    day(TODAY, { tasks: [todo], events: [brunch] }),
    day("2026-11-15"),
    day("2026-11-16"),
  ];
  const [eventEntry, taskEntry] = buildEntries(days, [], filters());

  const afterTask = applyMove(days, taskEntry, "2026-11-16", "2026-11-16");
  const afterEvent = applyMove(days, eventEntry, "2026-11-15", "2026-11-16");

  expect(afterTask.map((item) => item.tasks.map((t) => t.scheduled_date))).toEqual([
    [],
    [],
    ["2026-11-16"],
  ]);
  expect(afterEvent.map((item) => item.events.length)).toEqual([0, 1, 1]);
});

test("a span in the toast: one day, a run inside a month, or across months", () => {
  expect(spanLabel("2026-11-26", "2026-11-26")).toBe("Nov 26");
  expect(spanLabel("2026-11-26", "2026-11-29")).toBe("Nov 26 – 29");
  expect(spanLabel("2026-11-30", "2026-12-02")).toBe("Nov 30 – Dec 2");
});
