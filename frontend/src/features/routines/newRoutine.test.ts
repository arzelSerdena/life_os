import { describe, expect, it } from "vitest";
import { moveRoutine, newRoutineMissing, type StepDraft } from "./newRoutine";

const step = (title: string, lifeAreaId: number | null): StepDraft => ({
  key: 1,
  title,
  owner: { lifeAreaId, projectId: null },
});

describe("newRoutineMissing", () => {
  it("asks for a name first", () => {
    expect(newRoutineMissing("  ", [step("Read", null)])).toBe("Add a name");
  });

  it("asks for each step's owner", () => {
    expect(newRoutineMissing("Evening", [step("Floss", 1), step("Read", null)])).toBe(
      "Pick an owner for “Read”",
    );
  });

  it("allows a routine with no steps", () => {
    expect(newRoutineMissing("Evening", [])).toBeNull();
  });
});

describe("moveRoutine", () => {
  it("drops a routine dragged down after the row it lands on", () => {
    expect(moveRoutine([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
  });

  it("drops a routine dragged up before the row it lands on", () => {
    expect(moveRoutine([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3]);
  });

  it("keeps the order for an unknown routine", () => {
    expect(moveRoutine([1, 2], 9, 2)).toEqual([1, 2]);
  });
});
