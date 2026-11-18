import { expect, test } from "vitest";
import type { OccurrenceRead, ProjectRead } from "../../client/types.gen";
import { taskRead } from "../../test-utils";
import { type CalendarFilters, DEFAULT_FILTERS, type Entry, viewRange } from "./calendar";
import {
  type LinearBar,
  linearMonths,
  marksThatFit,
  projectBars,
  projectStart,
  slotDay,
  splitEntries,
} from "./linear";

const TODAY = "2026-11-18";
const QUARTER = viewRange("quarter", TODAY); // Oct 1 – Dec 31, 2026

function event(start: string, end: string, overrides: Partial<OccurrenceRead> = {}): Entry {
  const occurrence = {
    event_id: Number(start.replaceAll("-", "")),
    occurrence_date: start,
    life_area_id: 1,
    project_id: null,
    title: `Event ${start}`,
    notes: null,
    start_date: start,
    end_date: end,
    start_time: null,
    end_time: null,
    location: null,
    is_repeating: false,
    is_cancelled: false,
    is_changed: false,
    is_past: end < TODAY,
    ...overrides,
  } satisfies OccurrenceRead;
  return {
    kind: "event",
    key: `event:${occurrence.event_id}:${start}`,
    start,
    end,
    order: 0,
    event: occurrence,
  };
}

const project = (overrides: Partial<ProjectRead>) =>
  ({
    id: 1,
    title: "Portfolio site",
    life_area_id: 1,
    start_date: "2026-10-20",
    due_date: "2026-11-30",
    status: "active",
    archived_at: null,
    created_at: "2026-10-01T09:00:00Z",
    ...overrides,
  }) as ProjectRead;

const filters = (
  show: Partial<CalendarFilters["show"]> = {},
  hiddenAreas: number[] = [],
): CalendarFilters => ({
  ...DEFAULT_FILTERS,
  hiddenAreas,
  show: { ...DEFAULT_FILTERS.show, ...show },
});

const bars = (entries: Entry[]) => splitEntries(entries).bars;

test("events over several days are bars; everything on one day is a mark", () => {
  const trip = event("2026-11-02", "2026-11-05");
  const brunch = event("2026-11-07", "2026-11-07", { start_time: "11:00:00" });
  const holiday = event("2026-11-11", "2026-11-11");
  const task: Entry = {
    kind: "task",
    key: "task:1",
    start: "2026-11-07",
    end: "2026-11-07",
    order: 3e6,
    task: taskRead({ id: 1, title: "Call mum" }),
  };

  const split = splitEntries([trip, brunch, holiday, task]);

  expect(split.bars.map((bar) => bar.key)).toEqual([`bar:${trip.key}`]);
  expect(split.marks).toEqual([brunch, holiday, task]);
});

