import { useEffect } from "react";
import { isEditable, isOverlayOpen, type KeyInfo } from "../../keyboard";
import { useNewTask } from "../../stores/newTaskStore";
import type { TaskSpot } from "./newTask";

/**
 * Whether a key press asks for New task: Ctrl N (⌘ N on a Mac) anywhere, or N on its own
 * outside a text field. Browser tabs keep Ctrl N for a new window, so N is the one that works
 * there; the desktop app gets both.
 */
export function isNewTaskKey(event: KeyInfo, isTyping: boolean): boolean {
  if (event.key.toLowerCase() !== "n" || event.altKey || event.shiftKey || event.repeat) {
    return false;
  }
  if (event.ctrlKey || event.metaKey) return true;
  return !isTyping;
}

/** Ctrl N or N opens New task on every screen, with the page's spot where it has one. */
export function useNewTaskShortcut(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isNewTaskKey(event, isEditable(event.target))) return;
      event.preventDefault();
      const state = useNewTask.getState();
      if (state.spot !== null || isOverlayOpen()) return;
      state.open(state.page?.spot, state.page?.today ?? undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Tells Ctrl N what the page's New task button opens with (Today schedules today), so the
 * shortcut adds the task where the person is looking. Cleared when the page goes.
 */
export function usePageSpot(spot: TaskSpot, today: string | undefined): void {
  const key = JSON.stringify(spot);
  useEffect(() => {
    const setPage = useNewTask.getState().setPage;
    setPage({ spot: JSON.parse(key) as TaskSpot, today: today ?? null });
    return () => setPage(null);
  }, [key, today]);
}
