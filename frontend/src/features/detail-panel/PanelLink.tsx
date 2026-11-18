import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { PANEL_OPENER, type PanelTarget, useDetailPanel } from "../../stores/detailPanelStore";
import { itemMenuProps } from "../item-menu/target";
import { projectPath } from "../projects/paths";

/**
 * An item's title that opens it in the detail panel, or a project's that opens its project
 * page. `stretched` makes the whole row or card clickable: give that container `relative`,
 * and controls inside it `relative z-10`. Right-clicking it (or anywhere in a stretched row)
 * opens the item's ⋯ menu.
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
  const close = useDetailPanel((state) => state.close);
  const navigate = useNavigate();
  const onClick = () => {
    if (target.kind !== "project") return open(target);
    close();
    navigate(projectPath(target.id));
  };
  return (
    <button
      type="button"
      {...(target.kind === "project" ? {} : PANEL_OPENER)}
      {...itemMenuProps(target)}
      data-stretched={stretched ? "" : undefined}
      onClick={onClick}
      className={`min-w-0 cursor-pointer text-left outline-none ${
        stretched
          ? "after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-(--focus-ring)"
          : "rounded-[4px] hover:underline focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
      } ${className}`}
    >
      {children}
    </button>
  );
}
