import { describe, expect, it } from "vitest";
import type { SearchHitRead } from "../../client/types.gen";
import { calendarKeyAction } from "../calendar/calendarKeys";
import { filterCommands, hitMeta, hitTarget, paletteRows } from "./commands";

function hit(overrides: Partial<SearchHitRead>): SearchHitRead {
  return {
    kind: "task",
    id: 1,
    title: "Run",
    status: "todo",
    life_area_id: null,
    life_area_title: null,
    life_area_color: null,
    project_id: null,
    project_title: null,
    ...overrides,
  };
}

const labels = (query: string) => filterCommands(query).map((command) => command.label);

describe("filterCommands", () => {
  it("lists every command for a blank query", () => {
    expect(labels("  ")[0]).toBe("New task");
    expect(labels("").length).toBeGreaterThan(10);
  });

  it("finds by label without “Go to”, by word and by keyword, best first", () => {
    expect(labels("tod")).toEqual(["Go to Today"]);
    expect(labels("INBOX")).toEqual(["Go to Inbox"]);
    expect(labels("backup")).toEqual(["Go to Settings"]);
    expect(labels("task")).toEqual([
      "New task",
      "Go to All tasks",
      "Go to Completed tasks",
      "Go to Cancelled tasks",
    ]);
  });

  it("finds nothing for an unknown word", () => {
    expect(labels("zebra")).toEqual([]);
  });
});

describe("paletteRows", () => {
  it("puts found items first, grouped by kind, then the matching commands", () => {
    const rows = paletteRows("run", [
      hit({ kind: "life_area", id: 1, title: "Running" }),
      hit({ kind: "task", id: 2, title: "Run 5k" }),
    ]);
    expect(rows.map((row) => row.group)).toEqual(["Life areas", "Tasks"]);
  });

  it("leads with a command its first letters match", () => {
    const rows = paletteRows("inb", [hit({ title: "Inbox zero" })]);
    expect(rows.map((row) => row.key)).toEqual(["command-inbox", "task-1"]);
  });

  it("is only commands when the query is blank", () => {
    expect(paletteRows("", []).every((row) => row.kind === "command")).toBe(true);
  });
});

describe("hitMeta", () => {
  it("says where a task lives, the Inbox for none, and Done when done", () => {
    expect(
      hitMeta(
        hit({ life_area_id: 1, life_area_title: "Health", project_id: 3, project_title: "10k" }),
      ),
    ).toBe("Health · 10k");
    expect(hitMeta(hit({ status: "done" }))).toBe("Inbox · Done");
  });

  it("gives a project its area and a finished status, and areas and routines nothing", () => {
    expect(
      hitMeta(hit({ kind: "project", status: "active", life_area_id: 1, life_area_title: "Work" })),
    ).toBe("Work");
    expect(
      hitMeta(
        hit({ kind: "project", status: "cancelled", life_area_id: 1, life_area_title: "Work" }),
      ),
    ).toBe("Work · Cancelled");
    expect(hitMeta(hit({ kind: "life_area", status: null, life_area_title: "Work" }))).toBe("");
    expect(hitMeta(hit({ kind: "routine", status: null }))).toBe("");
  });
});

describe("hitTarget", () => {
  it("opens pages for areas, projects and routines, and the panel for tasks", () => {
    expect(hitTarget(hit({ kind: "life_area", id: 4 }))).toEqual({ kind: "go", to: "/areas/4" });
    expect(hitTarget(hit({ kind: "project", id: 5 }))).toEqual({
      kind: "go",
      to: "/areas/projects/5",
    });
    expect(hitTarget(hit({ kind: "routine", id: 6 }))).toEqual({
      kind: "go",
      to: "/areas/routines/6",
    });
    expect(hitTarget(hit({ kind: "task", id: 7 }))).toEqual({ kind: "panel", id: 7 });
  });
});

describe("calendarKeyAction", () => {
  it("switches views with 1–4", () => {
    expect(calendarKeyAction("1", "year", "2026-11-18")).toEqual({ kind: "view", view: "week" });
    expect(calendarKeyAction("4", "week", "2026-11-18")).toEqual({ kind: "view", view: "year" });
  });

  it("goes to today with T and moves to the first day of the next or previous period", () => {
    expect(calendarKeyAction("t", "week", "2026-11-18")).toEqual({ kind: "anchor", anchor: null });
    expect(calendarKeyAction("ArrowRight", "week", "2026-11-18")).toEqual({
      kind: "anchor",
      anchor: "2026-11-23",
    });
    expect(calendarKeyAction("ArrowLeft", "month", "2026-11-18")).toEqual({
      kind: "anchor",
      anchor: "2026-10-01",
    });
  });

  it("ignores other keys", () => {
    expect(calendarKeyAction("5", "week", "2026-11-18")).toBeNull();
    expect(calendarKeyAction("ArrowUp", "week", "2026-11-18")).toBeNull();
  });
});
