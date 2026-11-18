import type {
  HomeDeadlineRead,
  HomeProjectRead,
  HomeRead,
  LogMetricRead,
  OccurrenceRead,
  PushMetricRead,
} from "../../client/types.gen";
import type { PendingDelete } from "../../stores/pendingDeleteStore";
import { daysBetween, plural, shortDate } from "../life-areas/overview/format";
import { formatValue } from "../metrics/format";
import { addDays, WEEKDAY_NAMES, weekdayIndex } from "../pickers/dates";

/** Home shows "Set up Life OS" until there is a life area and at least one task or routine. */
export function isFirstRun(home: HomeRead): boolean {
  const { setup } = home;
  return setup.life_area === null || (setup.routine === null && setup.task === null);
}

/** Tasks waiting to be deleted (the undo toast's delay) are left out, as in every list. */
export function withoutPending(home: HomeRead, pending: readonly PendingDelete[]): HomeRead {
  const hidden = new Set(pending.filter((item) => item.kind === "task").map((item) => item.id));
  if (hidden.size === 0) return home;
  const keep = (tasks: HomeRead["tasks"]) => tasks.filter((task) => !hidden.has(task.id));
  return {
    ...home,
    overdue: keep(home.overdue),
    tasks: keep(home.tasks),
    completed: keep(home.completed),
  };
}

/** The header's "6 of 14 done": today's tasks (overdue included) plus today's due routine
 * steps; skipped steps are left out of both counts. */
export function doneCount(home: HomeRead): { done: number; total: number } {
  const steps = home.routines.flatMap((routine) => routine.steps);
  const counted = steps.filter((step) => step.status !== "skipped");
  return {
    done: home.completed.length + counted.filter((step) => step.status === "done").length,
    total: home.overdue.length + home.tasks.length + home.completed.length + counted.length,
  };
}

/** A routine block's ring: done of due, skipped steps left out. */
export function routineCount(steps: HomeRead["routines"][number]["steps"]): {
  done: number;
  total: number;
} {
  const counted = steps.filter((step) => step.status !== "skipped");
  return { done: counted.filter((step) => step.status === "done").length, total: counted.length };
}

/** "Sun" for 2026-11-15. */
function weekday(day: string): string {
  return WEEKDAY_NAMES[weekdayIndex(day)].slice(0, 3);
}

/** Whether a timed single-day event is over at `now` ("HH:MM"): its end, or its start. */
function isOverAt(event: OccurrenceRead, day: string, now: string): boolean {
  if (event.end_date < day) return true;
  if (event.end_date > day) return false;
  const last = event.end_time ?? (event.start_date === day ? event.start_time : null);
  return last !== null && last.slice(0, 5) <= now;
}

/** When an event happens, as seen on `day`: "5 – 6 PM", "All day", and "Until 3 PM" on a
 * multi-day event's last day. */
export function eventWhen(
  event: OccurrenceRead,
  day: string,
  time: (value: string) => string,
): string {
  const start = event.start_time ? time(event.start_time) : null;
  const end = event.end_time ? time(event.end_time) : null;
  if (event.start_date === event.end_date) {
    if (!start) return "All day";
    return end ? `${start} – ${end}` : start;
  }
  if (day === event.end_date && end) return `Until ${end}`;
  if (day === event.start_date && start) {
    return `${start} – ${weekday(event.end_date)}${end ? ` ${end}` : ""}`;
  }
  return "All day";
}

export type ScheduleItem =
  | { kind: "event"; key: string; event: OccurrenceRead; when: string; past: boolean }
  | { kind: "project"; key: string; project: HomeProjectRead }
  | { kind: "deadline"; key: string; deadline: HomeDeadlineRead }
  | { kind: "now"; key: string };

/** Today's Schedule: all-day and multi-day events first, then project due dates and target
 * deadlines, then timed events by start time, with the now line between the past and the
 * upcoming ones (only when there are timed events). */
export function scheduleItems(
  home: HomeRead,
  now: string,
  time: (value: string) => string,
): ScheduleItem[] {
  const day = home.today;
  const isTimed = (event: OccurrenceRead) =>
    event.start_date === event.end_date && event.start_time !== null;
  const asItem = (event: OccurrenceRead): ScheduleItem => ({
    kind: "event",
    key: `e${event.event_id}-${event.occurrence_date}`,
    event,
    when: eventWhen(event, day, time),
    past: isOverAt(event, day, now),
  });
  const untimed = home.events.filter((event) => !isTimed(event)).map(asItem);
  const timed = home.events
    .filter(isTimed)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const items: ScheduleItem[] = [
    ...untimed,
    ...home.projects_due.map(
      (project): ScheduleItem => ({ kind: "project", key: `p${project.id}`, project }),
    ),
    ...home.deadlines.map(
      (deadline): ScheduleItem => ({ kind: "deadline", key: `m${deadline.metric_id}`, deadline }),
    ),
  ];
  if (timed.length === 0) return items;
  const upcoming = timed.findIndex((event) => (event.start_time ?? "").slice(0, 5) > now);
  const before = upcoming === -1 ? timed : timed.slice(0, upcoming);
  const after = upcoming === -1 ? [] : timed.slice(upcoming);
  return [...items, ...before.map(asItem), { kind: "now", key: "now" }, ...after.map(asItem)];
}

