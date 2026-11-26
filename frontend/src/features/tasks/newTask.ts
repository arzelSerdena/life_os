import type { ProjectRead, TaskCreate, TaskTemplateCreate } from "../../client/types.gen";
import { daysFrom } from "../pickers/dates";
import { endsOn, type RepeatRule, toRRule } from "../pickers/repeat";
import type { Priority } from "./board";

/**
 * New task, as pure functions: what a column or subgroup + fills in, and what Create sends
 * (STYLE_GUIDE.md, "Approved: Tasks" › Interactions).
 */

/** What New task starts with. An owner of null is the Inbox. */
export type TaskSpot = {
  priority?: Priority;
  lifeAreaId?: number | null;
  projectId?: number | null;
  sectionId?: number | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduledEndTime?: string | null;
};

const PRIORITY_KEYS: readonly string[] = ["high", "medium", "low", "none"];

/**
 * The spot a column or subgroup key stands for: "high" or "priority-high", "area-3",
 * "no-area" (the Inbox), "project-7" (and its area), "section-4" or "no-section" (on a project
 * board, whose base spot holds the project), a day ("2026-11-20"). "no-project",
 * "overdue", "all" and No date add nothing.
 */
export function spotFromKey(key: string, projects: readonly ProjectRead[]): TaskSpot {
  if (PRIORITY_KEYS.includes(key)) return { priority: key as Priority };
  if (key.startsWith("priority-")) return { priority: key.slice("priority-".length) as Priority };
  if (key === "no-area") return { lifeAreaId: null, projectId: null };
  if (key.startsWith("area-")) return { lifeAreaId: Number(key.slice("area-".length)) };
  if (key.startsWith("project-")) {
    const project = projects.find((p) => p.id === Number(key.slice("project-".length)));
    return project ? { lifeAreaId: project.life_area_id, projectId: project.id } : {};
  }
  if (key === "no-section") return { sectionId: null };
  if (key.startsWith("section-")) return { sectionId: Number(key.slice("section-".length)) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return { scheduledDate: key };
  return {};
}

/** A column's spot with its subgroup's on top (a project subgroup sets the area too). */
export function spotFor(
  columnKey: string,
  subgroupKey: string | null,
  projects: readonly ProjectRead[],
  base: TaskSpot = {},
): TaskSpot {
  return {
    ...base,
    ...spotFromKey(columnKey, projects),
    ...(subgroupKey ? spotFromKey(subgroupKey, projects) : {}),
  };
}

export type NewTaskValues = {
  title: string;
  lifeAreaId: number | null;
  projectId: number | null;
  sectionId: number | null;
  priority: Priority;
  scheduledDate: string | null;
  scheduledTime?: string | null;
  scheduledEndTime?: string | null;
  dueDate: string | null;
  repeat: RepeatRule | null;
  subtasks: string[];
};

/** A recurring task's dates come from its scheduled date, else its due date, else today. */
export function repeatAnchor(
  values: Pick<NewTaskValues, "scheduledDate" | "dueDate">,
  today: string,
) {
  return values.scheduledDate ?? values.dueDate ?? today;
}

/** Why Create can't send yet, or null. A missing title only disables the button. */
export function newTaskProblem(values: NewTaskValues, today: string): string | null {
  if (!values.repeat || !values.dueDate) return null;
  if (values.dueDate < repeatAnchor(values, today)) {
    return "A repeating task can't be due before its scheduled date.";
  }
  return null;
}

type Owner = { life_area_id?: number; project_id?: number; section_id?: number };

function owner(values: NewTaskValues): Owner {
  if (values.projectId !== null) {
    return {
      project_id: values.projectId,
      ...(values.sectionId !== null ? { section_id: values.sectionId } : {}),
    };
  }
  return values.lifeAreaId !== null ? { life_area_id: values.lifeAreaId } : {};
}

/**
 * What Create sends: a task, or with a repeat rule a recurring task (a template) that starts
 * on the anchor date and is due `due_offset_days` after each occurrence.
 */
export function createRequest(
  values: NewTaskValues,
  today: string,
): { kind: "task"; body: TaskCreate } | { kind: "template"; body: TaskTemplateCreate } {
  const subtasks = values.subtasks.map((title) => title.trim()).filter(Boolean);
  const common = {
    title: values.title.trim(),
    priority: values.priority,
    subtasks,
    ...owner(values),
  };
  if (!values.repeat) {
    return {
      kind: "task",
      body: {
        ...common,
        scheduled_date: values.scheduledDate,
        ...(values.scheduledTime ? { scheduled_time: values.scheduledTime } : {}),
        ...(values.scheduledEndTime ? { scheduled_end_time: values.scheduledEndTime } : {}),
        due_date: values.dueDate,
      },
    };
  }
  const anchor = repeatAnchor(values, today);
  return {
    kind: "template",
    body: {
      ...common,
      rrule: toRRule(values.repeat, anchor),
      repeat_from: values.repeat.from,
      starts_on: anchor,
      ends_on: endsOn(values.repeat, anchor),
      due_offset_days: values.dueDate ? daysFrom(anchor, values.dueDate) : null,
    },
  };
}
