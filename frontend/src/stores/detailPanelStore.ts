import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** What the detail panel shows. Events open on one occurrence, named by its original date. */
export type PanelTarget =
  | { kind: "area"; id: number }
  | { kind: "project"; id: number }
  | { kind: "task"; id: number }
  | { kind: "template"; id: number }
  | { kind: "event"; id: number; day: string | null }
  | { kind: "metric"; id: number }
  | { kind: "routine"; id: number }
  | { kind: "step"; id: number; routineId: number };

export const PANEL_MIN_WIDTH = 360;
export const PANEL_MAX_WIDTH = 560;
export const PANEL_DEFAULT_WIDTH = 400;

type DetailPanelState = {
  target: PanelTarget | null;
  width: number;
  open: (target: PanelTarget) => void;
  close: () => void;
  setWidth: (width: number) => void;
};

export function clampPanelWidth(width: number): number {
  return Math.round(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, width)));
}

/** The detail panel's open item and its width. Only the width is remembered. */
export const useDetailPanel = create<DetailPanelState>()(
  persist(
    (set) => ({
      target: null,
      width: PANEL_DEFAULT_WIDTH,
      open: (target) => set({ target }),
      close: () => set({ target: null }),
      setWidth: (width) => set({ width: clampPanelWidth(width) }),
    }),
    {
      name: "life-os.detail-panel",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ width: state.width }),
    },
  ),
);

/** Spread onto anything that opens the panel, so clicking it doesn't count as clicking away. */
export const PANEL_OPENER = { "data-panel-opener": "" } as const;
