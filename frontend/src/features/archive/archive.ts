import type {
  ArchivedAreaRead,
  ArchivedRoutineRead,
  FinishedProjectRead,
  LifeAreaRead,
} from "../../client/types.gen";
import { plural, shortDate } from "../life-areas/overview/format";
import { describeRepeat, parseRRule } from "../pickers/repeat";

export type ArchiveTab = "areas" | "projects" | "routines";

export const ARCHIVE_TABS: { key: ArchiveTab; label: string }[] = [
  { key: "areas", label: "Areas" },
  { key: "projects", label: "Projects" },
  { key: "routines", label: "Routines" },
];

export const EMPTY_MESSAGES: Record<ArchiveTab, string> = {
  areas: "No archived areas.",
  projects: "No finished or archived projects.",
  routines: "No archived routines.",
};

/** The tab in the address (`?tab=projects`), Areas when it names none. */
export function tabOf(value: string | null): ArchiveTab {
  return ARCHIVE_TABS.some((tab) => tab.key === value) ? (value as ArchiveTab) : "areas";
}

/** "Oct 2", with the year when it isn't this one: "Oct 2, 2025". */
export function archiveDate(date: string, thisYear: number): string {
  const year = Number(date.slice(0, 4));
  return year === thisYear ? shortDate(date) : `${shortDate(date)}, ${year}`;
}

/** What restoring the area brings back, "1 project · 41 tasks · 2 metrics"; "Empty" when
 * nothing belongs to it; "" when what it holds was archived before it. */
export function areaContents(area: ArchivedAreaRead): string {
  if (!area.has_items) return "Empty";
  return [
    area.projects > 0 ? plural(area.projects, "project") : null,
    area.tasks > 0 ? plural(area.tasks, "task") : null,
    area.metrics > 0 ? plural(area.metrics, "metric") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Archived Oct 2 · 1 project · 41 tasks · 2 metrics", or "Archived Jun 30 · Empty". */
export function areaMeta(area: ArchivedAreaRead, thisYear: number): string {
  return [`Archived ${archiveDate(area.archived_on, thisYear)}`, areaContents(area)]
    .filter(Boolean)
    .join(" · ");
}

/** "Restored “Language learning” · 1 project, 41 tasks back" (what came back with it). */
export function restoredAreaMessage(area: ArchivedAreaRead): string {
  const back = [
    area.projects > 0 ? plural(area.projects, "project") : null,
    area.tasks > 0 ? plural(area.tasks, "task") : null,
  ].filter(Boolean);
  return `Restored “${area.title}”${back.length > 0 ? ` · ${back.join(", ")} back` : ""}`;
}

/** "Health & Beauty · Nov 3 · 18/20 tasks": the area, the day of its status, its tasks. */
export function projectMeta(
  project: FinishedProjectRead,
  areaTitle: string | undefined,
  thisYear: number,
): string {
  return [
    areaTitle,
    archiveDate(project.on, thisYear),
    project.total > 0 ? `${project.done}/${project.total} tasks` : "No tasks",
  ]
    .filter(Boolean)
    .join(" · ");
}

export type ProjectGroupKey = "done" | "cancelled" | "archived";

export const PROJECT_GROUPS: { key: ProjectGroupKey; label: string }[] = [
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
  { key: "archived", label: "Archived" },
];

/** Archived projects go under ARCHIVED whatever their status; the others by status. */
export function projectGroup(project: FinishedProjectRead): ProjectGroupKey {
  if (project.archived_at !== null) return "archived";
  return project.status === "cancelled" ? "cancelled" : "done";
}

/** The projects of the areas not hidden by the filter, grouped, each group newest first
 * (the API's order); empty groups are left out. */
export function groupProjects(
  projects: readonly FinishedProjectRead[],
  hiddenAreas: readonly number[],
): { key: ProjectGroupKey; label: string; projects: FinishedProjectRead[] }[] {
  const shown = projects.filter((project) => !hiddenAreas.includes(project.life_area_id));
  return PROJECT_GROUPS.map((group) => ({
    ...group,
    projects: shown.filter((project) => projectGroup(project) === group.key),
  })).filter((group) => group.projects.length > 0);
}

/** The areas the Projects filter lists: those with a project here, in the sidebar's order
 * (archived areas too), each with its count. */
export function filterAreas(
  projects: readonly FinishedProjectRead[],
  lifeAreas: readonly LifeAreaRead[],
): { area: LifeAreaRead; count: number }[] {
  return [...lifeAreas]
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((area) => ({
      area,
      count: projects.filter((project) => project.life_area_id === area.id).length,
    }))
    .filter((row) => row.count > 0);
}

/** The area to restore first, while the project's area is archived. */
export function restoreBlocker(
  project: FinishedProjectRead,
  lifeAreas: readonly LifeAreaRead[],
): string | null {
  const area = lifeAreas.find((item) => item.id === project.life_area_id);
  return area && area.archived_at !== null ? area.title : null;
}

/** "Every day · 5 steps · Archived Nov 1 · best run 21 days" (the app says run, not streak). */
export function routineMeta(routine: ArchivedRoutineRead, thisYear: number): string {
  return [
    describeRepeat(parseRRule(routine.rrule), routine.schedule_starts_on),
    plural(routine.steps, "step"),
    `Archived ${archiveDate(routine.archived_on, thisYear)}`,
    routine.best_run > 0 ? `best run ${plural(routine.best_run, "day")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Why the routine can't be deleted: "A step feeds Weekly runs." */
export function routineDeleteBlocker(routine: ArchivedRoutineRead): string | null {
  const { feeds } = routine;
  if (feeds.length === 0) return null;
  const names =
    feeds.length === 1 ? feeds[0] : `${feeds.slice(0, -1).join(", ")} and ${feeds.at(-1)}`;
  return `${feeds.length === 1 ? "A step feeds" : "Steps feed"} ${names}.`;
}
