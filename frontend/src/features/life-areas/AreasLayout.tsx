import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Folder, GripVertical, Pause, Plus } from "lucide-react";
import { type ComponentProps, type ReactNode, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useOutletContext } from "react-router";
import {
  getRoutinesHistoryOptions,
  getRoutinesHistoryQueryKey,
  listLifeAreasOptions,
  listLifeAreasQueryKey,
  listProjectsOptions,
  listProjectsQueryKey,
  reorderLifeAreasMutation,
  reorderProjectsMutation,
  reorderRoutinesMutation,
} from "../../client/@tanstack/react-query.gen";
import type {
  LifeAreaRead,
  ProjectRead,
  RoutineHistoryRead,
  RoutinesHistoryRead,
} from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { SIDEBAR_ROW, Sidebar, SidebarLink } from "../../components/Sidebar";
import { NewProjectModal } from "../projects/NewProjectModal";
import { projectPath } from "../projects/paths";
import { NewRoutineModal } from "../routines/NewRoutineModal";
import { ProgressRing } from "../tasks/RoutinesPage";
import { routineColumn } from "../tasks/routines";
import type { LifeAreaPrefill } from "./form";
import { LifeAreaFormModal } from "./LifeAreaFormModal";
import { areaDataAttribute, nextFreePalette } from "./palette";

type AreasContext = {
  /** Opens the New area pop-up, optionally with a quick-start name and color filled in. */
  openCreateForm: (prefill?: LifeAreaPrefill) => void;
  /** Opens the New project pop-up, with an area chosen if one is given. */
  openNewProject: (lifeAreaId?: number) => void;
  /** Opens New routine, optionally with a quick-start name filled in. */
  openNewRoutine: (title?: string) => void;
};

/** Lets pages inside the Areas group open the New area pop-up. */
export function useAreasContext(): AreasContext {
  return useOutletContext<AreasContext>();
}

type FormTarget = { prefill?: LifeAreaPrefill };

