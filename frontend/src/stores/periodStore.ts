import { create } from "zustand";
import { type Period, shiftPeriod, today } from "../period";

type PeriodState = {
  period: Period;
  /** Any date inside the shown period. */
  date: string;
  setPeriod: (period: Period) => void;
  /** Shows the period that contains `date`, such as an archived routine's archive day. */
  setDate: (date: string) => void;
  shift: (steps: number) => void;
};

/** One period for the whole screen, kept while moving between the overview and area pages. */
export const usePeriodStore = create<PeriodState>()((set) => ({
  period: "quarter",
  date: today(),
  setPeriod: (period) => set({ period }),
  setDate: (date) => set({ date }),
  shift: (steps) => set((state) => ({ date: shiftPeriod(state.period, state.date, steps) })),
}));
