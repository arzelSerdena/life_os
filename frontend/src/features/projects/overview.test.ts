import { describe, expect, it } from "vitest";
import type {
  LifeAreaRead,
  OverviewProjectRead,
  ProjectsOverviewRead,
  ProjectTotalsRead,
} from "../../client/types.gen";
import {
  boardSubtitle,
  cardDateLine,
  daysLeft,
  nextUpSubtitle,
  projectColumns,
  projectTiles,
  sortProjects,
  timelineSubtitle,
} from "./overview";

const TODAY = "2026-11-14";

const totals = (fields: Partial<ProjectTotalsRead> = {}): ProjectTotalsRead => ({
  done: 0,
  done_with_due: 0,
  done_on_time: 0,
  rollovers: 0,
  finished: 0,
  finished_on_time: 0,
  ...fields,
});

const project = (fields: Partial<OverviewProjectRead>): OverviewProjectRead => ({
  id: 1,
  life_area_id: 1,
  title: "Project",
  status: "active",
  start: "2026-10-01",
  due_date: null,
  completed_on: null,
  done: 0,
  total: 0,
  open: 0,
  overdue: 0,
  pace_status: null,
  ...fields,
});

const overview = (fields: Partial<ProjectsOverviewRead> = {}): ProjectsOverviewRead => ({
  period: "quarter",
  range: { start: "2026-10-01", end: "2026-12-31" },
  previous_range: { start: "2026-07-01", end: "2026-09-30" },
  today: TODAY,
  has_projects: true,
  totals: totals(),
  previous: totals(),
  open: 0,
  open_projects: 0,
  overdue: 0,
  overdue_projects: 0,
  buckets: [],
  projects: [],
  due_next: [],
  stalled: [],
  no_next_step: [],
  ...fields,
});

const area = (id: number, title: string, color: string): LifeAreaRead =>
  ({ id, title, color, archived_at: null }) as LifeAreaRead;

describe("projectTiles", () => {
  it("compares with the previous period", () => {
    const tiles = projectTiles(
      overview({
        totals: totals({
          done: 31,
          done_with_due: 20,
          done_on_time: 15,
          rollovers: 43,
          finished: 1,
          finished_on_time: 1,
        }),
        previous: totals({ done: 25, done_with_due: 10, done_on_time: 8, rollovers: 42 }),
        overdue: 3,
        overdue_projects: 2,
        open: 39,
        open_projects: 6,
      }),
      "quarter",
    );

    expect(tiles.map((tile) => [tile.label, tile.value, tile.unit, tile.line])).toEqual([
      ["Tasks done", "31", "", "+6 vs Q3"],
      ["On time", "75", "%", "−5 pts vs Q3"],
      ["Overdue now", "3", "", "in 2 projects"],
      ["Rollovers", "1.4", "/ task", "−0.3 vs Q3"],
      ["Open tasks", "39", "", "in 6 projects"],
      ["Projects finished", "1", "", "1 on time"],
    ]);
    expect(tiles[1].good).toBe(false);
    expect(tiles[3].good).toBe(true);
  });

  it("shows dashes and the period when there are no tasks yet", () => {
    const tiles = projectTiles(overview(), "quarter");

    expect(tiles.map((tile) => [tile.value, tile.line])).toEqual([
      ["0", "in Q4"],
      ["—", "no tasks due yet"],
      ["0", ""],
      ["—", "no tasks yet"],
      ["0", ""],
      ["0", "in Q4"],
    ]);
  });

  it("draws no line for a series that stays at zero", () => {
    const bucket = (open: number) => ({
      start: "2026-11-02",
      end: "2026-11-08",
      totals: totals(),
      open,
      overdue: 0,
    });
    const tiles = projectTiles(overview({ buckets: [bucket(2), bucket(5)] }), "quarter");

    expect(tiles[2].points).toEqual([]);
    expect(tiles[4].points).toEqual([2, 5]);
    expect(tiles[4].good).toBe(false);
  });
});

