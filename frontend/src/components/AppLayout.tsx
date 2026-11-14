import { CalendarDays, House, type LucideIcon, Settings, Shapes, SquareKanban } from "lucide-react";
import { NavLink, Outlet } from "react-router";

type RailGroup = { label: string; icon: LucideIcon; to?: string };

// Groups without a route aren't built yet; they show as disabled so the rail keeps its shape.
const GROUPS: RailGroup[] = [
  { label: "Home", icon: House },
  { label: "Tasks", icon: SquareKanban },
  { label: "Calendar", icon: CalendarDays },
  { label: "Areas", icon: Shapes, to: "/areas" },
];
const SETTINGS: RailGroup = { label: "Settings", icon: Settings };

/** The icon rail. Each group renders its own sidebar and page inside the outlet. */
export function AppLayout() {
  return (
    <div className="flex h-screen min-w-[1280px]">
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
    </div>
  );
}

const RAIL_ITEM =
  "grid size-8 place-items-center rounded-full text-(--rail-icon) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)";

function RailItem({ group }: { group: RailGroup }) {
  const Icon = group.icon;
  const icon = <Icon aria-hidden className="size-(--rail-icon-size)" strokeWidth={2} />;
  return group.to ? (
    <NavLink
      to={group.to}
      aria-label={group.label}
      title={group.label}
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
