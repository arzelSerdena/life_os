import type {
  RoutinePageRead,
  RoutinePageStepRead,
  RoutineStepDay,
  RoutineTotalsRead,
  StepDayState,
} from "../../client/types.gen";
import { addDays, type Period, periodInSentence } from "../../period";
import { shortDate } from "../life-areas/overview/format";
import { describeRepeat, matches, parseRRule } from "../pickers/repeat";

/**
 * The routine page, as pure functions (Approved: routine page; docs/DOMAIN.md section 8):
 * five calculated tiles, the Steps heatmap, Completion by step, Schedule history and the
 * Day card.
 */

export type DayState = StepDayState["state"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** "Sat, Nov 14". */
export function weekdayDate(day: string): string {
  return `${WEEKDAYS[weekday(day)]}, ${shortDate(day)}`;
}

/** "Nov 9 – 15", or "Oct 26 – Nov 1" across months; one day alone when they are the same. */
export function dayRange(start: string, end: string): string {
  if (start === end) return shortDate(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${shortDate(start)} – ${sameMonth ? Number(end.slice(8)) : shortDate(end)}`;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

// ---------- Header ----------

/** The schedule chip: "Every day · since Oct 5", or "· from today" / "· from Nov 20". */
export function scheduleLabel(page: RoutinePageRead): string {
  const rows = page.routine.schedules;
  const current = [...rows].reverse().find((row) => row.starts_on <= page.today) ?? rows[0];
  const rule = describeRepeat(parseRRule(current.rrule), current.starts_on);
  if (current.starts_on < page.today) return `${rule} · since ${shortDate(current.starts_on)}`;
  if (current.starts_on === page.today) return `${rule} · from today`;
  return `${rule} · from ${shortDate(current.starts_on)}`;
}

// ---------- Changing the schedule ----------

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Whether a stored RRULE, running from `startsOn`, falls on `day`. Its BYMONTHDAY and
 * BYMONTH win over the start's day, as the backend reads them. */
export function ruleDueOn(rrule: string, startsOn: string, day: string): boolean {
  if (day < startsOn) return false;
  const fields = Object.fromEntries(rrule.split(";").map((part) => part.split("=")));
  const rule = parseRRule(rrule);
  if (rule.frequency === "monthly" || rule.frequency === "yearly") {
    const [y, m, d] = day.split("-").map(Number);
    const [sy, sm] = startsOn.split("-").map(Number);
    const monthDay = Number(fields.BYMONTHDAY ?? startsOn.slice(8));
    if (d !== monthDay) return false;
    if (rule.frequency === "monthly") return ((y - sy) * 12 + (m - sm)) % rule.interval === 0;
    return m === Number(fields.BYMONTH ?? sm) && (y - sy) % rule.interval === 0;
  }
  return matches(rule, startsOn, day);
}

/** Whether the routine's schedules made `day` due: the schedule in effect that day. */
function scheduledOn(page: RoutinePageRead, day: string): boolean {
  const row = [...page.routine.schedules].reverse().find((item) => item.starts_on <= day);
  return row ? ruleDueOn(row.rrule, row.starts_on, day) : false;
}

export type ScheduleImpact = {
  /** Days before today since the routine started. */
  pastDays: number;
  /** "Keeps 41 past days as they were", for a change from `from`. */
  keeps: string;
  /** "Changes which of 41 past days were due · 6 Sundays no longer due". */
  changes: string;
};

/** What a new schedule would do to the past, from a date or for all days. */
export function scheduleImpact(page: RoutinePageRead, rrule: string, from: string): ScheduleImpact {
  const start = page.routine.schedules[0].starts_on;
  const past = start < page.today ? each(start, addDays(page.today, -1)) : [];
  const kept = past.filter((day) => day < from).length;
  const lost: string[] = [];
  let gained = 0;
  for (const day of past) {
    const before = scheduledOn(page, day);
    const after = ruleDueOn(rrule, start, day);
    if (before && !after) lost.push(day);
    if (after && !before) gained += 1;
  }
  const lostDays = new Set(lost.map(weekday));
  const lostText =
    lost.length === 0
      ? ""
      : lostDays.size === 1
        ? ` · ${lost.length} ${WEEKDAY_NAMES[weekday(lost[0])]}${lost.length === 1 ? "" : "s"} no longer due`
        : ` · ${lost.length} ${plural(lost.length, "day")} no longer due`;
  const gainedText = gained ? ` · ${gained} more ${plural(gained, "day")} due` : "";
  const days = (count: number) => `${count} past ${plural(count, "day")}`;
  return {
    pastDays: past.length,
    keeps:
      kept === past.length
        ? `Keeps ${days(kept)} as they were`
        : `Keeps ${days(kept)} as they were; changes ${past.length - kept} since ${shortDate(from)}`,
    changes: `Changes which of ${days(past.length)} were due${lostText}${gainedText}`,
  };
}

/** The life areas of the steps, in step order, each once. */
export function stepAreaIds(page: RoutinePageRead): number[] {
  return [...new Set(page.steps.map((row) => row.step.life_area_id))];
}

// ---------- Tiles ----------

export type Tile = {
  label: string;
  /** "—" when nothing was due yet. */
  value: string;
  unit: string;
  line: string;
  /** One point per bucket (day, week or month); null where there's nothing to show. */
  points: (number | null)[];
  tips: string[];
  good: boolean;
};

/** What the previous period is called in "vs …": "last week", "October", "Q3". */
function previousName(period: Period, start: string): string {
  const before = addDays(start, -1);
  const month = Number(before.slice(5, 7)) - 1;
  if (period === "week") return "last week";
  if (period === "month") return FULL_MONTHS[month];
  return `Q${Math.floor(month / 3) + 1}`;
}

/** "+4 pts vs last week", "−3 vs Q3", "±0 vs October". */
function delta(current: number, previous: number, name: string, unit = ""): string {
  const change = current - previous;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "±";
  return `${sign}${Math.abs(change)}${unit} vs ${name}`;
}

/** A bucket's name in a tile's tip: "Mon, Nov 16", "Week of Nov 9", "November". */
function bucketName(period: Period, start: string, end: string, today: string): string {
  if (period === "week") return weekdayDate(start);
  if (period === "year") return FULL_MONTHS[Number(start.slice(5, 7)) - 1];
  if (start <= today && today <= end) return "This week";
  return `Week of ${shortDate(start)}`;
}

/** The five tiles: completion rate, full days, current run, missed and skipped. */
export function tiles(page: RoutinePageRead, period: Period): Tile[] {
  const { totals, previous, buckets } = page;
  const names = buckets.map((bucket) => bucketName(period, bucket.start, bucket.end, page.today));
  const tip = (values: (number | null)[], format: (value: number) => string) =>
    values.map((value, index) =>
      value === null ? names[index] : `${names[index]}: ${format(value)}`,
    );
  const series = (pick: (bucket: RoutineTotalsRead) => number | null) =>
    buckets.map((bucket) => pick(bucket.totals));
  const since = `Since ${shortDate(firstDay(page))}`;
  const before = previous && previousName(period, page.start);
  const steps = totals.done + totals.missed + totals.skipped;

  if (steps === 0) {
    return ["Completion rate", "Full days", "Current run", "Missed", "Skipped"].map((label) => ({
      label,
      value: "—",
      unit: "",
      line: "",
      points: [],
      tips: [],
      good: true,
    }));
  }

  const rate = totals.completion_rate;
  const rates = series((bucket) => bucket.completion_rate);
  const rateTile: Tile = {
    label: "Completion rate",
    value: rate === null ? "—" : `${rate}`,
    unit: rate === null ? "" : "%",
    line:
      before && previous?.completion_rate != null && rate !== null
        ? delta(rate, previous.completion_rate, before, " pts")
        : since,
    points: rates,
    tips: tip(rates, (value) => `${value}%`),
    good: !previous?.completion_rate || rate === null || rate >= previous.completion_rate,
  };

  const full = series((bucket) => bucket.full_days);
  const fullTile: Tile = {
    label: "Full days",
    value: `${totals.full_days}`,
    unit: "",
    line: `of ${totals.due_days} due ${plural(totals.due_days, "day")}`,
    points: full,
    tips: tip(full, String),
    good: !previous || totals.full_days >= previous.full_days,
  };

  // When the current run is 0, the best run comes first (docs/DOMAIN.md section 6).
  const { current_run: current, best_run: best } = page;
  const bestDates = best.start && best.end ? ` · ${dayRange(best.start, best.end)}` : "";
  const runs = buckets.map((bucket) => bucket.run);
  const showBest = current.length === 0 && best.length > 0;
  const runTile: Tile = {
    label: showBest ? "Best run" : "Current run",
    value: `${showBest ? best.length : current.length}`,
    unit: plural(showBest ? best.length : current.length, "day"),
    line: showBest
      ? `${dayRange(best.start ?? "", best.end ?? "")} · current 0`
      : best.length > 0
        ? `Best ${best.length}${bestDates}`
        : "No full days yet",
    points: runs,
    tips: tip(runs, String),
    good: runs.length < 2 || current.length >= runs[runs.length - 2],
  };

  const missed = series((bucket) => bucket.missed);
  const missedTile: Tile = {
    label: "Missed",
    value: `${totals.missed}`,
    unit: plural(totals.missed, "step"),
    line: previous && before ? delta(totals.missed, previous.missed, before) : since,
    points: missed,
    tips: tip(missed, String),
    good: !previous || totals.missed <= previous.missed,
  };

  const skipped = series((bucket) => bucket.skipped);
  const skippedTile: Tile = {
    label: "Skipped",
    value: `${totals.skipped}`,
    unit: plural(totals.skipped, "step"),
    line: `of ${steps} due ${plural(steps, "step")}`,
    points: skipped,
    tips: tip(skipped, String),
    good: true,
  };

  return [rateTile, fullTile, runTile, missedTile, skippedTile];
}

/** The routine's first day: its first schedule, or an earlier step. */
function firstDay(page: RoutinePageRead): string {
  const days = [
    page.routine.schedules[0].starts_on,
    ...page.steps.map((row) => row.step.starts_on),
  ];
  return days.sort()[0];
}

// ---------- Heatmap ----------

/** A square: a step's state on one day, or a share of due steps done (a day of the All
 * steps row, or a week in the Year view). */
export type HeatCell = {
  key: string;
  state: DayState | "share";
  /** 0 to 1, for "share". */
  share: number;
  /** Today's square (outlined), or the current week in the Year view. */
  isCurrent: boolean;
  /** The day a click selects; none in the Year view. */
  day: string | null;
  label: string;
};

export type HeatHeader = { key: string; label: string; left: number; width: number; bold?: string };

export type Heatmap = {
  columns: number;
  header: HeatHeader[];
  /** Index of today's column label, highlighted in the Week and Month views. */
  todayKey: string | null;
  all: HeatCell[];
  steps: { row: RoutinePageStepRead; cells: HeatCell[] }[];
};

const STATE_WORDS: Record<DayState, string> = {
  done: "done",
  skipped: "skipped",
  missed: "missed",
  todo: "to do",
  upcoming: "upcoming",
  paused: "paused",
  not_due: "not due",
  none: "not started",
};

/** Monday on or before the day. */
function monday(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

function each(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** One day across every step: the share of due steps done, or the state they share. */
function dayAggregate(
  states: DayState[],
  day: string,
  today: string,
): Omit<HeatCell, "key" | "day" | "label"> & { done: number; total: number } {
  const base = { share: 0, isCurrent: day === today, done: 0, total: 0 };
  const due = states.filter((state) => state !== "not_due" && state !== "none");
  if (due.length === 0) {
    return { ...base, state: states.every((state) => state === "none") ? "none" : "not_due" };
  }
  if (due.every((state) => state === "paused")) return { ...base, state: "paused" };
  if (day > today) return { ...base, state: "upcoming" };
  const done = due.filter((state) => state === "done").length;
  const counted =
    day === today
      ? due.filter((state) => state !== "skipped" && state !== "paused").length
      : due.filter((state) => state === "done" || state === "missed").length;
  if (counted === 0) return { ...base, state: "skipped" };
  return { ...base, state: "share", share: done / counted, done, total: counted };
}

/** One week (Year view), for one step or all of them. */
function weekAggregate(
  states: DayState[],
  start: string,
  today: string,
): Omit<HeatCell, "key" | "day" | "label"> {
  const isCurrent = start <= today && today <= addDays(start, 6);
  const base = { share: 0, isCurrent };
  if (start > today) {
    return { ...base, state: states.includes("upcoming") ? "upcoming" : "not_due" };
  }
  const done = states.filter((state) => state === "done").length;
  const missed = states.filter((state) => state === "missed").length;
  if (done + missed > 0) return { ...base, state: "share", share: done / (done + missed) };
  if (states.includes("paused")) return { ...base, state: "paused" };
  if (isCurrent && states.includes("todo")) return { ...base, state: "share", share: 0 };
  if (states.every((state) => state === "none")) return { ...base, state: "none" };
  return { ...base, state: "not_due" };
}

export function heatmap(page: RoutinePageRead, period: Period): Heatmap {
  const { today } = page;
  const days = each(page.start, page.end);
  const stateOn = (row: RoutinePageStepRead) =>
    new Map(row.days.map((item) => [item.day, item.state]));
  const lookups = page.steps.map((row) => ({ row, states: stateOn(row) }));

  if (period === "year") {
    const weeks: string[] = [];
    for (let start = monday(page.start); start <= page.end; start = addDays(start, 7)) {
      weeks.push(start);
    }
    const weekStates = (states: Map<string, DayState>[], start: string) =>
      each(start, addDays(start, 6)).flatMap((day) =>
        states.map((map) => map.get(day)).filter((state) => state !== undefined),
      );
    const weekCell = (name: string, states: Map<string, DayState>[], start: string): HeatCell => {
      const cell = weekAggregate(weekStates(states, start), start, today);
      const share = cell.state === "share" ? ` · ${Math.round(cell.share * 100)}% done` : "";
      return {
        ...cell,
        key: start,
        day: null,
        label: `${name} · Week of ${shortDate(start)}${share}`,
      };
    };
    const header = weeks.flatMap((start, index) => {
      const firstOfMonth = each(start, addDays(start, 6)).find(
        (day) => day.endsWith("-01") && day >= page.start && day <= page.end,
      );
      if (!firstOfMonth) return [];
      return [
        {
          key: firstOfMonth,
          label: FULL_MONTHS[Number(firstOfMonth.slice(5, 7)) - 1].slice(0, 3),
          left: (100 * index) / weeks.length,
          width: 0,
        },
      ];
    });
    const all = lookups.map((item) => item.states);
    return {
      columns: weeks.length,
      header,
      todayKey: null,
      all: weeks.map((start) => weekCell("All steps", all, start)),
      steps: lookups.map(({ row, states }) => ({
        row,
        cells: weeks.map((start) => weekCell(row.step.title, [states], start)),
      })),
    };
  }

  const n = days.length;
  const header: HeatHeader[] =
    period === "quarter"
      ? days.flatMap((day, index) =>
          day.endsWith("-01")
            ? [
                {
                  key: day,
                  label: FULL_MONTHS[Number(day.slice(5, 7)) - 1],
                  left: (100 * index) / n,
                  width: 0,
                },
              ]
            : [],
        )
      : days.map((day, index) => ({
          key: day,
          label: period === "week" ? WEEKDAYS[weekday(day)] : `${Number(day.slice(8))}`,
          bold: period === "week" ? `${Number(day.slice(8))}` : undefined,
          left: (100 * index) / n,
          width: 100 / n,
        }));

  const all = days.map((day): HeatCell => {
    const cell = dayAggregate(
      lookups.map(({ states }) => states.get(day) ?? "none"),
      day,
      today,
    );
    const words =
      cell.state === "share"
        ? `${cell.done} of ${cell.total} done`
        : STATE_WORDS[cell.state as DayState];
    return {
      key: day,
      state: cell.state,
      share: cell.share,
      isCurrent: cell.isCurrent,
      day,
      label: `All steps · ${weekdayDate(day)} · ${words}`,
    };
  });

  return {
    columns: n,
    header,
    todayKey: period === "quarter" || !days.includes(today) ? null : today,
    all,
    steps: lookups.map(({ row, states }) => ({
      row,
      cells: days.map((day) => {
        const state = states.get(day) ?? "none";
        return {
          key: day,
          state,
          share: 0,
          isCurrent: day === today,
          day,
          label: `${row.step.title} · ${weekdayDate(day)} · ${STATE_WORDS[state]}`,
        };
      }),
    })),
  };
}

// ---------- Completion by step ----------

/** "83% of due steps done in Q4", or nothing when nothing was done or missed. */
export function completionSubtitle(page: RoutinePageRead, period: Period): string | undefined {
  const rate = page.totals.completion_rate;
  if (rate === null) return undefined;
  return `${rate}% of due steps done in ${periodInSentence(period, page.start)}`;
}

// ---------- Schedule history ----------

export type StripSegment = {
  key: string;
  left: number;
  width: number;
  label: string;
  cutLeft: boolean;
  openRight: boolean;
};

/** Where a stretch of days falls in the period, in percent; null when it doesn't. */
function position(page: RoutinePageRead, start: string, end: string) {
  const first = start < page.start ? page.start : start;
  const last = end > page.end ? page.end : end;
  if (first > last) return null;
  const total = each(page.start, page.end).length;
  const offset = each(page.start, first).length - 1;
  const length = each(first, last).length;
  return { left: (100 * offset) / total, width: (100 * length) / total };
}

export type ScheduleHistory = {
  schedules: StripSegment[];
  pauses: StripSegment[];
  subtitle: string;
};

/** The schedules and pauses that touch the period, or null when the routine has only ever
 * had one schedule and no pauses. */
export function scheduleHistory(page: RoutinePageRead, period: Period): ScheduleHistory | null {
  const rows = page.routine.schedules;
  if (rows.length < 2 && page.pauses.length === 0) return null;
  const schedules = rows.flatMap((row, index): StripSegment[] => {
    const next = rows[index + 1];
    const end = next ? addDays(next.starts_on, -1) : null;
    const place = position(page, row.starts_on, end ?? "9999-12-31");
    if (!place) return [];
    const rule = describeRepeat(parseRRule(row.rrule), row.starts_on);
    const label = end
      ? `${rule} · ${dayRange(row.starts_on, end)}`
      : `${rule} · ${row.starts_on >= page.start ? "from" : "since"} ${shortDate(row.starts_on)}`;
    return [
      {
        key: row.starts_on,
        ...place,
        label,
        cutLeft: row.starts_on < page.start,
        openRight: !end || end > page.end,
      },
    ];
  });
  const pauses = page.pauses.flatMap((pause): StripSegment[] => {
    // ends_on is the first day it no longer covers; an open pause runs to today.
    const end = pause.ends_on ? addDays(pause.ends_on, -1) : page.today;
    if (end < pause.starts_on) return [];
    const place = position(page, pause.starts_on, end);
    if (!place) return [];
    const label = pause.ends_on
      ? `Paused ${dayRange(pause.starts_on, end)}`
      : `Paused since ${shortDate(pause.starts_on)}`;
    return [{ key: pause.starts_on, ...place, label, cutLeft: false, openRight: false }];
  });
  const parts = [
    `${schedules.length} ${plural(schedules.length, "schedule")}`,
    pauses.length ? `${pauses.length} ${plural(pauses.length, "pause")}` : "",
  ].filter(Boolean);
  return {
    schedules,
    pauses,
    subtitle: `${parts.join(" · ")} in ${periodInSentence(period, page.start)}`,
  };
}

// ---------- Day card ----------

export type DayRowState = "todo" | "done" | "skipped" | "missed" | "upcoming";

export type DayRow = {
  row: RoutinePageStepRead;
  state: DayRowState;
};

export type DayCard =
  | { kind: "steps"; rows: DayRow[]; done: number; total: number; canSkipDay: boolean }
  | { kind: "paused"; since: string }
  | { kind: "not_due"; next: string | null };

/** The selected day: each step due on it with its status, or why nothing is due. */
export function dayCard(page: RoutinePageRead, day: string, due: RoutineStepDay[]): DayCard {
  const rows: DayRow[] = due
    .filter((item) => item.routine_id === page.routine.id)
    .flatMap((item) => {
      const row = page.steps.find((step) => step.step.id === item.step_id);
      if (!row) return [];
      const state: DayRowState =
        day > page.today && item.status === "todo" ? "upcoming" : item.status;
      return [{ row, state }];
    });
  if (rows.length > 0) {
    const counted = rows.filter((item) => item.state !== "skipped");
    return {
      kind: "steps",
      rows,
      done: counted.filter((item) => item.state === "done").length,
      total: counted.length,
      canSkipDay: rows.some((item) => item.state === "todo" || item.state === "upcoming"),
    };
  }
  const pause = page.pauses.find(
    (item) => item.starts_on <= day && (item.ends_on === null || day < item.ends_on),
  );
  if (pause && (pause.ends_on !== null || day <= page.today)) {
    return { kind: "paused", since: pause.starts_on };
  }
  const next = page.steps
    .map((row) => row.next_due)
    .filter((value): value is string => value !== null && value > page.today)
    .sort()[0];
  return { kind: "not_due", next: day === page.today ? (next ?? null) : null };
}
