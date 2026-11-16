import type {
  DayRead,
  OccurrenceRead,
  ProjectRead,
  RoutineStepDay,
  TaskRead,
} from "../../client/types.gen";
import { shortDate } from "../life-areas/overview/format";
import { addDays, daysFrom, monthTitle, WEEKDAY_NAMES, weekdayIndex } from "../pickers/dates";
import type { Priority } from "../tasks/board";
import { type RoutineDay, routineDays } from "../tasks/next7";

/**
 * The Calendar's Week and Month, as pure functions (Approved: Calendar). Both are day grids
 * with no time axis: events over several days, and all-day events, are bars across the top;
 * each day then lists its timed events, routines, project due dates and tasks. The agenda
 * lists exactly what the grid shows.
 */

export type CalendarView = "week" | "month";

export type ShowKey =
  | "events"
  | "tasks"
  | "routines"
  | "projects"
  | "completed"
  | "cancelled"
  | "weekends";

/** The sidebar's choices. Areas and priorities are stored as what is hidden, so new ones show. */
export type CalendarFilters = {
  /** Life area ids that are hidden; "none" hides items with no area (the Inbox). */
  hiddenAreas: (number | "none")[];
  hiddenPriorities: Priority[];
  show: Record<ShowKey, boolean>;
};

export const DEFAULT_FILTERS: CalendarFilters = {
  hiddenAreas: [],
  hiddenPriorities: [],
  show: {
    events: true,
    tasks: true,
    routines: true,
    projects: true,
    completed: true,
    cancelled: false,
    weekends: true,
  },
};

/** Whether any filter hides something (Clear filters then has work to do). */
export function isFiltered(filters: CalendarFilters): boolean {
  const { show } = filters;
  return (
    filters.hiddenAreas.length > 0 ||
    filters.hiddenPriorities.length > 0 ||
    !show.events ||
    !show.tasks ||
    !show.routines ||
    !show.projects ||
    !show.completed
  );
}

// ---------------------------------------------------------------- the shown range

export type DayRange = { start: string; end: string; count: number };

