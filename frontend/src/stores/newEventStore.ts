import { create } from "zustand";
import type { EventSpot } from "../features/events/newEvent";

type NewEventState = {
  /** What New event starts with while it is open; null when closed. */
  spot: EventSpot | null;
  /** The server's today where the opener knows it (it follows Settings › Day ends at). */
  today: string | null;
  open: (spot?: EventSpot, today?: string) => void;
  close: () => void;
};

/** The New event pop-up, opened from the Calendar and an area's Add menu. */
export const useNewEvent = create<NewEventState>()((set) => ({
  spot: null,
  today: null,
  open: (spot = {}, today) => set({ spot, today: today ?? null }),
  close: () => set({ spot: null, today: null }),
}));
