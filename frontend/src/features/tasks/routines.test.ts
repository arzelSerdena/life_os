import { describe, expect, it } from "vitest";
import type { RoutineHistoryRead, StepDayState, StepHistoryRead } from "../../client/types.gen";
import { dayLabel, routineColumn, squareLabel, stepView } from "./routines";

const TODAY = "2026-11-21"; // a Saturday
const WEEK = [
  "2026-11-15",
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
];

function step(
  id: number,
  states: StepDayState["state"][],
  fields: Partial<StepHistoryRead> = {},
): StepHistoryRead {
  return {
    id,
    title: `Step ${id}`,
    life_area_id: 1,
    project_id: null,
    next_due: TODAY,
    paused_since: null,
    days: states.map((state, index) => ({ day: WEEK[index], state })),
    ...fields,
  };
}

function routine(steps: StepHistoryRead[], fields: Partial<RoutineHistoryRead> = {}) {
  return { id: 1, title: "Evening", rrule: "FREQ=DAILY", paused_since: null, steps, ...fields };
}

describe("stepView", () => {
  it("counts done days out of due days, skipped ones included", () => {
    const view = stepView(
      step(1, ["done", "missed", "done", "skipped", "done", "done", "todo"]),
      TODAY,
    );
    expect(view).toMatchObject({ doneCount: 4, dueCount: 7, dueToday: true, done: false });
    expect(view.next).toBeNull();
  });

  it("leaves out days the step wasn't due, and shows the next due day", () => {
    const view = stepView(
      step(1, ["done", "not_due", "not_due", "not_due", "not_due", "not_due", "not_due"], {
        next_due: "2026-11-22",
      }),
      TODAY,
    );
    expect(view).toMatchObject({ doneCount: 1, dueCount: 1, dueToday: false });
    expect(view.next).toBe("Sun, Nov 22");
  });

  it("shows no next day while paused", () => {
    const view = stepView(
      step(1, ["done", "done", "paused", "paused", "paused", "paused", "paused"], {
        next_due: null,
      }),
      TODAY,
    );
    expect(view).toMatchObject({ doneCount: 2, dueCount: 2, dueToday: false, next: null });
  });
});

describe("routineColumn", () => {
  it("counts today's done steps out of those due today", () => {
    const column = routineColumn(
      routine([
        step(1, ["done", "done", "done", "done", "done", "done", "done"]),
        step(2, ["done", "done", "done", "done", "done", "done", "todo"]),
        step(3, ["none", "none", "none", "none", "none", "none", "not_due"]),
      ]),
      TODAY,
    );
    expect(column).toMatchObject({ done: 1, total: 2, subtitle: "Daily" });
  });

  it("adds the pause to the schedule line", () => {
    const column = routineColumn(
      routine([], { rrule: "FREQ=WEEKLY;BYDAY=SU", paused_since: "2026-11-10" }),
      TODAY,
    );
    expect(column.subtitle).toBe("Sundays · Paused since Nov 10");
  });
});

it("labels days and squares", () => {
  expect(dayLabel("2026-11-15")).toBe("Sun, Nov 15");
  expect(squareLabel({ day: "2026-11-17", state: "missed" })).toBe("Tue · Missed");
});