/** Week: Monday to Sunday around `anchor`. Month: the whole weeks that hold its days. */
export function viewRange(view: CalendarView, anchor: string): DayRange {
  if (view === "week") {
    const start = addDays(anchor, -weekdayIndex(anchor));
    return { start, end: addDays(start, 6), count: 7 };
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const last = addDays(`${nextMonth(anchor)}-01`, -1);
  const start = addDays(first, -weekdayIndex(first));
  const end = addDays(last, 6 - weekdayIndex(last));
  return { start, end, count: daysFrom(start, end) + 1 };
}

function nextMonth(day: string): string {
  const [year, month] = day.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** The next or previous week or month: the anchor moves to its first day. */
export function stepAnchor(view: CalendarView, anchor: string, steps: number): string {
  if (view === "week") return addDays(viewRange("week", anchor).start, 7 * steps);
  const [year, month] = anchor.split("-").map(Number);
  const index = year * 12 + (month - 1) + steps;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

/** Whether today is inside the shown week, or the shown month itself. */
export function showsToday(view: CalendarView, anchor: string, today: string): boolean {
  if (view === "month") return anchor.slice(0, 7) === today.slice(0, 7);
  const { start, end } = viewRange("week", anchor);
  return start <= today && today <= end;
}

/**
 * The header: "Nov 9 – 15", "Nov 30 – Dec 6", "Jan 4 – 10, 2027" (another year),
 * "Dec 28, 2026 – Jan 3, 2027"; a month is "November 2026".
 */
export function rangeLabel(view: CalendarView, anchor: string, today: string): string {
  if (view === "month") return monthTitle(anchor.slice(0, 7));
  const { start, end } = viewRange("week", anchor);
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  if (startYear !== endYear)
    return `${shortDate(start)}, ${startYear} – ${shortDate(end)}, ${endYear}`;
  const endText =
    start.slice(0, 7) === end.slice(0, 7) ? String(Number(end.slice(8))) : shortDate(end);
  const year = startYear === today.slice(0, 4) ? "" : `, ${startYear}`;
  return `${shortDate(start)} – ${endText}${year}`;
}

// ---------------------------------------------------------------- entries

/** One thing on the grid. Bars (events over several days, or all day) span their days. */
export type Entry =
  | { kind: "event"; key: string; start: string; end: string; order: number; event: OccurrenceRead }
  | { kind: "routine"; key: string; start: string; end: string; order: number; routine: RoutineDay }
  | {
      kind: "project";
      key: string;
      start: string;
      end: string;
      order: number;
      project: ProjectRead;
    }
  | { kind: "task"; key: string; start: string; end: string; order: number; task: TaskRead };

export type EntryKind = Entry["kind"];

/** A bar across the top of the day(s): an event over several days, or all day. */
export function isBar(entry: Entry): boolean {
  return (
    entry.kind === "event" &&
    (entry.event.start_date !== entry.event.end_date || entry.event.start_time === null)
  );
}

/** "Fri 6 PM – Sun 3 PM", "All day · until Nov 15", "11 AM – 12:30 PM", "All day". */
export function eventSpan(event: OccurrenceRead, time: (value: string) => string): string {
  const start = event.start_time ? time(event.start_time) : null;
  const end = event.end_time ? time(event.end_time) : null;
  if (event.start_date === event.end_date) {
    if (!start) return "All day";
    return end ? `${start} – ${end}` : start;
  }
  if (start) {
    const day = (date: string) => WEEKDAY_NAMES[weekdayIndex(date)].slice(0, 3);
    return `${day(event.start_date)} ${start} – ${day(event.end_date)} ${end ?? ""}`.trim();
  }
  return `All day · until ${shortDate(event.end_date)}`;
}

function areaShown(filters: CalendarFilters, lifeAreaId: number | null): boolean {
  return !filters.hiddenAreas.includes(lifeAreaId ?? "none");
}

/** Whether the filters let a task through (its kind, status, area and priority). */
export function taskShown(filters: CalendarFilters, task: TaskRead): boolean {
  const { show } = filters;
  if (!show.tasks) return false;
  if (task.status === "done" && !show.completed) return false;
  if (task.status === "cancelled" && !show.cancelled) return false;
  return areaShown(filters, task.life_area_id) && !filters.hiddenPriorities.includes(task.priority);
}

// Within a day: timed events by start time, then routines, project due dates, open tasks in
// the day's order, then done and cancelled tasks.
const RANK = { event: 0, routine: 1, project: 2, open: 3, done: 4, cancelled: 5 };

function minutes(time: string | null): number {
  if (!time) return 0;
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/**
 * What the grid shows for the loaded days, after the sidebar's filters. Routines are one
 * entry per routine and day (Week); Month shows them as a ring beside the date instead.
 */
export function buildEntries(
  days: readonly DayRead[],
  projects: readonly ProjectRead[],
  filters: CalendarFilters,
): Entry[] {
  const { show } = filters;
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const weekend = (day: string) => !show.weekends && weekdayIndex(day) >= 5;

  for (const day of days) {
    if (show.events) {
      // A multi-day event comes with every day it covers; it is one bar.
      for (const event of day.events) {
        const key = `event:${event.event_id}:${event.occurrence_date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (event.is_cancelled && !show.cancelled) continue;
        if (!areaShown(filters, event.life_area_id)) continue;
        const bar = event.start_date !== event.end_date || event.start_time === null;
        if (!bar && weekend(event.start_date)) continue;
        entries.push({
          kind: "event",
          key,
          start: event.start_date,
          end: event.end_date,
          order: RANK.event * 1e6 + minutes(event.start_time),
          event,
        });
      }
    }
    if (weekend(day.day)) continue;
    if (show.routines) {
      const steps = day.routine_steps.filter((step) => areaShown(filters, step.life_area_id));
      routineDays(steps, day.day).forEach((routine, index) => {
        entries.push({
          kind: "routine",
          key: `routine:${routine.routineId}:${day.day}`,
          start: day.day,
          end: day.day,
          order: RANK.routine * 1e6 + index,
          routine,
        });
      });
    }
    if (show.projects) {
      for (const project of projects) {
        if (project.due_date !== day.day || !areaShown(filters, project.life_area_id)) continue;
        entries.push({
          kind: "project",
          key: `project:${project.id}`,
          start: day.day,
          end: day.day,
          order: RANK.project * 1e6 + project.id,
          project,
        });
      }
    }
    for (const task of day.tasks) {
      if (!taskShown(filters, task)) continue;
      const rank =
        task.status === "todo" ? RANK.open : RANK[task.status === "done" ? "done" : "cancelled"];
      entries.push({
        kind: "task",
        key: `task:${task.id}`,
        start: day.day,
        end: day.day,
        order: rank * 1e6 + (task.status === "todo" ? task.sort_order : 0),
        task,
      });
    }
  }
  return entries;
}

/** Month shows a day's routines as one ring beside the date: every step due that day. */
export function routineTotals(days: readonly DayRead[], filters: CalendarFilters) {
  const totals = new Map<string, { done: number; total: number; routines: RoutineDay[] }>();
  if (!filters.show.routines) return totals;
  for (const day of days) {
    const steps: RoutineStepDay[] = day.routine_steps.filter((step) =>
      areaShown(filters, step.life_area_id),
    );
    if (steps.length === 0) continue;
    totals.set(day.day, {
      done: steps.filter((step) => step.status === "done").length,
      total: steps.length,
      routines: routineDays(steps, day.day),
    });
  }
  return totals;
}

// ---------------------------------------------------------------- the agenda

export type AgendaDay = { day: string; entries: Entry[] };

/**
 * The agenda: each day of the range that has something, with the same entries as the grid.
 * A bar is listed on its first day, or on the range's first day if it started before.
 */
export function agendaDays(entries: readonly Entry[], range: DayRange): AgendaDay[] {
  const byDay = new Map<string, Entry[]>();
  for (const entry of entries) {
    // Dates as text compare in calendar order.
    let day = entry.start;
    if (day < range.start) day = range.start;
    if (day > range.end) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }
  return [...byDay.keys()].sort().map((day) => ({
    day,
    entries: (byDay.get(day) ?? []).sort(
      (a, b) => Number(isBar(b)) - Number(isBar(a)) || a.order - b.order,
    ),
  }));
}

/** A day heading: "Today" / "Sat, Nov 14", "Tomorrow" / "Sun, Nov 15", "Mon" / "Nov 16". */
export function agendaTitle(day: string, today: string): { label: string; date: string } {
  const weekday = WEEKDAY_NAMES[weekdayIndex(day)].slice(0, 3);
  if (day === today) return { label: "Today", date: `${weekday}, ${shortDate(day)}` };
  if (day === addDays(today, 1))
    return { label: "Tomorrow", date: `${weekday}, ${shortDate(day)}` };
  return { label: weekday, date: shortDate(day) };
}

// ---------------------------------------------------------------- the Inbox panel

export type InboxMode = "scheduled" | "due";

/**
 * The right panel's Inbox: open tasks with no scheduled date (Scheduled) or no due date
 * (Due), oldest first. Dropping one on a day sets that date.
 */
export function inboxPanelTasks(tasks: readonly TaskRead[], mode: InboxMode): TaskRead[] {
  return tasks
    .filter(
      (task) =>
        task.status === "todo" &&
        task.archived_at === null &&
        (mode === "scheduled" ? task.scheduled_date === null : task.due_date === null),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
}

// ---------------------------------------------------------------- moving things

/** The day after `day`: FullCalendar's ends are exclusive, ours are the last day. */
export function exclusiveEnd(day: string): string {
  return addDays(day, 1);
}

/** A one-off event moved by whole days, keeping its length. */
export function shiftEvent(
  event: OccurrenceRead,
  start: string,
): { start_date: string; end_date: string | null } {
  const length = daysFrom(event.start_date, event.end_date);
  return { start_date: start, end_date: length > 0 ? addDays(start, length) : null };
}

/** "Nov 26 – 29", "Nov 30 – Dec 2", or one day "Nov 26": a bar's dates in the toast. */
export function spanLabel(start: string, end: string): string {
  if (start === end) return shortDate(start);
  const endText =
    start.slice(0, 7) === end.slice(0, 7) ? String(Number(end.slice(8))) : shortDate(end);
  return `${shortDate(start)} – ${endText}`;
}

/** Whether an entry can be dragged: open tasks, and one-off events (not repeating ones). */
export function canMove(entry: Entry): boolean {
  if (entry.kind === "task") return entry.task.status === "todo";
  if (entry.kind === "event") return !entry.event.is_repeating && !entry.event.is_cancelled;
  return false;
}

/**
 * The loaded days after a drag or resize, for the cache until the server answers: a task
 * takes the new day as its scheduled date; an event its new dates, on every day it covers.
 */
export function applyMove(
  days: readonly DayRead[],
  entry: Entry,
  start: string,
  end: string,
): DayRead[] {
  if (entry.kind === "task") {
    const moved = { ...entry.task, scheduled_date: start };
    return days.map((day) => {
      const tasks = day.tasks.filter((task) => task.id !== moved.id);
      return { ...day, tasks: day.day === start ? [...tasks, moved] : tasks };
    });
  }
  if (entry.kind === "event") {
    const { event_id, occurrence_date } = entry.event;
    const moved = { ...entry.event, start_date: start, end_date: end };
    return days.map((day) => {
      const events = day.events.filter(
        (event) => !(event.event_id === event_id && event.occurrence_date === occurrence_date),
      );
      return { ...day, events: start <= day.day && day.day <= end ? [...events, moved] : events };
    });
  }
  return [...days];
}
