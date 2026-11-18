import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type CalendarFilters,
  type CalendarView,
  DEFAULT_FILTERS,
  type InboxMode,
} from "../features/calendar/calendar";

export type CalendarPanel = "agenda" | "inbox";

type CalendarState = {
  view: CalendarView;
  /** Any day inside the shown period; null shows today's. Not remembered. */
  anchor: string | null;
  /** The right panel, or null when it is hidden. */
  panel: CalendarPanel | null;
  inboxMode: InboxMode;
  filters: CalendarFilters;
  setView: (view: CalendarView) => void;
  setAnchor: (anchor: string | null) => void;
  setPanel: (panel: CalendarPanel | null) => void;
  setInboxMode: (mode: InboxMode) => void;
  setFilters: (filters: CalendarFilters) => void;
};

/** The Calendar's view, panel and sidebar filters, remembered; it always opens on today. */
export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      view: "week",
      anchor: null,
      panel: "agenda",
      inboxMode: "scheduled",
      filters: DEFAULT_FILTERS,
      setView: (view) => set({ view }),
      setAnchor: (anchor) => set({ anchor }),
      setPanel: (panel) => set({ panel }),
      setInboxMode: (inboxMode) => set({ inboxMode }),
      setFilters: (filters) => set({ filters }),
    }),
    {
      name: "life-os.calendar",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ view, panel, inboxMode, filters }) => ({ view, panel, inboxMode, filters }),
      // Filters saved before a new SHOW option existed get its default.
      merge: (saved, current) => {
        const state = { ...current, ...(saved as Partial<CalendarState>) };
        const filters = state.filters ?? DEFAULT_FILTERS;
        return {
          ...state,
          filters: {
            ...DEFAULT_FILTERS,
            ...filters,
            show: { ...DEFAULT_FILTERS.show, ...filters.show },
          },
        };
      },
    },
  ),
);
