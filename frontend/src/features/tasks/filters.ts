import type { TaskRead } from "../../client/types.gen";
import { type BoardGroup, type Priority, placementDate } from "./board";

/**
 * The Tasks group's filter-and-sort menu, as pure functions: what each view offers, the
 * defaults, and how a view's choices filter and order its tasks. Rules: STYLE_GUIDE.md,
 * "Approved: Tasks" (the Screens table) as changed by the Nov 16 decisions.
 */

export type FilterView =
  | "all"
  | "today"
  | "unscheduled"
  | "inbox"
  | "next7"
  | "completed"
  | "cancelled"
  /** A project page's Board (one set of choices for every project). */
  | "project";

export type SortKey = "manual" | "priority" | "date" | "due" | "created";
export type SubgroupKey = "area" | "project" | "priority" | "section" | "none";
export type ShowKey = "events" | "routines" | "projects" | "completed" | "cancelled";
/** A life area's id, or "none" for tasks with no area. */
export type AreaKey = number | "none";
/** A section's id, or "none" for a project's tasks with no section. */
export type SectionKey = number | "none";
/** Which columns a subgroup choice belongs to: a group, Next 7 days' day columns, or a
 * project board's sections. */
export type Layout = BoardGroup | "days" | "section";

export const SORT_LABELS: Record<SortKey, string> = {
  manual: "Manual",
  priority: "Priority",
  date: "Date",
  due: "Due date",
  created: "Created",
};

export const SUBGROUP_LABELS: Record<SubgroupKey, string> = {
  area: "Area",
  project: "Project",
  priority: "Priority",
  section: "Section",
  none: "None",
};

export const SHOW_LABELS: Record<ShowKey, string> = {
  events: "Events",
  routines: "Routine steps",
  projects: "Project due dates",
  completed: "Completed",
  cancelled: "Cancelled",
};

type ViewMenu = {
  /** Subgroup choices per layout, the first being the default; none means no Subgroup row. */
  subgroups: Partial<Record<Layout, SubgroupKey[]>>;
  /** Sort choices, the first being the default; none means a fixed order. */
  sorts: SortKey[];
  /** Whether the Life areas filter is offered, and with a No area row. */
  areas: "with-no-area" | "areas-only" | false;
  /** Whether the Section filter is offered (a project board). */
  sections?: boolean;
  /** The SHOW toggles and whether each starts on. */
  show: Partial<Record<ShowKey, boolean>>;
};

/** What each view's menu offers. Sort never includes Title. */
export const VIEW_MENUS: Record<FilterView, ViewMenu> = {
  all: {
    subgroups: { priority: ["area", "none"], area: ["project", "priority", "none"] },
    sorts: ["manual", "priority", "date", "due", "created"],
    areas: "with-no-area",
    show: { completed: false, cancelled: false },
  },
  today: {
    subgroups: { priority: ["area", "none"], area: ["project", "priority", "none"] },
    sorts: ["manual", "priority", "date", "due", "created"],
    areas: "with-no-area",
    show: { completed: false, cancelled: false },
  },
  // Unscheduled tasks have an area and no dates, so there is no No area, Date or Due date.
  unscheduled: {
    subgroups: { priority: ["area", "none"], area: ["project", "priority", "none"] },
    sorts: ["manual", "priority", "created"],
    areas: "areas-only",
    show: { completed: false, cancelled: false },
  },
  // The Inbox is tasks with no life area, so a Life areas filter would have nothing to pick.
  inbox: {
    subgroups: {},
    sorts: ["created", "priority", "due"],
    areas: false,
    show: {},
  },
  next7: {
    subgroups: { days: ["none", "area", "priority"] },
    sorts: ["manual", "priority", "due", "created"],
    areas: "with-no-area",
    show: { events: true, routines: true, projects: true, completed: true, cancelled: false },
  },
  completed: { subgroups: {}, sorts: [], areas: "with-no-area", show: {} },
  cancelled: { subgroups: {}, sorts: [], areas: "with-no-area", show: {} },
  // A project's tasks share one area, so Section takes the Life areas filter's place.
  project: {
    subgroups: { priority: ["section", "none"], section: ["priority", "none"] },
    sorts: ["manual", "priority", "date", "due", "created"],
    areas: false,
    sections: true,
    show: { completed: false, cancelled: false },
  },
};

