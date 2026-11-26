import { create } from "zustand";

export type OutcomesSort = "area" | "behind" | "name";
export type OutcomesShow = "good" | "bad" | "untargeted";

type OutcomesCardState = {
  sort: OutcomesSort;
  shown: OutcomesShow[];
  hiddenAreas: number[];
  grouped: boolean;
  setSort: (sort: OutcomesSort) => void;
  toggleShown: (value: OutcomesShow) => void;
  toggleHiddenArea: (areaId: number) => void;
  toggleGrouped: () => void;
};

export const useOutcomesCardStore = create<OutcomesCardState>((set) => ({
  sort: "area",
  shown: ["good", "bad", "untargeted"],
  hiddenAreas: [],
  grouped: true,
  setSort: (sort) => set({ sort }),
  toggleShown: (value) =>
    set((state) => ({
      shown: state.shown.includes(value)
        ? state.shown.filter((item) => item !== value)
        : [...state.shown, value],
    })),
  toggleHiddenArea: (areaId) =>
    set((state) => ({
      hiddenAreas: state.hiddenAreas.includes(areaId)
        ? state.hiddenAreas.filter((id) => id !== areaId)
        : [...state.hiddenAreas, areaId],
    })),
  toggleGrouped: () => set((state) => ({ grouped: !state.grouped })),
}));
