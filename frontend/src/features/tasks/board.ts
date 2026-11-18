import type { LifeAreaRead, ProjectRead, SectionRead, TaskRead } from "../../client/types.gen";

/**
 * The Tasks group's boards, as pure functions: which tasks a view lists and how they split
 * into columns and subgroups. Rules: design/STYLE_GUIDE.md, "Approved: Tasks" and the Nov 16
 * decisions (High / Medium / Low / No priority; Inbox = no life area; an Unscheduled view).
 */

export const TASK_VIEWS = ["all", "today", "unscheduled", "completed", "cancelled"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export type BoardGroup = "priority" | "area";
export type Priority = TaskRead["priority"];

export const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "none", label: "No priority" },
];

export function isTaskView(value: string | undefined): value is TaskView {
  return (TASK_VIEWS as readonly string[]).includes(value ?? "");
}

/** Where a task sits: its scheduled date, else its due date, else nowhere (Unscheduled). */
export function placementDate(task: TaskRead): string | null {
  return task.scheduled_date ?? task.due_date;
}

/** An open task whose due date is past. */
export function isOverdue(task: TaskRead, today: string): boolean {
  return task.status === "todo" && task.due_date !== null && task.due_date < today;
}

/** Which finished tasks a view lists beside its open ones (the menu's SHOW section). */
export type ShowFinished = { completed?: boolean; cancelled?: boolean };

/** The tasks a view lists, in the view's order; finished ones only when `show` asks. */
export function tasksForView(
  view: TaskView,
  tasks: readonly TaskRead[],
  today: string,
  show: ShowFinished = {},
): TaskRead[] {
  const listed = (task: TaskRead) =>
    task.status === "todo" ||
    (task.status === "done" && show.completed === true) ||
    (task.status === "cancelled" && show.cancelled === true);
  switch (view) {
    case "all":
      return tasks.filter(listed).sort(byPlacement);
    case "today":
      return tasks
        .filter((task) => listed(task) && (placementDate(task) === today || isOverdue(task, today)))
        .sort(byPlacement);
    case "unscheduled":
      return tasks
        .filter((task) => listed(task) && task.life_area_id !== null && !placementDate(task))
        .sort(byPlacement);
    case "completed":
      return tasks
        .filter((task) => task.status === "done")
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "") || b.id - a.id);
    case "cancelled":
      return tasks
        .filter((task) => task.status === "cancelled")
        .sort((a, b) => (b.cancelled_at ?? "").localeCompare(a.cancelled_at ?? "") || b.id - a.id);
  }
}

/** Open tasks with no life area: the Inbox (inbox.ts lists them in order). */
export function inboxTasks(tasks: readonly TaskRead[]): TaskRead[] {
  return tasks.filter((task) => task.status === "todo" && task.life_area_id === null);
}

/** Manual order: by placement date (undated last), then the day's order, then creation. */
function byPlacement(a: TaskRead, b: TaskRead): number {
  const dayA = placementDate(a) ?? "9999-12-31";
  const dayB = placementDate(b) ?? "9999-12-31";
  return dayA.localeCompare(dayB) || a.sort_order - b.sort_order || a.id - b.id;
}

export type Marker =
  | { kind: "priority"; priority: Priority }
  | { kind: "area"; color: string | null }
  | { kind: "project"; color: string | null }
  | { kind: "none" };

export type Subgroup = {
  key: string;
  label: string;
  marker: Marker;
  /** The Today view's Overdue subgroup: red, and always first. */
  danger?: boolean;
  /** The project a project subgroup is about, so its card can lead the subgroup. */
  project?: ProjectRead;
  tasks: TaskRead[];
};

export type Column = {
  key: string;
  title: string;
  marker: Marker;
  count: number;
  /** Subgroups in order; a column without subgrouping has one unnamed subgroup. */
  subgroups: Subgroup[];
};

export type BoardContext = {
  today: string;
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
};

/** How a column splits into subgroups (picked in the filter-and-sort menu). */
export type SubgroupBy = "area" | "project" | "priority" | "section" | "none";

/**
 * The columns for a view. Priority group: High, Medium, Low, No priority. Area group: No area
 * plus one per area. Each column splits by `subgroupBy` (by default area in the Priority group,
 * project in the Area group). Completed and Cancelled use area columns with no subgroups.
 * Today puts overdue tasks in a red Overdue subgroup first. Counts are open tasks only, except
 * on Completed and Cancelled.
 */
export function buildColumns(
  view: TaskView,
  group: BoardGroup,
  tasks: readonly TaskRead[],
  context: BoardContext,
  subgroupBy: SubgroupBy = group === "area" ? "project" : "area",
): Column[] {
  const finished = view === "completed" || view === "cancelled";
  const byArea = finished || group === "area";
  const columns = byArea ? areaColumns(view, context) : priorityColumns();

  return columns.map((column) => {
    const own = tasks.filter((task) => column.holds(task));
    let rest = own;
    const subgroups: Subgroup[] = [];
    if (view === "today") {
      const overdue = own.filter((task) => isOverdue(task, context.today));
      if (overdue.length > 0) {
        subgroups.push({
          key: "overdue",
          label: "Overdue",
          marker: { kind: "none" },
          danger: true,
          tasks: overdue,
        });
      }
      rest = own.filter((task) => !isOverdue(task, context.today));
    }
    subgroups.push(...splitTasks(rest, finished ? "none" : subgroupBy, context));
    return {
      key: column.key,
      title: column.title,
      marker: column.marker,
      count: finished ? own.length : own.filter((task) => task.status === "todo").length,
      subgroups,
    };
  });
}

