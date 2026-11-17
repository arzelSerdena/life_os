import { describe, expect, it } from "vitest";
import type {
  RoutinePageRead,
  RoutinePageStepRead,
  RoutineStepDay,
  RoutineTotalsRead,
  StepDayState,
} from "../../client/types.gen";
import { parseRRule } from "../pickers/repeat";
import { dayCard, heatmap, scheduleHistory, scheduleLabel, tiles } from "./routine";

const TODAY = "2026-11-18"; // a Wednesday; its week is Nov 16 to 22
const WEEK = [
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
];

function totals(fields: Partial<RoutineTotalsRead> = {}): RoutineTotalsRead {
  return {
    done: 0,
    missed: 0,
    skipped: 0,
    due_days: 0,
    full_days: 0,
    completion_rate: null,
    ...fields,
  };
}

function step(
  id: number,
  states: StepDayState["state"][],
  fields: Partial<RoutinePageStepRead> = {},
): RoutinePageStepRead {
  return {
    step: {
      id,
      routine_id: 1,
      life_area_id: 1,
      project_id: null,
      title: `Step ${id}`,
      notes: null,
      starts_on: "2026-11-09",
      sort_order: id,
      is_paused: false,
      current_streak: 0,
      best_streak: 0,
      archived_at: null,
      created_at: "2026-11-09T00:00:00Z",
      updated_at: "2026-11-09T00:00:00Z",
    },
    metric: null,
    next_due: TODAY,
    paused_since: null,
    days: states.map((state, index) => ({ day: WEEK[index], state })),
    done: states.filter((state) => state === "done").length,
    missed: states.filter((state) => state === "missed").length,
    ...fields,
  };
}

function page(fields: Partial<RoutinePageRead> = {}): RoutinePageRead {
  return {
    routine: {
      id: 1,
      title: "Evening",
      notes: null,
      sort_order: 0,
      is_paused: false,
      archived_at: null,
      created_at: "2026-11-09T00:00:00Z",
      updated_at: "2026-11-09T00:00:00Z",
      schedules: [{ rrule: "FREQ=DAILY", starts_on: "2026-11-09" }],
      steps: [],
    },
    rrule: "FREQ=DAILY",
    paused_since: null,
    pauses: [],
    period: "week",
    start: WEEK[0],
    end: WEEK[6],
    today: TODAY,
    totals: totals(),
    previous: null,
    current_run: { length: 0, start: null, end: null },
    best_run: { length: 0, start: null, end: null },
    buckets: [],
    steps: [],
    ...fields,
  };
}

const UPCOMING: StepDayState["state"][] = ["upcoming", "upcoming", "upcoming", "upcoming"];

describe("parseRRule", () => {
  it("reads the frequency, interval and weekdays back", () => {
    expect(parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=SA,TU")).toMatchObject({
      frequency: "weekly",
      interval: 2,
      weekdays: [1, 5],
    });
    expect(parseRRule("FREQ=DAILY")).toMatchObject({ frequency: "daily", interval: 1 });
  });
});

