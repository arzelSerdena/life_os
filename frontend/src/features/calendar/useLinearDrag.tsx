import { CalendarDays, Folder } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type DaySpan, type DragSubject, draggedSpan, dragLabel } from "./linearDrag";

/** How far the pointer moves before a press becomes a drag, so a click still opens things. */
const THRESHOLD = 4;

export type LinearDrag = {
  subject: DragSubject;
  /** The day under the pointer, once the pointer has been over one. */
  over: string | null;
  span: DaySpan | null;
  x: number;
  y: number;
};

/** The calendar day under a point: a day of the linear calendar, under any bar over it. */
export function dayAt(x: number, y: number): string | null {
  if (typeof document.elementsFromPoint !== "function") return null;
  for (const element of document.elementsFromPoint(x, y)) {
    const day = element.closest<HTMLElement>(".linear-grid [data-date]")?.dataset.date;
    if (day) return day;
  }
  return null;
}

/**
 * Dragging in the linear calendar with the pointer: `begin` from a press on a bar, its end,
 * a day popover's row or an Inbox row. Past a few pixels it becomes a drag (`onStart`, e.g.
 * closing the popover), and letting go over a day calls `onDrop`; Esc cancels it. The click
 * that follows a drag is swallowed, so it doesn't open what was dragged.
 */
export function useLinearDrag(onDrop: (subject: DragSubject, span: DaySpan) => void) {
  const [drag, setDrag] = useState<LinearDrag | null>(null);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const begin = (subject: DragSubject, event: ReactPointerEvent, onStart?: () => void) => {
    if (event.button !== 0) return;
    // No text selection while dragging.
    event.preventDefault();
    cleanup.current?.();
    const x0 = event.clientX;
    const y0 = event.clientY;
    let started = false;
    let over: string | null = null;

    const move = (e: PointerEvent) => {
      if (!started) {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) < THRESHOLD) return;
        started = true;
        document.body.classList.add("is-linear-dragging");
        onStart?.();
      }
      over = dayAt(e.clientX, e.clientY) ?? over;
      setDrag({
        subject,
        over,
        span: over ? draggedSpan(subject, over) : null,
        x: e.clientX,
        y: e.clientY,
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", key);
      document.body.classList.remove("is-linear-dragging");
      cleanup.current = null;
      setDrag(null);
    };
    const up = () => {
      const wasDrag = started;
      stop();
      if (!wasDrag) return;
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      if (over) dropRef.current(subject, draggedSpan(subject, over));
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", key);
    cleanup.current = stop;
  };

  return { drag, begin };
}

/**
 * What follows the pointer: a row-like card for a single-day item or an Inbox task (a bar is
 * drawn at its new dates in the calendar instead), and the dark label with the new dates.
 */
export function DragOverlay({ drag }: { drag: LinearDrag | null }) {
  if (!drag) return null;
  const { subject, span, x, y } = drag;
  const card = subject.kind === "bar" ? null : ghostOf(subject);
  return createPortal(
    <>
      {card && (
        <div aria-hidden className="linear-ghost" style={{ left: x + 14, top: y + 10 }}>
          {card.icon}
          <span className="truncate">{card.title}</span>
        </div>
      )}
      {span && (
        <div role="status" className="linear-drag-label" style={{ left: x + 14, top: y - 30 }}>
          {dragLabel(subject, span)}
        </div>
      )}
    </>,
    document.body,
  );
}

function ghostOf(subject: Exclude<DragSubject, { kind: "bar" }>) {
  if (subject.kind === "inbox") return { title: subject.task.title, icon: <TaskBox /> };
  const { entry } = subject;
  switch (entry.kind) {
    case "event":
      return {
        title: entry.event.title,
        icon: (
          <CalendarDays
            aria-hidden
            className="size-4 shrink-0 text-(--text-tertiary)"
            strokeWidth={2}
          />
        ),
      };
    case "project":
      return {
        title: entry.project.title,
        icon: (
          <Folder aria-hidden className="size-4 shrink-0 text-(--text-tertiary)" strokeWidth={2} />
        ),
      };
    case "task":
      return { title: entry.task.title, icon: <TaskBox /> };
    default:
      return null;
  }
}

function TaskBox() {
  return <span aria-hidden className="linear-ghost-box" />;
}
