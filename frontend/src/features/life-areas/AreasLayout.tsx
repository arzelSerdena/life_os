import { useQuery } from "@tanstack/react-query";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate, useOutletContext } from "react-router";
import { listLifeAreasOptions } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import type { LifeAreaPrefill } from "./form";
import { LifeAreaFormModal } from "./LifeAreaFormModal";
import { areaDataAttribute, nextFreePalette } from "./palette";

type AreasContext = {
  /** Opens the New area pop-up, optionally with a quick-start name and color filled in. */
  openCreateForm: (prefill?: LifeAreaPrefill) => void;
  openEditForm: (lifeArea: LifeAreaRead) => void;
};

/** Lets pages inside the Areas group open the shared create and edit form. */
export function useAreasContext(): AreasContext {
  return useOutletContext<AreasContext>();
}

type FormTarget = { lifeArea: LifeAreaRead | null; prefill?: LifeAreaPrefill };

/** The Areas group: its sidebar beside the overview, an area's page or the archived areas. */
export function AreasLayout() {
  const navigate = useNavigate();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const lifeAreas = useQuery(listLifeAreasOptions());
  const activeAreas = lifeAreas.data ?? [];

  const context: AreasContext = {
    openCreateForm: (prefill) => setFormTarget({ lifeArea: null, prefill }),
    openEditForm: (lifeArea) => setFormTarget({ lifeArea }),
  };

  return (
    <>
      <aside
        aria-label="Areas"
        className="flex w-(--sidebar-width) shrink-0 flex-col border-r border-(--border-default) bg-(--bg-surface) px-(--sidebar-gutter-x) py-(--sidebar-gutter-y)"
      >
        <div className="mb-0.5 flex h-8 items-center gap-2 rounded-(--radius-6) pr-1 has-[a:hover]:bg-(--bg-hover) has-[a[aria-current=page]]:bg-(--bg-hover) has-[a[aria-current=page]]:shadow-[inset_2px_0_0_var(--color-brand-600)]">
          <NavLink
            to="/areas"
            end
            className="flex h-full flex-1 items-center pl-2 text-[13px] leading-[18px] font-semibold tracking-[0.04em] text-(--text-primary) uppercase outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          >
            Life areas
          </NavLink>
          <IconButton label="New life area" onPress={() => context.openCreateForm()}>
            <Plus />
          </IconButton>
        </div>

        <nav aria-label="Life areas" className="flex flex-col gap-(--sidebar-item-gap)">
          {lifeAreas.isError && (
            <p className="px-2 py-1 type-meta text-(--text-danger)">Couldn't load your areas.</p>
          )}
          {lifeAreas.isSuccess && activeAreas.length === 0 && (
            <p className="px-2 py-1 type-meta text-(--text-secondary)">
              No life areas yet. Use + to add one.
            </p>
          )}
          {activeAreas.map((lifeArea) => (
            <SidebarLink key={lifeArea.id} to={`/areas/${lifeArea.id}`}>
              <span
                aria-hidden
                data-area={areaDataAttribute(lifeArea.color)}
                className="mx-1 size-2 shrink-0 rounded-[2px] bg-(--area-solid)"
              />
              <span className="truncate">{lifeArea.title}</span>
            </SidebarLink>
          ))}
        </nav>

        <div className="flex-1" />
        <div className="my-(--sidebar-divider-space) h-px shrink-0 bg-(--sidebar-divider)" />
        <SidebarLink to="/areas/archived">
          <Archive aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          Archived areas
        </SidebarLink>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet context={context} />
      </main>

      {formTarget && (
        <LifeAreaFormModal
          lifeArea={formTarget.lifeArea}
          lifeAreas={activeAreas}
          prefill={formTarget.prefill}
          defaultColor={nextFreePalette(activeAreas)}
          onClose={() => setFormTarget(null)}
          onSaved={(saved) => {
            if (!formTarget.lifeArea) {
              navigate(`/areas/${saved.id}`);
            }
          }}
        />
      )}
    </>
  );
}

function SidebarLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex h-(--sidebar-item-height) items-center gap-2 rounded-(--radius-6) px-2 type-sidebar-item outline-none hover:bg-(--sidebar-item-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
          isActive
            ? "bg-(--sidebar-item-active-bg) text-(--sidebar-item-text-active) shadow-[inset_2px_0_0_var(--color-brand-600)]"
            : "text-(--sidebar-item-text)"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
