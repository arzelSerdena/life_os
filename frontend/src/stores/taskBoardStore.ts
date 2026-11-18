import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ProjectGroup } from "../features/projects/boardRules";
import type { BoardGroup } from "../features/tasks/board";
import type { FilterView, StoredFilters } from "../features/tasks/filters";

/** The views with a Priority | Area switch. */
export type GroupedView = "all" | "today" | "unscheduled";

export type InboxPanel = "areas" | "calendar" | "priority";

type TaskBoardState = {
  groups: Record<GroupedView, BoardGroup>;
  /** A project page's Board columns: Priority or Section (one choice for every project). */
  projectGroup: ProjectGroup;
  /** Collapsed subgroups, as "view/column/subgroup" keys. */
  collapsed: string[];
  /** The Inbox's right container: file by area, by date or by priority. */
  inboxPanel: InboxPanel;
  /** Each view's filter-and-sort choices; missing ones take the view's defaults. */
  filters: Partial<Record<FilterView, StoredFilters>>;
  setFilters: (view: FilterView, change: (current: StoredFilters) => StoredFilters) => void;
  setInboxPanel: (panel: InboxPanel) => void;
  setGroup: (view: GroupedView, group: BoardGroup) => void;
  setProjectGroup: (group: ProjectGroup) => void;
  toggleCollapsed: (key: string) => void;
};

/** Each Tasks view's grouping, filters, sort and collapsed subgroups, remembered in the browser. */
export const useTaskBoard = create<TaskBoardState>()(
  persist(
    (set) => ({
      groups: { all: "priority", today: "priority", unscheduled: "priority" },
      projectGroup: "priority",
      collapsed: [],
      inboxPanel: "areas",
      filters: {},
      setFilters: (view, change) =>
        set((state) => ({
          filters: { ...state.filters, [view]: change(state.filters[view] ?? {}) },
        })),
      setInboxPanel: (inboxPanel) => set({ inboxPanel }),
      setGroup: (view, group) => set((state) => ({ groups: { ...state.groups, [view]: group } })),
      setProjectGroup: (projectGroup) => set({ projectGroup }),
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
