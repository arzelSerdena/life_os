import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  type SortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Folder, Plus } from "lucide-react";
import { type ComponentPropsWithRef, type ReactNode, useState } from "react";
import {
  listTasksQueryKey,
  moveTaskMutation,
  reorderTasksMutation,
  updateTaskMutation,
} from "../../client/@tanstack/react-query.gen";
import type { ProjectRead, TaskRead } from "../../client/types.gen";
import { Counter } from "../../components/Counter";
import { Scroll } from "../../components/Scroll";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { useTaskBoard } from "../../stores/taskBoardStore";
import { EventRow } from "../calendar/AgendaRow";
import { PanelLink } from "../detail-panel/PanelLink";
import { daysBetween, shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import {
  type BoardContext,
  type BoardGroup,
  type Column,
  type Marker,
  placementDate,
  type Subgroup,
  type SubgroupBy,
  type TaskView,
} from "./board";
import type { SortKey } from "./filters";
import { spotFor } from "./newTask";
import { TaskCard } from "./TaskCard";

const TASKS_KEY = listTasksQueryKey({ query: { include_cancelled: true } });

type Spot = { columnKey: string; subgroupKey: string | null };
type DragState = { task: TaskRead; from: Spot; over: Spot | null };

const taskKey = (id: number) => `task:${id}`;
const spotId = ({ columnKey, subgroupKey }: Spot) =>
  subgroupKey ? `sub|${columnKey}|${subgroupKey}` : `col|${columnKey}`;

/** Cards keep their places while a task is dragged over them (any sort but Manual). */
const noShift: SortingStrategy = () => null;

const boardCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length === 0) return closestCorners(args);
  const tasks = within.filter((c) => String(c.id).startsWith("task:"));
  if (tasks.length > 0) return tasks;
  const subgroups = within.filter((c) => String(c.id).startsWith("sub|"));
  return subgroups.length > 0 ? subgroups : within;
};

type BoardProps = {
  view: TaskView;
  group: BoardGroup;
  subgroupBy?: SubgroupBy;
  sort?: SortKey;
  columns: Column[];
  context: BoardContext;
  /** False where the columns or subgroups already show priority. */
  showFlag: boolean;
  /** The column and subgroup +: New task pre-filled with that spot. */
  onAdd?: (columnKey: string, subgroupKey: string | null) => void;
};

