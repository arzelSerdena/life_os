import { useEffect } from "react";
import { canUsePageKey } from "../../keyboard";
import { useCalendarStore } from "../../stores/calendarStore";
import { type CalendarView, stepAnchor } from "./calendar";

const VIEW_KEYS: Record<string, CalendarView> = {
  "1": "week",
  "2": "month",
  "3": "quarter",
  "4": "year",
};

/** What a key does in the Calendar: switch the view, go to today or move the period. */
export type CalendarKeyAction =
  | { kind: "view"; view: CalendarView }
  | { kind: "anchor"; anchor: string | null };

export function calendarKeyAction(
  key: string,
  view: CalendarView,
  anchor: string,
  dayCount = 3,
): CalendarKeyAction | null {
  const nextView = VIEW_KEYS[key];
  if (nextView) return { kind: "view", view: nextView };
  if (key.toLowerCase() === "t") return { kind: "anchor", anchor: null };
  if (key === "ArrowLeft")
    return { kind: "anchor", anchor: stepAnchor(view, anchor, -1, dayCount) };
  if (key === "ArrowRight")
    return { kind: "anchor", anchor: stepAnchor(view, anchor, 1, dayCount) };
  return null;
}

/**
 * The Calendar's keys: 1–4 switch Week / Month / Quarter / Year, T goes to today, ← → move
 * the period. They wait while typing or while a pop-up is open, and arrows leave widgets
 * that use them (the view switch, a dragged item) alone.
 */
export function useCalendarKeys(anchor: string): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!canUsePageKey(event) || event.shiftKey) return;
      const { view, dayCount, setView, setAnchor } = useCalendarStore.getState();
      const action = calendarKeyAction(event.key, view, anchor, dayCount);
      if (!action) return;
      event.preventDefault();
      if (action.kind === "view") setView(action.view);
      else setAnchor(action.anchor);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor]);
}
