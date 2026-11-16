import { describe, expect, it } from "vitest";
import { isNewTaskKey } from "./newTaskShortcut";

const key = (overrides: Partial<Parameters<typeof isNewTaskKey>[0]> = {}) => ({
  key: "n",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  ...overrides,
});

describe("isNewTaskKey", () => {
  it("takes Ctrl N and ⌘ N, even while typing", () => {
    expect(isNewTaskKey(key({ ctrlKey: true }), true)).toBe(true);
    expect(isNewTaskKey(key({ metaKey: true, key: "N" }), false)).toBe(true);
  });

  it("takes N on its own only outside a text field", () => {
    expect(isNewTaskKey(key(), false)).toBe(true);
    expect(isNewTaskKey(key(), true)).toBe(false);
  });

  it("leaves other keys, Shift, Alt and held keys alone", () => {
    expect(isNewTaskKey(key({ key: "b", ctrlKey: true }), false)).toBe(false);
    expect(isNewTaskKey(key({ ctrlKey: true, shiftKey: true }), false)).toBe(false);
    expect(isNewTaskKey(key({ altKey: true }), false)).toBe(false);
    expect(isNewTaskKey(key({ repeat: true }), false)).toBe(false);
  });
});
