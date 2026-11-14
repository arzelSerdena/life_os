import type { ReactNode } from "react";
import { PANEL_OPENER, type PanelTarget, useDetailPanel } from "../../stores/detailPanelStore";

/**
 * An item's title that opens it in the detail panel. `stretched` makes the whole row or
 * card clickable: give that container `relative`, and controls inside it `relative z-10`.
 */
export function PanelLink({
  target,
  stretched = false,
  className = "",
  children,
}: {
  target: PanelTarget;
  stretched?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const open = useDetailPanel((state) => state.open);
  return (
    <button
      type="button"
      {...PANEL_OPENER}
      onClick={() => open(target)}
      className={`min-w-0 cursor-pointer text-left outline-none focus-visible:underline ${
        stretched
          ? "after:absolute after:inset-0 after:rounded-[inherit] after:content-['']"
          : "hover:underline"
      } ${className}`}
    >
      {children}
    </button>
  );
}
