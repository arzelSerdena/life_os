import { Popover } from "@heroui/react";
import { type ReactNode, type RefObject, useMemo } from "react";

/**
 * A popover opened from something drawn on the page (a calendar routine, "+3 more", a
 * heatmap square), so it anchors to that element instead of wrapping a trigger. Esc and a
 * click outside close it.
 */
export function AnchoredPopover({
  anchor,
  label,
  width,
  placement = "bottom start",
  onClose,
  children,
}: {
  anchor: HTMLElement;
  label: string;
  width: number;
  placement?: "bottom start" | "right top" | "bottom";
  onClose: () => void;
  children: ReactNode;
}) {
  const triggerRef: RefObject<HTMLElement> = useMemo(() => ({ current: anchor }), [anchor]);
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };
  // The root carries HeroUI's popover styles. It needs a trigger to press, so a hidden one
  // stands in; the popover is placed by the anchor.
  return (
    <Popover isOpen onOpenChange={onOpenChange}>
      <Popover.Trigger aria-hidden tabIndex={-1} className="hidden" />
      <Popover.Content
        triggerRef={triggerRef}
        placement={placement}
        style={{ width }}
        className="rounded-(--radius-12) border border-(--border-default) p-0"
      >
        <Popover.Dialog aria-label={label} className="flex flex-col p-1.5 outline-none">
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
