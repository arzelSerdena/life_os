import { describe, expect, it } from "vitest";
import type {
  ArchivedAreaRead,
  ArchivedRoutineRead,
  FinishedProjectRead,
  LifeAreaRead,
} from "../../client/types.gen";
import {
  archiveDate,
  areaMeta,
  filterAreas,
  groupProjects,
  projectMeta,
  restoreBlocker,
  restoredAreaMessage,
  routineDeleteBlocker,
  routineMeta,
  tabOf,
} from "./archive";

const YEAR = 2026;

function area(fields: Partial<ArchivedAreaRead> = {}): ArchivedAreaRead {
  return {
    id: 1,
    title: "Language learning",
    color: "ochre",
    archived_at: "2026-10-02T09:00:00Z",
    archived_on: "2026-10-02",
    projects: 1,
    tasks: 41,
    metrics: 2,
    has_items: true,
    ...fields,
  };
}

function project(fields: Partial<FinishedProjectRead> = {}): FinishedProjectRead {
  return {
    id: 1,
    life_area_id: 1,
    title: "Couch to 5K",
    status: "done",
    archived_at: null,
    on: "2026-11-03",
    done: 18,
    total: 20,
    has_items: true,
    ...fields,
  };
}

function lifeArea(id: number, title: string, fields: Partial<LifeAreaRead> = {}): LifeAreaRead {
  return {
    id,
    title,
    vision: null,
    notes: null,
    color: "blue",
    sort_order: id,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...fields,
  };
}

function routine(fields: Partial<ArchivedRoutineRead> = {}): ArchivedRoutineRead {
  return {
    id: 1,
    title: "Study sprint",
    archived_at: "2026-11-01T09:00:00Z",
    archived_on: "2026-11-01",
    rrule: "FREQ=DAILY",
    schedule_starts_on: "2026-07-06",
    steps: 5,
    best_run: 21,
    feeds: [],
    ...fields,
  };
}

describe("tabOf", () => {
  it("reads the tab from the address, Areas by default", () => {
    expect(tabOf("projects")).toBe("projects");
    expect(tabOf("routines")).toBe("routines");
    expect(tabOf(null)).toBe("areas");
    expect(tabOf("tasks")).toBe("areas");
  });
});

describe("archiveDate", () => {
  it("adds the year only when it isn't this one", () => {
    expect(archiveDate("2026-10-02", YEAR)).toBe("Oct 2");
    expect(archiveDate("2025-10-02", YEAR)).toBe("Oct 2, 2025");
  });
});

describe("areas", () => {
  it("lists what Restore brings back, or Empty", () => {
    expect(areaMeta(area(), YEAR)).toBe("Archived Oct 2 · 1 project · 41 tasks · 2 metrics");
    expect(areaMeta(area({ projects: 0, metrics: 0, tasks: 1 }), YEAR)).toBe(
      "Archived Oct 2 · 1 task",
    );
    expect(areaMeta(area({ projects: 0, tasks: 0, metrics: 0, has_items: false }), YEAR)).toBe(
      "Archived Oct 2 · Empty",
    );
  });

  it("says what came back in the toast", () => {
    expect(restoredAreaMessage(area())).toBe(
      "Restored “Language learning” · 1 project, 41 tasks back",
    );
    expect(restoredAreaMessage(area({ projects: 0, tasks: 0 }))).toBe(
      "Restored “Language learning”",
    );
  });
});

describe("projects", () => {
  it("shows the area, the day of its status and its tasks", () => {
    expect(projectMeta(project(), "Health & Beauty", YEAR)).toBe(
      "Health & Beauty · Nov 3 · 18/20 tasks",
    );
    expect(projectMeta(project({ done: 0, total: 0 }), "Home", YEAR)).toBe(
      "Home · Nov 3 · No tasks",
    );
  });

  it("groups by Done, Cancelled and Archived, leaving out empty groups and hidden areas", () => {
    const projects = [
      project({ id: 1, status: "active", archived_at: "2026-11-10T00:00:00Z" }),
      project({ id: 2, status: "done", archived_at: "2026-11-09T00:00:00Z" }),
      project({ id: 3, status: "done" }),
      project({ id: 4, status: "done", life_area_id: 2 }),
    ];

    const groups = groupProjects(projects, [2]);

    expect(groups.map((group) => [group.key, group.projects.map((p) => p.id)])).toEqual([
      ["done", [3]],
      ["archived", [1, 2]],
    ]);
  });

  it("lists filter areas with a project here, in the sidebar's order", () => {
    const areas = [
      lifeArea(1, "Career", { sort_order: 2 }),
      lifeArea(2, "Home", { sort_order: 1 }),
      lifeArea(3, "Health", { sort_order: 0 }),
    ];
    const projects = [project({ life_area_id: 1 }), project({ id: 2, life_area_id: 2 })];

    expect(filterAreas(projects, areas).map((row) => [row.area.title, row.count])).toEqual([
      ["Home", 1],
      ["Career", 1],
    ]);
  });

  it("can't be restored while its area is archived", () => {
    const areas = [lifeArea(1, "Freelance", { archived_at: "2026-08-14T00:00:00Z" })];
    expect(restoreBlocker(project(), areas)).toBe("Freelance");
    expect(restoreBlocker(project(), [lifeArea(1, "Career")])).toBeNull();
  });
});

describe("routines", () => {
  it("shows the schedule, steps, archive day and best run", () => {
    expect(routineMeta(routine(), YEAR)).toBe(
      "Every day · 5 steps · Archived Nov 1 · best run 21 days",
    );
    expect(
      routineMeta(routine({ rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR", steps: 1, best_run: 0 }), YEAR),
    ).toBe("Every Mon, Wed, Fri · 1 step · Archived Nov 1");
  });

  it("can't be deleted while a step feeds a metric", () => {
    expect(routineDeleteBlocker(routine())).toBeNull();
    expect(routineDeleteBlocker(routine({ feeds: ["Weekly runs"] }))).toBe(
      "A step feeds Weekly runs.",
    );
    expect(routineDeleteBlocker(routine({ feeds: ["Runs", "Miles", "Days"] }))).toBe(
      "Steps feed Runs, Miles and Days.",
    );
  });
});