describe("subtitles", () => {
  const data = overview({
    projects: [
      project({ id: 1, life_area_id: 1 }),
      project({ id: 2, life_area_id: 2 }),
      project({ id: 3, life_area_id: 1, status: "done", completed_on: "2026-10-30" }),
    ],
    due_next: [1],
    stalled: [{ project_id: 2, days: 20 }],
    no_next_step: [{ project_id: 1, open: 0 }],
  });

  it("counts active projects, their areas and those finished", () => {
    expect(timelineSubtitle(data, "quarter")).toBe(
      "2 active projects in 2 areas · 1 finished in Q4",
    );
    expect(boardSubtitle(data, "quarter")).toBe("2 active · 1 finished in Q4");
  });

  it("sums up Next up, leaving out empty sections", () => {
    expect(nextUpSubtitle(data, "quarter")).toBe("1 due in Q4 · 1 stalled · 1 without tasks");
    expect(nextUpSubtitle(overview(), "quarter")).toBe("");
  });
});

describe("dates", () => {
  it("badges days left, urgent within a week", () => {
    expect(daysLeft("2026-11-20", TODAY)).toEqual({ label: "6d", urgent: true });
    expect(daysLeft("2026-11-30", TODAY)).toEqual({ label: "16d", urgent: false });
    expect(daysLeft(TODAY, TODAY)).toEqual({ label: "Today", urgent: true });
    expect(daysLeft("2026-11-10", TODAY)).toEqual({ label: "4d late", urgent: true });
  });

  it("writes a card's date line", () => {
    expect(cardDateLine(project({ due_date: "2026-11-30" }), TODAY)).toBe("Due Nov 30 · 16d");
    expect(cardDateLine(project({}), TODAY)).toBe("No due date");
    expect(cardDateLine(project({ due_date: "2026-11-10" }), TODAY)).toBe("Overdue · Nov 10");
    expect(cardDateLine(project({ status: "done", completed_on: "2026-10-30" }), TODAY)).toBe(
      "Done Oct 30",
    );
  });
});

describe("projectColumns", () => {
  const areas = [area(1, "Career", "blue"), area(2, "Home", "terracotta")];
  const projects = [
    project({ id: 1, title: "Resume", due_date: "2026-11-30", pace_status: "on_pace" }),
    project({ id: 2, title: "Hackathon", due_date: "2026-11-20", pace_status: "behind" }),
    project({ id: 3, title: "Life OS app" }),
    project({ id: 4, title: "Room", life_area_id: 2, due_date: "2027-01-23" }),
    project({ id: 5, title: "Interview", status: "done", completed_on: "2026-10-30" }),
    project({
      id: 6,
      title: "Fund",
      life_area_id: 2,
      due_date: "2026-12-31",
      pace_status: "ahead",
    }),
  ];
  const data = overview({ projects });
  const titles = (columns: ReturnType<typeof projectColumns>) =>
    columns.map((column) => [column.title, column.projects.map((found) => found.title)]);

  it("groups by area, sorted by due date with finished ones last", () => {
    expect(titles(projectColumns(data, areas, "area", "due", true))).toEqual([
      ["Career", ["Hackathon", "Resume", "Life OS app", "Interview"]],
      ["Home", ["Fund", "Room"]],
    ]);
  });

  it("groups by pace; a due project without tasks counts as on pace", () => {
    expect(titles(projectColumns(data, areas, "pace", "name", true))).toEqual([
      ["Behind pace", ["Hackathon"]],
      ["On pace", ["Resume", "Room"]],
      ["Ahead", ["Fund"]],
      ["No due date", ["Life OS app"]],
      ["Finished", ["Interview"]],
    ]);
  });

  it("groups by due month and can hide finished projects", () => {
    expect(titles(projectColumns(data, areas, "due", "due", false))).toEqual([
      ["This month", ["Hackathon", "Resume"]],
      ["Next month", ["Fund"]],
      ["Later", ["Room"]],
      ["No due date", ["Life OS app"]],
    ]);
  });

  it("sorts by progress, most done first", () => {
    const sorted = sortProjects(
      [
        project({ id: 1, title: "A", done: 1, total: 4 }),
        project({ id: 2, title: "B", done: 3, total: 4 }),
        project({ id: 3, title: "C" }),
      ],
      "progress",
    );
    expect(sorted.map((found) => found.title)).toEqual(["B", "A", "C"]);
  });
});
