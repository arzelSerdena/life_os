import { PanelLeftClose } from "lucide-react";
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import {
  SIDEBAR_COLLAPSE_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  useSidebarStore,
} from "../stores/sidebarStore";
import { IconButton } from "./IconButton";

/** Below this window width the sidebar stops docking and opens on top of the page. */
const NARROW_QUERY = "(max-width: 1439px)";

export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia?.(NARROW_QUERY);
      query?.addEventListener("change", onChange);
      return () => query?.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(NARROW_QUERY).matches ?? false,
  );
}

/** Whether the sidebar is out of sight, and a way to show it again. */
export function useSidebarVisibility(): { isHidden: boolean; show: () => void } {
  const isNarrow = useIsNarrow();
  const { collapsed, overlayOpen, setCollapsed, setOverlayOpen } = useSidebarStore();
  return {
    isHidden: isNarrow ? !overlayOpen : collapsed,
    show: () => (isNarrow ? setOverlayOpen(true) : setCollapsed(false)),
  };
}

/** Ctrl + B (⌘ + B on a Mac) hides or shows the sidebar. */
export function useSidebarShortcut(): void {
  const isNarrow = useIsNarrow();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isNarrow) {
        useSidebarStore.getState().setOverlayOpen(false);
        return;
      }
      if (event.key.toLowerCase() !== "b" || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const state = useSidebarStore.getState();
      if (isNarrow) state.setOverlayOpen(!state.overlayOpen);
      else state.setCollapsed(!state.collapsed);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNarrow]);
}

type SidebarProps = {
  label: string;
  children: ReactNode;
};

/**
 * A group's sidebar beside the rail. Docked, it can be hidden and resized by dragging its
 * right border (double-click resets it). In a narrow window it opens on top of the page and
 * closes again after a choice.
 */
export function Sidebar({ label, children }: SidebarProps) {
  const isNarrow = useIsNarrow();
  const { collapsed, width, overlayOpen, setCollapsed, setWidth, setOverlayOpen } =
    useSidebarStore();
  const location = useLocation();
  const asideRef = useRef<HTMLElement>(null);

  // A choice in the overlay (any navigation) closes it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on navigation only
  useEffect(() => {
    setOverlayOpen(false);
  }, [location.pathname]);

  if (isNarrow ? !overlayOpen : collapsed) return null;

  const hide = () => (isNarrow ? setOverlayOpen(false) : setCollapsed(true));

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const left = asideRef.current?.getBoundingClientRect().left ?? 0;
    const handle = event.currentTarget;
    handle.setPointerCapture?.(event.pointerId);
    const onMove = (move: PointerEvent) => {
      const next = move.clientX - left;
      if (next < SIDEBAR_COLLAPSE_WIDTH) {
        setWidth(SIDEBAR_DEFAULT_WIDTH);
        setCollapsed(true);
        stop();
      } else {
        setWidth(next);
      }
    };
    const stop = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
  };

  const aside = (
    <aside
      ref={asideRef}
      aria-label={label}
      style={{ width }}
      className={`relative flex shrink-0 flex-col border-r border-(--border-default) bg-(--bg-surface) px-(--sidebar-gutter-x) py-(--sidebar-gutter-y) ${
        isNarrow ? "absolute inset-y-0 left-(--rail-width) z-30 shadow-(--effect-overlay)" : ""
      }`}
    >
      {children}
      <div className="absolute right-3 bottom-(--sidebar-gutter-y)">
        <IconButton label="Hide sidebar" onPress={hide}>
          <PanelLeftClose />
        </IconButton>
      </div>
      {!isNarrow && (
        // biome-ignore lint/a11y/useSemanticElements: a focusable splitter has no native element
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={startResize}
          onDoubleClick={() => setWidth(SIDEBAR_DEFAULT_WIDTH)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setWidth(width - 16);
            if (event.key === "ArrowRight") setWidth(width + 16);
          }}
          className="absolute inset-y-0 -right-[3px] w-1.5 cursor-col-resize outline-none hover:bg-brand-200 focus-visible:bg-brand-300"
        />
      )}
    </aside>
  );

  if (!isNarrow) return aside;
  return (
    <>
      {/* Clicking the page beside the overlay closes it. */}
      <div aria-hidden className="fixed inset-0 z-20" onClick={() => setOverlayOpen(false)} />
      {aside}
    </>
  );
}
