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

// The date helpers moved to the shared pickers; these names stay for the Inbox.
export { addDays, addMonths, monthGrid, monthTitle, nextMonday } from "../pickers/dates";
