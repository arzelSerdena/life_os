import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import {
  clearRoutineStepDayMutation,
  setRoutineStepDayMutation,
} from "../../client/@tanstack/react-query.gen";
import { AnchoredPopover } from "../../components/AnchoredPopover";
import { QueryError } from "../../components/QueryError";
import { useChangeToast } from "../../stores/changeToastStore";
import { type DayState, weekdayDate } from "./routine";

/** The step states a square's popover can change; other squares only select their day. */
const EDITABLE: DayState[] = ["done", "skipped", "missed", "todo", "upcoming"];

export type SquareTarget = {
  anchor: HTMLElement;
  stepId: number;
  title: string;
  day: string;
  state: DayState;
};

export function canEditSquare(state: DayState): boolean {
  return EDITABLE.includes(state);
}

/** "Skipped “Read” today" or "Skipped “Read” on Thu, 12 Nov". */
export function skippedMessage(title: string, day: string, today: string): string {
  return `Skipped “${title}”${day === today ? " today" : ` on ${weekdayDate(day)}`}`;
}

const ITEM =
  "flex h-7 items-center gap-2 rounded-(--radius-6) px-2 text-left type-body text-(--text-primary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:pointer-events-none disabled:opacity-45";

/**
 * A step's square in the heatmap: set that day to Done, Skipped, or To do (Missed for a day
 * that's over). A day that hasn't come can't be done.
 */
export function SquarePopover({
  target,
  today,
  onClose,
}: {
  target: SquareTarget;
  today: string;
  onClose: () => void;
}) {
  const showToast = useChangeToast((state) => state.show);
  const set = useMutation(setRoutineStepDayMutation());
  const clear = useMutation(clearRoutineStepDayMutation());
  const { stepId, title, day, state } = target;
  const path = { step_id: stepId, day };
  const isChecked = state === "done" || state === "skipped";
  const busy = set.isPending || clear.isPending;

  const choose = (next: "done" | "skipped" | "todo") => {
    if (next === "todo") {
      if (!isChecked) return onClose();
      clear.mutate({ path }, { onSuccess: onClose });
      return;
    }
    if (next === state) return onClose();
    set.mutate(
      { path, body: { status: next } },
      {
        onSuccess: (change) => {
          if (next === "skipped") showToast(skippedMessage(title, day, today), change.batch_id);
          onClose();
        },
      },
    );
  };

  const items: { id: "done" | "skipped" | "todo"; label: string; on: boolean; off?: boolean }[] = [
    { id: "done", label: "Done", on: state === "done", off: day > today },
    { id: "skipped", label: "Skipped", on: state === "skipped" },
    { id: "todo", label: day < today ? "Missed" : "To do", on: !isChecked },
  ];

  return (
    <AnchoredPopover
      anchor={target.anchor}
      label={`${title}, ${weekdayDate(day)}`}
      width={220}
      onClose={onClose}
    >
      <div className="px-2 pt-1 pb-1.5 text-xs leading-4 text-(--text-tertiary)">
        <b className="block truncate type-body font-semibold text-(--text-primary)">{title}</b>
        {weekdayDate(day)}
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.on}
          disabled={item.off || busy}
          onClick={() => choose(item.id)}
          className={`${ITEM} ${item.on ? "font-medium" : ""}`}
        >
          {item.label}
          {item.on && (
            <Check
              aria-hidden
              className="ml-auto size-3.5 text-(--color-brand-600)"
              strokeWidth={2.5}
            />
          )}
        </button>
      ))}
      {(set.error || clear.error) && <QueryError error={set.error ?? clear.error} />}
    </AnchoredPopover>
  );
}
