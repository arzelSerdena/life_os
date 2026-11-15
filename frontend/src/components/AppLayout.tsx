import {
  CalendarDays,
  House,
  LayoutGrid,
  type LucideIcon,
  Settings,
  SquareKanban,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { UndoToast } from "../features/deleting/UndoToast";
import { useDetailPanel } from "../stores/detailPanelStore";
import { useSidebarShortcut, useSidebarVisibility } from "./Sidebar";

// The panel brings the notes editor, so it loads the first time something is opened.
const DetailPanel = lazy(() =>
  import("../features/detail-panel/DetailPanel").then((module) => ({
    default: module.DetailPanel,
  })),
);

type RailGroup = { label: string; icon: LucideIcon; to?: string };

// Groups without a route aren't built yet; they show as disabled so the rail keeps its shape.
const GROUPS: RailGroup[] = [
  { label: "Home", icon: House },
  { label: "Tasks", icon: SquareKanban },
  { label: "Calendar", icon: CalendarDays },
  { label: "Plan", icon: LayoutGrid, to: "/areas" },
];
const SETTINGS: RailGroup = { label: "Settings", icon: Settings };

/** The icon rail. Each group renders its own sidebar and page inside the outlet. */
export function AppLayout() {
  useSidebarShortcut();
  const hasPanel = useDetailPanel((state) => state.target !== null);
  return (
    <div className="relative flex h-screen min-h-[720px] min-w-[1280px]">
      <nav aria-label="Main" className="flex w-(--rail-width) shrink-0 px-1 py-2">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-(--rail-radius) bg-(--rail-bg) py-1.5">
          <div
            aria-hidden
            className="mb-1.5 grid size-7 place-items-center rounded-full bg-brand-700 text-xs font-semibold text-white"
          >
            L
          </div>
          {GROUPS.map((group) => (
            <RailItem key={group.label} group={group} />
          ))}
          <div className="flex-1" />
          <RailItem group={SETTINGS} />
        </div>
      </nav>
      <Outlet />
      <Suspense fallback={null}>{hasPanel && <DetailPanel />}</Suspense>
      <UndoToast />
    </div>
  );
}

const RAIL_ITEM =
  "grid size-8 place-items-center rounded-full text-(--rail-icon) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)";

function RailItem({ group }: { group: RailGroup }) {
  const location = useLocation();
  const sidebar = useSidebarVisibility();
  const isOpenGroup = group.to !== undefined && location.pathname.startsWith(group.to);
  const Icon = group.icon;
  const icon = <Icon aria-hidden className="size-(--rail-icon-size)" strokeWidth={2} />;
  return group.to ? (
    <NavLink
      to={group.to}
      aria-label={group.label}
      title={group.label}
      onClick={(event) => {
        // The open group's icon brings back its hidden sidebar instead of leaving the page.
        if (isOpenGroup && sidebar.isHidden) {
          event.preventDefault();
          sidebar.show();
        }
      }}
      className={({ isActive }) =>
        `${RAIL_ITEM} ${
          isActive
            ? "bg-(--rail-icon-active-bg) text-(--rail-icon-active) shadow-(--effect-raised)"
            : "hover:bg-white/60"
        }`
      }
    >
      {icon}
    </NavLink>
  ) : (
    <button
      type="button"
      disabled
      aria-label={`${group.label} (not built yet)`}
      title={`${group.label} — not built yet`}
      className={`${RAIL_ITEM} opacity-50`}
    >
      {icon}
    </button>
  );
}
