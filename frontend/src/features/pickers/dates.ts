import { shortDate } from "../life-areas/overview/format";

/**
 * Calendar-date helpers for the pickers. Dates are local calendar dates as "YYYY-MM-DD";
 * the maths runs in UTC so no time zone can shift a day.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function utc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** A local calendar date ("YYYY-MM-DD") `days` after `day`. */
export function addDays(day: string, days: number): string {
  const date = utc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysFrom(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday (weeks start on Monday). */
export function weekdayIndex(day: string): number {
  return (utc(day).getUTCDay() + 6) % 7;
}

/** The Monday after `day` (weeks start on Monday), for the Date picker's Next week. */
export function nextMonday(day: string): string {
  return addDays(day, 7 - weekdayIndex(day));
}

/** "2026-11" → the month's grid: whole Monday-to-Sunday weeks, as dates. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  let day = addDays(first, -weekdayIndex(first));
  const weeks: string[][] = [];
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  } while (day.slice(0, 7) === month);
  return weeks;
}

/** "2026-11" moved by `months`. */
export function addMonths(month: string, months: number): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + months, 1));
  return date.toISOString().slice(0, 7);
}

/** "2026-11" → "November 2026". */
export function monthTitle(month: string): string {
  return utc(`${month}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** "Sun, Nov 15" */
export function dayDate(day: string): string {
  return `${WEEKDAY_NAMES[weekdayIndex(day)].slice(0, 3)}, ${shortDate(day)}`;
}

/** "Nov 4, 2026", the picker's date field. */
export function longDate(day: string): string {
  return utc(day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today, Tomorrow, the weekday within the coming week, else "Nov 20, 2026". */
export function relativeName(day: string, today: string): string {
  const ahead = daysFrom(today, day);
  if (ahead === 0) return "Today";
  if (ahead === 1) return "Tomorrow";
  if (ahead > 1 && ahead < 7) return WEEKDAY_NAMES[weekdayIndex(day)];
  return longDate(day);
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
  if (date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** A month and day with no year: this year's, or next year's once it has passed. */
function nextMonthDay(month: number, day: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const date = validDate(year, month, day);
  if (date && date >= today) return date;
  return validDate(year + 1, month, day) ?? date;
}

function monthIndex(word: string): number | null {
  if (word.length < 3) return null;
  const index = MONTHS.findIndex((name) => name.startsWith(word));
  return index === -1 ? null : index + 1;
}

/**
 * What a typed date means, or null: "today", "tom", "fri" (this one, today included),
 * "+3d" / "+2w" / "+1m", "nov 20", "20 nov", "nov 20 2027", "11/20", "11/20/2027",
 * "2026-11-20", or "20" (the next 20th).
 */
export function parseDate(text: string, today: string): string | null {
  const input = text.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!input) return null;
  if (ISO.test(input)) {
    const [year, month, day] = input.split("-").map(Number);
    return validDate(year, month, day);
  }
  if ("today".startsWith(input) && input.length >= 3) return today;
  if (input === "tmr" || ("tomorrow".startsWith(input) && input.length >= 3)) {
    return addDays(today, 1);
  }

  const offset = /^\+?(\d{1,3}) ?([dwm])$/.exec(input);
  if (offset && (input.startsWith("+") || offset[2] !== "m")) {
    const count = Number(offset[1]);
    if (offset[2] === "d") return addDays(today, count);
    if (offset[2] === "w") return addDays(today, count * 7);
    const [year, month, day] = today.split("-").map(Number);
    const target = new Date(Date.UTC(year, month - 1 + count, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0));
    return validDate(
      target.getUTCFullYear(),
      target.getUTCMonth() + 1,
      Math.min(day, last.getUTCDate()),
    );
  }

  if (/^[a-z]{2,}$/.test(input)) {
    const weekday = WEEKDAY_NAMES.findIndex((name) => name.toLowerCase().startsWith(input));
    if (weekday !== -1) return addDays(today, (weekday - weekdayIndex(today) + 7) % 7);
  }

  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(input);
  if (slash) {
    const [month, day] = [Number(slash[1]), Number(slash[2])];
    if (!slash[3]) return nextMonthDay(month, day, today);
    const year = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
    return validDate(year, month, day);
  }

  const words = input.split(" ");
  if (words.length === 2 || words.length === 3) {
    const [first, second, third] = words;
    const year = third && /^\d{4}$/.test(third) ? Number(third) : null;
    if (third && year === null) return null;
    let month: number | null = null;
    let day: number | null = null;
    if (/^\d{1,2}$/.test(first)) {
      month = monthIndex(second);
      day = Number(first);
    } else if (/^\d{1,2}$/.test(second)) {
      month = monthIndex(first);
      day = Number(second);
    }
    if (month === null || day === null) return null;
    return year === null ? nextMonthDay(month, day, today) : validDate(year, month, day);
  }

  if (/^\d{1,2}$/.test(input)) {
    const day = Number(input);
    const [year, month] = today.split("-").map(Number);
    const date = validDate(year, month, day);
    if (date && date >= today) return date;
    const next = new Date(Date.UTC(year, month, 1));
    return validDate(next.getUTCFullYear(), next.getUTCMonth() + 1, day);
  }
  return null;
}
