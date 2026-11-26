import { Check } from "lucide-react";
import type { ReactNode } from "react";

type EntityCheckboxProps = {
  checked: boolean;
  onChange: () => void;
  /** Accessible label read by screen readers. */
  label: string;
  /** Square = task/subtask; round = routine step (STYLE_GUIDE.md). */
  shape?: "square" | "round";
  /** md = 16 px (tasks & steps); sm = 14 px (subtasks); xs = 12 px (compact cells). Hit area is always 24 × 24 px. */
  size?: "xs" | "sm" | "md";
  /** area = inherits nearest data-area tokens; neutral = muted neutral border/fill. */
  tone?: "area" | "neutral";
  disabled?: boolean;
  cancelled?: boolean;
  title?: string;
  /** Optional center icon when unchecked (e.g. X for cancelled/missed, Minus for skipped). */
  overlay?: ReactNode;
  className?: string;
};

/**
 * Shared checkbox for tasks, subtasks, and routine steps: consistent area/neutral tokens,
 * keyboard focus ring, and a 24 × 24 px hit target even when drawn smaller.
 */
export function EntityCheckbox({
  checked,
  onChange,
  label,
  shape = "square",
  size = "md",
  tone = "area",
  disabled = false,
  cancelled = false,
  title,
  overlay,
  className = "",
}: EntityCheckboxProps) {
  const boxSize =
    size === "xs"
      ? "size-3 border-[1.5px]"
      : size === "sm"
        ? "size-3.5 border-[1.5px]"
        : "size-4 border-2";
  const radius =
    shape === "round" ? "rounded-full" : size === "xs" ? "rounded-[3px]" : "rounded-[4px]";
  const checkSize = size === "xs" ? "size-2.5" : size === "sm" ? "size-2.5" : "size-3";

  const colors = checked
    ? tone === "area"
      ? "border-(--checkbox-area-done) bg-(--checkbox-area-done)"
      : "border-(--color-neutral-300) bg-(--color-neutral-300)"
    : cancelled
      ? "border-(--color-neutral-300)"
      : tone === "area"
        ? "border-(--checkbox-area-todo)"
        : "border-(--color-neutral-400)";

  return (
    <label
      title={title}
      onPointerDown={(event) => event.stopPropagation()}
      className={`relative z-10 grid size-6 shrink-0 cursor-pointer place-items-center has-disabled:cursor-default ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={onChange}
        className={`peer cursor-pointer appearance-none app-focus-ring disabled:cursor-default ${boxSize} ${radius} ${colors}`}
      />
      {checked ? (
        <Check
          aria-hidden
          className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white ${checkSize}`}
          strokeWidth={3.75}
        />
      ) : (
        overlay
      )}
    </label>
  );
}
