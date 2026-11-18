import type { PanelTarget } from "../../stores/detailPanelStore";
import { projectPath } from "../projects/paths";

/**
 * Whatever has a ⋯ menu: everything the detail panel opens, plus routines and routine steps
 * (edited on the routine page). A step names its routine, whose page holds the step's data.
 */
export type ItemTarget =
  | PanelTarget
  | { kind: "routine"; id: number }
  | { kind: "step"; id: number; routineId: number };

/** The attribute a right-click looks for. */
export const ITEM_MENU_ATTRIBUTE = "data-item-menu";

/** "task:12", "event:5:2026-11-18" (a repeating event's occurrence), "step:7:3". */
export function encodeItem(target: ItemTarget): string {
  switch (target.kind) {
    case "event":
      return `event:${target.id}:${target.day ?? ""}`;
    case "step":
      return `step:${target.id}:${target.routineId}`;
    default:
      return `${target.kind}:${target.id}`;
  }
}

const SIMPLE = ["area", "project", "task", "template", "metric", "routine"] as const;

export function decodeItem(value: string | null | undefined): ItemTarget | null {
  if (!value) return null;
  const [kind, rawId, extra] = value.split(":");
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (kind === "event") return { kind, id, day: extra || null };
  if (kind === "step") {
    const routineId = Number(extra);
    return Number.isInteger(routineId) && routineId > 0 ? { kind, id, routineId } : null;
  }
  const simple = SIMPLE.find((name) => name === kind);
  return simple ? { kind: simple, id } : null;
}

/** Spread onto a row, card, bar or heatmap square so right-clicking it opens the item's ⋯ menu. */
export function itemMenuProps(target: ItemTarget) {
  return { [ITEM_MENU_ATTRIBUTE]: encodeItem(target) };
}

/** The item's own page, if it has one: there, deleting or archiving it leaves the page. */
export function itemPagePath(target: ItemTarget): string | null {
  switch (target.kind) {
    case "area":
      return `/areas/${target.id}`;
    case "project":
      return projectPath(target.id);
    case "routine":
      return `/areas/routines/${target.id}`;
    default:
      return null;
  }
}
