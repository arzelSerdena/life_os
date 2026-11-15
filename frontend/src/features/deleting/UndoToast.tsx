import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { undoBatch } from "../../client/sdk.gen";
import { errorMessage } from "../../errors";
import { type AppliedChange, useChangeToast } from "../../stores/changeToastStore";
import { type PendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";

/**
 * Deletes an item after the undo toast's delay. Until then (and until the request settles)
 * the item is listed in the pending deletes, and lists leave it out.
 */
export function useDeleteWithUndo() {
  const queryClient = useQueryClient();
  const schedule = usePendingDeletes((state) => state.schedule);
  return (item: Omit<PendingDelete, "key" | "isSent">, request: () => Promise<unknown>) =>
    schedule(item, async () => {
      try {
        await request();
      } finally {
        // Refresh before the item stops being hidden, so it doesn't flash back.
        await queryClient.invalidateQueries();
      }
    });
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

const LINK =
  "rounded-[4px] px-1.5 py-1 text-xs font-semibold text-brand-700 outline-none hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-(--focus-ring)";
const CLOSE =
  "grid size-6 place-items-center rounded-(--radius-6) text-(--text-tertiary) outline-none hover:bg-(--bg-hover) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring)";

/** Undoes an applied change's batch and refreshes everything it touched. */
function useUndoChange() {
  const queryClient = useQueryClient();
  const dismiss = useChangeToast((state) => state.dismiss);
  const fail = useChangeToast((state) => state.fail);
  return async (change: AppliedChange) => {
    dismiss(change.key);
    try {
      await undoBatch({ path: { batch_id: change.batchId }, throwOnError: true });
    } catch (error) {
      fail("Couldn't undo.", error);
    } finally {
      await queryClient.invalidateQueries();
    }
  };
}

/**
 * The undo toast: for the latest delete, or else for the latest change (Completed “X”),
 * and the message when a delete or an undo fails.
 */
export function UndoToast() {
  const pending = usePendingDeletes((state) => state.pending);
  const failure = usePendingDeletes((state) => state.failure);
  const undo = usePendingDeletes((state) => state.undo);
  const commit = usePendingDeletes((state) => state.commit);
  const dismissFailure = usePendingDeletes((state) => state.dismissFailure);
  const change = useChangeToast((state) => state.change);
  const changeFailure = useChangeToast((state) => state.failure);
  const dismissChange = useChangeToast((state) => state.dismiss);
  const undoChange = useUndoChange();
  const latest = pending.findLast((item) => !item.isSent);

  useEffect(() => {
    if (!latest && !change) return;
    // Ctrl Z undoes the delete or change, except while typing, where it undoes the typing.
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        if (isEditable(event.target)) return;
        event.preventDefault();
        if (latest) undo(latest.key);
        else if (change) void undoChange(change);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [latest, change, undo, undoChange]);

  useEffect(() => {
    // Closing the app sends what is waiting instead of dropping it.
    const onPageHide = () => commit();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [commit]);

  if (!latest && !failure && !change && !changeFailure) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex h-10 -translate-x-1/2 items-center gap-2.5 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) pr-2 pl-3 shadow-(--effect-overlay)"
    >
      {latest ? (
        <>
          <Trash2 aria-hidden className="size-4 shrink-0 text-(--text-tertiary)" />
          <span className="max-w-80 truncate text-[13px] text-(--text-primary)">
            Deleted “{latest.label}”
          </span>
          <button type="button" className={LINK} onClick={() => undo(latest.key)}>
            Undo
          </button>
          <kbd className="rounded-[4px] border border-(--border-default) px-1 text-[11px] font-medium text-(--text-tertiary)">
            Ctrl Z
          </kbd>
          <button
            type="button"
            aria-label="Close"
            className={CLOSE}
            onClick={() => commit(latest.key)}
          >
            <X aria-hidden className="size-4" />
          </button>
        </>
      ) : change ? (
        <>
          <CircleCheck aria-hidden className="size-4 shrink-0 text-(--text-tertiary)" />
          <span className="max-w-80 truncate text-[13px] text-(--text-primary)">
            {change.message}
          </span>
          <button type="button" className={LINK} onClick={() => void undoChange(change)}>
            Undo
          </button>
          <kbd className="rounded-[4px] border border-(--border-default) px-1 text-[11px] font-medium text-(--text-tertiary)">
            Ctrl Z
          </kbd>
          <button
            type="button"
            aria-label="Close"
            className={CLOSE}
            onClick={() => dismissChange(change.key)}
          >
            <X aria-hidden className="size-4" />
          </button>
        </>
      ) : failure ? (
        <>
          <CircleAlert aria-hidden className="size-4 shrink-0 text-(--text-danger)" />
          <span className="max-w-[480px] truncate text-[13px] text-(--text-primary)">
            Couldn't delete “{failure.label}”. {errorMessage(failure.error)}
          </span>
          <button type="button" aria-label="Close" className={CLOSE} onClick={dismissFailure}>
            <X aria-hidden className="size-4" />
          </button>
        </>
      ) : (
        changeFailure && (
          <>
            <CircleAlert aria-hidden className="size-4 shrink-0 text-(--text-danger)" />
            <span className="max-w-[480px] truncate text-[13px] text-(--text-primary)">
              {changeFailure.message} {errorMessage(changeFailure.error)}
            </span>
            <button
              type="button"
              aria-label="Close"
              className={CLOSE}
              onClick={() => dismissChange()}
            >
              <X aria-hidden className="size-4" />
            </button>
          </>
        )
      )}
    </div>
  );
}
