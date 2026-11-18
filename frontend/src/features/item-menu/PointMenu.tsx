import { Dropdown } from "@heroui/react";
import { type MouseEvent as ReactMouseEvent, type RefObject, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ACTION_MENU_WIDTH, ActionMenuList, type PanelAction } from "../detail-panel/PanelParts";

/** Where the menu opens: the pointer, or under the focused item for Shift F10 and the menu key. */
export type MenuPoint = { x: number; y: number; returnFocus?: HTMLElement };

/** Where a contextmenu event asks for a menu. Keyboard ones have no pointer position. */
export function menuPoint(event: MouseEvent | ReactMouseEvent, element: Element): MenuPoint {
  const fromKeyboard = event.button === -1 || (event.clientX === 0 && event.clientY === 0);
  if (!fromKeyboard) return { x: event.clientX, y: event.clientY };
  const box = element.getBoundingClientRect();
  return {
    x: box.left + 8,
    y: box.bottom,
    returnFocus: element instanceof HTMLElement ? element : undefined,
  };
}

/**
 * An item's ⋯ menu opened by right-click, at the pointer. Same items and styles as the ⋯
 * button's; Esc, a click outside or choosing an item closes it.
 */
export function PointMenu({
  point,
  actions,
  label,
  onClose,
}: {
  point: MenuPoint;
  actions: PanelAction[];
  label: string;
  onClose: () => void;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const triggerRef = anchor as RefObject<HTMLElement>;
  const close = () => {
    onClose();
    // Opened from the keyboard: go back to the item, as the ⋯ button would.
    point.returnFocus?.focus();
  };
  return (
    <>
      {createPortal(
        <span
          ref={anchor}
          aria-hidden
          className="pointer-events-none fixed size-0"
          style={{ left: point.x, top: point.y }}
        />,
        document.body,
      )}
      <Dropdown isOpen onOpenChange={(isOpen) => !isOpen && close()}>
        {/* The root needs a trigger to press; the menu is placed by the point instead. */}
        <Dropdown.Trigger aria-hidden aria-label={label} className="hidden" />
        <Dropdown.Popover
          triggerRef={triggerRef}
          placement="bottom start"
          offset={2}
          className={ACTION_MENU_WIDTH}
        >
          <ActionMenuList actions={actions} label={label} />
        </Dropdown.Popover>
      </Dropdown>
    </>
  );
}

/**
 * Right-click for a row that holds its own ⋯ actions (Finished & archived rows): spread
 * `onContextMenu` on the row and render `menu`.
 */
export function useRowContextMenu(actions: PanelAction[], label: string) {
  const [point, setPoint] = useState<MenuPoint | null>(null);
  const onContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (isNativeMenuTarget(event.target as Element)) return;
    event.preventDefault();
    setPoint(menuPoint(event, event.currentTarget));
  };
  const menu = point && (
    <PointMenu point={point} actions={actions} label={label} onClose={() => setPoint(null)} />
  );
  return { onContextMenu, menu, isOpen: point !== null };
}

/** Text fields keep the browser's menu (copy, paste, spelling); checkboxes don't. */
const TEXT_FIELDS =
  "input:not([type=checkbox], [type=radio], [type=range], [type=color], [type=button], [type=submit], [type=reset]), textarea, select, [contenteditable=''], [contenteditable='true']";

export function isNativeMenuTarget(element: Element | null): boolean {
  return Boolean(element?.closest(TEXT_FIELDS));
}
