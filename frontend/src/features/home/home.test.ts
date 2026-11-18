import { expect, test } from "vitest";
import type { LogMetricRead, OccurrenceRead, PushMetricRead } from "../../client/types.gen";
import { emptyHome, taskRead } from "../../test-utils";
import { formatTime } from "../tasks/format";
import {
  behindLine,
  comingUpDays,
  comingUpSubtitle,
  doneCount,
  eventWhen,
  isFirstRun,
  logLine,
  nextUp,
  scheduleItems,
  todaySubtitle,
  withoutPending,
} from "./home";

const TODAY = "2026-11-14"; // a Saturday
const time = (value: string) => formatTime(value, "12h");

let nextEventId = 1;
function occurrence(overrides: Partial<OccurrenceRead>): OccurrenceRead {
  const id = nextEventId++;
  return {
    event_id: id,
    occurrence_date: overrides.start_date ?? TODAY,
    life_area_id: 1,
    project_id: null,
    title: `Event ${id}`,
    notes: null,
    start_date: TODAY,
    end_date: overrides.start_date ?? TODAY,
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

const step = (status: "todo" | "done" | "skipped" | "missed", id: number) => ({
  step_id: id,
  title: `Step ${id}`,
  life_area_id: 1,
  project_id: null,
  status,
  streak: 0,
  metric: null,
});

const metric = {
  metric_id: 1,
  life_area_id: 1,
  project_id: null,
  aggregation: "sum",
  direction: "higher",
  target_kind: "per_period",
} as const;

test("first run lasts until there is an area and a task or a routine", () => {
  const setup = (life_area: string | null, routine: string | null, task: string | null) =>
    isFirstRun(emptyHome({ setup: { life_area, routine, task } }));
  expect(setup(null, "Morning", "Buy groceries")).toBe(true);
  expect(setup("Career", null, null)).toBe(true);
  expect(setup("Career", "Morning", null)).toBe(false);
  expect(setup("Career", null, "Buy groceries")).toBe(false);
});

test("the done count adds today's tasks and due steps, leaving skipped steps out", () => {
  const home = emptyHome({
    overdue: [taskRead({})],
    tasks: [taskRead({}), taskRead({})],
    completed: [taskRead({ status: "done" })],
    routines: [
      {
        routine_id: 1,
        title: "Evening",
        steps: [step("done", 1), step("todo", 2), step("skipped", 3)],
      },
    ],
  });
  expect(doneCount(home)).toEqual({ done: 2, total: 6 });
  expect(todaySubtitle(home)).toBe("4 tasks");
});

test("tasks waiting to be deleted are left out", () => {
  const kept = taskRead({});
  const deleting = taskRead({});
  const home = withoutPending(emptyHome({ tasks: [kept, deleting] }), [
    { key: "1", kind: "task", id: deleting.id, label: "x", isSent: false },
  ]);
  expect(home.tasks).toEqual([kept]);
});

test("the schedule puts all-day items first, then timed events around the now line", () => {
  const weekend = occurrence({ title: "Hackathon weekend", end_date: "2026-11-15" });
  const brunch = occurrence({ title: "Brunch", start_time: "11:00:00", end_time: "12:30:00" });
  const demo = occurrence({
    title: "Demo rehearsal",
    start_time: "17:00:00",
    end_time: "18:00:00",
  });
  const home = emptyHome({
    events: [demo, weekend, brunch],
    projects_due: [{ id: 3, life_area_id: 1, title: "Kitchen", due_date: TODAY }],
  });

  const items = scheduleItems(home, "14:40", time);

  expect(items.map((item) => item.kind)).toEqual(["event", "project", "event", "now", "event"]);
  const [first, , second, , third] = items;
  expect(first.kind === "event" && [first.event.title, first.when, first.past]).toEqual([
    "Hackathon weekend",
    "All day",
    false,
  ]);
  expect(second.kind === "event" && [second.event.title, second.when, second.past]).toEqual([
    "Brunch",
    "11 AM – 12:30 PM",
    true,
  ]);
  expect(third.kind === "event" && third.past).toBe(false);
  expect(nextUp(home, "14:40", time)).toBe("Demo rehearsal 5 PM");
  // No timed events: no now line.
  expect(scheduleItems(emptyHome({ events: [weekend] }), "14:40", time)).toHaveLength(1);
});

test("a multi-day event says Until on its last day", () => {
  const event = occurrence({
    start_date: "2026-11-14",
    end_date: "2026-11-15",
    start_time: "18:00:00",
    end_time: "15:00:00",
  });
  expect(eventWhen(event, "2026-11-15", time)).toBe("Until 3 PM");
  expect(eventWhen(event, "2026-11-14", time)).toBe("6 PM – Sun 3 PM");
});

test("coming up groups by day, with an event that began earlier on the first day", () => {
  const home = emptyHome({
    coming_up: {
      range: { start: "2026-11-15", end: "2026-11-21" },
      events: [
        occurrence({ title: "Study group", start_date: "2026-11-19", start_time: "19:00:00" }),
        occurrence({
          title: "Hackathon weekend",
          start_date: "2026-11-14",
          end_date: "2026-11-15",
          end_time: "15:00:00",
          start_time: "09:00:00",
        }),
      ],
      projects: [{ id: 3, life_area_id: 1, title: "Kitchen deep clean", due_date: "2026-11-15" }],
      deadlines: [],
    },
  });

  const days = comingUpDays(home, time);

  expect(days.map((day) => [day.title, day.subtitle, day.items.length])).toEqual([
    ["Tomorrow", "Sun, Nov 15", 2],
    ["Thu", "Nov 19", 1],
  ]);
  const [weekend] = days[0].items;
  expect(weekend.kind === "event" && weekend.when).toBe("Until 3 PM");
  expect(comingUpSubtitle(home, days)).toBe("Nov 15 – 21 · 3 items");
  // With nothing today, the header names the first thing that starts.
  expect(nextUp(home, "09:00", time)).toBe("Sun, Nov 15 · Kitchen deep clean due");
});

test("log lines say the target and how the week is going", () => {
  const daily = {
    ...metric,
    title: "Water",
    format: "number",
    unit: "glasses",
    target_period: "day",
    target_value: 8,
    value: null,
    days_met: 4,
    days_counted: 5,
  } satisfies LogMetricRead;
  expect(logLine(daily)).toBe("8 glasses a day · 4 of 5 days met this week");
  expect(logLine({ ...daily, days_counted: 0 })).toBe("8 glasses a day");
  expect(
    logLine({
      ...daily,
      title: "Study hours",
      format: "duration",
      unit: null,
      target_period: "week",
      target_value: 600,
      value: 360,
    }),
  ).toBe("6 h of 10 h this week");
});

test("a metric behind target says where it stands and how long is left", () => {
  const behind = {
    ...metric,
    title: "Job applications",
    format: "number",
    unit: null,
    target_period: "month",
    target_value: 5,
    value: 1,
    ends_on: "2026-11-30",
  } satisfies PushMetricRead;
  expect(behindLine(behind, TODAY)).toBe("1 of 5 this month · 16 days left");
  expect(behindLine({ ...behind, value: null, ends_on: TODAY }, TODAY)).toBe(
    "0 of 5 this month · ends today",
  );
  expect(
    behindLine(
      { ...behind, target_kind: "reach_by", target_period: null, ends_on: "2026-12-31" },
      TODAY,
    ),
  ).toBe("1 of 5 by Dec 31");
});