/** The header's "Next: …": today's next timed event, or, when today holds nothing at all,
 * the first thing coming up. Null otherwise. */
export function nextUp(
  home: HomeRead,
  now: string,
  time: (value: string) => string,
): string | null {
  const today = home.events
    .filter(
      (event) =>
        event.start_date === home.today &&
        event.start_time !== null &&
        event.start_time.slice(0, 5) > now,
    )
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  if (today[0]?.start_time) return `${today[0].title} ${time(today[0].start_time)}`;
  const { total } = doneCount(home);
  const hasToday =
    total > 0 || home.events.length + home.projects_due.length + home.deadlines.length > 0;
  if (hasToday) return null;
  const first = comingUpDays(home, time).find((group) =>
    group.items.some((item) => item.kind !== "event" || item.event.start_date === group.day),
  );
  const item = first?.items.find(
    (entry) => entry.kind !== "event" || entry.event.start_date === first.day,
  );
  if (!first || !item) return null;
  const on = `${weekday(first.day)}, ${shortDate(first.day)}`;
  if (item.kind === "event") {
    const at = item.event.start_time ? ` ${time(item.event.start_time)}` : "";
    return `${on} · ${item.event.title}${at}`;
  }
  return `${on} · ${item.kind === "project" ? item.project.title : item.deadline.title} due`;
}

export type ComingUpItem = Exclude<ScheduleItem, { kind: "now" }>;
export type ComingUpDay = { day: string; title: string; subtitle: string; items: ComingUpItem[] };

/** The next 7 days by day: events (one that began earlier shows on the first day, as
 * "Until 3 PM" on its last), then project due dates and deadlines. Empty days are left out. */
export function comingUpDays(home: HomeRead, time: (value: string) => string): ComingUpDay[] {
  const { range, events, projects, deadlines } = home.coming_up;
  const byDay = new Map<string, ComingUpItem[]>();
  const put = (day: string, item: ComingUpItem) =>
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  const sorted = [...events].sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
      a.title.localeCompare(b.title),
  );
  for (const event of sorted) {
    // An event that began before the range shows on its first day.
    const day = [event.start_date, range.start].sort()[1];
    put(day, {
      kind: "event",
      key: `e${event.event_id}-${event.occurrence_date}`,
      event,
      when: eventWhen(event, day, time),
      past: false,
    });
  }
  for (const project of projects) {
    if (project.due_date)
      put(project.due_date, { kind: "project", key: `p${project.id}`, project });
  }
  for (const deadline of deadlines) {
    put(deadline.day, { kind: "deadline", key: `m${deadline.metric_id}`, deadline });
  }
  return [...byDay.keys()].sort().map((day) => {
    const tomorrow = day === addDays(home.today, 1);
    return {
      day,
      title: tomorrow ? "Tomorrow" : weekday(day),
      subtitle: tomorrow ? `${weekday(day)}, ${shortDate(day)}` : shortDate(day),
      items: byDay.get(day) ?? [],
    };
  });
}

/** Coming up's subtitle: "Nov 15 – 21 · 5 items". */
export function comingUpSubtitle(home: HomeRead, days: ComingUpDay[]): string {
  const { start, end } = home.coming_up.range;
  const endLabel =
    start.slice(0, 7) === end.slice(0, 7) ? end.slice(8).replace(/^0/, "") : shortDate(end);
  const count = days.reduce((sum, day) => sum + day.items.length, 0);
  return `${shortDate(start)} – ${endLabel} · ${plural(count, "item")}`;
}

/** Today's subtitle: "5 tasks · 3 events". */
export function todaySubtitle(home: HomeRead): string {
  const tasks = home.overdue.length + home.tasks.length + home.completed.length;
  const parts = [
    tasks > 0 && plural(tasks, "task"),
    home.events.length > 0 && plural(home.events.length, "event"),
  ];
  return parts.filter(Boolean).join(" · ");
}

/** A target as one line: "8 glasses a day · 4 of 5 days met this week", "6 h of 10 h this week". */
export function logLine(metric: LogMetricRead): string {
  const target = formatValue(metric.target_value, metric);
  if (metric.target_period === "day") {
    const met =
      metric.days_counted > 0
        ? ` · ${metric.days_met} of ${plural(metric.days_counted, "day")} met this week`
        : "";
    return `${target} a day${met}`;
  }
  return `${formatValue(metric.value ?? 0, metric)} of ${target} this week`;
}

/** A metric behind its target: "1 of 5 this month · 16 days left", "₱800 of ₱5,000 by Dec 31". */
export function behindLine(metric: PushMetricRead, today: string): string {
  const value = formatValue(metric.value ?? 0, metric);
  const target = formatValue(metric.target_value, metric);
  if (metric.target_kind === "reach_by") {
    return metric.ends_on
      ? `${value} of ${target} by ${shortDate(metric.ends_on)}`
      : `${value} of ${target}`;
  }
  const left = metric.ends_on ? daysBetween(today, metric.ends_on) : 0;
  const rest =
    left > 0
      ? ` · ${plural(left, "day")} left`
      : left === 0 && metric.ends_on
        ? " · ends today"
        : "";
  return `${value} of ${target} this ${metric.target_period}${rest}`;
}

/** Needs a push shows at most this many rows per section, then "+n more". */
export const PUSH_ROWS = 3;
