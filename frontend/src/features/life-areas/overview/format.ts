import type { OutcomeRead } from "../../../client/types.gen";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS = [
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

/** "2026-11-14" -> { year, month (0-based), day } */
export function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** "Nov 14" */
export function shortDate(date: string): string {
  const { month, day } = parts(date);
  return `${SHORT_MONTHS[month]} ${day}`;
}

export function shortMonth(date: string): string {
  return SHORT_MONTHS[parts(date).month];
}

export function monthName(date: string): string {
  return MONTHS[parts(date).month];
}

/** Whole days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  const a = parts(from);
  const b = parts(to);
  return Math.round(
    (Date.UTC(b.year, b.month, b.day) - Date.UTC(a.year, a.month, a.day)) / 86_400_000,
  );
}

/** "this week" / "Oct" / "the week of Nov 2" for a target period starting on `start`. */
export function targetPeriodName(period: string, start: string, isCurrent: boolean): string {
  if (isCurrent) return `this ${period}`;
  if (period === "month") return shortMonth(start);
  if (period === "week") return `the week of ${shortDate(start)}`;
  return shortDate(start);
}

export type Tone = "good" | "bad" | "neutral";

/** Good when on track, met or improving; bad when behind, missed or worsening. */
export function outcomeTone(status: OutcomeRead["status"]): Tone {
  if (status === "met" || status === "on_track" || status === "improving" || status === "steady") {
    return "good";
  }
  if (status === "behind" || status === "missed" || status === "worsening") return "bad";
  return "neutral";
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
