import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ProjectsGroup, ProjectsSort } from "../features/projects/overview";

type ProjectsOverviewState = {
  /** The Projects board's columns, order and finished projects. Remembered. */
  group: ProjectsGroup;
  sort: ProjectsSort;
  showFinished: boolean;
  setGroup: (group: ProjectsGroup) => void;
  setSort: (sort: ProjectsSort) => void;
  toggleFinished: () => void;
};

export const useProjectsOverviewStore = create<ProjectsOverviewState>()(
  persist(
    (set) => ({
      group: "area",
      sort: "due",
      showFinished: true,
      setGroup: (group) => set({ group }),
      setSort: (sort) => set({ sort }),
      toggleFinished: () => set((state) => ({ showFinished: !state.showFinished })),
    }),
    {
      name: "life-os-projects-overview",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ group, sort, showFinished }) => ({ group, sort, showFinished }),
    },
  ),
);
