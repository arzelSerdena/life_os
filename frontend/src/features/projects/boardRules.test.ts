import { expect, test } from "vitest";
import type { SectionRead } from "../../client/types.gen";
import { taskRead as task } from "../../test-utils";
import { resolveFilters, sectionShown } from "../tasks/filters";
import { spotFor } from "../tasks/newTask";
import { applyDropChange, buildProjectColumns, dropChange, dropMessage } from "./boardRules";

const sections: SectionRead[] = [
  { id: 5, project_id: 7, title: "Writing", sort_order: 1 },
  { id: 4, project_id: 7, title: "Research", sort_order: 0 },
];
const owned = { life_area_id: 1, project_id: 7 };

test("Priority columns split by section, in section order with No section last", () => {
  const research = task({ ...owned, priority: "high", section_id: 4 });
  const loose = task({ ...owned, priority: "high", section_id: null });
  const writing = task({ ...owned, priority: "high", section_id: 5 });
  const low = task({ ...owned, priority: "low", section_id: 5, status: "done" });

  const columns = buildProjectColumns(
    [research, loose, writing, low],
    sections,
    "priority",
    "section",
  );
  expect(columns.map((column) => column.title)).toEqual(["High", "Medium", "Low", "No priority"]);
  expect(columns[0].subgroups.map((s) => [s.label, s.tasks.map((t) => t.id)])).toEqual([
    ["Research", [research.id]],
    ["Writing", [writing.id]],
    ["No section", [loose.id]],
  ]);
  // Counts are open tasks only; empty subgroups are left out.
  expect(columns[2].count).toBe(0);
  expect(columns[1].subgroups).toEqual([]);
});

test("Section columns start with No section, then each section in order", () => {
  const a = task({ ...owned, section_id: 5, priority: "medium" });
  const b = task({ ...owned, section_id: null });
  const columns = buildProjectColumns([a, b], sections, "section", "priority");
  expect(columns.map((column) => column.key)).toEqual(["no-section", "section-4", "section-5"]);
  expect(columns[0].count).toBe(1);
  expect(columns[2].subgroups.map((s) => s.label)).toEqual(["Medium"]);
});

test("A drop changes only what differs, and nothing on its own spot", () => {
  const t = task({ ...owned, priority: "low", section_id: 4 });
  expect(dropChange(t, "low", "section-4")).toBeNull();
  expect(dropChange(t, "high", null)).toEqual({ priority: "high" });
  expect(dropChange(t, "high", "no-section")).toEqual({ priority: "high", sectionId: null });
  expect(dropChange(t, "section-5", "priority-low")).toEqual({ sectionId: 5 });
  expect(applyDropChange(t, { sectionId: null })).toMatchObject({
    section_id: null,
    priority: "low",
  });
});

test("The toast names the new section and priority", () => {
  const t = task({ ...owned, title: "Draft" });
  expect(dropMessage(t, { priority: "high" }, sections)).toBe("Set “Draft” · High priority");
  expect(dropMessage(t, { sectionId: 5, priority: "none" }, sections)).toBe(
    "Moved “Draft” · Writing · No priority",
  );
  expect(dropMessage(t, { sectionId: null }, sections)).toBe("Moved “Draft” · No section");
});

test("A section + fills in the project and the section", () => {
  const base = { lifeAreaId: 1, projectId: 7 };
  expect(spotFor("high", "section-4", [], base)).toEqual({
    ...base,
    priority: "high",
    sectionId: 4,
  });
  expect(spotFor("no-section", "priority-low", [], base)).toEqual({
    ...base,
    sectionId: null,
    priority: "low",
  });
});

test("The project board's menu: Section subgroups, a Section filter and no area filter", () => {
  const filters = resolveFilters("project", "priority", { hiddenSections: ["none"] });
  expect(filters.subgroup).toBe("section");
  expect(resolveFilters("project", "section", undefined).subgroup).toBe("priority");
  expect(filters.hiddenAreas).toEqual([]);
  expect(sectionShown(filters, task({ ...owned, section_id: null }))).toBe(false);
  expect(sectionShown(filters, task({ ...owned, section_id: 4 }))).toBe(true);
  // Other views ignore a stored section filter.
  expect(resolveFilters("all", "priority", { hiddenSections: [4] }).hiddenSections).toEqual([]);
});
