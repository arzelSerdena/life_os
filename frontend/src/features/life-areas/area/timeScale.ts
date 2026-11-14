import type { DateRangeRead } from "../../../client/types.gen";
import type { Period } from "../../../period";
import { daysBetween, parts, shortMonth } from "../overview/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

/** Positions dates across a period as percentages of its width. */
export function timeScale(range: DateRangeRead) {
  const total = daysBetween(range.start, range.end) + 1;
  /** Where a day starts, 0 to 100. */
  const at = (date: string) =>
    (Math.min(Math.max(daysBetween(range.start, date), 0), total) / total) * 100;
  /** Where a day ends. */
  const after = (date: string) => at(addDays(date, 1));
  return { total, at, after };
}

/** ISO dates compare as strings. */
export function laterDate(a: string, b: string): string {
  return [a, b].sort()[1];
}

export function earlierDate(a: string, b: string): string {
  return [a, b].sort()[0];
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month, day + days)).toISOString().slice(0, 10);
}

export function eachDay(range: DateRangeRead): string[] {
  const days: string[] = [];
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Month labels on top, and smaller ticks under them: Mondays, or days in a week view. */
export function scaleTicks(range: DateRangeRead, period: Period) {
  const months: { date: string; label: string }[] = [];
  const ticks: { date: string; label: string }[] = [];
  for (const date of eachDay(range)) {
    const { day } = parts(date);
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    if (date === range.start || day === 1) {
      months.push({
        date,
        label: period === "year" ? shortMonth(date) : MONTHS[parts(date).month],
      });
    }
    if (period === "week") ticks.push({ date, label: `${WEEKDAYS[weekday]} ${day}` });
    else if (period !== "year" && weekday === 0) ticks.push({ date, label: `${day}` });
  }
  return { months, ticks };
}

/** A routine schedule in words: "Daily", "Sundays", "Mon, Wed, Fri", or "Custom". */
export function describeRule(rrule: string): string {
  const fields = Object.fromEntries(rrule.split(";").map((part) => part.split("=")));
  const names: Record<string, [string, string]> = {
    MO: ["Mon", "Mondays"],
    TU: ["Tue", "Tuesdays"],
    WE: ["Wed", "Wednesdays"],
    TH: ["Thu", "Thursdays"],
    FR: ["Fri", "Fridays"],
    SA: ["Sat", "Saturdays"],
    SU: ["Sun", "Sundays"],
  };
  if (fields.FREQ === "DAILY" && !fields.INTERVAL) return "Daily";
  if (fields.FREQ === "WEEKLY" && !fields.INTERVAL) {
    const days: string[] = fields.BYDAY ? fields.BYDAY.split(",") : [];
    if (days.length === 1 && names[days[0]]) return names[days[0]][1];
    if (days.length === 5 && !days.includes("SA") && !days.includes("SU")) return "Weekdays";
    if (days.length > 1) return days.map((day) => names[day]?.[0] ?? day).join(", ");
    return "Weekly";
  }
  if (fields.FREQ === "MONTHLY") return "Monthly";
  return "Custom";
}
