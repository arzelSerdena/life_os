import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { errorMessage } from "../../errors";
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

/** The undo toast for the latest delete, and the message when a delete fails. */
export function UndoToast() {
  const pending = usePendingDeletes((state) => state.pending);
  const failure = usePendingDeletes((state) => state.failure);
  const undo = usePendingDeletes((state) => state.undo);
  const commit = usePendingDeletes((state) => state.commit);
  const dismissFailure = usePendingDeletes((state) => state.dismissFailure);
  const latest = pending.findLast((item) => !item.isSent);

  useEffect(() => {
    if (!latest) return;
    // Ctrl Z undoes the delete, except while typing, where it undoes the typing.
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        if (isEditable(event.target)) return;
        event.preventDefault();
        undo(latest.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [latest, undo]);

  useEffect(() => {
    // Closing the app sends what is waiting instead of dropping it.
    const onPageHide = () => commit();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [commit]);

  if (!latest && !failure) return null;
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
      ) : (
        failure && (
          <>
            <CircleAlert aria-hidden className="size-4 shrink-0 text-(--text-danger)" />
            <span className="max-w-[480px] truncate text-[13px] text-(--text-primary)">
              Couldn't delete “{failure.label}”. {errorMessage(failure.error)}
            </span>
            <button type="button" aria-label="Close" className={CLOSE} onClick={dismissFailure}>
              <X aria-hidden className="size-4" />
            </button>
          </>
        )
      )}
    </div>
  );
}
