import { create } from "zustand";
import type { TaskSpot } from "../features/tasks/newTask";

/** What the page's own New task button would open, for Ctrl N. */
export type PageSpot = { spot: TaskSpot; today: string | null };

type NewTaskState = {
  /** What New task starts with while it is open; null when closed. */
  spot: TaskSpot | null;
  /** The server's today where the opener knows it (it follows Settings › Day ends at). */
  today: string | null;
  /** The shown page's spot (set by pages with a New task button); null elsewhere. */
  page: PageSpot | null;
  open: (spot?: TaskSpot, today?: string) => void;
  close: () => void;
  setPage: (page: PageSpot | null) => void;
};

/** The New task pop-up, opened from New task, the board's + buttons and Ctrl N. */
export const useNewTask = create<NewTaskState>()((set) => ({
  spot: null,
  today: null,
  page: null,
  open: (spot = {}, today) => set({ spot, today: today ?? null }),
  close: () => set({ spot: null, today: null }),
  setPage: (page) => set({ page }),
}));
