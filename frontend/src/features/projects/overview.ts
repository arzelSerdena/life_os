import type {
  LifeAreaRead,
  OverviewProjectRead,
  ProjectsOverviewRead,
  ProjectTotalsRead,
} from "../../client/types.gen";
import { type Period, periodInSentence } from "../../period";
import { daysBetween, plural, shortDate } from "../life-areas/overview/format";
import { bucketName, delta, previousName, type Tile } from "../routines/routine";

export type ProjectsGroup = "area" | "pace" | "due";
export type ProjectsSort = "due" | "progress" | "name";

/** The six execution-stats tiles, all counted from project tasks. */
export function projectTiles(overview: ProjectsOverviewRead, period: Period): Tile[] {
  const { totals, previous, buckets } = overview;
  const names = buckets.map((bucket) =>
    bucketName(period, bucket.start, bucket.end, overview.today),
  );
  const tip = (values: (number | null)[], format: (value: number) => string) =>
    values.map((value, index) =>
      value === null ? names[index] : `${names[index]}: ${format(value)}`,
    );
  const before = previousName(period, overview.range.start);
  const inPeriod = `in ${periodInSentence(period, overview.range.start)}`;
  const rising = (points: (number | null)[]) => {
    const shown = points.filter((point) => point !== null);
    return shown.length > 1 && shown[shown.length - 1] > shown[0];
  };

  const done = buckets.map((bucket) => bucket.totals.done);
  const onTime = buckets.map((bucket) => onTimeRate(bucket.totals));
  const rate = onTimeRate(totals);
  const rateBefore = onTimeRate(previous);
  const overdue = buckets.map((bucket) => bucket.overdue);
  const rolls = buckets.map((bucket) => rolloversPerTask(bucket.totals));
  const roll = rolloversPerTask(totals);
  const rollBefore = rolloversPerTask(previous);
  const open = buckets.map((bucket) => bucket.open);
  const finished = buckets.map((bucket) => bucket.totals.finished);

  return [
    {
      label: "Tasks done",
      value: `${totals.done}`,
      unit: "",
      line:
        totals.done + previous.done === 0 ? inPeriod : delta(totals.done, previous.done, before),
      points: line(done),
      tips: tip(done, String),
      good: totals.done >= previous.done,
    },
    {
      label: "On time",
      value: rate === null ? "—" : `${rate}`,
      unit: rate === null ? "" : "%",
      line:
        rate === null
          ? "no tasks due yet"
          : rateBefore === null
            ? `${totals.done_on_time} of ${totals.done_with_due}`
            : delta(rate, rateBefore, before, " pts"),
      points: line(onTime),
      tips: tip(onTime, (value) => `${value}%`),
      good: rate === null || rateBefore === null || rate >= rateBefore,
    },
    {
      label: "Overdue now",
      value: `${overview.overdue}`,
      unit: "",
      line: overview.overdue ? `in ${plural(overview.overdue_projects, "project")}` : "",
      points: line(overdue),
      tips: tip(overdue, String),
      good: !rising(overdue),
    },
    {
      label: "Rollovers",
      value: roll === null ? "—" : roll.toFixed(1),
      unit: roll === null ? "" : "/ task",
      line:
        roll === null
          ? "no tasks yet"
          : rollBefore === null
            ? `over ${plural(totals.done, "task")} done`
            : decimalDelta(roll, rollBefore, before),
      points: line(rolls),
      tips: tip(rolls, (value) => `${value.toFixed(1)} per task`),
      good: roll === null || rollBefore === null || roll <= rollBefore,
    },
    {
      label: "Open tasks",
      value: `${overview.open}`,
      unit: "",
      line: overview.open ? `in ${plural(overview.open_projects, "project")}` : "",
      points: line(open),
      tips: tip(open, String),
      good: !rising(open),
    },
    {
      label: "Projects finished",
      value: `${totals.finished}`,
      unit: "",
      line: totals.finished ? `${totals.finished_on_time} on time` : inPeriod,
      points: line(finished),
      tips: tip(finished, String),
      good: totals.finished >= previous.finished,
    },
  ];
}

/** A series that never leaves zero draws no line. */
function line(points: (number | null)[]): (number | null)[] {
  return points.some((point) => point !== null && point !== 0) ? points : [];
}

/** Share of tasks done with a due date that were done by it, 0–100; null with none. */
export function onTimeRate(totals: ProjectTotalsRead): number | null {
  if (totals.done_with_due === 0) return null;
  return Math.round((totals.done_on_time / totals.done_with_due) * 100);
}

/** Rollovers per task done, to one decimal; null with nothing done. */
export function rolloversPerTask(totals: ProjectTotalsRead): number | null {
  if (totals.done === 0) return null;
  return Math.round((totals.rollovers / totals.done) * 10) / 10;
}

/** "−0.3 vs Q3" */
function decimalDelta(current: number, previous: number, name: string): string {
  const change = Math.round((current - previous) * 10) / 10;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "±";
  return `${sign}${Math.abs(change).toFixed(1)} vs ${name}`;
}

/** "7 active projects in 5 areas · 1 finished in Q4" */
export function timelineSubtitle(overview: ProjectsOverviewRead, period: Period): string {
  const active = overview.projects.filter((project) => project.status === "active");
  const finished = overview.projects.length - active.length;
  const areas = new Set(active.map((project) => project.life_area_id)).size;
  const parts = [`${plural(active.length, "active project")} in ${plural(areas, "area")}`];
  if (finished)
    parts.push(`${finished} finished in ${periodInSentence(period, overview.range.start)}`);
  return parts.join(" · ");
}

