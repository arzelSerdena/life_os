import { useQuery } from "@tanstack/react-query";
import { Archive, Folder, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { NavLink, Outlet, useNavigate, useOutletContext } from "react-router";
import { listLifeAreasOptions, listProjectsOptions } from "../../client/@tanstack/react-query.gen";
import { IconButton } from "../../components/IconButton";
import { SIDEBAR_ROW, SIDEBAR_ROW_ACTIVE, Sidebar, SidebarLink } from "../../components/Sidebar";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { NewProjectModal } from "../projects/NewProjectModal";
import type { LifeAreaPrefill } from "./form";
import { LifeAreaFormModal } from "./LifeAreaFormModal";
import { areaDataAttribute, nextFreePalette } from "./palette";

type AreasContext = {
  /** Opens the New area pop-up, optionally with a quick-start name and color filled in. */
  openCreateForm: (prefill?: LifeAreaPrefill) => void;
  /** Opens the New project pop-up, with an area chosen if one is given. */
  openNewProject: (lifeAreaId?: number) => void;
};

/** Lets pages inside the Areas group open the New area pop-up. */
export function useAreasContext(): AreasContext {
  return useOutletContext<AreasContext>();
}

type FormTarget = { prefill?: LifeAreaPrefill };

/** The Plan group: its sidebar beside the overview, an area's page or Finished & archived. */
export function AreasLayout() {
  const navigate = useNavigate();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [newProject, setNewProject] = useState<{ lifeAreaId?: number } | null>(null);
  const lifeAreas = useQuery(listLifeAreasOptions());
  const activeAreas = lifeAreas.data ?? [];
  const projects = useQuery(listProjectsOptions());
  const panelTarget = useDetailPanel((state) => state.target);
  const openPanel = useDetailPanel((state) => state.open);

  // Active projects in active areas, in area order.
  const areaOrder = new Map(activeAreas.map((area, index) => [area.id, index]));
  const activeProjects = (projects.data ?? [])
    .filter((project) => project.status === "active" && areaOrder.has(project.life_area_id))
    .sort(
      (a, b) =>
        (areaOrder.get(a.life_area_id) ?? 0) - (areaOrder.get(b.life_area_id) ?? 0) ||
        a.sort_order - b.sort_order,
    );
  const colorOf = (lifeAreaId: number) => activeAreas.find((area) => area.id === lifeAreaId)?.color;

  const context: AreasContext = {
    openCreateForm: (prefill) => setFormTarget({ prefill }),
    openNewProject: (lifeAreaId) => setNewProject({ lifeAreaId }),
  };

  return (
    <>
      <Sidebar label="Plan">
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

        <div className="my-(--sidebar-divider-space) h-px shrink-0 bg-(--sidebar-divider)" />

        <div className="mb-0.5 flex h-8 items-center gap-2 pr-1">
          <h2 className="flex-1 pl-2 text-[13px] leading-[18px] font-semibold tracking-[0.04em] text-(--text-primary) uppercase">
            Projects
          </h2>
          {activeAreas.length > 0 && (
            <IconButton label="New project" onPress={() => context.openNewProject()}>
              <Plus />
            </IconButton>
          )}
        </div>
        <nav aria-label="Projects" className="flex flex-col gap-(--sidebar-item-gap)">
          {projects.isSuccess && activeProjects.length === 0 && (
            <p className="px-2 py-1 type-meta text-(--text-secondary)">No projects yet.</p>
          )}
          {activeProjects.map((project) => (
            <SidebarButton
              key={project.id}
              isActive={panelTarget?.kind === "project" && panelTarget.id === project.id}
              onPress={() => openPanel({ kind: "project", id: project.id })}
            >
              <Folder
                aria-hidden
                data-area={areaDataAttribute(colorOf(project.life_area_id))}
                className="size-4 shrink-0 text-(--area-solid)"
                strokeWidth={2}
              />
              <span className="truncate">{project.title}</span>
            </SidebarButton>
          ))}
        </nav>

        <div className="flex-1" />
        <div className="my-(--sidebar-divider-space) h-px shrink-0 bg-(--sidebar-divider)" />
        <SidebarLink to="/areas/archived">
          <Archive aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          Finished & archived
        </SidebarLink>
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet context={context} />
      </main>

      {formTarget && (
        <LifeAreaFormModal
          lifeAreas={activeAreas}
          prefill={formTarget.prefill}
          defaultColor={nextFreePalette(activeAreas)}
          onClose={() => setFormTarget(null)}
          onSaved={(saved) => navigate(`/areas/${saved.id}`)}
        />
      )}

      {newProject && (
        <NewProjectModal
          lifeAreas={activeAreas}
          lifeAreaId={newProject.lifeAreaId}
          onClose={() => setNewProject(null)}
          // Until the project page exists, a new project opens in the detail panel.
          onCreated={(project) => openPanel({ kind: "project", id: project.id })}
        />
      )}
    </>
  );
}

/** A sidebar row that opens something in place instead of going to a page. */
function SidebarButton({
  isActive,
  onPress,
  children,
}: {
  isActive: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={isActive || undefined}
      onClick={onPress}
      className={`${SIDEBAR_ROW} w-full text-left ${isActive ? SIDEBAR_ROW_ACTIVE : "text-(--sidebar-item-text)"}`}
    >
      {children}
    </button>
  );
}
