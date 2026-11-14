import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import {
  clampPanelWidth,
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  useDetailPanel,
} from "../../stores/detailPanelStore";
import { EntityPanel } from "./entities";
import { ToolbarSlot } from "./PanelParts";

const EDGE_GAP = 8;

/**
 * The detail panel: floats over the page on the right and shows one item to edit, with its
 * notes. Esc or clicking elsewhere on the page closes it.
 */
export function DetailPanel() {
  const target = useDetailPanel((state) => state.target);
  const close = useDetailPanel((state) => state.close);
  const width = useDetailPanel((state) => state.width);
  const panel = useRef<HTMLElement>(null);
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  const isOpen = target !== null;

  useEffect(() => {
    if (!isOpen) return;
    // Menus and dialogs handle their own Esc and mark it handled.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) close();
    };
    // Pop-ups render outside #root, so clicks in them don't count as clicking away.
    const onPointerDown = (event: PointerEvent) => {
      const clicked = event.target as Element | null;
      if (!clicked || !document.getElementById("root")?.contains(clicked)) return;
      if (panel.current?.contains(clicked) || clicked.closest("[data-panel-opener]")) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, close]);

  if (!target) return null;
  const key = `${target.kind}-${target.id}${target.kind === "event" ? `-${target.day}` : ""}`;
  return (
    <aside
      ref={panel}
      aria-label="Details"
      style={{ width }}
      className="fixed top-2 right-2 bottom-2 z-30 flex flex-col rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface) shadow-(--effect-overlay)"
    >
      <ResizeHandle />
      <ToolbarSlot.Provider value={toolbar}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-(--radius-12)">
          <EntityPanel key={key} target={target} />
        </div>
      </ToolbarSlot.Provider>
      <div ref={setToolbar} className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2" />
    </aside>
  );
}

/** Drag the left edge to resize (360–560 px); double-click resets it. */
function ResizeHandle() {
  const width = useDetailPanel((state) => state.width);
  const setWidth = useDetailPanel((state) => state.setWidth);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isDragging) setWidth(window.innerWidth - EDGE_GAP - event.clientX);
  };
  const stop = () => setIsDragging(false);

  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> can't be dragged or focused
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize details"
      aria-valuemin={PANEL_MIN_WIDTH}
      aria-valuemax={PANEL_MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => setWidth(PANEL_DEFAULT_WIDTH)}
      onKeyDown={(event) => {
        const step = event.key === "ArrowLeft" ? 16 : event.key === "ArrowRight" ? -16 : 0;
        if (step) setWidth(clampPanelWidth(width + step));
      }}
      data-dragging={isDragging}
      className="group absolute top-0 bottom-0 -left-[5px] z-20 w-2.5 cursor-col-resize outline-none"
    >
      <span className="absolute top-3 bottom-3 left-1 hidden w-0.5 rounded-full bg-brand-400 group-hover:block group-focus-visible:block group-data-[dragging=true]:block" />
      <span className="absolute top-1/2 left-px -mt-[18px] hidden h-9 w-2 rounded-[4px] bg-brand-600 group-hover:block group-focus-visible:block group-data-[dragging=true]:block" />
    </div>
  );
}
