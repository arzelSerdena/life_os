import { shortDate } from "../life-areas/overview/format";
import { addDays, daysFrom, WEEKDAY_NAMES, weekdayIndex } from "./dates";

/**
 * Repeat rules as the Repeat picker builds them (STYLE_GUIDE.md, "Approved: Pickers"). The API
 * takes an RRULE with no DTSTART, UNTIL or COUNT; the series runs from `starts_on` (the
 * anchor: the item's date) to `ends_on`, so "After n times" becomes an end date here.
 */

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

/** Monday first, as RRULE writes them. */
export const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export type RepeatEnds =
  | { kind: "never" }
  | { kind: "on"; date: string }
  | { kind: "after"; count: number };

export type RepeatRule = {
  frequency: Frequency;
  /** Every `interval` days, weeks, months or years. */
  interval: number;
  /** Weekly only: 0 = Monday … 6 = Sunday, in order. */
  weekdays: number[];
  /** Tasks only: the next one comes from the scheduled date or from completing this one. */
  from: "schedule" | "completion";
  ends: RepeatEnds;
};

export type PresetId = "daily" | "weekdays" | "weekly" | "monthly" | "yearly";

const WEEKDAYS_MON_FRI = [0, 1, 2, 3, 4];

/** The plain rule for a frequency, taken from the anchor date. */
export function simpleRule(frequency: Frequency, anchor: string): RepeatRule {
  return {
    frequency,
    interval: 1,
    weekdays: frequency === "weekly" ? [weekdayIndex(anchor)] : [],
    from: "schedule",
    ends: { kind: "never" },
  };
}

/** The Repeat picker's presets, with the value shown at the right ("Mon – Fri", "Sat"…). */
export function presets(
  anchor: string,
): { id: PresetId; label: string; note: string; rule: RepeatRule }[] {
  return [
    { id: "daily", label: "Every day", note: "", rule: simpleRule("daily", anchor) },
    {
      id: "weekdays",
      label: "Every weekday",
      note: "Mon – Fri",
      rule: { ...simpleRule("weekly", anchor), weekdays: WEEKDAYS_MON_FRI },
    },
    {
      id: "weekly",
      label: "Every week",
      note: WEEKDAY_NAMES[weekdayIndex(anchor)].slice(0, 3),
      rule: simpleRule("weekly", anchor),
    },
    {
      id: "monthly",
      label: "Every month",
      note: `on the ${ordinal(Number(anchor.slice(8)))}`,
      rule: simpleRule("monthly", anchor),
    },
    {
      id: "yearly",
      label: "Every year",
      note: shortDate(anchor),
      rule: simpleRule("yearly", anchor),
    },
  ];
}

/** Which preset a rule is, if it is one. */
export function presetOf(rule: RepeatRule, anchor: string): PresetId | null {
  return (
    presets(anchor).find(
      ({ rule: preset }) =>
        preset.frequency === rule.frequency &&
        preset.interval === rule.interval &&
        preset.weekdays.join() === rule.weekdays.join() &&
        rule.from === "schedule" &&
        rule.ends.kind === "never",
    )?.id ?? null
  );
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

/** The RRULE the API stores: "FREQ=WEEKLY;BYDAY=TU,SA". Months and years use the anchor's day. */
export function toRRule(rule: RepeatRule, anchor: string): string {
  const parts = [`FREQ=${rule.frequency.toUpperCase()}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  const [, month, day] = anchor.split("-").map(Number);
  if (rule.frequency === "weekly") {
    const days = rule.weekdays.length ? rule.weekdays : [weekdayIndex(anchor)];
    parts.push(
      `BYDAY=${[...days]
        .sort()
        .map((index) => BYDAY[index])
        .join(",")}`,
    );
  }
  if (rule.frequency === "monthly") parts.push(`BYMONTHDAY=${day}`);
  if (rule.frequency === "yearly") parts.push(`BYMONTH=${month}`, `BYMONTHDAY=${day}`);
  return parts.join(";");
}

/** Whether `day` (on or after the anchor) is one of the rule's dates. */
function matches(rule: RepeatRule, anchor: string, day: string): boolean {
  const [ay, am, ad] = anchor.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  switch (rule.frequency) {
    case "daily":
      return daysFrom(anchor, day) % rule.interval === 0;
    case "weekly": {
      const weeks =
        daysFrom(addDays(anchor, -weekdayIndex(anchor)), addDays(day, -weekdayIndex(day))) / 7;
      const days = rule.weekdays.length ? rule.weekdays : [weekdayIndex(anchor)];
      return weeks % rule.interval === 0 && days.includes(weekdayIndex(day));
    }
    case "monthly":
      return d === ad && ((y - ay) * 12 + (m - am)) % rule.interval === 0;
    case "yearly":
      return d === ad && m === am && (y - ay) % rule.interval === 0;
  }
}

/** The rule's first `count` dates from the anchor (fewer if none come within 100 years). */
export function occurrences(rule: RepeatRule, anchor: string, count: number): string[] {
  const found: string[] = [];
  const limit = addDays(anchor, 36_525);
  for (let day = anchor; found.length < count && day <= limit; day = addDays(day, 1)) {
    if (matches(rule, anchor, day)) found.push(day);
  }
  return found;
}

/** The series' last day, or null when it never ends. */
export function endsOn(rule: RepeatRule, anchor: string): string | null {
  if (rule.ends.kind === "never") return null;
  if (rule.ends.kind === "on") return rule.ends.date;
  return occurrences(rule, anchor, rule.ends.count).at(-1) ?? null;
}

function dayList(weekdays: number[]): string {
  return [...weekdays]
    .sort()
    .map((index) => WEEKDAY_NAMES[index].slice(0, 3))
    .join(", ");
}

/**
 * The rule as data, for the Repeat chip and the Custom footer: "Every day", "Every weekday",
 * "Every Sat", "Every 2 weeks · Tue, Sat", "Every month on the 14th", "Every year on Nov 14",
 * then "· from completion" and "· until Feb 27" or "· 5 times".
 */
export function describeRepeat(rule: RepeatRule, anchor: string): string {
  const n = rule.interval;
  const unit = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[rule.frequency];
  const every = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
  let base: string;
  switch (rule.frequency) {
    case "daily":
      base = every;
      break;
    case "weekly": {
      const days = rule.weekdays.length ? rule.weekdays : [weekdayIndex(anchor)];
      if (n === 1 && days.join() === WEEKDAYS_MON_FRI.join()) base = "Every weekday";
      else if (n === 1) base = `Every ${dayList(days)}`;
      else base = `${every} · ${dayList(days)}`;
      break;
    }
    case "monthly":
      base = `${every} on the ${ordinal(Number(anchor.slice(8)))}`;
      break;
    case "yearly":
      base = `${every} on ${shortDate(anchor)}`;
      break;
  }
  const parts = [base];
  if (rule.from === "completion") parts.push("from completion");
  if (rule.ends.kind === "on") parts.push(`until ${shortDate(rule.ends.date)}`);
  if (rule.ends.kind === "after") {
    parts.push(rule.ends.count === 1 ? "once" : `${rule.ends.count} times`);
  }
  return parts.join(" · ");
}
