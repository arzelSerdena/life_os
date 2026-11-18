import type { SectionRead, TaskRead } from "../../client/types.gen";
import {
  type Column,
  orderedSections,
  PRIORITIES,
  type Priority,
  type SubgroupBy,
  splitTasks,
} from "../tasks/board";
import { spotFor } from "../tasks/newTask";

/**
 * A project page's Board, as pure functions: the Tasks board for one project (STYLE_GUIDE.md,
 * "Approved: Tasks", the "A project" row). Columns are Priority or Section; each splits by the
 * other one or not at all; dragging a card sets the column's and the subgroup's property.
 */

export type ProjectGroup = "priority" | "section";

/**
 * The columns: High, Medium, Low, No priority; or No section and then each section in order.
 * `tasks` are already filtered and in the board's order. Counts are open tasks only.
 */
export function buildProjectColumns(
  tasks: readonly TaskRead[],
  sections: readonly SectionRead[],
  group: ProjectGroup,
  subgroupBy: SubgroupBy,
): Column[] {
  const specs =
    group === "priority"
      ? PRIORITIES.map(({ key, label }) => ({
          key,
          title: label,
          marker: { kind: "priority" as const, priority: key },
          holds: (task: TaskRead) => task.priority === key,
        }))
      : [
          {
            key: "no-section",
            title: "No section",
            marker: { kind: "none" as const },
            holds: (task: TaskRead) =>
              task.section_id === null || !sections.some((s) => s.id === task.section_id),
          },
          ...orderedSections(sections).map((section) => ({
            key: `section-${section.id}`,
            title: section.title,
            marker: { kind: "none" as const },
            holds: (task: TaskRead) => task.section_id === section.id,
          })),
        ];
  // A subgroup is never the same as the group.
  const by = subgroupBy === group ? "none" : subgroupBy;
  return specs.map((spec) => {
    const own = tasks.filter(spec.holds);
    return {
      key: spec.key,
      title: spec.title,
      marker: spec.marker,
      count: own.filter((task) => task.status === "todo").length,
      subgroups: splitTasks(own, by, { lifeAreas: [], projects: [], sections }),
    };
  });
}

/** What a drop changes: only the properties that differ from the task's own. */
export type DropChange = { priority?: Priority; sectionId?: number | null };

/** The change a drop on a column (and a subgroup in it) makes, or null when it changes nothing. */
export function dropChange(
  task: TaskRead,
  columnKey: string,
  subgroupKey: string | null,
): DropChange | null {
  const spot = spotFor(columnKey, subgroupKey, []);
  const change: DropChange = {};
  if (spot.priority !== undefined && spot.priority !== task.priority) {
    change.priority = spot.priority;
  }
  if (spot.sectionId !== undefined && spot.sectionId !== task.section_id) {
    change.sectionId = spot.sectionId;
  }
  return Object.keys(change).length > 0 ? change : null;
}

/** The task as it looks after the drop, to show it at once. */
export function applyDropChange(task: TaskRead, change: DropChange): TaskRead {
  return {
    ...task,
    ...(change.priority !== undefined ? { priority: change.priority } : {}),
    ...(change.sectionId !== undefined ? { section_id: change.sectionId } : {}),
  };
}

const PRIORITY_NAMES: Record<Priority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
  none: "No priority",
};

/** The toast: Moved “X” · Design, Set “X” · High priority, or both. */
export function dropMessage(
  task: TaskRead,
  change: DropChange,
  sections: readonly SectionRead[],
): string {
  const parts: string[] = [];
  if (change.sectionId !== undefined) {
    parts.push(
      change.sectionId === null
        ? "No section"
        : (sections.find((section) => section.id === change.sectionId)?.title ?? "Section"),
    );
  }
  if (change.priority !== undefined) parts.push(PRIORITY_NAMES[change.priority]);
  const verb = change.sectionId !== undefined ? "Moved" : "Set";
  return `${verb} “${task.title}” · ${parts.join(" · ")}`;
}