type ColumnSpec = {
  key: string;
  title: string;
  marker: Marker;
  holds: (task: TaskRead) => boolean;
};

function priorityColumns(): ColumnSpec[] {
  return PRIORITIES.map(({ key, label }) => ({
    key,
    title: label,
    marker: { kind: "priority", priority: key },
    holds: (task) => task.priority === key,
  }));
}

function areaColumns(view: TaskView, { lifeAreas }: BoardContext): ColumnSpec[] {
  const columns: ColumnSpec[] = lifeAreas.map((area) => ({
    key: `area-${area.id}`,
    title: area.title,
    marker: { kind: "area", color: area.color },
    holds: (task) => task.life_area_id === area.id,
  }));
  // Unscheduled lists only tasks with an area, so its No area column would always be empty.
  if (view !== "unscheduled") {
    columns.unshift({
      key: "no-area",
      title: "No area",
      marker: { kind: "area", color: null },
      holds: (task) => task.life_area_id === null,
    });
  }
  return columns;
}

/** Tasks split into subgroups; "none" gives one unnamed subgroup (left out when empty). */
export function splitTasks(
  tasks: readonly TaskRead[],
  by: SubgroupBy,
  context: Pick<BoardContext, "lifeAreas" | "projects"> & {
    /** A project's sections, for the project board's Section subgroups. */
    sections?: readonly SectionRead[];
  },
): Subgroup[] {
  switch (by) {
    case "section":
      return sectionSubgroups(tasks, context.sections ?? []);
    case "area":
      return areaSubgroups(tasks, context);
    case "project":
      return projectSubgroups(tasks, context);
    case "priority":
      return prioritySubgroups(tasks);
    case "none":
      return tasks.length > 0
        ? [{ key: "all", label: "", marker: { kind: "none" }, tasks: [...tasks] }]
        : [];
  }
}

/** One subgroup per priority, High first. Empty subgroups are left out. */
function prioritySubgroups(tasks: readonly TaskRead[]): Subgroup[] {
  return PRIORITIES.map(({ key, label }) => ({
    key: `priority-${key}`,
    label,
    marker: { kind: "priority" as const, priority: key },
    tasks: tasks.filter((task) => task.priority === key),
  })).filter((subgroup) => subgroup.tasks.length > 0);
}

/** A project's sections in their order. */
export function orderedSections(sections: readonly SectionRead[]): SectionRead[] {
  return [...sections].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

/** One subgroup per section in section order, then No section. Empty ones are left out. */
function sectionSubgroups(tasks: readonly TaskRead[], sections: readonly SectionRead[]) {
  const subgroups: Subgroup[] = orderedSections(sections).map((section) => ({
    key: `section-${section.id}`,
    label: section.title,
    marker: { kind: "none" },
    tasks: tasks.filter((task) => task.section_id === section.id),
  }));
  subgroups.push({
    key: "no-section",
    label: "No section",
    marker: { kind: "none" },
    tasks: tasks.filter(
      (task) => task.section_id === null || !sections.some((s) => s.id === task.section_id),
    ),
  });
  return subgroups.filter((subgroup) => subgroup.tasks.length > 0);
}

/** One subgroup per area in area order, then No area. Empty subgroups are left out. */
function areaSubgroups(
  tasks: readonly TaskRead[],
  { lifeAreas }: Pick<BoardContext, "lifeAreas">,
): Subgroup[] {
  const subgroups: Subgroup[] = lifeAreas.map((area) => ({
    key: `area-${area.id}`,
    label: area.title,
    marker: { kind: "area", color: area.color },
    tasks: tasks.filter((task) => task.life_area_id === area.id),
  }));
  subgroups.push({
    key: "no-area",
    label: "No area",
    marker: { kind: "area", color: null },
    tasks: tasks.filter((task) => !lifeAreas.some((area) => area.id === task.life_area_id)),
  });
  return subgroups.filter((subgroup) => subgroup.tasks.length > 0);
}

/** One subgroup per project in project order, then No project. Empty ones are left out. */
function projectSubgroups(
  tasks: readonly TaskRead[],
  { projects, lifeAreas }: Pick<BoardContext, "lifeAreas" | "projects">,
) {
  const colorOf = (lifeAreaId: number) =>
    lifeAreas.find((area) => area.id === lifeAreaId)?.color ?? null;
  const ordered = [...projects].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const subgroups: Subgroup[] = ordered.map((project) => ({
    key: `project-${project.id}`,
    label: project.title,
    marker: { kind: "project", color: colorOf(project.life_area_id) },
    project,
    tasks: tasks.filter((task) => task.project_id === project.id),
  }));
  subgroups.push({
    key: "no-project",
    label: "No project",
    marker: { kind: "none" },
    tasks: tasks.filter(
      (task) => task.project_id === null || !projects.some((p) => p.id === task.project_id),
    ),
  });
  return subgroups.filter((subgroup) => subgroup.tasks.length > 0);
}

/** Open-task counts for the sidebar rows. */
export function sidebarCounts(tasks: readonly TaskRead[], today: string) {
  return {
    all: tasksForView("all", tasks, today).length,
    inbox: inboxTasks(tasks).length,
    today: tasksForView("today", tasks, today).length,
    unscheduled: tasksForView("unscheduled", tasks, today).length,
  };
}