/** Columns one fifth of the board wide (at least 260 px); more columns scroll sideways. */
export function Board({
  view,
  group,
  subgroupBy = "none",
  sort = "manual",
  columns,
  context,
  showFlag,
  onAdd,
}: BoardProps) {
  const queryClient = useQueryClient();
  const showToast = useChangeToast((state) => state.show);
  const update = useMutation(updateTaskMutation());
  const move = useMutation(moveTaskMutation());
  const reorder = useMutation(reorderTasksMutation());
  const [drag, setDrag] = useState<DragState | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const finished = view === "completed" || view === "cancelled";
  const reorderable = !finished && sort === "manual" && subgroupBy === "none";

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as { task: TaskRead; spot: Spot } | undefined;
    if (data) setDrag({ task: data.task, from: data.spot, over: null });
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!drag || !over) return;
    const overData = over.data.current as
      | { spot?: Spot; columnKey?: string; subgroupKey?: string | null }
      | undefined;
    const spot: Spot | null = overData?.spot
      ? overData.spot
      : overData?.columnKey
        ? { columnKey: overData.columnKey, subgroupKey: overData.subgroupKey ?? null }
        : null;
    if (!spot || spot.subgroupKey === "overdue") return;
    if (!drag.over || spotId(spot) !== spotId(drag.over)) {
      setDrag({ ...drag, over: spot });
    }
  };

  const onDragEnd = async ({ over }: DragEndEvent) => {
    const ended = drag;
    setDrag(null);
    if (!ended || !over) return;
    const overId = String(over.id);
    const overData = over.data.current as
      | {
          task?: TaskRead;
          spot?: Spot;
          columnKey?: string;
          subgroupKey?: string | null;
        }
      | undefined;
    const to: Spot | null = overData?.spot
      ? overData.spot
      : overData?.columnKey
        ? { columnKey: overData.columnKey, subgroupKey: overData.subgroupKey ?? null }
        : null;
    if (!to || to.subgroupKey === "overdue") return;

    const { task, from } = ended;
    const sameSpot = from.columnKey === to.columnKey && from.subgroupKey === to.subgroupKey;

    if (sameSpot) {
      if (!reorderable || !overId.startsWith("task:")) return;
      const col = columns.find((c) => c.key === to.columnKey);
      const openTasks =
        col?.subgroups.flatMap((s) => s.tasks).filter((t) => t.status === "todo") ?? [];
      const ids = openTasks.map((t) => t.id);
      const oldIndex = ids.indexOf(task.id);
      const newIndex = ids.indexOf(Number(overId.slice("task:".length)));
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(openTasks, oldIndex, newIndex);
      const day = view === "unscheduled" ? null : placementDate(task);
      const dayIds = reordered
        .filter((t) => (view === "unscheduled" ? true : placementDate(t) === day))
        .map((t) => t.id);
      if (dayIds.length < 2) return;

      void queryClient.cancelQueries({ queryKey: TASKS_KEY });
      queryClient.setQueryData<TaskRead[]>(TASKS_KEY, (old) => {
        if (!old) return old;
        const orderMap = new Map(dayIds.map((id, idx) => [id, idx]));
        return old.map((t) =>
          orderMap.has(t.id) ? { ...t, sort_order: orderMap.get(t.id) ?? t.sort_order } : t,
        );
      });
      reorder.mutate({ body: { day, task_ids: dayIds } });
      return;
    }

    const rawSpot = spotFor(to.columnKey, to.subgroupKey, context.projects, {});
    const spot = to.subgroupKey === "no-project" ? { ...rawSpot, projectId: null } : rawSpot;
    const priorityChanged = spot.priority !== undefined && spot.priority !== task.priority;
    const areaChanged = spot.lifeAreaId !== undefined && spot.lifeAreaId !== task.life_area_id;
    const projectChanged = spot.projectId !== undefined && spot.projectId !== task.project_id;
    if (!priorityChanged && !areaChanged && !projectChanged) return;

    void queryClient.cancelQueries({ queryKey: TASKS_KEY });
    queryClient.setQueryData<TaskRead[]>(TASKS_KEY, (old) =>
      old?.map((t) =>
        t.id === task.id
          ? {
              ...t,
              priority: spot.priority ?? t.priority,
              life_area_id: spot.lifeAreaId !== undefined ? spot.lifeAreaId : t.life_area_id,
              project_id: spot.projectId !== undefined ? spot.projectId : t.project_id,
            }
          : t,
      ),
    );

    const batches: string[] = [];
    try {
      if (areaChanged || projectChanged) {
        const res = await move.mutateAsync({
          path: { task_id: task.id },
          body: {
            life_area_id: spot.lifeAreaId !== undefined ? spot.lifeAreaId : task.life_area_id,
            project_id: spot.projectId !== undefined ? spot.projectId : null,
          },
        });
        if (res.batch_id) batches.push(res.batch_id);
      }
      if (priorityChanged && spot.priority) {
        const res = await update.mutateAsync({
          path: { task_id: task.id },
          body: { priority: spot.priority },
        });
        if (res.batch_id) batches.push(res.batch_id);
      }
      const last = batches.pop();
      if (last) {
        const destCol = columns.find((c) => c.key === to.columnKey)?.title ?? "updated";
        showToast(`Moved “${task.title}” · ${destCol}`, last, batches);
      }
    } catch {
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    }
  };

  const colorOf = (lifeAreaId: number | null) =>
    context.lifeAreas.find((area) => area.id === lifeAreaId)?.color ?? null;
  const panelOpen = useDetailPanel((state) => state.target !== null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(event) => void onDragEnd(event)}
      onDragCancel={() => setDrag(null)}
    >
      <Scroll
        direction="horizontal"
        fade={!panelOpen}
        className="@container min-h-0 flex-1 px-(--page-gutter) pt-4"
      >
        <div className="flex h-full min-w-min gap-4">
          {columns.map((column) => (
            <BoardColumn
              key={column.key}
              view={view}
              group={group}
              column={column}
              context={context}
              showFlag={showFlag}
              reorderable={reorderable}
              canDrag={!finished}
              target={drag?.over ?? null}
              onAdd={onAdd}
            />
          ))}
        </div>
      </Scroll>
      <DragOverlay dropAnimation={null}>
        {drag ? (
          <ul className="w-[260px] cursor-grabbing rounded-(--radius-8) shadow-(--effect-overlay)">
            <TaskCard
              task={drag.task}
              today={context.today}
              areaColor={colorOf(drag.task.life_area_id)}
              project={context.projects.find((p) => p.id === drag.task.project_id)}
              showFlag={showFlag}
              showProject
            />
          </ul>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  view,
  group,
  column,
  context,
  showFlag,
  reorderable,
  canDrag,
  target,
  onAdd,
}: {
  view: TaskView;
  group: BoardGroup;
  column: Column;
  context: BoardContext;
  showFlag: boolean;
  reorderable: boolean;
  canDrag: boolean;
  target: Spot | null;
  onAdd?: (columnKey: string, subgroupKey: string | null) => void;
}) {
  const headingId = `column-${view}-${column.key}`;
  const { setNodeRef } = useDroppable({
    id: spotId({ columnKey: column.key, subgroupKey: null }),
    data: { columnKey: column.key, subgroupKey: null },
  });
  const isArea = column.marker.kind === "area" && column.key.startsWith("area-");
  const areaId = isArea ? Number(column.key.slice("area-".length)) : null;
  const columnOver = target?.columnKey === column.key && target.subgroupKey === null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 min-w-[260px] flex-[0_0_calc((100cqw_-_64px)/5)] flex-col"
    >
      <header className="flex h-7 shrink-0 items-center gap-2">
        <MarkerSquare marker={column.marker} size="column" />
        <h2
          id={headingId}
          className="min-w-0 truncate text-base leading-6 font-semibold text-(--text-primary)"
        >
          {areaId !== null ? (
            <PanelLink
              target={{ kind: "area", id: areaId }}
              className="truncate text-base leading-6 font-semibold text-(--text-primary)"
            >
              {column.title}
            </PanelLink>
          ) : (
            column.title
          )}
        </h2>
        <Counter count={column.count} />
        {onAdd && (
          <AddButton
            label={`New task in ${column.title}`}
            onPress={() => onAdd(column.key, null)}
          />
        )}
      </header>
      <Scroll
        ref={setNodeRef}
        className={`mt-3.5 flex min-h-0 flex-1 flex-col gap-1.5 rounded-(--radius-8) pb-6 transition-colors ${
          columnOver ? "bg-brand-50/40" : ""
        }`}
      >
        {column.events && column.events.length > 0 && (
          <ul className="flex flex-col">
            {column.events.map((ev) => (
              <EventRow
                key={`${ev.event_id}-${ev.occurrence_date}`}
                event={ev}
                color={context.lifeAreas.find((a) => a.id === ev.life_area_id)?.color ?? null}
              />
            ))}
          </ul>
        )}
        {column.subgroups.map((subgroup) => {
          const spot: Spot = { columnKey: column.key, subgroupKey: subgroup.key };
          const items = canDrag
            ? subgroup.tasks.filter((t) => t.status === "todo").map((t) => taskKey(t.id))
            : [];
          const cards = (
            <SortableContext
              id={spotId(spot)}
              items={items}
              strategy={reorderable ? verticalListSortingStrategy : noShift}
            >
              <Cards
                subgroup={subgroup}
                context={context}
                showFlag={showFlag}
                spot={spot}
                canDrag={canDrag}
              />
            </SortableContext>
          );
          if (subgroup.label) {
            return (
              <DroppableSubgroupBlock
                key={subgroup.key}
                collapseKey={`${view}/${group}/${column.key}/${subgroup.key}`}
                subgroup={subgroup}
                spot={spot}
                isOver={target?.columnKey === column.key && target.subgroupKey === subgroup.key}
                onAdd={onAdd && (() => onAdd(column.key, subgroup.key))}
              >
                {cards}
              </DroppableSubgroupBlock>
            );
          }
          return <div key={subgroup.key}>{cards}</div>;
        })}
      </Scroll>
    </section>
  );
}

