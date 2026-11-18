import { create } from "zustand";

/** Which keyboard pop-up is open: the Ctrl K palette or the `?` shortcuts list. */
export type CommandOverlay = "palette" | "shortcuts";

type CommandState = {
  open: CommandOverlay | null;
  show: (overlay: CommandOverlay) => void;
  close: () => void;
};

export const useCommands = create<CommandState>()((set) => ({
  open: null,
  show: (open) => set({ open }),
  close: () => set({ open: null }),
}));
