import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 320;
/** Dragging narrower than this collapses the sidebar. */
export const SIDEBAR_COLLAPSE_WIDTH = 160;

export const DEFAULT_RAIL_ORDER = ["/tasks", "/calendar", "/areas"];
export const DEFAULT_TASKS_NAV_ORDER = [
  "/tasks/inbox",
  "/tasks/today",
  "/tasks/unscheduled",
  "/tasks/next-7-days",
  "/tasks/routines",
];

/** Keeps saved order for known keys and appends any new defaults. */
export function mergeOrder(saved: readonly string[] | undefined, defaults: readonly string[]) {
  const known = new Set(defaults);
  const kept = (saved ?? []).filter((key) => known.has(key));
  const missing = defaults.filter((key) => !kept.includes(key));
  return [...kept, ...missing];
}

type SidebarState = {
  /** The user hid the sidebar. Remembered. */
  collapsed: boolean;
  width: number;
  railOrder: string[];
  tasksNavOrder: string[];
  tasksProjectOrder: number[];
  setCollapsed: (collapsed: boolean) => void;
  setWidth: (width: number) => void;
  setRailOrder: (order: string[]) => void;
  setTasksNavOrder: (order: string[]) => void;
  setTasksProjectOrder: (order: number[]) => void;
};

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      width: SIDEBAR_DEFAULT_WIDTH,
      railOrder: DEFAULT_RAIL_ORDER,
      tasksNavOrder: DEFAULT_TASKS_NAV_ORDER,
      tasksProjectOrder: [],
      setCollapsed: (collapsed) => set({ collapsed }),
      setWidth: (width) =>
        set({ width: Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH) }),
      setRailOrder: (railOrder) => set({ railOrder }),
      setTasksNavOrder: (tasksNavOrder) => set({ tasksNavOrder }),
      setTasksProjectOrder: (tasksProjectOrder) => set({ tasksProjectOrder }),
    }),
    {
      name: "life-os-sidebar",
      // Storage can be unavailable (private windows, tests); the sidebar then just isn't remembered.
      storage: createJSONStorage(() => localStorage),
      partialize: ({ collapsed, width, railOrder, tasksNavOrder, tasksProjectOrder }) => ({
        collapsed,
        width,
        railOrder,
        tasksNavOrder,
        tasksProjectOrder,
      }),
    },
  ),
);
