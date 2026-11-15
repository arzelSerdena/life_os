import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { isPendingDelete, UNDO_DELAY_MS, usePendingDeletes } from "./pendingDeleteStore";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  usePendingDeletes.setState({ pending: [], failure: null });
});

const item = { kind: "task" as const, id: 2, label: "Update resume" };

test("the delete is sent only after the undo delay", async () => {
  const run = vi.fn().mockResolvedValue(undefined);
  usePendingDeletes.getState().schedule(item, run);

  expect(isPendingDelete(usePendingDeletes.getState().pending, "task", 2)).toBe(true);
  vi.advanceTimersByTime(UNDO_DELAY_MS - 1);
  expect(run).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(run).toHaveBeenCalledOnce();
  // Still hidden until the request settles, but no longer undoable.
  expect(usePendingDeletes.getState().pending).toMatchObject([{ id: 2, isSent: true }]);
  await vi.runAllTimersAsync();
  expect(usePendingDeletes.getState().pending).toEqual([]);
});

test("undo cancels the latest delete that wasn't sent", () => {
  const first = vi.fn().mockResolvedValue(undefined);
  const second = vi.fn().mockResolvedValue(undefined);
  usePendingDeletes.getState().schedule(item, first);
  usePendingDeletes.getState().schedule({ ...item, id: 3, label: "Draft the pitch" }, second);

  usePendingDeletes.getState().undo();
  vi.advanceTimersByTime(UNDO_DELAY_MS);

  expect(second).not.toHaveBeenCalled();
  expect(first).toHaveBeenCalledOnce();
});

test("a failed delete is reported and the item comes back", async () => {
  usePendingDeletes.getState().schedule(item, () => Promise.reject({ detail: "Not found" }));
  usePendingDeletes.getState().commit();
  await vi.runAllTimersAsync();

  const state = usePendingDeletes.getState();
  expect(state.pending).toEqual([]);
  expect(state.failure).toEqual({ label: "Update resume", error: { detail: "Not found" } });
});
