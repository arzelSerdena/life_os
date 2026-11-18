import type {
  LifeAreaRead,
  OverviewRoutineRead,
  RoutinesOverviewRead,
  RoutineTotalsRead,
} from "../../client/types.gen";
import { type Period, periodInSentence } from "../../period";
import { shortDate } from "../life-areas/overview/format";
import { describeRepeat, parseRRule } from "../pickers/repeat";
import {
  bucketName,
  type DayState,
  delta,
  type HeatCell,
  plural,
  previousName,
  shareRow,
  statesByDay,
  type Tile,
} from "./routine";

/**
 * The Routines overview, as pure functions (Approved: Routines overview; docs/DOMAIN.md
 * section 8): five tiles across every routine, one heatmap row and one completion bar per
 * routine, and the Pick up card.
 */

export type OverviewSort = "manual" | "rate" | "name";

/** Completion rate, Steps done, Full days, Missed and Longest run, across every routine. */
export function overviewTiles(overview: RoutinesOverviewRead, period: Period): Tile[] {
  const { totals, previous, buckets } = overview;
  const steps = totals.done + totals.missed + totals.skipped;
  const labels = ["Completion rate", "Steps done", "Full days", "Missed", "Longest run"];
  if (steps === 0) {
    return labels.map((label) => ({
      label,
      value: "—",
      unit: "",
      line: "",
      points: [],
      tips: [],
      good: true,
    }));
  }

  const names = buckets.map((bucket) =>
    bucketName(period, bucket.start, bucket.end, overview.today),
  );
  const tip = (values: (number | null)[], format: (value: number) => string) =>
    values.map((value, index) =>
      value === null ? names[index] : `${names[index]}: ${format(value)}`,
    );
  const series = (pick: (bucket: RoutineTotalsRead) => number | null) =>
    buckets.map((bucket) => pick(bucket.totals));
  const since = overview.started ? `Since ${shortDate(overview.started)}` : "";
  const before = previous && previousName(period, overview.start);

  const rate = totals.completion_rate;
  const rates = series((bucket) => bucket.completion_rate);
  const done = series((bucket) => bucket.done);
  const full = series((bucket) => bucket.full_days);
  const missed = series((bucket) => bucket.missed);
  const runs = buckets.map((bucket) => bucket.run);
  const longest = overview.longest_run;
  const length = longest?.length ?? 0;

  return [
    {
      label: "Completion rate",
      value: rate === null ? "—" : `${rate}`,
      unit: rate === null ? "" : "%",
      line:
        before && previous?.completion_rate != null && rate !== null
          ? delta(rate, previous.completion_rate, before, " pts")
          : since,
      points: rates,
      tips: tip(rates, (value) => `${value}%`),
      good: previous?.completion_rate == null || rate === null || rate >= previous.completion_rate,
    },
    {
      label: "Steps done",
      value: `${totals.done}`,
      unit: "",
      line: `of ${steps} due`,
      points: done,
      tips: tip(done, String),
      good: !previous || totals.done >= previous.done,
    },
    {
      label: "Full days",
      value: `${totals.full_days}`,
      unit: "",
      line: `of ${totals.due_days} routine ${plural(totals.due_days, "day")}`,
      points: full,
      tips: tip(full, String),
      good: !previous || totals.full_days >= previous.full_days,
    },
    {
      label: "Missed",
      value: `${totals.missed}`,
      unit: plural(totals.missed, "step"),
      line: previous && before ? delta(totals.missed, previous.missed, before) : since,
      points: missed,
      tips: tip(missed, String),
      good: !previous || totals.missed <= previous.missed,
    },
    {
      label: "Longest run",
      value: `${length}`,
      unit: plural(length, "day"),
      line: longest ? longest.routine_title : "No full days yet",
      points: runs,
      tips: tip(runs, String),
      good: runs.length < 2 || length >= runs[runs.length - 2],
    },
  ];
}

/** "Every day · 4 steps". */
export function routineMeta(routine: OverviewRoutineRead): string {
  const rule = describeRepeat(parseRRule(routine.rrule), routine.schedule_starts_on);
  const steps = routine.steps.length;
  return `${rule} · ${steps} ${plural(steps, "step")}`;
}

/** "3 routines · 13 steps". */
export function routinesSubtitle(routines: OverviewRoutineRead[]): string {
  const steps = routines.reduce((sum, routine) => sum + routine.steps.length, 0);
  return `${routines.length} ${plural(routines.length, "routine")} · ${steps} ${plural(steps, "step")}`;
}

/** The routines the cards show, in the chosen order; paused ones only when asked for. */
export function shownRoutines(
  routines: OverviewRoutineRead[],
  sort: OverviewSort,
  showPaused: boolean,
): OverviewRoutineRead[] {
  const shown = routines.filter((routine) => showPaused || !routine.paused_since);
  if (sort === "name") {
    return [...shown].sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === "rate") {
    // Highest first; routines with nothing done or missed yet last.
    const rate = (routine: OverviewRoutineRead) => routine.totals.completion_rate ?? -1;
    return [...shown].sort((a, b) => rate(b) - rate(a));
  }
  return shown;
}

/** A routine's heatmap row: each day's share of its due steps done (each week's in Year). */
export function routineCells(
  routine: OverviewRoutineRead,
  overview: RoutinesOverviewRead,
  period: Period,
): HeatCell[] {
  return shareRow(
    routine.title,
    routine.steps.map((step) => statesByDay(step.days)),
    period,
    overview.start,
    overview.end,
    overview.today,
  );
}

/** "85% of due steps done in Q4", or nothing when nothing was done or missed. */
export function overviewCompletionSubtitle(
  overview: RoutinesOverviewRead,
  period: Period,
): string | undefined {
  const rate = overview.totals.completion_rate;
  if (rate === null) return undefined;
  return `${rate}% of due steps done in ${periodInSentence(period, overview.start)}`;
}

/** Routines with steps still to do today (paused ones never are). */
export function openToday(routines: OverviewRoutineRead[]): OverviewRoutineRead[] {
  return routines.filter(
    (routine) => !routine.paused_since && routine.today_done < routine.today_due,
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "10 days · ended Tue". */
export function pickUpLine(run: number, endedOn: string): string {
  const day = WEEKDAYS[new Date(`${endedOn}T00:00:00Z`).getUTCDay()];
  return `${run} ${plural(run, "day")} · ended ${day}`;
}

const STATUS_WORDS: Partial<Record<DayState, string>> = {
  done: "Done",
  skipped: "Skipped",
  missed: "Missed",
  todo: "To do",
  upcoming: "Upcoming",
  paused: "Paused",
};

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Export as CSV: one line per step and day it was due (or paused) in the period. */
export function overviewCsv(overview: RoutinesOverviewRead, areas: LifeAreaRead[]): string {
  const lines = [["Date", "Routine", "Step", "Life area", "Status"]];
  for (const routine of overview.routines) {
    for (const step of routine.steps) {
      const area = areas.find((item) => item.id === step.life_area_id)?.title ?? "";
      for (const day of step.days) {
        const status = STATUS_WORDS[day.state];
        if (status) lines.push([day.day, routine.title, step.title, area, status]);
      }
    }
  }
  return `${lines.map((line) => line.map(csvField).join(",")).join("\n")}\n`;
}
