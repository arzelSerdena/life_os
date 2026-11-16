import { describe, expect, test } from "vitest";
import type { PreviewRow } from "../../client/types.gen";
import { clockTime, everyText, rowMeta, rowName } from "./previewText";

describe("everyText", () => {
  test.each([
    ["FREQ=WEEKLY;BYDAY=SU", "Every Sun"],
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=WE", "Every other Wed"],
    ["FREQ=WEEKLY;BYDAY=MO,WE", "Every Mon, Wed"],
    ["FREQ=DAILY", "Every day"],
    ["FREQ=MONTHLY;INTERVAL=3", "Every 3 months"],
  ])("%s reads %s", (rule, text) => expect(everyText(rule)).toBe(text));
});

test("on-the-hour times drop :00", () => {
  expect(clockTime("14:00:00")).toBe("2 PM");
  expect(clockTime("09:30:00")).toBe("9:30 AM");
  expect(clockTime("00:00:00")).toBe("12 AM");
});

describe("rowMeta", () => {
  const row = (fields: Partial<PreviewRow>): PreviewRow => ({ kind: "event", ...fields });

  test.each<[Partial<PreviewRow>, string]>([
    [
      { date: "2026-11-26", start_time: "09:00:00", end_time: "16:00:00" },
      "Thu, Nov 26 · 9 AM – 4 PM",
    ],
    [{ rrule: "FREQ=WEEKLY;BYDAY=SU", last_date: "2026-11-08" }, "Every Sun · last on Nov 8"],
    [{ rrule: "FREQ=WEEKLY;BYDAY=SU", from_date: "2026-10-04" }, "Every Sun · from Oct 4"],
    [{ date: "2026-11-15", and_later: true }, "Sun, Nov 15 and later"],
    [
      { kind: "moved_occurrence", date: "2026-11-29", moved_to: "2026-11-28" },
      "Nov 29 → Sat, Nov 28",
    ],
    [{ kind: "task", date: "2026-11-04" }, "Nov 4"],
    [{ kind: "routine_step", context: "Weekly reset" }, "Weekly reset"],
    [{ kind: "schedules", counts: [{ of: "schedules", count: 2 }] }, "2"],
    [
      {
        kind: "history",
        counts: [
          { of: "logs", count: 286 },
          { of: "days", count: 104 },
        ],
      },
      "286 logs · 104 days",
    ],
    [
      {
        kind: "task",
        finished: true,
        counts: [
          { of: "done", count: 9 },
          { of: "cancelled", count: 1 },
        ],
      },
      "9 done · 1 cancelled",
    ],
  ])("%o", (fields, text) => expect(rowMeta(row(fields))).toBe(text));

  test("rows without a name of their own are named by their kind", () => {
    expect(rowName({ kind: "skipped_occurrence", title: null })).toBe("Skipped occurrence");
    expect(rowName({ kind: "task", title: "Update resume" })).toBe("Update resume");
  });
});
