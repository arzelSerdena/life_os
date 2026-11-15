import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 320;
/** Dragging narrower than this collapses the sidebar. */
export const SIDEBAR_COLLAPSE_WIDTH = 160;

type SidebarState = {
  /** Docked windows only: the user hid the sidebar. Remembered. */
  collapsed: boolean;
  width: number;
  /** Narrow windows only: the sidebar is open on top of the page. */
  overlayOpen: boolean;
  setCollapsed: (collapsed: boolean) => void;
  setWidth: (width: number) => void;
  setOverlayOpen: (open: boolean) => void;
};

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      width: SIDEBAR_DEFAULT_WIDTH,
      overlayOpen: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      setWidth: (width) =>
        set({ width: Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH) }),
      setOverlayOpen: (overlayOpen) => set({ overlayOpen }),
    }),
    {
      name: "life-os-sidebar",
      // Storage can be unavailable (private windows, tests); the sidebar then just isn't remembered.
      storage: createJSONStorage(() => localStorage),
      partialize: ({ collapsed, width }) => ({ collapsed, width }),
    },
  ),
);
