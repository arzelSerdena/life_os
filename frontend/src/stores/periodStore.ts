import { create } from "zustand";
import { type Period, shiftPeriod, today } from "../period";

type PeriodState = {
  period: Period;
  /** Any date inside the shown period. */
  date: string;
  setPeriod: (period: Period) => void;
  shift: (steps: number) => void;
};

/** One period for the whole screen, kept while moving between the overview and area pages. */
export const usePeriodStore = create<PeriodState>()((set) => ({
  period: "quarter",
  date: today(),
  setPeriod: (period) => set({ period }),
  shift: (steps) => set((state) => ({ date: shiftPeriod(state.period, state.date, steps) })),
}));