function DroppableSubgroupBlock({
  collapseKey,
  subgroup,
  spot,
  isOver,
  onAdd,
  children,
}: {
  collapseKey: string;
  subgroup: Subgroup;
  spot: Spot;
  isOver: boolean;
  onAdd?: () => void;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: spotId(spot),
    data: spot,
    disabled: subgroup.key === "overdue",
  });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-(--radius-8) transition-colors ${isOver ? "bg-brand-50/50" : ""}`}
    >
      <SubgroupBlock collapseKey={collapseKey} subgroup={subgroup} onAdd={onAdd}>
        {children}
      </SubgroupBlock>
    </div>
  );
}

export function SubgroupBlock({
  collapseKey,
  subgroup,
  onAdd,
  children,
}: {
  collapseKey: string;
  subgroup: Subgroup;
  /** The subgroup's +, shown on hover. */
  onAdd?: () => void;
  children: ReactNode;
}) {
  const collapsed = useTaskBoard((state) => state.collapsed.includes(collapseKey));
  const toggle = useTaskBoard((state) => state.toggleCollapsed);
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <h3 className="group/subgroup relative flex items-center">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => toggle(collapseKey)}
          className={`flex h-6 w-full items-center gap-1.5 rounded-(--radius-6) px-0.5 text-xs leading-4 font-semibold tracking-[0.04em] uppercase outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
            subgroup.danger ? "text-(--text-danger)" : "text-(--text-tertiary)"
          }`}
        >
          <ChevronDown
            aria-hidden
            className={`size-3 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            strokeWidth={2}
          />
          <MarkerSquare marker={subgroup.marker} size="subgroup" />
          <span className="truncate">{subgroup.label}</span>
          <Counter count={subgroup.tasks.length} />
        </button>
        {onAdd && (
          <span className="absolute right-0.5 opacity-0 group-hover/subgroup:opacity-100 has-[:focus-visible]:opacity-100">
            <AddButton label={`New task in ${subgroup.label}`} small onPress={onAdd} />
          </span>
        )}
      </h3>
      {!collapsed && children}
    </div>
  );
}

