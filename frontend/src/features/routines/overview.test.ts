import { describe, expect, it } from "vitest";
import type {
  OverviewRoutineRead,
  RoutinesOverviewRead,
  RoutineTotalsRead,
  StepDayState,
} from "../../client/types.gen";
import {
  openToday,
  overviewCsv,
  overviewTiles,
  pickUpLine,
  routineCells,
  routineMeta,
  routinesSubtitle,
  shownRoutines,
} from "./overview";

const TODAY = "2026-11-18"; // a Wednesday

function totals(done: number, missed: number, skipped = 0, dueDays = 0, fullDays = 0) {
  const counted = done + missed;
  return {
    done,
    missed,
    skipped,
    due_days: dueDays,
    full_days: fullDays,
    completion_rate: counted ? Math.round((100 * done) / counted) : null,
  } satisfies RoutineTotalsRead;
}

const WEEK = ["16", "17", "18", "19", "20", "21", "22"].map((day) => `2026-11-${day}`);

function days(states: StepDayState["state"][]): StepDayState[] {
  return states.map((state, index) => ({ day: WEEK[index], state }));
}

function routine(fields: Partial<OverviewRoutineRead> & { id: number }): OverviewRoutineRead {
  return {
    title: `Routine ${fields.id}`,
    rrule: "FREQ=DAILY",
    schedule_starts_on: "2026-11-09",
    paused_since: null,
    totals: totals(0, 0),
    today_done: 0,
    today_due: 0,
    steps: [],
    ...fields,
  };
}

const MORNING = routine({
  id: 1,
  title: "Morning",
  totals: totals(4, 1),
  today_done: 1,
  today_due: 2,
  steps: [
    {
      id: 11,
      title: "Water",
      life_area_id: 1,
      project_id: null,
      days: days(["done", "done", "done", "upcoming", "upcoming", "upcoming", "upcoming"]),
    },
    {
      id: 12,
      title: "Make the bed",
      life_area_id: 2,
      project_id: null,
      days: days(["missed", "done", "todo", "upcoming", "upcoming", "upcoming", "upcoming"]),
    },
  ],
});

const READING = routine({
  id: 2,
  title: "Evening, reading",
  rrule: "FREQ=WEEKLY;BYDAY=SU",
  totals: totals(1, 0),
  steps: [
    {
      id: 21,
      title: "Read",
      life_area_id: 1,
      project_id: null,
      days: days(["not_due", "not_due", "not_due", "not_due", "not_due", "not_due", "upcoming"]),
    },
  ],
});

const PAUSED = routine({ id: 3, title: "Abs", paused_since: "2026-11-10", totals: totals(0, 0) });

function overview(fields: Partial<RoutinesOverviewRead> = {}): RoutinesOverviewRead {
  return {
    period: "week",
    start: WEEK[0],
    end: WEEK[6],
    today: TODAY,
    totals: totals(5, 1, 1, 6, 3),
    previous: totals(21, 0),
    longest_run: { length: 9, routine_id: 2, routine_title: "Evening, reading" },
    started: "2026-11-09",
    buckets: [
      { start: WEEK[0], end: WEEK[0], totals: totals(2, 1), run: 8 },
      { start: WEEK[1], end: WEEK[1], totals: totals(3, 0), run: 9 },
      { start: WEEK[2], end: WEEK[2], totals: totals(1, 0), run: 9 },
    ],
    routines: [MORNING, READING, PAUSED],
    most_missed: [],
    pick_up: [],
    ...fields,
  };
}

describe("overviewTiles", () => {
  it("adds up every routine and names the longest run's routine", () => {
    const tiles = overviewTiles(overview(), "week");
    expect(tiles.map((tile) => [tile.label, tile.value, tile.unit, tile.line])).toEqual([
      ["Completion rate", "83", "%", "−17 pts vs last week"],
      ["Steps done", "5", "", "of 7 due"],
      ["Full days", "3", "", "of 6 routine days"],
      ["Missed", "1", "step", "+1 vs last week"],
      ["Longest run", "9", "days", "Evening, reading"],
    ]);
    expect(tiles[4].points).toEqual([8, 9, 9]);
    expect(tiles[0].tips[0]).toBe("Mon, Nov 16: 67%");
  });

  it("says since when there is no previous period, and — with no history", () => {
    const first = overviewTiles(overview({ previous: null, longest_run: null }), "week");
    expect(first[0].line).toBe("Since Nov 9");
    expect(first[4].line).toBe("No full days yet");
    const empty = overviewTiles(overview({ totals: totals(0, 0) }), "week");
    expect(empty.map((tile) => tile.value)).toEqual(["—", "—", "—", "—", "—"]);
  });
});

describe("routine rows", () => {
  it("describes each routine and the card", () => {
    expect(routineMeta(MORNING)).toBe("Every day · 2 steps");
    expect(routinesSubtitle([MORNING, READING])).toBe("2 routines · 3 steps");
  });

  it("sorts by completion rate or name and hides paused routines when asked", () => {
    const all = [MORNING, READING, PAUSED];
    expect(shownRoutines(all, "manual", true).map((r) => r.id)).toEqual([1, 2, 3]);
    expect(shownRoutines(all, "rate", true).map((r) => r.id)).toEqual([2, 1, 3]);
    expect(shownRoutines(all, "name", false).map((r) => r.title)).toEqual([
      "Evening, reading",
      "Morning",
    ]);
  });

  it("shades each day by the share of due steps done", () => {
    const cells = routineCells(MORNING, overview(), "week");
    expect(cells.map((cell) => [cell.state, cell.share])).toEqual([
      ["share", 0.5],
      ["share", 1],
      ["share", 0.5], // today: Water done, Make the bed still to do
      ["upcoming", 0],
      ["upcoming", 0],
      ["upcoming", 0],
      ["upcoming", 0],
    ]);
    expect(cells[0].label).toBe("Morning · Mon, Nov 16 · 1 of 2 done");
    expect(routineCells(READING, overview(), "week")[0].state).toBe("not_due");
  });
});

describe("Pick up", () => {
  it("lists routines with steps left today, never paused ones", () => {
    const paused = { ...PAUSED, today_due: 2 };
    expect(openToday([MORNING, READING, paused]).map((r) => r.id)).toEqual([1]);
  });

  it("says how long the streak was and the day it ended", () => {
    expect(pickUpLine(10, "2026-11-17")).toBe("10 days · ended Tue");
  });
});

describe("overviewCsv", () => {
  it("has one line per step and due day, quoting commas", () => {
    const areas = [{ id: 1, title: "Health" }] as Parameters<typeof overviewCsv>[1];
    const lines = overviewCsv(overview({ routines: [READING] }), areas)
      .trim()
      .split("\n");
    expect(lines).toEqual([
      "Date,Routine,Step,Life area,Status",
      '2026-11-22,"Evening, reading",Read,Health,Upcoming',
    ]);
  });
});