/** What is remembered for a view; anything missing takes the view's default. */
export type StoredFilters = {
  sort?: SortKey;
  subgroups?: Partial<Record<Layout, SubgroupKey>>;
  hiddenPriorities?: Priority[];
  /** Hidden rather than chosen areas, so a new area shows up by default. */
  hiddenAreas?: AreaKey[];
  /** Hidden sections, so a new section shows up by default. */
  hiddenSections?: SectionKey[];
  show?: Partial<Record<ShowKey, boolean>>;
};

/** A view's choices with the defaults filled in. */
export type Filters = {
  sort: SortKey;
  subgroup: SubgroupKey;
  hiddenPriorities: Priority[];
  hiddenAreas: AreaKey[];
  hiddenSections: SectionKey[];
  show: Record<ShowKey, boolean>;
};

export function resolveFilters(
  view: FilterView,
  layout: Layout,
  stored: StoredFilters | undefined,
): Filters {
  const menu = VIEW_MENUS[view];
  const subgroups = menu.subgroups[layout] ?? [];
  const sorts = menu.sorts;
  const storedSubgroup = stored?.subgroups?.[layout];
  const show = { events: true, routines: true, projects: true, completed: false, cancelled: false };
  for (const key of Object.keys(menu.show) as ShowKey[]) {
    show[key] = stored?.show?.[key] ?? menu.show[key] ?? show[key];
  }
  return {
    sort: stored?.sort && sorts.includes(stored.sort) ? stored.sort : (sorts[0] ?? "manual"),
    subgroup:
      storedSubgroup && subgroups.includes(storedSubgroup)
        ? storedSubgroup
        : (subgroups[0] ?? "none"),
    hiddenPriorities: stored?.hiddenPriorities ?? [],
    hiddenAreas: menu.areas ? (stored?.hiddenAreas ?? []) : [],
    hiddenSections: menu.sections ? (stored?.hiddenSections ?? []) : [],
    show,
  };
}

/** Whether the filters hide anything (the header icon's accent dot and Clear filters). */
export function filtersOn(view: FilterView, filters: Filters): boolean {
  const menu = VIEW_MENUS[view];
  return (
    filters.hiddenPriorities.length > 0 ||
    filters.hiddenAreas.length > 0 ||
    filters.hiddenSections.length > 0 ||
    (Object.keys(menu.show) as ShowKey[]).some((key) => filters.show[key] !== menu.show[key])
  );
}

/** Whether something in a life area (null = no area) passes the Life areas filter. */
export function areaShown(filters: Filters, lifeAreaId: number | null): boolean {
  return !filters.hiddenAreas.includes(lifeAreaId ?? "none");
}

/** Whether a task passes the Priority and Life areas filters. */
export function taskShown(filters: Filters, task: TaskRead): boolean {
  return !filters.hiddenPriorities.includes(task.priority) && areaShown(filters, task.life_area_id);
}

/** Whether a project's task passes the Section filter. */
export function sectionShown(filters: Filters, task: TaskRead): boolean {
  return !filters.hiddenSections.includes(task.section_id ?? "none");
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };
const LAST_DAY = "9999-12-31";

/**
 * Tasks in the chosen order. `manual` is the order the tasks come in (each view's own), and
 * breaks ties for the other sorts. Created is oldest first, like the Inbox has always been.
 */
export function sortTasks(tasks: readonly TaskRead[], sort: SortKey): TaskRead[] {
  const position = new Map(tasks.map((task, index) => [task.id, index]));
  const manual = (a: TaskRead, b: TaskRead) =>
    (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0);
  const compare: Record<SortKey, (a: TaskRead, b: TaskRead) => number> = {
    manual,
    priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    date: (a, b) => (placementDate(a) ?? LAST_DAY).localeCompare(placementDate(b) ?? LAST_DAY),
    due: (a, b) =>
      (a.due_date ?? LAST_DAY).localeCompare(b.due_date ?? LAST_DAY) ||
      (a.due_time ?? "99").localeCompare(b.due_time ?? "99"),
    created: (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
  };
  return [...tasks].sort((a, b) => compare[sort](a, b) || manual(a, b));
}

/** Open tasks first, then done and cancelled ones, each keeping its order. */
export function openFirst(tasks: readonly TaskRead[]): TaskRead[] {
  return [
    ...tasks.filter((task) => task.status === "todo"),
    ...tasks.filter((task) => task.status !== "todo"),
  ];
}
