import type { TaskRead } from "../../client/types.gen";
import type { Priority } from "./board";

/**
 * The Inbox screen, as pure functions. The Inbox is open tasks with no life area
 * (STYLE_GUIDE.md, "Inbox and priority", Nov 16); the right container files them by area,
 * project, scheduled date or priority.
 */

/** Open tasks with no life area, oldest first, so the list is worked through in order. */
export function inboxList(tasks: readonly TaskRead[]): TaskRead[] {
  return tasks
    .filter((task) => task.status === "todo" && task.life_area_id === null)
    .sort((a, b) => a.id - b.id);
}

/** What a drop target, a menu item or a key files a task into. */
export type FileTarget =
  | { kind: "area"; id: number }
  | { kind: "project"; id: number }
  | { kind: "date"; date: string }
  | { kind: "priority"; priority: Priority };

/** A drop target's id for dnd-kit, unique across the three panels. */
export function targetId(target: FileTarget): string {
  switch (target.kind) {
    case "area":
    case "project":
      return `${target.kind}:${target.id}`;
    case "date":
      return `date:${target.date}`;
    case "priority":
      return `priority:${target.priority}`;
  }
}

/** Open-task counts for the drop panels: per area, per project, per scheduled date, per priority. */
export function fileCounts(tasks: readonly TaskRead[]) {
  const areas = new Map<number, number>();
  const projects = new Map<number, number>();
  const dates = new Map<string, number>();
  const priorities = new Map<Priority, number>();
  const add = <K>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const task of tasks) {
    if (task.status !== "todo") continue;
    if (task.life_area_id !== null) add(areas, task.life_area_id);
    if (task.project_id !== null) add(projects, task.project_id);
    if (task.scheduled_date !== null) add(dates, task.scheduled_date);
    add(priorities, task.priority);
  }
  return { areas, projects, dates, priorities };
}

/** A local calendar date ("YYYY-MM-DD") `days` after `day`. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The Monday after `day` (weeks start on Monday), for the Date picker's Next week. */
export function nextMonday(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, (8 - weekday) % 7 || 7);
}

/** "2026-11" → the month's grid: whole Monday-to-Sunday weeks, as dates. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  let day = addDays(first, -weekday);
  const weeks: string[][] = [];
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  } while (day.slice(0, 7) === month);
  return weeks;
}

/** "2026-11" moved by `months`. */
export function addMonths(month: string, months: number): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + months, 1));
  return date.toISOString().slice(0, 7);
}

/** "2026-11" → "November 2026". */
export function monthTitle(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
