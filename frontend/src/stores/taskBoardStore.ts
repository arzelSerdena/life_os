import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BoardGroup } from "../features/tasks/board";

/** The views with a Priority | Area switch. */
export type GroupedView = "all" | "today" | "unscheduled";

export type InboxPanel = "areas" | "calendar" | "priority";

type TaskBoardState = {
  groups: Record<GroupedView, BoardGroup>;
  /** Collapsed subgroups, as "view/column/subgroup" keys. */
  collapsed: string[];
  /** The Inbox's right container: file by area, by date or by priority. */
  inboxPanel: InboxPanel;
  setInboxPanel: (panel: InboxPanel) => void;
  setGroup: (view: GroupedView, group: BoardGroup) => void;
  toggleCollapsed: (key: string) => void;
};

/** Each Tasks view's grouping and collapsed subgroups, remembered in the browser. */
export const useTaskBoard = create<TaskBoardState>()(
  persist(
    (set) => ({
      groups: { all: "priority", today: "priority", unscheduled: "priority" },
      collapsed: [],
      inboxPanel: "areas",
      setInboxPanel: (inboxPanel) => set({ inboxPanel }),
      setGroup: (view, group) => set((state) => ({ groups: { ...state.groups, [view]: group } })),
      toggleCollapsed: (key) =>
        set((state) => ({
          collapsed: state.collapsed.includes(key)
            ? state.collapsed.filter((item) => item !== key)
            : [...state.collapsed, key],
        })),
    }),
    { name: "life-os-task-board", storage: createJSONStorage(() => localStorage) },
  ),
);
