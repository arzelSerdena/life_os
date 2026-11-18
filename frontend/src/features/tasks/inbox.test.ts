import { expect, test } from "vitest";
import { taskRead as task } from "../../test-utils";
import { addMonths, fileCounts, inboxList, monthGrid, nextMonday } from "./inbox";

test("the Inbox lists open tasks still to be sorted, oldest first", () => {
  const sorted = { life_area_id: 1, scheduled_date: "2026-11-16", priority: "low" as const };
  const noArea = task({ title: "No area", scheduled_date: "2026-11-16", priority: "high" });
  const noDate = task({
    ...sorted,
    title: "No date",
    scheduled_date: null,
    due_date: "2026-11-20",
  });
  const noPriority = task({ ...sorted, title: "No priority", priority: "none" });
  const done = task({ status: "done" });
  const filed = task({ ...sorted, title: "Sorted" });
  const occurrence = task({ ...sorted, title: "Occurrence", template_id: 3, priority: "none" });

  expect(
    inboxList([noPriority, filed, done, noDate, occurrence, noArea]).map((t) => t.title),
  ).toEqual(["No area", "No date", "No priority"]);
});

test("the drop panels count open tasks by area, project, scheduled date and priority", () => {
  const counts = fileCounts([
    task({ life_area_id: 1, project_id: 7, scheduled_date: "2026-11-18", priority: "high" }),
    task({ life_area_id: 1, priority: "high" }),
    task({ life_area_id: 1, status: "done", scheduled_date: "2026-11-18" }),
  ]);

  expect(counts.areas.get(1)).toBe(2);
  expect(counts.projects.get(7)).toBe(1);
  expect(counts.dates.get("2026-11-18")).toBe(1);
  expect(counts.priorities.get("high")).toBe(2);
});

test("the month grid is whole Monday-to-Sunday weeks", () => {
  const weeks = monthGrid("2026-11"); // Nov 1, 2026 is a Sunday
  expect(weeks[0][0]).toBe("2026-10-26");
  expect(weeks[0][6]).toBe("2026-11-01");
  expect(weeks.at(-1)?.[6]).toBe("2026-12-06");
  expect(weeks).toHaveLength(6);
  expect(monthGrid("2027-02")).toHaveLength(4); // Feb 2027 starts on a Monday
});

test("Next week is the coming Monday, and months roll over the year", () => {
  expect(nextMonday("2026-11-16")).toBe("2026-11-23"); // a Monday
  expect(nextMonday("2026-11-22")).toBe("2026-11-23"); // a Sunday
  expect(addMonths("2026-12", 1)).toBe("2027-01");
  expect(addMonths("2026-01", -1)).toBe("2025-12");
});