describe("scheduleLabel", () => {
  it("names the schedule in force and when it began", () => {
    expect(scheduleLabel(page())).toBe("Every day · since Nov 9");
    const today = page({
      routine: {
        ...page().routine,
        schedules: [{ rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", starts_on: TODAY }],
      },
    });
    expect(scheduleLabel(today)).toBe("Every weekday · from today");
  });
});

describe("tiles", () => {
  it("compares with the previous period and shows the current run", () => {
    const found = tiles(
      page({
        totals: totals({ done: 4, missed: 1, due_days: 3, full_days: 1, completion_rate: 80 }),
        previous: totals({ done: 14, missed: 0, due_days: 7, full_days: 7, completion_rate: 100 }),
        current_run: { length: 1, start: "2026-11-17", end: "2026-11-17" },
        best_run: { length: 1, start: "2026-11-17", end: "2026-11-17" },
      }),
      "week",
    );

    expect(found.map((tile) => [tile.label, tile.value, tile.unit, tile.line])).toEqual([
      ["Completion rate", "80", "%", "−20 pts vs last week"],
      ["Full days", "1", "", "of 3 due days"],
      ["Current run", "1", "day", "Best 1 · Nov 17"],
      ["Missed", "1", "step", "+1 vs last week"],
      ["Skipped", "0", "steps", "of 5 due steps"],
    ]);
    expect(found[0].good).toBe(false);
    expect(found[3].good).toBe(false);
  });

  it("shows the best run first while the current run is 0", () => {
    const [, , run] = tiles(
      page({
        totals: totals({ done: 10, missed: 2, completion_rate: 83 }),
        best_run: { length: 4, start: "2026-10-26", end: "2026-10-29" },
      }),
      "quarter",
    );

    expect([run.label, run.value, run.unit, run.line]).toEqual([
      "Best run",
      "4",
      "days",
      "Oct 26 – 29 · current 0",
    ]);
  });

  it("shows dashes before anything was due", () => {
    expect(tiles(page(), "week").map((tile) => tile.value)).toEqual(["—", "—", "—", "—", "—"]);
  });
});

describe("heatmap", () => {
  it("gives each day the share of due steps done, skipped steps left out", () => {
    const map = heatmap(
      page({
        steps: [
          step(1, ["done", "done", "done", ...UPCOMING]),
          step(2, ["missed", "skipped", "todo", ...UPCOMING]),
        ],
      }),
      "week",
    );

    expect(map.columns).toBe(7);
    expect(map.todayKey).toBe(TODAY);
    expect(map.all.slice(0, 4).map((cell) => [cell.state, cell.share])).toEqual([
      ["share", 0.5],
      ["share", 1],
      ["share", 0.5],
      ["upcoming", 0],
    ]);
    expect(map.all[0].label).toBe("All steps · Mon, Nov 16 · 1 of 2 done");
    expect(map.steps[1].cells[1].label).toBe("Step 2 · Tue, Nov 17 · skipped");
  });

  it("puts a week in each square of the Year view", () => {
    const days: StepDayState["state"][] = ["done", "missed", "todo", ...UPCOMING];
    const map = heatmap(page({ steps: [step(1, days)] }), "year");

    const current = map.all.find((cell) => cell.key === "2026-11-16");
    expect(current).toMatchObject({ state: "share", share: 0.5, isCurrent: true, day: null });
  });

  it("marks a day every step was paused, and a day with nothing due", () => {
    const map = heatmap(
      page({ steps: [step(1, ["paused", "not_due", "todo", ...UPCOMING])] }),
      "week",
    );

    expect(map.all.slice(0, 2).map((cell) => cell.state)).toEqual(["paused", "not_due"]);
  });
});

describe("scheduleHistory", () => {
  it("lists the schedules and pauses in the period", () => {
    const found = scheduleHistory(
      page({
        period: "month",
        start: "2026-11-01",
        end: "2026-11-30",
        routine: {
          ...page().routine,
          schedules: [
            { rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", starts_on: "2026-08-03" },
            { rrule: "FREQ=DAILY", starts_on: "2026-11-05" },
          ],
        },
        pauses: [
          { starts_on: "2026-11-10", ends_on: "2026-11-12" },
          { starts_on: "2026-11-16", ends_on: null },
        ],
      }),
      "month",
    );

    expect(found?.schedules.map((segment) => segment.label)).toEqual([
      "Every weekday · Aug 3 – Nov 4",
      "Every day · from Nov 5",
    ]);
    expect(found?.schedules[0]).toMatchObject({ left: 0, cutLeft: true });
    expect(found?.pauses.map((segment) => segment.label)).toEqual([
      "Paused Nov 10 – 11",
      "Paused since Nov 16",
    ]);
    expect(found?.subtitle).toBe("2 schedules · 2 pauses in November");
  });

  it("is left out for one schedule and no pauses", () => {
    expect(scheduleHistory(page(), "week")).toBeNull();
  });
});

describe("dayCard", () => {
  const due = (id: number, status: RoutineStepDay["status"], day = TODAY): RoutineStepDay => ({
    step_id: id,
    routine_id: 1,
    routine_title: "Evening",
    title: `Step ${id}`,
    life_area_id: 1,
    project_id: null,
    day,
    status,
  });
  const steps = [step(1, []), step(2, []), step(3, [])];

  it("counts done out of the steps that weren't skipped", () => {
    const card = dayCard(page({ steps }), TODAY, [
      due(1, "done"),
      due(2, "skipped"),
      due(3, "todo"),
    ]);

    expect(card).toMatchObject({ kind: "steps", done: 1, total: 2, canSkipDay: true });
  });

  it("leaves out other routines' steps and marks a later day upcoming", () => {
    const later = "2026-11-20";
    const other = { ...due(9, "todo", later), routine_id: 2 };
    const card = dayCard(page({ steps }), later, [due(1, "todo", later), other]);

    expect(card.kind === "steps" && card.rows.map((row) => row.state)).toEqual(["upcoming"]);
  });

  it("says when nothing is due, and when the routine was paused", () => {
    const paused = page({ steps, pauses: [{ starts_on: "2026-11-17", ends_on: null }] });
    const sunday = page({ steps: [step(1, [], { next_due: "2026-11-22" })] });

    expect(dayCard(paused, TODAY, [])).toEqual({ kind: "paused", since: "2026-11-17" });
    expect(dayCard(sunday, TODAY, [])).toEqual({ kind: "not_due", next: "2026-11-22" });
  });
});
