import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type HomeCardId = "today" | "routines" | "log" | "dump" | "calendar" | "push" | "coming";

export type HomeColumns = [HomeCardId[], HomeCardId[], HomeCardId[]];
export type HomeColumnRatios = [number, number, number];

const DEFAULT_COLUMNS: HomeColumns = [
  ["today"],
  ["routines", "log", "dump"],
  ["calendar", "push", "coming"],
];

export const DEFAULT_COLUMN_RATIOS: HomeColumnRatios = [36, 36, 28];

const ALL_CARDS: HomeCardId[] = ["today", "routines", "log", "dump", "calendar", "push", "coming"];

type HomeState = {
  dumpNote: string;
  columns: HomeColumns;
  columnRatios: HomeColumnRatios;
  setDumpNote: (dumpNote: string) => void;
  setColumns: (columns: HomeColumns) => void;
  setColumnRatios: (ratios: HomeColumnRatios) => void;
  resetColumnRatios: () => void;
};

/** Reconcile saved columns so newly added cards appear even for existing localStorage state. */
function normalizeColumns(saved: HomeColumns | undefined): HomeColumns {
  if (saved?.length !== 3) return DEFAULT_COLUMNS;
  const seen = new Set<HomeCardId>();
  const cols: HomeColumns = [[], [], []];
  for (let i = 0; i < 3; i++) {
    for (const id of saved[i] ?? []) {
      if (ALL_CARDS.includes(id) && !seen.has(id)) {
        seen.add(id);
        cols[i].push(id);
      }
    }
  }
  for (const id of ALL_CARDS) {
    if (!seen.has(id)) {
      const targetCol = DEFAULT_COLUMNS.findIndex((col) => col.includes(id));
      cols[targetCol === -1 ? 1 : targetCol].push(id);
    }
  }
  return cols;
}

function normalizeRatios(saved: HomeColumnRatios | undefined): HomeColumnRatios {
  if (saved?.length !== 3 || saved.some((n) => !Number.isFinite(n) || n < 15)) {
    return DEFAULT_COLUMN_RATIOS;
  }
  return saved;
}

export const useHomeStore = create<HomeState>()(
  persist(
    (set) => ({
      dumpNote: "",
      columns: DEFAULT_COLUMNS,
      columnRatios: DEFAULT_COLUMN_RATIOS,
      setDumpNote: (dumpNote) => set({ dumpNote }),
      setColumns: (columns) => set({ columns }),
      setColumnRatios: (columnRatios) => set({ columnRatios }),
      resetColumnRatios: () => set({ columnRatios: DEFAULT_COLUMN_RATIOS }),
    }),
    {
      name: "life-os.home",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<HomeState>) };
        return {
          ...state,
          columns: normalizeColumns(state.columns),
          columnRatios: normalizeRatios(state.columnRatios),
        };
      },
    },
  ),
);
