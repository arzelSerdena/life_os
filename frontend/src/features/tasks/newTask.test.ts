import { expect, test } from "vitest";
import type { ProjectRead } from "../../client/types.gen";
import { simpleRule } from "../pickers/repeat";
import { createRequest, type NewTaskValues, newTaskProblem, spotFor, spotFromKey } from "./newTask";

const TODAY = "2026-11-14";
const projects = [{ id: 7, life_area_id: 3 }] as ProjectRead[];

const blank: NewTaskValues = {
  title: "Tailor resume",
  lifeAreaId: null,
  projectId: null,
  sectionId: null,
  priority: "none",
  scheduledDate: null,
  dueDate: null,
  repeat: null,
  subtasks: [],
};

test("a column or subgroup + fills in its spot", () => {
  expect(spotFromKey("high", projects)).toEqual({ priority: "high" });
  expect(spotFromKey("priority-low", projects)).toEqual({ priority: "low" });
  expect(spotFromKey("area-3", projects)).toEqual({ lifeAreaId: 3 });
  expect(spotFromKey("no-area", projects)).toEqual({ lifeAreaId: null, projectId: null });
  expect(spotFromKey("project-7", projects)).toEqual({ lifeAreaId: 3, projectId: 7 });
  expect(spotFromKey("2026-11-20", projects)).toEqual({ scheduledDate: "2026-11-20" });
  for (const key of ["no-project", "overdue", "all", "no-date", "project-99"]) {
    expect(spotFromKey(key, projects)).toEqual({});
  }
  // The subgroup goes on top of the column, and both on top of the view's base.
  expect(spotFor("medium", "area-3", projects, { scheduledDate: TODAY })).toEqual({
    scheduledDate: TODAY,
    priority: "medium",
    lifeAreaId: 3,
  });
  expect(spotFor("area-3", "project-7", projects)).toEqual({ lifeAreaId: 3, projectId: 7 });
});

test("a one-off task sends its owner, dates and trimmed subtasks", () => {
  expect(
    createRequest(
      {
        ...blank,
        title: "  Tailor resume ",
        projectId: 7,
        lifeAreaId: 3,
        sectionId: 2,
        priority: "high",
        scheduledDate: "2026-11-15",
        subtasks: [" Match keywords ", "", "Export as PDF"],
      },
      TODAY,
    ),
  ).toEqual({
    kind: "task",
    body: {
      title: "Tailor resume",
      priority: "high",
      project_id: 7,
      section_id: 2,
      subtasks: ["Match keywords", "Export as PDF"],
      scheduled_date: "2026-11-15",
      due_date: null,
    },
  });
  expect(createRequest({ ...blank, lifeAreaId: 3 }, TODAY).body).toMatchObject({ life_area_id: 3 });
  expect(createRequest(blank, TODAY).body).not.toHaveProperty("life_area_id");
});

test("with a repeat rule it is a recurring task from the scheduled date", () => {
  const values: NewTaskValues = {
    ...blank,
    lifeAreaId: 3,
    scheduledDate: "2026-11-17",
    dueDate: "2026-11-19",
    repeat: { ...simpleRule("weekly", "2026-11-17"), ends: { kind: "after", count: 2 } },
  };
  expect(newTaskProblem(values, TODAY)).toBeNull();
  expect(createRequest(values, TODAY)).toEqual({
    kind: "template",
    body: {
      title: "Tailor resume",
      priority: "none",
      subtasks: [],
      life_area_id: 3,
      rrule: "FREQ=WEEKLY;BYDAY=TU",
      repeat_from: "schedule",
      starts_on: "2026-11-17",
      ends_on: "2026-11-24",
      due_offset_days: 2,
    },
  });
  // No dates: it starts today with no due date.
  expect(createRequest({ ...blank, repeat: simpleRule("daily", TODAY) }, TODAY).body).toMatchObject(
    { starts_on: TODAY, due_offset_days: null, ends_on: null },
  );
  // Due before the scheduled date has no offset to store.
  expect(newTaskProblem({ ...values, dueDate: "2026-11-16" }, TODAY)).toMatch(/can't be due/);
  expect(newTaskProblem({ ...values, repeat: null, dueDate: "2026-11-16" }, TODAY)).toBeNull();
});
