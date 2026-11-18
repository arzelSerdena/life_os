/** Shared rules for the app's keyboard shortcuts. */

export type KeyInfo = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat"
>;

/** The press is in a text field, where single keys type instead of acting. */
export function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** A pop-up, picker or menu is open; page shortcuts wait until it closes. */
export function isOverlayOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]') !== null;
}

/** Ctrl (⌘ on a Mac) with `key`, and no Alt or Shift. */
export function isModKey(event: KeyInfo, key: string): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === key
  );
}

/** A key pressed on its own (Shift allowed, for `?`), not held down. */
export function isPlainKey(event: KeyInfo): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat;
}

// Arrow keys already move inside these, so the Calendar's ← → leave them alone.
const ARROW_WIDGETS =
  '[role="toolbar"], [role="radiogroup"], [role="listbox"], [role="grid"], [role="tablist"], [role="slider"], [aria-roledescription="draggable"]';

/** A single-key page shortcut may act: not typing, no pop-up open, no arrow widget focused. */
export function canUsePageKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || !isPlainKey(event) || isEditable(event.target)) return false;
  if (isOverlayOpen()) return false;
  if (event.key.startsWith("Arrow")) {
    return !(event.target instanceof Element && event.target.closest(ARROW_WIDGETS));
  }
  return true;
}
