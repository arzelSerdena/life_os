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
  /** Number of days shown in "days" view (2–14). */
  dayCount: number;
  /** Whether Days / Week shows the hourly time grid. */
  timed: boolean;
  /** Any day inside the shown period; null shows today's. Not remembered. */
  anchor: string | null;
  /** The right panel, or null when it is hidden. */
  panel: CalendarPanel | null;
  /** Remembered panel kind so toggling back on restores Agenda or Inbox. */
  lastPanel: CalendarPanel;
  inboxMode: InboxMode;
  filters: CalendarFilters;
  setView: (view: CalendarView) => void;
  setDayCount: (dayCount: number) => void;
  setTimed: (timed: boolean) => void;
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
      dayCount: 3,
      timed: false,
      anchor: null,
      panel: "agenda",
      lastPanel: "agenda",
      inboxMode: "scheduled",
      filters: DEFAULT_FILTERS,
      setView: (view) => set({ view }),
      setDayCount: (dayCount) => set({ dayCount }),
      setTimed: (timed) => set({ timed }),
      setAnchor: (anchor) => set({ anchor }),
      setPanel: (panel) => set((state) => ({ panel, lastPanel: panel ?? state.lastPanel })),
      setInboxMode: (inboxMode) => set({ inboxMode }),
      setFilters: (filters) => set({ filters }),
    }),
    {
      name: "life-os.calendar",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ view, dayCount, timed, panel, lastPanel, inboxMode, filters }) => ({
        view,
        dayCount,
        timed,
        panel,
        lastPanel,
        inboxMode,
        filters,
      }),
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