/** The Plan group: its sidebar beside the overview, an area's page or Finished & archived. */
export function AreasLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [newProject, setNewProject] = useState<{ lifeAreaId?: number } | null>(null);
  const [newRoutine, setNewRoutine] = useState<{ title?: string } | null>(null);
  const history = useQuery(getRoutinesHistoryOptions());
  const lifeAreas = useQuery(listLifeAreasOptions());
  const activeAreas = lifeAreas.data ?? [];
  const projects = useQuery(listProjectsOptions());
  const reorderAreas = useMutation(reorderLifeAreasMutation());
  const reorderProjects = useMutation(reorderProjectsMutation());

  // Active projects in active areas, in saved sort_order (tie-broken by area order).
  const areaOrder = new Map(activeAreas.map((area, index) => [area.id, index]));
  const activeProjects = (projects.data ?? [])
    .filter((project) => project.status === "active" && areaOrder.has(project.life_area_id))
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (areaOrder.get(a.life_area_id) ?? 0) - (areaOrder.get(b.life_area_id) ?? 0) ||
        a.id - b.id,
    );
  const colorOf = (lifeAreaId: number) => activeAreas.find((area) => area.id === lifeAreaId)?.color;

  const onReorderAreas = (order: number[]) => {
    const byId = new Map(activeAreas.map((area) => [area.id, area]));
    const key = listLifeAreasQueryKey();
    queryClient.setQueryData<LifeAreaRead[]>(
      key,
      order.flatMap((id) => byId.get(id) ?? []),
    );
    reorderAreas.mutate(
      { body: { life_area_ids: order } },
      { onError: () => queryClient.invalidateQueries({ queryKey: key }) },
    );
  };

  const onReorderProjects = (order: number[]) => {
    const rank = new Map(order.map((id, index) => [id, index]));
    const key = listProjectsQueryKey();
    queryClient.setQueryData<ProjectRead[]>(key, (current) =>
      current?.map((project) => {
        const next = rank.get(project.id);
        return next !== undefined ? { ...project, sort_order: next } : project;
      }),
    );
    reorderProjects.mutate(
      { body: { project_ids: order } },
      { onError: () => queryClient.invalidateQueries({ queryKey: key }) },
    );
  };

  const context: AreasContext = {
    openCreateForm: (prefill) => setFormTarget({ prefill }),
    openNewProject: (lifeAreaId) => setNewProject({ lifeAreaId }),
    openNewRoutine: (title) => setNewRoutine({ title }),
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

        <SortableSidebarNav
          label="Life areas"
          items={activeAreas}
          dropSpotTestId="area-drop-spot"
          onReorder={onReorderAreas}
          to={(area) => `/areas/${area.id}`}
          menuItem={(area) => ({ kind: "area", id: area.id })}
          renderContent={(lifeArea) => (
            <>
              <span
                aria-hidden
                data-area={areaDataAttribute(lifeArea.color)}
                className="mx-1 size-2 shrink-0 rounded-[2px] bg-(--area-solid)"
              />
              <span className="truncate">{lifeArea.title}</span>
            </>
          )}
        >
          {lifeAreas.isError && (
            <p className="px-2 py-1 type-meta text-(--text-danger)">Couldn't load your areas.</p>
          )}
          {lifeAreas.isSuccess && activeAreas.length === 0 && (
            <p className="px-2 py-1 type-meta text-(--text-secondary)">
              No life areas yet. Use + to add one.
            </p>
          )}
        </SortableSidebarNav>

        <div className="my-(--sidebar-divider-space) h-px shrink-0 bg-(--sidebar-divider)" />

        <div className="mb-0.5 flex h-8 items-center gap-2 rounded-(--radius-6) pr-1 has-[a:hover]:bg-(--bg-hover) has-[a[aria-current=page]]:bg-(--bg-hover) has-[a[aria-current=page]]:shadow-[inset_2px_0_0_var(--color-brand-600)]">
          <NavLink
            to="/areas/projects"
            end
            className="flex h-full flex-1 items-center pl-2 text-[13px] leading-[18px] font-semibold tracking-[0.04em] text-(--text-primary) uppercase outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          >
            Projects
          </NavLink>
          {activeAreas.length > 0 && (
            <IconButton label="New project" onPress={() => context.openNewProject()}>
              <Plus />
            </IconButton>
          )}
        </div>
        <SortableSidebarNav
          label="Projects"
          items={activeProjects}
          dropSpotTestId="project-drop-spot"
          onReorder={onReorderProjects}
          to={(project) => projectPath(project.id)}
          menuItem={(project) => ({ kind: "project", id: project.id })}
          renderContent={(project) => (
            <>
              <Folder
                aria-hidden
                data-area={areaDataAttribute(colorOf(project.life_area_id))}
                className="size-4 shrink-0 text-(--area-solid)"
                strokeWidth={2}
              />
              <span className="truncate">{project.title}</span>
            </>
          )}
        >
          {projects.isSuccess && activeProjects.length === 0 && (
            <p className="px-2 py-1 type-meta text-(--text-secondary)">No projects yet.</p>
          )}
        </SortableSidebarNav>

        <div className="my-(--sidebar-divider-space) h-px shrink-0 bg-(--sidebar-divider)" />

        <RoutinesGroup onNew={() => context.openNewRoutine()} />

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
          onCreated={(project) => navigate(projectPath(project.id))}
        />
      )}

      {newRoutine && history.data && (
        <NewRoutineModal
          today={history.data.today}
          title={newRoutine.title}
          lifeAreas={activeAreas}
          projects={activeProjects}
          onClose={() => setNewRoutine(null)}
          onCreated={(routine) => {
            setNewRoutine(null);
            navigate(`/areas/routines/${routine.id}`);
          }}
        />
      )}
    </>
  );
}

/** ROUTINES: the heading opens the routines page and + opens New routine; each active routine
 * shows today's ring (a pause icon while paused), in routine order. */
function RoutinesGroup({ onNew }: { onNew: () => void }) {
  const queryClient = useQueryClient();
  const history = useQuery(getRoutinesHistoryOptions());
  const routines = history.data?.routines ?? [];
  const today = history.data?.today ?? "";
  const reorder = useMutation(reorderRoutinesMutation());

  const onReorder = (order: number[]) => {
    if (!history.data) return;
    const byId = new Map(routines.map((routine) => [routine.id, routine]));
    const key = getRoutinesHistoryQueryKey();
    queryClient.setQueryData<RoutinesHistoryRead>(key, {
      ...history.data,
      routines: order.flatMap((id) => byId.get(id) ?? []),
    });
    reorder.mutate(
      { body: { routine_ids: order } },
      { onError: () => queryClient.invalidateQueries({ queryKey: key }) },
    );
  };

  return (
    <>
      <div className="mb-0.5 flex h-8 items-center gap-2 rounded-(--radius-6) pr-1 has-[a:hover]:bg-(--bg-hover) has-[a[aria-current=page]]:bg-(--bg-hover) has-[a[aria-current=page]]:shadow-[inset_2px_0_0_var(--color-brand-600)]">
        <NavLink
          to="/areas/routines"
          end
          className="flex h-full flex-1 items-center pl-2 text-[13px] leading-[18px] font-semibold tracking-[0.04em] text-(--text-primary) uppercase outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          Routines
        </NavLink>
        <IconButton label="New routine" onPress={onNew}>
          <Plus />
        </IconButton>
      </div>
      <SortableSidebarNav
        label="Routines"
        items={routines}
        dropSpotTestId="routine-drop-spot"
        onReorder={onReorder}
        to={(routine) => `/areas/routines/${routine.id}`}
        menuItem={(routine) => ({ kind: "routine", id: routine.id })}
        renderContent={(routine) => (
          <>
            <RoutineMark routine={routine} today={today} />
            <span className="truncate">{routine.title}</span>
          </>
        )}
      >
        {history.isSuccess && routines.length === 0 && (
          <p className="px-2 py-1 type-meta text-(--text-secondary)">No routines yet.</p>
        )}
      </SortableSidebarNav>
    </>
  );
}

