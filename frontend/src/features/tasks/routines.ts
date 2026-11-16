import type { RoutineHistoryRead, StepDayState, StepHistoryRead } from "../../client/types.gen";
import { describeRule } from "../life-areas/area/timeScale";
import { shortDate } from "../life-areas/overview/format";

/**
 * Tasks › Routines, as pure functions (Approved: Tasks, "Next 7 days and Routines"): one
 * column per routine with today's progress, and a card per step with its last seven days.
 */

export type DayState = StepDayState["state"];

/** States of a day the step was due on (paused, not-due and before-start days aren't). */
const DUE: ReadonlySet<DayState> = new Set(["done", "skipped", "missed", "todo", "upcoming"]);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type StepView = {
  step: StepHistoryRead;
  /** Today's state, or null when today isn't in the range. */
  todayState: DayState | null;
  dueToday: boolean;
  done: boolean;
  /** "Sun, Nov 22" when the step isn't due today; null otherwise or while paused. */
  next: string | null;
  /** Done days out of due days in the range ("6/7"). */
  doneCount: number;
  dueCount: number;
};

export type RoutineColumn = {
  routine: RoutineHistoryRead;
  /** "Daily", or "Daily · Paused since Nov 10". */
  subtitle: string;
  /** Steps due today, and how many of them are done. */
  done: number;
  total: number;
  steps: StepView[];
};

/** "Sun, Nov 15". */
export function dayLabel(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${shortDate(day)}`;
}

export function stepView(step: StepHistoryRead, today: string): StepView {
  const todayState = step.days.find((item) => item.day === today)?.state ?? null;
  const dueToday = todayState !== null && DUE.has(todayState);
  const due = step.days.filter((item) => DUE.has(item.state));
  return {
    step,
    todayState,
    dueToday,
    done: todayState === "done",
    next: !dueToday && step.next_due && step.next_due > today ? dayLabel(step.next_due) : null,
    doneCount: due.filter((item) => item.state === "done").length,
    dueCount: due.length,
  };
}

export function routineColumn(routine: RoutineHistoryRead, today: string): RoutineColumn {
  const steps = routine.steps.map((step) => stepView(step, today));
  const dueToday = steps.filter((step) => step.dueToday);
  const schedule = describeRule(routine.rrule);
  return {
    routine,
    subtitle: routine.paused_since
      ? `${schedule} · Paused since ${shortDate(routine.paused_since)}`
      : schedule,
    done: dueToday.filter((step) => step.done).length,
    total: dueToday.length,
    steps,
  };
}

const STATE_LABELS: Record<DayState, string> = {
  done: "Done",
  skipped: "Skipped",
  missed: "Missed",
  todo: "Today",
  upcoming: "Upcoming",
  paused: "Paused",
  not_due: "Not due",
  none: "Not started",
};

/** A square's hover text: "Sun · Done". */
export function squareLabel(item: StepDayState): string {
  return `${dayLabel(item.day).slice(0, 3)} · ${STATE_LABELS[item.state]}`;
}