/** "7 active · 1 finished in Q4" */
export function boardSubtitle(overview: ProjectsOverviewRead, period: Period): string {
  const active = overview.projects.filter((project) => project.status === "active").length;
  const finished = overview.projects.length - active;
  const parts = [`${active} active`];
  if (finished)
    parts.push(`${finished} finished in ${periodInSentence(period, overview.range.start)}`);
  return parts.join(" · ");
}

/** "3 due in Q4 · 2 stalled · 2 with no next step"; "" when nothing needs a push. */
export function nextUpSubtitle(overview: ProjectsOverviewRead, period: Period): string {
  const parts: string[] = [];
  if (overview.due_next.length) {
    parts.push(
      `${overview.due_next.length} due in ${periodInSentence(period, overview.range.start)}`,
    );
  }
  if (overview.stalled.length) parts.push(`${overview.stalled.length} stalled`);
  const none = overview.no_next_step;
  if (none.length) {
    const empty = none.every((item) => item.open === 0);
    parts.push(empty ? `${none.length} without tasks` : `${none.length} with no next step`);
  }
  return parts.join(" · ");
}

/** The days-left badge: "6d", "Today", "3d late"; urgent within 7 days. */
export function daysLeft(due: string, today: string): { label: string; urgent: boolean } {
  const days = daysBetween(today, due);
  if (days < 0) return { label: `${-days}d late`, urgent: true };
  if (days === 0) return { label: "Today", urgent: true };
  return { label: `${days}d`, urgent: days <= 7 };
}

/** A board card's date line: "Due Nov 30 · 16d", "Overdue Nov 10", "Done Oct 30", "No due date". */
export function cardDateLine(project: OverviewProjectRead, today: string): string {
  if (project.status === "done" && project.completed_on) {
    return `Done ${shortDate(project.completed_on)}`;
  }
  if (!project.due_date) return "No due date";
  const days = daysBetween(today, project.due_date);
  if (days < 0) return `Overdue · ${shortDate(project.due_date)}`;
  return `Due ${shortDate(project.due_date)} · ${days}d`;
}

export type BoardColumn = {
  key: string;
  title: string;
  /** The area's color for an area column. */
  area?: string | null;
  projects: OverviewProjectRead[];
};

/** The board's columns for a grouping, sorted; empty columns are left out. */
export function projectColumns(
  overview: ProjectsOverviewRead,
  areas: LifeAreaRead[],
  group: ProjectsGroup,
  sort: ProjectsSort,
  showFinished: boolean,
): BoardColumn[] {
  const shown = sortProjects(
    overview.projects.filter((project) => showFinished || project.status === "active"),
    sort,
  );
  const isDone = (project: OverviewProjectRead) => project.status === "done";
  let columns: BoardColumn[];
  if (group === "area") {
    const order = [...new Set(overview.projects.map((project) => project.life_area_id))];
    columns = order.map((id) => {
      const area = areas.find((found) => found.id === id);
      return {
        key: `area-${id}`,
        title: area?.title ?? "Life area",
        area: area?.color ?? null,
        projects: shown.filter((project) => project.life_area_id === id),
      };
    });
  } else if (group === "pace") {
    const pace = (status: string | null) => (project: OverviewProjectRead) =>
      !isDone(project) && project.due_date !== null && paceOf(project) === status;
    columns = [
      { key: "behind", title: "Behind pace", projects: shown.filter(pace("behind")) },
      { key: "on_pace", title: "On pace", projects: shown.filter(pace("on_pace")) },
      { key: "ahead", title: "Ahead", projects: shown.filter(pace("ahead")) },
      {
        key: "no-due",
        title: "No due date",
        projects: shown.filter((project) => !isDone(project) && project.due_date === null),
      },
      { key: "finished", title: "Finished", projects: shown.filter(isDone) },
    ];
  } else {
    const month = overview.today.slice(0, 7);
    const next = nextMonth(month);
    const due = (test: (dueMonth: string) => boolean) => (project: OverviewProjectRead) =>
      !isDone(project) && project.due_date !== null && test(project.due_date.slice(0, 7));
    columns = [
      { key: "this-month", title: "This month", projects: shown.filter(due((m) => m <= month)) },
      { key: "next-month", title: "Next month", projects: shown.filter(due((m) => m === next)) },
      { key: "later", title: "Later", projects: shown.filter(due((m) => m > next)) },
      {
        key: "no-due",
        title: "No due date",
        projects: shown.filter((project) => !isDone(project) && project.due_date === null),
      },
      { key: "finished", title: "Finished", projects: shown.filter(isDone) },
    ];
  }
  return columns.filter((column) => column.projects.length > 0);
}

/** A project with a due date but no tasks yet counts as on pace: nothing is behind. */
function paceOf(project: OverviewProjectRead): string {
  return project.pace_status ?? "on_pace";
}

function nextMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, "0")}`;
}

/** Due date (soonest first, none last), progress (most done first) or name. Finished
 * projects go last within a column. */
export function sortProjects(
  projects: OverviewProjectRead[],
  sort: ProjectsSort,
): OverviewProjectRead[] {
  const share = (project: OverviewProjectRead) =>
    project.total ? project.done / project.total : 0;
  const byName = (a: OverviewProjectRead, b: OverviewProjectRead) => a.title.localeCompare(b.title);
  const compare = {
    due: (a: OverviewProjectRead, b: OverviewProjectRead) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || byName(a, b),
    progress: (a: OverviewProjectRead, b: OverviewProjectRead) =>
      share(b) - share(a) || byName(a, b),
    name: byName,
  }[sort];
  const rank = (project: OverviewProjectRead) => (project.status === "done" ? 1 : 0);
  return [...projects].sort((a, b) => rank(a) - rank(b) || compare(a, b));
}