type SidebarMenuItem = ComponentProps<typeof SidebarLink>["item"];

type SortableSidebarNavProps<T extends { id: number }> = {
  label: string;
  items: readonly T[];
  dropSpotTestId: string;
  onReorder: (order: number[]) => void;
  to: (item: T) => string;
  menuItem: (item: T) => SidebarMenuItem;
  renderContent: (item: T) => ReactNode;
  children?: ReactNode;
};

/** Drag-to-reorder sidebar nav shared by Life areas, Projects, and Routines. */
function SortableSidebarNav<T extends { id: number }>({
  label,
  items,
  dropSpotTestId,
  onReorder,
  to,
  menuItem,
  renderContent,
  children,
}: SortableSidebarNavProps<T>) {
  const [dragging, setDragging] = useState<number | null>(null);
  // A drop ends with a click on the row under the pointer, which shouldn't open it.
  const justDropped = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter still opens the row; Space picks the row up and puts it down.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const onDragStart = ({ active }: DragStartEvent) => setDragging(Number(active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    justDropped.current = true;
    setTimeout(() => {
      justDropped.current = false;
    });
    if (!over || active.id === over.id) return;
    const ids = items.map((item) => item.id);
    const from = ids.indexOf(Number(active.id));
    const toIndex = ids.indexOf(Number(over.id));
    if (from < 0 || toIndex < 0) return;
    onReorder(arrayMove(ids, from, toIndex));
  };
  const lifted = items.find((item) => item.id === dragging);

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-(--sidebar-item-gap)"
      onClickCapture={(event) => {
        if (justDropped.current) event.preventDefault();
      }}
    >
      {children}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableSidebarRow
              key={item.id}
              id={item.id}
              to={to(item)}
              menuItem={menuItem(item)}
              dropSpotTestId={dropSpotTestId}
            >
              {renderContent(item)}
            </SortableSidebarRow>
          ))}
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {lifted && (
            <div
              className={`${SIDEBAR_ROW} cursor-grabbing bg-(--bg-surface) text-(--sidebar-item-text) shadow-(--effect-overlay)`}
            >
              <GripVertical
                aria-hidden
                className="-ml-1.5 size-3 shrink-0 text-(--text-tertiary)"
                strokeWidth={2}
              />
              {renderContent(lifted)}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </nav>
  );
}

function SortableSidebarRow({
  id,
  to,
  menuItem,
  dropSpotTestId,
  children,
}: {
  id: number;
  to: string;
  menuItem: SidebarMenuItem;
  dropSpotTestId: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        data-testid={dropSpotTestId}
        className="h-(--sidebar-item-height) rounded-(--radius-6) border-[1.5px] border-dashed border-(--color-neutral-300)"
      />
    );
  }
  // The link is what gets focus (Space lifts the row from there), so the wrapper is neither
  // a button nor a second tab stop.
  const { role: _role, tabIndex: _tabIndex, ...handle } = attributes;
  return (
    <div ref={setNodeRef} style={style} {...handle} {...listeners}>
      <SidebarLink to={to} item={menuItem}>
        {children}
      </SidebarLink>
    </div>
  );
}

function RoutineMark({ routine, today }: { routine: RoutineHistoryRead; today: string }) {
  if (routine.paused_since) {
    return (
      <Pause
        role="img"
        aria-label="Paused"
        className="size-4 shrink-0 fill-(--color-neutral-500) stroke-none"
      />
    );
  }
  const column = routineColumn(routine, today);
  return <ProgressRing done={column.done} total={column.total} className="size-4" />;
}
