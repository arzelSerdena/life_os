import type { ProjectRead } from "../../client/types.gen";
import { earlierDate, laterDate } from "../life-areas/area/timeScale";
import { addDays, daysFrom, weekdayIndex } from "../pickers/dates";
import type { CalendarFilters, DayRange, Entry } from "./calendar";

/**
 * Quarter and Year: the linear calendar (Approved: Calendar Month, Quarter and Year). One row
 * per month: the month's days in a line under 37 repeating weekday slots (M T W T F S S …),
 * blank slots before the 1st and after the last day. Bars across days come first (events over
 * several days, then projects from their start to their due date), packed into lanes; each
 * day's single-day entries are small marks under that day's own bars.
 */

/** Weekday slots in a row: a month can start on a Sunday and run 31 days. */
export const SLOTS = 37;

/** Year keeps 3 lanes of bars; the rest are counted under the month name. */
export const YEAR_LANES = 3;

export type EventEntry = Extract<Entry, { kind: "event" }>;

/** A bar: an event over several days, or a project from its start to its due date. */
export type LinearBar =
  | { kind: "event"; key: string; start: string; end: string; past: boolean; entry: EventEntry }
  | {
      kind: "project";
      key: string;
      start: string;
      end: string;
      past: boolean;
      project: ProjectRead;
    };

/** A bar's part in one month row: slots `from` to `to`, cut where it goes on. */
export type PlacedBar = {
  bar: LinearBar;
  lane: number;
  from: number;
  to: number;
  cutStart: boolean;
  cutEnd: boolean;
};

export type MonthRow = {
  /** "2026-11" */
  month: string;
  /** The slot of the 1st (0 = Monday). */
  offset: number;
  days: number;
  /** Lanes of bars drawn (Year: at most 3). */
  lanes: number;
  bars: PlacedBar[];
  /** Year: the bars past the third lane, shown in the "+n" popover. */
  hidden: LinearBar[];
  /** Per day of the month ("2026-11-18"): its marks, in the day's order. */
  marks: Map<string, Entry[]>;
  /** Per slot: the first lane free under that day's own bars, where its marks start. */
  markLane: number[];
};

/** A project with a due date is a bar from its start date, or the day it was created. */
export function projectStart(project: ProjectRead): string {
  const start = project.start_date ?? project.created_at.slice(0, 10);
  return project.due_date && start > project.due_date ? project.due_date : start;
}

/**
 * The project bars the filters let through: active projects, and done or cancelled ones when
 * Completed or Cancelled is on. A project with no due date has no bar.
 */
export function projectBars(
  projects: readonly ProjectRead[],
  filters: CalendarFilters,
  range: DayRange,
  today: string,
): LinearBar[] {
  const { show } = filters;
  if (!show.projects) return [];
  return projects
    .filter(
      (project) =>
        project.archived_at === null &&
        project.due_date !== null &&
        !filters.hiddenAreas.includes(project.life_area_id) &&
        (project.status === "active" ||
          (project.status === "done" && show.completed) ||
          (project.status === "cancelled" && show.cancelled)),
    )
    .map((project): LinearBar => {
      const end = project.due_date as string;
      return {
        kind: "project",
        key: `bar:project:${project.id}`,
        start: projectStart(project),
        end,
        past: end < today,
        project,
      };
    })
    .filter((bar) => bar.start <= range.end && bar.end >= range.start);
}

/** Events over several days are bars; everything else on a single day is a mark. */
export function splitEntries(entries: readonly Entry[]): { bars: LinearBar[]; marks: Entry[] } {
  const bars: LinearBar[] = [];
  const marks: Entry[] = [];
  for (const entry of entries) {
    if (entry.kind === "routine") continue;
    if (entry.kind === "event" && entry.start !== entry.end)
      bars.push({
        kind: "event",
        key: `bar:${entry.key}`,
        start: entry.start,
        end: entry.end,
        past: entry.event.is_past,
        entry,
      });
    else marks.push(entry);
  }
  return { bars, marks };
}