test("each month is a row: the 1st sits under its weekday, and slots past the end are blank", () => {
  const rows = linearMonths(QUARTER, [], [], "quarter");

  expect(rows.map((row) => row.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
  // Oct 1, 2026 is a Thursday; Nov 1 a Sunday; Dec 1 a Tuesday.
  expect(rows.map((row) => row.offset)).toEqual([3, 6, 1]);
  expect(slotDay(rows[1], 5)).toBeNull();
  expect(slotDay(rows[1], 6)).toBe("2026-11-01");
  expect(slotDay(rows[1], 35)).toBe("2026-11-30");
  expect(slotDay(rows[1], 36)).toBeNull();
});

test("bars share a lane when they don't overlap, and a bar crossing months is cut", () => {
  const trip = event("2026-10-28", "2026-11-03");
  const course = event("2026-11-02", "2026-11-10");
  const later = event("2026-11-20", "2026-11-22");

  const [october, november] = linearMonths(QUARTER, bars([trip, course, later]), [], "quarter");

  expect(october.bars).toMatchObject([{ lane: 0, cutStart: false, cutEnd: true }]);
  expect(october.bars[0].to).toBe(october.offset + 30); // Oct 31
  const lanes = november.bars.map((placed) => [placed.bar.start, placed.lane, placed.cutStart]);
  expect(lanes).toEqual([
    ["2026-10-28", 0, true],
    ["2026-11-02", 1, false],
    ["2026-11-20", 0, false],
  ]);
  expect(november.lanes).toBe(2);
});

test("events come before projects in the lanes", () => {
  const portfolio = projectBars([project({})], filters(), QUARTER, TODAY);
  const course = event("2026-11-02", "2026-11-10");

  const november = linearMonths(QUARTER, [...portfolio, ...bars([course])], [], "quarter")[1];

  expect(november.bars.map((placed) => [placed.bar.kind, placed.lane])).toEqual([
    ["event", 0],
    ["project", 1],
  ]);
});

test("Year keeps three lanes and counts the rest, keeping the shortest projects", () => {
  const long = projectBars(
    [project({ id: 1, start_date: "2026-09-01", due_date: "2026-12-20" })],
    filters(),
    QUARTER,
    TODAY,
  );
  const short = projectBars(
    [project({ id: 2, start_date: "2026-11-03", due_date: "2026-11-12" })],
    filters(),
    QUARTER,
    TODAY,
  );
  const events = bars([event("2026-11-01", "2026-11-04"), event("2026-11-02", "2026-11-06")]);

  const year = viewRange("year", TODAY);
  const november = linearMonths(year, [...events, ...long, ...short], [], "year")[10];

  expect(november.lanes).toBe(3);
  expect(november.bars.map((placed) => placed.bar.key)).toEqual([
    events[0].key,
    events[1].key,
    short[0].key,
  ]);
  expect(november.hidden.map((bar) => bar.key)).toEqual([long[0].key]);
});

test("a day's marks start under its own bars", () => {
  const trip = event("2026-11-02", "2026-11-04");
  const course = event("2026-11-03", "2026-11-05");
  const november = linearMonths(QUARTER, bars([trip, course]), [], "quarter")[1];
  const slot = (day: number) => november.offset + day - 1;

  expect(november.markLane[slot(2)]).toBe(1);
  expect(november.markLane[slot(4)]).toBe(2);
  expect(november.markLane[slot(5)]).toBe(2);
  expect(november.markLane[slot(6)]).toBe(0);
});

test("marks are grouped by day in the day's order", () => {
  const late: Entry = { ...event("2026-11-07", "2026-11-07"), key: "late", order: 5 };
  const early: Entry = { ...event("2026-11-07", "2026-11-07"), key: "early", order: 1 };

  const november = linearMonths(QUARTER, [], [late, early], "quarter")[1];

  expect(november.marks.get("2026-11-07")?.map((entry) => entry.key)).toEqual(["early", "late"]);
});

test("a project bar runs from its start date, or the day it was created, to its due date", () => {
  expect(projectStart(project({}))).toBe("2026-10-20");
  expect(projectStart(project({ start_date: null }))).toBe("2026-10-01");
  // A start after the due date shows as one day.
  expect(projectStart(project({ start_date: "2026-12-05", due_date: "2026-12-01" }))).toBe(
    "2026-12-01",
  );
});

test("project bars follow the filters, and a project with no due date has none", () => {
  const all = [
    project({ id: 1 }),
    project({ id: 2, due_date: null }),
    project({ id: 3, status: "done" }),
    project({ id: 4, status: "cancelled" }),
    project({ id: 5, archived_at: "2026-11-01T00:00:00Z" }),
    project({ id: 6, life_area_id: 2 }),
    project({ id: 7, start_date: "2027-01-05", due_date: "2027-02-01" }),
  ];
  const ids = (found: LinearBar[]) =>
    found.map((bar) => (bar.kind === "project" ? bar.project.id : null));

  expect(ids(projectBars(all, filters(), QUARTER, TODAY))).toEqual([1, 3, 6]);
  const cancelledOnly = filters({ completed: false, cancelled: true }, [2]);
  expect(ids(projectBars(all, cancelledOnly, QUARTER, TODAY))).toEqual([1, 4]);
  expect(projectBars(all, filters({ projects: false }), QUARTER, TODAY)).toEqual([]);
});

test("marks that don't fit end with +n", () => {
  // Quarter: 9 px marks with 3 px gaps; a 21 × 30 box takes 2 across and 2 lines.
  expect(marksThatFit(4, { width: 21, height: 30 }, "quarter")).toEqual({ shown: 4, more: 0 });
  // Five don't fit: "+n" takes a line of its own, leaving one line of two.
  expect(marksThatFit(5, { width: 21, height: 30 }, "quarter")).toEqual({ shown: 2, more: 3 });
  // Year: 6 px marks with 2 px gaps; "+n" takes two marks' room beside them.
  expect(marksThatFit(1, { width: 14, height: 6 }, "year")).toEqual({ shown: 1, more: 0 });
  expect(marksThatFit(9, { width: 30, height: 14 }, "year")).toEqual({ shown: 6, more: 3 });
});