function Cards({
  subgroup,
  context,
  showFlag,
  spot,
  canDrag,
}: {
  subgroup: Subgroup;
  context: BoardContext;
  showFlag: boolean;
  spot: Spot;
  canDrag: boolean;
}) {
  const colorOf = (lifeAreaId: number | null) =>
    context.lifeAreas.find((area) => area.id === lifeAreaId)?.color ?? null;
  const renderCard = (task: TaskRead, containerProps?: ComponentPropsWithRef<"li">) => (
    <TaskCard
      key={task.id}
      task={task}
      today={context.today}
      areaColor={colorOf(task.life_area_id)}
      project={context.projects.find((project) => project.id === task.project_id)}
      showFlag={showFlag}
      showProject={!subgroup.project}
      containerProps={containerProps}
    />
  );

  return (
    <ul className="flex flex-col gap-1.5">
      {subgroup.project && (
        <ProjectCard
          project={subgroup.project}
          today={context.today}
          color={colorOf(subgroup.project.life_area_id)}
        />
      )}
      {subgroup.tasks.map((task) =>
        canDrag && task.status === "todo" ? (
          <SortableBoardTask
            key={task.id}
            task={task}
            spot={spot}
            renderCard={(props) => renderCard(task, props)}
          />
        ) : (
          renderCard(task)
        ),
      )}
    </ul>
  );
}