/**
 * Lays out the shown months. Bars take the first lane where they fit: events first (by
 * start, longer first), then projects (Quarter: by start, longer first; Year: shortest
 * first, so long projects are the ones counted in "+n").
 */
export function linearMonths(
  range: DayRange,
  bars: readonly LinearBar[],
  marks: readonly Entry[],
  view: "quarter" | "year",
): MonthRow[] {
  const rows: MonthRow[] = [];
  for (let first = range.start; first <= range.end; first = nextMonthStart(first)) {
    const last = addDays(nextMonthStart(first), -1);
    const offset = weekdayIndex(first);
    const slot = (day: string) => offset + daysFrom(first, day);
    const inMonth = bars.filter((bar) => bar.start <= last && bar.end >= first);
    const length = (bar: LinearBar) => daysFrom(bar.start, bar.end);
    const from = (bar: LinearBar) => slot(laterDate(bar.start, first));
    const to = (bar: LinearBar) => slot(earlierDate(bar.end, last));
    const events = inMonth
      .filter((bar) => bar.kind === "event")
      .sort((a, b) => from(a) - from(b) || to(b) - from(b) - (to(a) - from(a)));
    const projects = inMonth
      .filter((bar) => bar.kind === "project")
      .sort((a, b) =>
        view === "quarter"
          ? from(a) - from(b) || to(b) - from(b) - (to(a) - from(a))
          : length(a) - length(b) || from(a) - from(b),
      );

    const laneEnds: number[] = [];
    const placed: PlacedBar[] = [];
    const hidden: LinearBar[] = [];
    for (const bar of [...events, ...projects]) {
      const start = from(bar);
      let lane = laneEnds.findIndex((end) => start > end);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = to(bar);
      if (view === "year" && lane >= YEAR_LANES) {
        hidden.push(bar);
        continue;
      }
      placed.push({
        bar,
        lane,
        from: start,
        to: to(bar),
        cutStart: bar.start < first,
        cutEnd: bar.end > last,
      });
    }

    const markLane = Array.from({ length: SLOTS }, () => 0);
    for (const { lane, from: start, to: end } of placed)
      for (let index = start; index <= end; index++)
        markLane[index] = Math.max(markLane[index], lane + 1);

    const dayMarks = new Map<string, Entry[]>();
    for (const entry of marks) {
      if (entry.start < first || entry.start > last) continue;
      dayMarks.set(entry.start, [...(dayMarks.get(entry.start) ?? []), entry]);
    }
    for (const list of dayMarks.values()) list.sort((a, b) => a.order - b.order);

    rows.push({
      month: first.slice(0, 7),
      offset,
      days: daysFrom(first, last) + 1,
      lanes: view === "year" ? Math.min(laneEnds.length, YEAR_LANES) : laneEnds.length,
      bars: placed,
      hidden,
      marks: dayMarks,
      markLane,
    });
  }
  return rows;
}

function nextMonthStart(day: string): string {
  const [year, month] = day.split("-").map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** The day in a month row's slot, or null for the blank slots before the 1st and after the end. */
export function slotDay(row: MonthRow, slot: number): string | null {
  const day = slot - row.offset + 1;
  if (day < 1 || day > row.days) return null;
  return `${row.month}-${String(day).padStart(2, "0")}`;
}

/**
 * How many marks fit a day's box (its content box, padding excluded), and how many are left
 * for "+n". Quarter puts "+n" on a line of its own; Year puts it beside the marks, where it
 * takes two marks' room.
 */
export function marksThatFit(
  count: number,
  box: { width: number; height: number },
  view: "quarter" | "year",
): { shown: number; more: number } {
  const size = view === "quarter" ? 9 : 6;
  const gap = view === "quarter" ? 3 : 2;
  const howMany = (length: number) => Math.max(0, Math.floor((length + gap) / (size + gap)));
  const across = Math.max(1, howMany(box.width));
  if (count <= across * howMany(box.height)) return { shown: count, more: 0 };
  const room =
    view === "quarter" ? across * howMany(box.height - 12) : across * howMany(box.height) - 2;
  const shown = Math.max(0, Math.min(count, room));
  return { shown, more: count - shown };
}
