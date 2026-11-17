import type { Owner } from "../pickers/OwnerPicker";

/** A step typed into New routine, before the routine exists. */
export type StepDraft = { key: number; title: string; owner: Owner };

/** Why Create routine is disabled, or null when it can be created. */
export function newRoutineMissing(title: string, steps: readonly StepDraft[]): string | null {
  if (!title.trim()) return "Add a name";
  const ownerless = steps.find(
    (step) => step.owner.lifeAreaId === null && step.owner.projectId === null,
  );
  if (ownerless) return `Pick an owner for “${ownerless.title}”`;
  return null;
}

/** The routine ids in their new order after dragging one onto another's place. */
export function moveRoutine(ids: readonly number[], from: number, to: number): number[] {
  const order = ids.filter((id) => id !== from);
  const at = order.indexOf(to);
  if (at === -1 || !ids.includes(from)) return [...ids];
  // Dragging down lands after the row it is dropped on; dragging up, before it.
  order.splice(ids.indexOf(from) < ids.indexOf(to) ? at + 1 : at, 0, from);
  return order;
}