function SortableBoardTask({
  task,
  spot,
  renderCard,
}: {
  task: TaskRead;
  spot: Spot;
  renderCard: (containerProps: ComponentPropsWithRef<"li">) => ReactNode;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: taskKey(task.id),
    data: { task, spot },
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  if (isDragging) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        aria-hidden
        className="h-14 shrink-0 rounded-(--radius-8) border-[1.5px] border-dashed border-(--color-brand-500) bg-(--bg-surface)"
      />
    );
  }
  return renderCard({ ref: setNodeRef, style, ...listeners });
}

/** The project leading its subgroup: folder, name, progress bar, due date and done / total. */
export function ProjectCard({
  project,
  today,
  color,
}: {
  project: ProjectRead;
  today: string;
  color: string | null;
}) {
  const { done, total } = project.progress;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <li
      data-area={areaDataAttribute(color)}
      className="relative flex flex-col gap-0.5 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 py-2 hover:border-(--border-strong)"
    >
      <div className="flex items-start gap-2">
        <Folder
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-(--area-solid)"
          strokeWidth={2}
        />
        <PanelLink
          stretched
          openInPanel
          target={{ kind: "project", id: project.id }}
          className="line-clamp-2 flex-1 type-card-title text-(--text-primary)"
        >
          {project.title}
        </PanelLink>
      </div>
      <div
        role="progressbar"
        aria-label={`${project.title} progress`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1 mb-0.5 ml-6 h-1 rounded-[2px] bg-(--progress-track)"
      >
        <div
          className="h-full rounded-[2px] bg-(--progress-fill)"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden pl-6 type-meta text-(--text-tertiary)">
        {project.due_date && (
          <span className="truncate">
            {shortDate(project.due_date)} · {daysBetween(today, project.due_date)}d
          </span>
        )}
        <span className="ml-auto shrink-0 tabular-nums">
          {done} / {total}
        </span>
      </div>
    </li>
  );
}

/** The priority squares' fills (High, Medium, Low, No priority). */
export const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-(--priority-high)",
  medium: "bg-(--priority-medium)",
  low: "bg-(--priority-low)",
  none: "bg-(--priority-none)",
};

export function MarkerSquare({ marker, size }: { marker: Marker; size: "column" | "subgroup" }) {
  if (marker.kind === "none") return null;
  if (marker.kind === "project") {
    return (
      <Folder
        aria-hidden
        data-area={areaDataAttribute(marker.color)}
        className={`${size === "column" ? "size-4" : "size-[13px]"} shrink-0 text-(--area-solid)`}
        strokeWidth={2}
      />
    );
  }
  const square = size === "column" ? "size-3 rounded-[3px]" : "size-2 rounded-[2px]";
  if (marker.kind === "priority") {
    return <span aria-hidden className={`${square} shrink-0 ${PRIORITY_COLOR[marker.priority]}`} />;
  }
  return (
    <span
      aria-hidden
      data-area={areaDataAttribute(marker.color)}
      className={`${square} shrink-0 bg-(--area-solid)`}
    />
  );
}

/** The + of a column (always shown) or a subgroup (on hover). */
export function AddButton({
  label,
  small = false,
  onPress,
}: {
  label: string;
  small?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      isIconOnly
      variant="ghost"
      aria-label={label}
      onPress={onPress}
      className={`${small ? "size-5 [&_svg]:size-3.5" : "ml-auto size-6 [&_svg]:size-4"} min-w-0 shrink-0 rounded-(--radius-6) text-(--text-tertiary) hover:bg-(--color-neutral-200) hover:text-(--text-primary)`}
    >
      <Plus aria-hidden strokeWidth={2} />
    </Button>
  );
}

export { Counter };
