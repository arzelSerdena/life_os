import { create } from "zustand";
import type { TaskSpot } from "../features/tasks/newTask";

type NewTaskState = {
  /** What New task starts with while it is open; null when closed. */
  spot: TaskSpot | null;
  /** The server's today where the opener knows it (it follows Settings › Day ends at). */
  today: string | null;
  open: (spot?: TaskSpot, today?: string) => void;
  close: () => void;
};

/** The New task pop-up, opened from New task and the board's + buttons. */
export const useNewTask = create<NewTaskState>()((set) => ({
  spot: null,
  today: null,
  open: (spot = {}, today) => set({ spot, today: today ?? null }),
  close: () => set({ spot: null, today: null }),
}));
