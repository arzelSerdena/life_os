import type { PreviewCount, PreviewGroup, PreviewRow } from "../../client/types.gen";
import { parts, shortDate } from "../life-areas/overview/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RULE_DAYS: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

export const GROUP_LABELS: Record<PreviewGroup["effect"], string> = {
  cancelled: "Cancelled",
  ends_from_today: "Ends from today",
  archived: "Archived",
  deleted: "Deleted",
  kept: "Kept",
};

/** Rows that stand for a whole kind of thing are named by it. */
const KIND_NAMES: Partial<Record<PreviewRow["kind"], string>> = {
  history: "History",
  schedules: "Schedules",
  pauses: "Pauses",
  entries: "Entries",
  targets: "Targets",
  moved_occurrence: "Moved occurrence",
  skipped_occurrence: "Skipped occurrence",
  changed_occurrence: "Changed occurrence",
};

const COUNT_WORDS: Record<PreviewCount["of"], [string, string]> = {
  tasks: ["task", "tasks"],
  events: ["event", "events"],
  recurring_tasks: ["recurring task", "recurring tasks"],
  templates: ["template", "templates"],
  routine_steps: ["routine step", "routine steps"],
  metrics: ["metric", "metrics"],
  entries: ["entry", "entries"],
  targets: ["target", "targets"],
  logs: ["log", "logs"],
  days: ["day", "days"],
  schedules: ["schedule", "schedules"],
  pauses: ["pause", "pauses"],
  done: ["done", "done"],
  cancelled: ["cancelled", "cancelled"],
};

export function rowName(row: PreviewRow): string {
  return KIND_NAMES[row.kind] ?? row.title ?? "";
}

/** "Fri, Nov 20" */
export function weekdayDate(date: string): string {
  const { year, month, day } = parts(date);
  return `${WEEKDAYS[new Date(Date.UTC(year, month, day)).getUTCDay()]}, ${shortDate(date)}`;
}

/** "14:00:00" -> "2 PM", "09:30" -> "9:30 AM" */
export function clockTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  const hour = hours % 12 || 12;
  return minutes ? `${hour}:${String(minutes).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** "Every Sun", "Every other Wed", "Every day", "Every month" */
export function everyText(rrule: string): string {
  const fields = Object.fromEntries(rrule.split(";").map((part) => part.split("=")));
  const interval = Number(fields.INTERVAL ?? 1);
  const every = interval === 2 ? "Every other" : interval > 2 ? `Every ${interval}` : "Every";
  const unit = (one: string, many: string) =>
    interval > 2 ? `${every} ${many}` : `${every} ${one}`;
  switch (fields.FREQ) {
    case "DAILY":
      return unit("day", "days");
    case "WEEKLY": {
      const days: string[] = fields.BYDAY ? fields.BYDAY.split(",") : [];
      if (days.length === 0) return unit("week", "weeks");
      if (days.length === 7) return unit("day", "days");
      return `${every} ${days.map((day) => RULE_DAYS[day] ?? day).join(", ")}`;
    }
    case "MONTHLY":
      return unit("month", "months");
    case "YEARLY":
      return unit("year", "years");
    default:
      return "Repeats";
  }
}

/** "2 entries · 1 target" */
export function countsText(counts: PreviewCount[]): string {
  return counts
    .map(({ of, count }) => {
      const [one, many] = COUNT_WORDS[of];
      return `${count} ${count === 1 ? one : many}`;
    })
    .join(" · ");
}

function timesText(row: PreviewRow): string | null {
  if (!row.start_time) return null;
  return row.end_time
    ? `${clockTime(row.start_time)} – ${clockTime(row.end_time)}`
    : clockTime(row.start_time);
}

/** The data on a row's right: dates, the repeat rule, the routine or owner, or counts. */
export function rowMeta(row: PreviewRow): string {
  const { kind } = row;
  const counts = row.counts ?? [];
  if (kind === "moved_occurrence" && row.date && row.moved_to) {
    return `${shortDate(row.date)} → ${weekdayDate(row.moved_to)}`;
  }
  if (kind === "skipped_occurrence" || kind === "changed_occurrence") {
    return row.date ? shortDate(row.date) : "";
  }
  // A row named by its kind with a count of that same kind shows only the number.
  if (KIND_NAMES[kind] && counts.length === 1 && counts[0].of === kind) {
    return String(counts[0].count);
  }
  if (counts.length > 0) return countsText(counts);
  if (row.context) return row.context;
  if (kind === "event") {
    if (row.date && row.and_later) return `${weekdayDate(row.date)} and later`;
    if (row.rrule) {
      const rule = everyText(row.rrule);
      if (row.last_date) return `${rule} · last on ${shortDate(row.last_date)}`;
      if (row.from_date) return `${rule} · from ${shortDate(row.from_date)}`;
      return rule;
    }
    if (row.date) {
      const times = timesText(row);
      return times ? `${weekdayDate(row.date)} · ${times}` : weekdayDate(row.date);
    }
    return "";
  }
  if (kind === "task_template") return row.rrule ? everyText(row.rrule) : "";
  if (kind === "task" && row.date) return shortDate(row.date);
  return "";
}

/** How many tasks a cascade cancels, for the toast: "2 tasks cancelled". */
export function cancelledTasks(groups: PreviewGroup[]): number {
  return (
    groups.find((group) => group.effect === "cancelled")?.rows.filter((row) => row.kind === "task")
      .length ?? 0
  );
}
