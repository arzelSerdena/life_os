import { expect, test } from "vitest";
import type { OccurrenceRead, ProjectRead } from "../../client/types.gen";
import { taskRead } from "../../test-utils";
import type { Entry } from "./calendar";
import type { LinearBar } from "./linear";
import {
  canDragBar,
  canDragEntry,
  changesDates,
  type DragSubject,
  draggedSpan,
  dragLabel,
  projectDates,
  withPreview,
} from "./linearDrag";

const project = (overrides: Partial<ProjectRead> = {}) =>
  ({
    id: 1,
    title: "Room makeover",
    life_area_id: 1,
    start_date: "2026-11-16",
    due_date: "2026-12-20",
    status: "active",
    archived_at: null,
    created_at: "2026-10-01T09:00:00Z",
    ...overrides,
  }) as ProjectRead;

const projectBar = (overrides: Partial<ProjectRead> = {}): LinearBar => {
  const item = project(overrides);
  return {
    kind: "project",
    key: `bar:project:${item.id}`,
    start: item.start_date ?? "2026-10-01",
    end: item.due_date as string,
    past: false,
    project: item,
  };
};

const eventEntry = (start: string, end: string, cancelled = false) =>
  ({
    kind: "event",
    key: `event:7:${start}`,
    start,
    end,
    order: 0,
    event: {
      event_id: 7,
      occurrence_date: start,
      title: "Beach trip",
      start_date: start,
      end_date: end,
      is_cancelled: cancelled,
    } as OccurrenceRead,
  }) as Extract<Entry, { kind: "event" }>;

const eventBar = (start: string, end: string, cancelled = false): LinearBar => ({
  kind: "event",
  key: `bar:event:7:${start}`,
  start,
  end,
  past: false,
  entry: eventEntry(start, end, cancelled),
});

const bar = (how: "move" | "start" | "end", grab: string, item = projectBar()): DragSubject => ({
  kind: "bar",
  bar: item,
  how,
  grab,
});

test("a moved bar keeps its length; its ends change one date and never cross", () => {
  expect(draggedSpan(bar("move", "2026-11-18"), "2026-11-25")).toEqual({
    start: "2026-11-23",
    end: "2026-12-27",
  });
  expect(draggedSpan(bar("end", "2026-12-20"), "2026-12-23")).toEqual({
    start: "2026-11-16",
    end: "2026-12-23",
  });
  expect(draggedSpan(bar("start", "2026-11-16"), "2026-11-02")).toEqual({
    start: "2026-11-02",
    end: "2026-12-20",
  });
  // Dragged past the other end, a bar shrinks to one day.
  expect(draggedSpan(bar("end", "2026-12-20"), "2026-11-01")).toEqual({
    start: "2026-11-16",
    end: "2026-11-16",
  });
  expect(draggedSpan(bar("start", "2026-11-16"), "2027-01-05").start).toBe("2026-12-20");

  const inbox: DragSubject = { kind: "inbox", task: taskRead({ title: "Renew passport" }) };
  expect(draggedSpan(inbox, "2026-11-25")).toEqual({ start: "2026-11-25", end: "2026-11-25" });
});

test("the label says the new dates", () => {
  const span = { start: "2026-11-16", end: "2026-12-23" };
  expect(dragLabel(bar("end", "2026-12-20"), span)).toBe("Nov 16 – Dec 23 · 38 days");
  expect(dragLabel(bar("end", "2026-12-20"), { start: "2026-11-16", end: "2026-11-16" })).toBe(
    "Nov 16 · 1 day",
  );
  const inbox: DragSubject = { kind: "inbox", task: taskRead({}) };
  expect(dragLabel(inbox, { start: "2026-11-25", end: "2026-11-25" })).toBe("Wed, Nov 25");
});

test("what can be dragged", () => {
  expect(canDragBar(projectBar())).toBe(true);
  expect(canDragBar(projectBar({ status: "done" }))).toBe(false);
  expect(canDragBar(projectBar({ archived_at: "2026-11-01T00:00:00Z" }))).toBe(false);
  expect(canDragBar(eventBar("2026-11-26", "2026-11-29"))).toBe(true);
  expect(canDragBar(eventBar("2026-11-26", "2026-11-29", true))).toBe(false);

  const task = (status: "todo" | "done"): Entry => ({
    kind: "task",
    key: "task:1",
    start: "2026-11-20",
    end: "2026-11-20",
    order: 0,
    task: taskRead({ status }),
  });
  expect(canDragEntry(task("todo"))).toBe(true);
  expect(canDragEntry(task("done"))).toBe(true);
  const due = (status: ProjectRead["status"]): Entry => ({
    kind: "project",
    key: "project:1",
    start: "2026-12-20",
    end: "2026-12-20",
    order: 0,
    project: project({ status }),
  });
  expect(canDragEntry(due("active"))).toBe(true);
  expect(canDragEntry(due("cancelled"))).toBe(false);
});

test("dropping where it started changes nothing", () => {
  const subject = bar("move", "2026-11-18");
  expect(changesDates(subject, { start: "2026-11-16", end: "2026-12-20" })).toBe(false);
  expect(changesDates(subject, { start: "2026-11-17", end: "2026-12-21" })).toBe(true);
  const entry: DragSubject = { kind: "entry", entry: eventEntry("2026-11-20", "2026-11-20") };
  expect(changesDates(entry, { start: "2026-11-20", end: "2026-11-20" })).toBe(false);
});

test("a project's end changes only its due date; a move or its start sets both", () => {
  const span = { start: "2026-11-16", end: "2026-12-23" };
  expect(projectDates(bar("end", "2026-12-20"), span)).toEqual({ due_date: "2026-12-23" });
  expect(projectDates(bar("move", "2026-11-18"), span)).toEqual({
    start_date: "2026-11-16",
    due_date: "2026-12-23",
  });
  // No start date yet: dragging the end keeps it that way.
  expect(projectDates(bar("end", "2026-12-20", projectBar({ start_date: null })), span)).toEqual({
    due_date: "2026-12-23",
  });

  const due = (start_date: string | null): DragSubject => ({
    kind: "entry",
    entry: {
      kind: "project",
      key: "project:1",
      start: "2026-12-20",
      end: "2026-12-20",
      order: 0,
      project: project({ start_date }),
    },
  });
  const day = { start: "2026-11-25", end: "2026-11-25" };
  expect(projectDates(due("2026-11-16"), day)).toEqual({ due_date: "2026-11-25" });
  // A due date dragged before the start takes the start with it.
  expect(projectDates(due("2026-11-30"), day)).toEqual({
    start_date: "2026-11-25",
    due_date: "2026-11-25",
  });
  expect(projectDates(bar("move", "2026-11-18", eventBar("2026-11-26", "2026-11-29")), span)).toBe(
    null,
  );
});

test("the dragged bar is drawn at its new dates", () => {
  const trip = eventBar("2026-11-26", "2026-11-29");
  const room = projectBar();
  const subject = bar("end", "2026-12-20", room);
  const shown = withPreview([trip, room], subject, { start: "2026-11-16", end: "2026-12-23" });
  expect(shown.map((item) => [item.start, item.end])).toEqual([
    ["2026-11-26", "2026-11-29"],
    ["2026-11-16", "2026-12-23"],
  ]);
  expect(withPreview([trip, room], null, null)).toEqual([trip, room]);
});
