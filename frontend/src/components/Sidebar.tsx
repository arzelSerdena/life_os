import { PanelLeftClose } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { type ItemTarget, itemMenuProps } from "../features/item-menu/target";
import { isEditable, isModKey, isOverlayOpen } from "../keyboard";
import {
  SIDEBAR_COLLAPSE_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  useSidebarStore,
} from "../stores/sidebarStore";
import { IconButton } from "./IconButton";

/** Whether the sidebar is hidden, and a way to show it again. */
export function useSidebarVisibility(): { isHidden: boolean; show: () => void } {
  const { collapsed, setCollapsed } = useSidebarStore();
  return { isHidden: collapsed, show: () => setCollapsed(false) };
}

/** Ctrl + B (⌘ + B on a Mac) hides or shows the sidebar. */
export function useSidebarShortcut(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        isEditable(event.target) ||
        isOverlayOpen() ||
        !isModKey(event, "b")
      ) {
        return;
      }
      event.preventDefault();
      const state = useSidebarStore.getState();
      state.setCollapsed(!state.collapsed);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

type SidebarProps = {
  label: string;
  children: ReactNode;
};

/**
 * A group's sidebar beside the rail, docked at every window width. It can be hidden and
 * resized by dragging its right border (double-click resets it).
 */
export function Sidebar({ label, children }: SidebarProps) {
  const { collapsed, width, setCollapsed, setWidth } = useSidebarStore();
  const asideRef = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (collapsed) return null;

  const hide = () => setCollapsed(true);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const left = asideRef.current?.getBoundingClientRect().left ?? 0;
    const handle = event.currentTarget;
    handle.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
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
      setIsDragging(false);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  return (
    <aside
      ref={asideRef}
      aria-label={label}
      style={{ width }}
      className="relative flex shrink-0 flex-col border-r border-(--border-default) bg-(--bg-surface) px-(--sidebar-gutter-x) py-(--sidebar-gutter-y)"
    >
      {children}
      <div className="absolute right-3 bottom-(--sidebar-gutter-y)">
        <IconButton label="Hide sidebar" onPress={hide}>
          <PanelLeftClose />
        </IconButton>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a focusable splitter has no native element */}
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
        data-dragging={isDragging}
        className="group absolute top-0 bottom-0 -right-[5px] z-20 w-2.5 cursor-col-resize outline-none"
      >
        <span className="absolute top-3 bottom-3 left-1 hidden w-0.5 rounded-full bg-brand-400 group-hover:block group-focus-visible:block group-data-[dragging=true]:block" />
        <span className="absolute top-1/2 left-px -mt-[18px] hidden h-9 w-2 rounded-[4px] bg-brand-600 group-hover:block group-focus-visible:block group-data-[dragging=true]:block" />
      </div>
    </aside>
  );
}

export const SIDEBAR_ROW =
  "flex h-(--sidebar-item-height) items-center gap-2 rounded-(--radius-6) px-2 type-sidebar-item outline-none hover:bg-(--sidebar-item-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)";
export const SIDEBAR_ROW_ACTIVE =
  "bg-(--sidebar-item-active-bg) text-(--sidebar-item-text-active) shadow-[inset_2px_0_0_var(--color-brand-600)]";

/** A sidebar row that goes to a page, marked while that page is open. */
export function SidebarLink({
  to,
  end,
  item,
  children,
}: {
  to: string;
  end?: boolean;
  /** The area, project or routine the row stands for: right-click opens its ⋯ menu. */
  item?: ItemTarget;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      {...(item ? itemMenuProps(item) : {})}
      className={({ isActive }) =>
        `${SIDEBAR_ROW} ${isActive ? SIDEBAR_ROW_ACTIVE : "text-(--sidebar-item-text)"}`
      }
    >
      {children}
    </NavLink>
  );
}
