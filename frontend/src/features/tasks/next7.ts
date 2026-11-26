import type {
  DayRead,
  OccurrenceRead,
  ProjectRead,
  RoutineStepDay,
  TaskRead,
} from "../../client/types.gen";
import { shortDate } from "../life-areas/overview/format";
import { isOverdue, placementDate } from "./board";
import { areaShown, type Filters, resolveFilters, sortTasks, taskShown } from "./filters";
import { addDays } from "./inbox";

/**
 * Tasks › Next 7 days, as pure functions: No date plus today and the six days after it
 * (Approved: Tasks, "Next 7 days and Routines"). Each day lists its routines first, then
 * events, project due dates and tasks; Today starts with the red Overdue subgroup.
 */

export const NO_DATE = "no-date";

export type RoutineDay = {
  routineId: number;
  title: string;
  day: string;
  startTime: string | null;
  endTime: string | null;
  steps: RoutineStepDay[];
  done: number;
};

export type DayColumn = {
  /** NO_DATE, or the day itself. */
  key: string;
  day: string | null;
  title: string;
  subtitle: string;
  /** Open tasks, overdue ones included. */
  count: number;
  /** Today only: open tasks whose due date is past. */
  overdue: TaskRead[];
  routines: RoutineDay[];
  events: OccurrenceRead[];
  projects: ProjectRead[];
  /** Open tasks in the chosen order (Manual: the day's order); these can be dragged. */
  open: TaskRead[];
  /** Done tasks in the order they were done, then cancelled ones; listed last. */
  done: TaskRead[];
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekday(day: string): string {
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
}

/** Titles: No date / Schedule, Today / Sat, Nov 14, Tomorrow / Sun, Nov 15, Monday / Nov 16. */
export function dayTitles(day: string, today: string): { title: string; subtitle: string } {
  const near = `${weekday(day).slice(0, 3)}, ${shortDate(day)}`;
  if (day === today) return { title: "Today", subtitle: near };
  if (day === addDays(today, 1)) return { title: "Tomorrow", subtitle: near };
  return { title: weekday(day), subtitle: shortDate(day) };
}

/** Manual order: the day's order, then creation. */
function byOrder(a: TaskRead, b: TaskRead): number {
  return a.sort_order - b.sort_order || a.id - b.id;
}

/** Overdue tasks are listed in Today only, whatever day they are placed on. */
function onColumn(task: TaskRead, day: string | null, today: string): boolean {
  if (isOverdue(task, today)) return false;
  if (day === null) return task.status === "todo" && placementDate(task) === null;
  return placementDate(task) === day;
}

/** All-day events first, then by start time, then by title. */
function byTime(a: OccurrenceRead, b: OccurrenceRead): number {
  return (
    (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
    a.title.localeCompare(b.title) ||
    a.event_id - b.event_id
  );
}

/** A day's routine steps, one card per routine, in the order the API lists them. */
export function routineDays(steps: readonly RoutineStepDay[], day: string): RoutineDay[] {
  const routines = new Map<number, RoutineDay>();
  for (const step of steps) {
    let routine = routines.get(step.routine_id);
    if (!routine) {
      routine = {
        routineId: step.routine_id,
        title: step.routine_title,
        day,
        startTime: step.routine_start_time ?? null,
        endTime: step.routine_end_time ?? null,
        steps: [],
        done: 0,
      };
      routines.set(step.routine_id, routine);
    }
    routine.steps.push(step);
    if (step.status === "done") routine.done += 1;
  }
  return [...routines.values()];
}

/**
 * No date plus one column per day, after the filter-and-sort menu's choices: Priority and
 * Life areas filter the tasks (Life areas also the routine steps, events and project due
 * dates), SHOW turns each kind on or off, and the sort orders the open tasks.
 */
export function buildDayColumns(
  tasks: readonly TaskRead[],
  days: readonly DayRead[],
  projects: readonly ProjectRead[],
  today: string,
  filters: Filters = resolveFilters("next7", "days", undefined),
): DayColumn[] {
  const { show } = filters;
  const shown = tasks.filter((task) => taskShown(filters, task));
  const column = (day: string | null, titles: { title: string; subtitle: string }) => {
    const listed = shown.filter((task) => onColumn(task, day, today));
    const overdue =
      day === today
        ? sortTasks(shown.filter((task) => isOverdue(task, today)).sort(byOrder), filters.sort)
        : [];
    const open = sortTasks(
      listed.filter((task) => task.status === "todo").sort(byOrder),
      filters.sort,
    );
    const found = days.find((item) => item.day === day);
    const steps =
      found && show.routines
        ? found.routine_steps.filter((step) => areaShown(filters, step.life_area_id))
        : [];
    const byTimeDone = (a: TaskRead, b: TaskRead) =>
      (a.completed_at ?? "").localeCompare(b.completed_at ?? "") || a.id - b.id;
    const byTimeCancelled = (a: TaskRead, b: TaskRead) =>
      (a.cancelled_at ?? "").localeCompare(b.cancelled_at ?? "") || a.id - b.id;
    return {
      key: day ?? NO_DATE,
      day,
      ...titles,
      count: open.length + overdue.length,
      overdue,
      routines: day ? routineDays(steps, day) : [],
      events:
        found && show.events
          ? found.events
              .filter((event) => !event.is_cancelled && areaShown(filters, event.life_area_id))
              .sort(byTime)
          : [],
      projects:
        day && show.projects
          ? projects.filter(
              (project) => project.due_date === day && areaShown(filters, project.life_area_id),
            )
          : [],
      open,
      done: [
        ...(show.completed ? listed.filter((task) => task.status === "done").sort(byTimeDone) : []),
        ...(show.cancelled
          ? listed.filter((task) => task.status === "cancelled").sort(byTimeCancelled)
          : []),
      ],
    };
  };
  return [
    column(null, { title: "No date", subtitle: "Schedule" }),
    ...days.map((item) => column(item.day, dayTitles(item.day, today))),
  ];
}

/** The Next 7 days sidebar count: open tasks on the day columns, overdue ones included. */
export function next7Count(
  tasks: readonly TaskRead[],
  days: readonly DayRead[],
  today: string,
): number {
  const dates = new Set(days.map((item) => item.day));
  return tasks.filter((task) => {
    if (task.status !== "todo") return false;
    const day = placementDate(task);
    return isOverdue(task, today) || (day !== null && dates.has(day));
  }).length;
}

/**
 * When an event happens on `day`: "All day", "11 AM – 12:30 PM", or for a multi-day event
 * "From 6 PM" on its first day, "Until 3 PM" on its last and "All day" in between.
 */
export function eventTime(
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
  if (day === event.start_date && start) return `From ${start}`;
  if (day === event.end_date && end) return `Until ${end}`;
  return "All day";
}

/** Whether a task can be dragged on this board: open and not overdue. */
export function canDrag(task: TaskRead, today: string): boolean {
  return task.status === "todo" && !isOverdue(task, today);
}

/** Whether a task can go to a column: No date only takes tasks with no due date. */
export function canDrop(task: TaskRead, columnKey: string): boolean {
  return columnKey !== NO_DATE || task.due_date === null;
}

/**
 * The task list after a drop, for the cache until the server answers: the listed tasks take
 * their new order, and a task moved to another column takes that column's scheduled date.
 */
export function applyDrop(
  tasks: readonly TaskRead[],
  order: readonly number[],
  move?: { taskId: number; day: string | null },
): TaskRead[] {
  return tasks.map((task) => {
    const position = order.indexOf(task.id);
    const moved = task.id === move?.taskId ? { ...task, scheduled_date: move.day } : task;
    return position === -1 ? moved : { ...moved, sort_order: position };
  });
}
