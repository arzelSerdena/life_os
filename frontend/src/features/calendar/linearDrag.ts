import type { TaskRead } from "../../client/types.gen";
import { shortDate } from "../life-areas/overview/format";
import { addDays, dayDate, daysFrom } from "../pickers/dates";
import { canMove, type Entry } from "./calendar";
import type { LinearBar } from "./linear";

/**
 * Dragging in Quarter and Year (Approved: Calendar, "Drag a project bar" and "Dragging from
 * Inbox"). A bar moves and keeps its length, or one of its ends is dragged to change its
 * start or end; a single-day item is dragged out of the day popover; an Inbox task is dropped
 * on a day. While dragging, the days the item would cover are shaded, the day under the
 * pointer is outlined, and a dark label says the new dates.
 */
export type DragSubject =
  | {
      kind: "bar";
      bar: LinearBar;
      /** "move" keeps its length; "start" and "end" drag that end of it. */
      how: "move" | "start" | "end";
      /** The day under the pointer when the drag began (a move keeps that offset). */
      grab: string;
    }
  | { kind: "entry"; entry: Entry }
  | { kind: "inbox"; task: TaskRead };

export type DaySpan = { start: string; end: string };

/** Whether a bar can be dragged: events that aren't cancelled, active projects. */
export function canDragBar(bar: LinearBar): boolean {
  if (bar.kind === "event") return !bar.entry.event.is_cancelled;
  return bar.project.status === "active" && bar.project.archived_at === null;
}

/** Whether a day popover's item can be dragged: open tasks, events, active projects' due dates. */
export function canDragEntry(entry: Entry): boolean {
  if (entry.kind === "project")
    return entry.project.status === "active" && entry.project.archived_at === null;
  return canMove(entry);
}

/** The days the dragged item would cover with the pointer over `over`. */
export function draggedSpan(subject: DragSubject, over: string): DaySpan {
  if (subject.kind !== "bar") return { start: over, end: over };
  const { bar, how, grab } = subject;
  if (how === "move") {
    const shift = daysFrom(grab, over);
    return { start: addDays(bar.start, shift), end: addDays(bar.end, shift) };
  }
  if (how === "start") return { start: over < bar.end ? over : bar.end, end: bar.end };
  return { start: bar.start, end: over > bar.start ? over : bar.start };
}

/** The dark label beside the pointer: "Nov 16 – Dec 23 · 38 days" for a bar, else "Wed, Nov 25". */
export function dragLabel(subject: DragSubject, span: DaySpan): string {
  if (subject.kind !== "bar") return dayDate(span.start);
  const days = daysFrom(span.start, span.end) + 1;
  const dates =
    span.start === span.end
      ? shortDate(span.start)
      : `${shortDate(span.start)} – ${shortDate(span.end)}`;
  return `${dates} · ${days} ${days === 1 ? "day" : "days"}`;
}

/** Whether the drop changes anything: dropping where it started saves nothing. */
export function changesDates(subject: DragSubject, span: DaySpan): boolean {
  switch (subject.kind) {
    case "bar":
      return span.start !== subject.bar.start || span.end !== subject.bar.end;
    case "entry":
      return span.start !== subject.entry.start;
    case "inbox":
      return true;
  }
}

/**
 * The dates a project is saved with. Dragging its end changes only the due date, so a project
 * with no start date keeps none; a move or its start sets both. A due date dragged before the
 * start takes the start with it.
 */
export function projectDates(
  subject: DragSubject,
  span: DaySpan,
): { start_date?: string; due_date: string } | null {
  if (subject.kind === "bar" && subject.bar.kind === "project")
    return subject.how === "end"
      ? { due_date: span.end }
      : { start_date: span.start, due_date: span.end };
  if (subject.kind === "entry" && subject.entry.kind === "project") {
    const { start_date } = subject.entry.project;
    return start_date && start_date > span.start
      ? { start_date: span.start, due_date: span.start }
      : { due_date: span.start };
  }
  return null;
}

/** Shows a bar at the dates it is being dragged to, so the calendar draws it there. */
export function withPreview(
  bars: readonly LinearBar[],
  subject: DragSubject | null,
  span: DaySpan | null,
): LinearBar[] {
  if (subject?.kind !== "bar" || !span) return [...bars];
  return bars.map((bar) => (bar.key === subject.bar.key ? { ...bar, ...span } : bar));
}
