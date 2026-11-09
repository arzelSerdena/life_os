import { Shapes } from "lucide-react";
import { NavLink, Outlet } from "react-router";

const NAV_LINK_BASE = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium";

export function AppLayout() {
  return (
    <div className="flex h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
        <p className="px-3 text-lg font-semibold">Life OS</p>
        <nav aria-label="Main">
          <NavLink
            to="/life-areas"
            className={({ isActive }) =>
              `${NAV_LINK_BASE} ${
                isActive ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-default"
              }`
            }
          >
            <Shapes aria-hidden className="size-4" />
            Life areas
          </NavLink>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
