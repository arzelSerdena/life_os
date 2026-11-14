/**
 * Calendar periods for the period switch (Week / Month / Quarter / Year).
 * Dates are local calendar dates as "YYYY-MM-DD" strings, like the API's. Weeks start on Monday.
 */

export const PERIODS = ["week", "month", "quarter", "year"] as const;
export type Period = (typeof PERIODS)[number];

export type DateRange = { start: string; end: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Today's local date. */
export function today(): string {
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/** The first and last day of the period that contains `date`. */
export function periodRange(period: Period, date: string): DateRange {
  const { year, month, day } = parseDate(date);
  switch (period) {
    case "week": {
      const mondayOffset = (utc(year, month, day).getUTCDay() + 6) % 7;
      return { start: addDays(date, -mondayOffset), end: addDays(date, 6 - mondayOffset) };
    }
    case "month":
      return monthsRange(year, month, 1);
    case "quarter":
      return monthsRange(year, month - (month % 3), 3);
    case "year":
      return monthsRange(year, 0, 12);
  }
}

/** The first day of the period `steps` periods before or after the one containing `date`. */
export function shiftPeriod(period: Period, date: string, steps: number): string {
  const { start } = periodRange(period, date);
  if (period === "week") {
    return addDays(start, steps * 7);
  }
  const months = { month: 1, quarter: 3, year: 12 }[period] * steps;
  const { year, month } = parseDate(start);
  const shifted = utc(year, month + months, 1);
  return formatDate(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
}

/** A short name for the period: "Nov 9 – 15", "Nov 2026", "Q4 2026", "2026". */
export function periodLabel(period: Period, date: string): string {
  const { start, end } = periodRange(period, date);
  const first = parseDate(start);
  switch (period) {
    case "week": {
      const last = parseDate(end);
      const lastLabel =
        last.month === first.month ? `${last.day}` : `${MONTHS[last.month]} ${last.day}`;
      const yearLabel = last.year === parseDate(today()).year ? "" : `, ${last.year}`;
      return `${MONTHS[first.month]} ${first.day} – ${lastLabel}${yearLabel}`;
    }
    case "month":
      return `${MONTHS[first.month]} ${first.year}`;
    case "quarter":
      return `Q${first.month / 3 + 1} ${first.year}`;
    case "year":
      return `${first.year}`;
  }
}

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

/**
 * The period's name inside a sentence ("Where your completed tasks went in Q4"):
 * "the week of Nov 9", "November", "Q4", "2026". The year is added when it isn't this year.
 */
export function periodInSentence(period: Period, date: string): string {
  const first = parseDate(periodRange(period, date).start);
  const year = first.year === parseDate(today()).year ? "" : ` ${first.year}`;
  switch (period) {
    case "week":
      return `the week of ${MONTHS[first.month]} ${first.day}${year ? `,${year}` : ""}`;
    case "month":
      return `${FULL_MONTHS[first.month]}${year}`;
    case "quarter":
      return `Q${first.month / 3 + 1}${year}`;
    case "year":
      return `${first.year}`;
  }
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  const moved = utc(year, month, day + days);
  return formatDate(moved.getUTCFullYear(), moved.getUTCMonth(), moved.getUTCDate());
}

function monthsRange(year: number, firstMonth: number, months: number): DateRange {
  const lastDay = utc(year, firstMonth + months, 0);
  return {
    start: formatDate(year, firstMonth, 1),
    end: formatDate(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate()),
  };
}

/** Month is 0-based, as in Date. */
function parseDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** UTC avoids daylight saving shifts in date arithmetic; overflowing days and months roll over. */
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
