import { create } from "zustand";

/** Items that delete at once with an undo toast instead of asking first. */
export type PendingDeleteKind = "task" | "subtask" | "metric_entry" | "metric_target";

export type PendingDelete = {
  key: string;
  kind: PendingDeleteKind;
  id: number;
  /** Shown in the toast: Deleted “Update resume”. */
  label: string;
  /** The DELETE went out: the item stays hidden until it settles, but can't be undone. */
  isSent: boolean;
};

type Scheduled = {
  label: string;
  run: () => Promise<unknown>;
  timer: ReturnType<typeof setTimeout>;
};

type PendingDeleteState = {
  /** Oldest first; the toast shows the last one. */
  pending: PendingDelete[];
  /** A delete that failed once it was sent. */
  failure: { label: string; error: unknown } | null;
  schedule: (item: Omit<PendingDelete, "key" | "isSent">, run: () => Promise<unknown>) => void;
  /** Cancels the delete; without a key, the latest one. */
  undo: (key?: string) => void;
  /** Sends the delete now instead of waiting; without a key, every pending one. */
  commit: (key?: string) => void;
  dismissFailure: () => void;
};

/** How long the toast waits before the DELETE is sent. Undo just cancels the timer. */
export const UNDO_DELAY_MS = 6000;

// Timers and requests stay outside the state so components only see plain items.
const scheduled = new Map<string, Scheduled>();
let nextKey = 0;

export const usePendingDeletes = create<PendingDeleteState>()((set, get) => {
  const forget = (key: string) =>
    set((state) => ({ pending: state.pending.filter((item) => item.key !== key) }));

  const send = (key: string) => {
    const item = scheduled.get(key);
    if (!item) return;
    clearTimeout(item.timer);
    scheduled.delete(key);
    set((state) => ({
      pending: state.pending.map((p) => (p.key === key ? { ...p, isSent: true } : p)),
    }));
    // The item stays hidden until the request settles, so a refetch can't flash it back.
    item.run().then(
      () => forget(key),
      (error: unknown) => {
        forget(key);
        set({ failure: { label: item.label, error } });
      },
    );
  };

  return {
    pending: [],
    failure: null,
    schedule: (item, run) => {
      const key = `${item.kind}-${item.id}-${nextKey++}`;
      const timer = setTimeout(() => send(key), UNDO_DELAY_MS);
      scheduled.set(key, { label: item.label, run, timer });
      set((state) => ({
        pending: [...state.pending, { ...item, key, isSent: false }],
        failure: null,
      }));
    },
    undo: (key) => {
      const target = key ?? get().pending.findLast((p) => !p.isSent)?.key;
      const item = target ? scheduled.get(target) : undefined;
      if (!target || !item) return;
      clearTimeout(item.timer);
      scheduled.delete(target);
      forget(target);
    },
    commit: (key) => {
      for (const item of key ? [key] : [...scheduled.keys()]) send(item);
    },
    dismissFailure: () => set({ failure: null }),
  };
});

/** Whether an item is waiting to be deleted, so lists can leave it out. */
export function isPendingDelete(
  pending: PendingDelete[],
  kind: PendingDeleteKind,
  id: number,
): boolean {
  return pending.some((item) => item.kind === kind && item.id === id);
}
