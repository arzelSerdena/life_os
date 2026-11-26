import { create } from "zustand";

/**
 * A change that was applied. With a batch, Undo restores it; without one (a confirmed
 * delete) the toast only reports it.
 */
export type AppliedChange = {
  key: number;
  /** Shown in the toast: Completed “Resume & portfolio”. */
  message: string;
  batchId: string | null;
  /** Batches applied before `batchId` as part of the same change; Undo restores them after it. */
  earlierBatchIds: string[];
  /** Undo for a change kept in the browser (Reset layout), with no batch. */
  onUndo?: () => void;
  /** Informational notice (e.g. "Cannot drag routines"), shown briefly without Undo. */
  isNotice?: boolean;
};

type ChangeToastState = {
  change: AppliedChange | null;
  /** Undo failed: the message to show instead. */
  failure: { message: string; error: unknown } | null;
  show: (message: string, batchId: string | null, earlierBatchIds?: string[]) => void;
  /** Shows a change made in the browser, which `onUndo` puts back. */
  showLocal: (message: string, onUndo: () => void) => void;
  /** Shows a brief notice in the toast position (e.g. "Cannot drag routines"). */
  showNotice: (message: string) => void;
  /** Hides the toast; with a key, only if that change is still the one shown. */
  dismiss: (key?: number) => void;
  fail: (message: string, error: unknown) => void;
};

/** How long the toast offers Undo. The change itself is already saved. */
export const CHANGE_TOAST_MS = 6000;

let timer: ReturnType<typeof setTimeout> | undefined;
let nextKey = 0;

export const useChangeToast = create<ChangeToastState>()((set, get) => ({
  change: null,
  failure: null,
  show: (message, batchId, earlierBatchIds = []) => {
    clearTimeout(timer);
    const key = nextKey++;
    set({ change: { key, message, batchId, earlierBatchIds }, failure: null });
    timer = setTimeout(() => get().dismiss(key), CHANGE_TOAST_MS);
  },
  showLocal: (message, onUndo) => {
    clearTimeout(timer);
    const key = nextKey++;
    set({ change: { key, message, batchId: null, earlierBatchIds: [], onUndo }, failure: null });
    timer = setTimeout(() => get().dismiss(key), CHANGE_TOAST_MS);
  },
  showNotice: (message) => {
    clearTimeout(timer);
    const key = nextKey++;
    set({
      change: { key, message, batchId: null, earlierBatchIds: [], isNotice: true },
      failure: null,
    });
    timer = setTimeout(() => get().dismiss(key), 2500);
  },
  dismiss: (key) => {
    if (key !== undefined && get().change?.key !== key) return;
    clearTimeout(timer);
    set({ change: null, failure: null });
  },
  fail: (message, error) => {
    clearTimeout(timer);
    set({ change: null, failure: { message, error } });
  },
}));
