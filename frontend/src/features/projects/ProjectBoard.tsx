import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  listTasksOptions,
  listTasksQueryKey,
  moveTaskMutation,
  updateTaskMutation,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead, TaskRead } from "../../client/types.gen";
import { QueryError } from "../../components/QueryError";
import { useChangeToast } from "../../stores/changeToastStore";
import { useNewTask } from "../../stores/newTaskStore";
import { isPendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";
import { useTaskBoard } from "../../stores/taskBoardStore";
import type { Column, Subgroup } from "../tasks/board";
import { tasksForView } from "../tasks/board";
import { useClearFilters, useViewFilters } from "../tasks/FilterMenu";
import { openFirst, sectionShown, sortTasks, taskShown } from "../tasks/filters";
import { spotFor, type TaskSpot } from "../tasks/newTask";
import { AddButton, Counter, MarkerSquare, SubgroupBlock } from "../tasks/TaskBoard";
import { TaskCard } from "../tasks/TaskCard";
import { NoMatch } from "../tasks/TasksPage";
import {
  applyDropChange,
  buildProjectColumns,
  type DropChange,
  dropChange,
  dropMessage,
} from "./boardRules";

/** Where a card is dropped: a column, and the subgroup inside it if any. */
type Spot = { columnKey: string; subgroupKey: string | null };
type Drag = { task: TaskRead; from: Spot; over: Spot | null };

const spotId = ({ columnKey, subgroupKey }: Spot) =>
  subgroupKey ? `sub|${columnKey}|${subgroupKey}` : `col|${columnKey}`;

/** The subgroup under the pointer if any, else its column. */
const subgroupFirst: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  const subgroups = within.filter((collision) => String(collision.id).startsWith("sub|"));
  return subgroups.length > 0 ? subgroups : within;
};

/**
 * A project page's Board: the project's tasks in Priority or Section columns (the header's
 * switch), split by the other one or not at all. Dragging an open card to another column or
 * subgroup sets its priority or section, with the undo toast. Each column keeps the board's
 * order (Manual is the placement order), so there is no reordering by hand here.
 */
export function ProjectBoard({
  project,
  area,
  today,
  canAdd,
}: {
  project: ProjectRead;
  area: LifeAreaRead;
  today: string;
  canAdd: boolean;
}) {
  const query = { project_id: project.id, include_cancelled: true };
  const tasksQuery = useQuery(listTasksOptions({ query }));
  const queryClient = useQueryClient();
  const group = useTaskBoard((state) => state.projectGroup);
  const filters = useViewFilters("project", group);
  const clearFilters = useClearFilters("project");
  const pending = usePendingDeletes((state) => state.pending);
  const openNewTask = useNewTask((state) => state.open);
  const showToast = useChangeToast((state) => state.show);
  const move = useMutation(moveTaskMutation());
  const update = useMutation(updateTaskMutation());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  // A short move starts a drag, so a click still opens the card.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (tasksQuery.isError) {
    return (
      <div className="p-(--page-gutter)">
        <QueryError error={tasksQuery.error} onRetry={tasksQuery.refetch} />
      </div>
    );
  }
  if (!tasksQuery.data) return null;

  const all = tasksQuery.data.filter((task) => !isPendingDelete(pending, "task", task.id));
  const unfiltered = tasksForView("all", all, today);
  const listed = tasksForView("all", all, today, filters.show).filter(
    (task) => taskShown(filters, task) && sectionShown(filters, task),
  );
  const tasks = openFirst(sortTasks(listed, filters.sort));
  const sections = project.sections;
  const columns = buildProjectColumns(tasks, sections, group, filters.subgroup).filter((column) =>
    column.marker.kind === "priority"
      ? !filters.hiddenPriorities.includes(column.marker.priority)
      : !filters.hiddenSections.includes(
          column.key === "no-section" ? "none" : Number(column.key.slice("section-".length)),
        ),
  );
  const showFlag = group !== "priority" && filters.subgroup !== "priority";
  const base: TaskSpot = { lifeAreaId: area.id, projectId: project.id };
  const onAdd = canAdd
    ? (columnKey: string, subgroupKey: string | null) =>
        openNewTask(spotFor(columnKey, subgroupKey, [], base), today)
    : undefined;

  // The drop the pointer is over now, if it would change something.
  const pendingChange = drag?.over
    ? dropChange(drag.task, drag.over.columnKey, drag.over.subgroupKey)
    : null;
  const target = pendingChange ? drag?.over : null;

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as { task: TaskRead; from: Spot } | undefined;
    if (data) setDrag({ task: data.task, from: data.from, over: null });
  };
  const onDragOver = ({ over }: DragOverEvent) => {
    if (!drag) return;
    const spot = (over?.data.current as Spot | undefined) ?? null;
    const id = (value: Spot | null) => (value ? spotId(value) : "");
    if (id(spot) !== id(drag.over)) setDrag({ ...drag, over: spot });
  };
  const onDragEnd = ({ over }: DragEndEvent) => {
    const ended = drag;
    setDrag(null);
    const spot = over?.data.current as Spot | undefined;
    if (!ended || !spot) return;
    const change = dropChange(ended.task, spot.columnKey, spot.subgroupKey);
    if (change) void save(ended.task, change);
  };

  /** Shows the drop at once, then saves the section and the priority, each its own batch. */
  const save = async (task: TaskRead, change: DropChange) => {
    const key = listTasksQueryKey({ query });
    setFailed(null);
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<TaskRead[]>(key, (old) =>
      old?.map((item) => (item.id === task.id ? applyDropChange(item, change) : item)),
    );
    const batches: string[] = [];
    try {
      if (change.sectionId !== undefined) {
        const moved = await move.mutateAsync({
          path: { task_id: task.id },
          body: { project_id: project.id, section_id: change.sectionId },
        });
        if (moved.batch_id) batches.push(moved.batch_id);
      }
      if (change.priority !== undefined) {
        const updated = await update.mutateAsync({
          path: { task_id: task.id },
          body: { priority: change.priority },
        });
        if (updated.batch_id) batches.push(updated.batch_id);
      }
    } catch (error) {
      setFailed(error);
      await queryClient.invalidateQueries();
    }
    const last = batches.pop();
    if (last) showToast(dropMessage(task, change, sections), last, batches);
  };

  const colorOf = () => area.color;
  const card = (task: TaskRead, containerProps?: React.ComponentPropsWithRef<"li">) => (
    <TaskCard
      key={task.id}
      task={task}
      today={today}
      areaColor={colorOf()}
      project={project}
      showFlag={showFlag}
      showProject={false}
      containerProps={containerProps}
    />
  );
  const item = (task: TaskRead, from: Spot) =>
    task.status === "todo" ? (
      <DraggableTask
        key={task.id}
        task={task}
        from={from}
        renderCard={(props) => card(task, props)}
      />
    ) : (
      card(task)
    );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={subgroupFirst}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      {failed !== null && (
        <div className="px-(--page-gutter) pt-2">
          <QueryError error={failed} />
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="@container min-h-0 flex-1 overflow-x-auto px-(--page-gutter) pt-4">
          <div className="flex h-full min-w-min gap-4">
            {columns.map((column) => {
              // The target column's counter shows the dragged card (+1), the source's drops it.
              const shift =
                drag && target && target.columnKey !== drag.from.columnKey
                  ? Number(column.key === target.columnKey) -
                    Number(column.key === drag.from.columnKey)
                  : 0;
              return (
                <BoardColumn
                  key={column.key}
                  group={group}
                  column={column}
                  count={column.count + shift}
                  target={target ?? null}
                  onAdd={onAdd}
                  renderItem={item}
                />
              );
            })}
          </div>
        </div>
        {tasks.length === 0 &&
          (unfiltered.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
              <p className="type-body text-(--text-secondary)">No tasks yet.</p>
              {canAdd && (
                <Button
                  size="sm"
                  onPress={() => openNewTask(base, today)}
                  className="button--area pointer-events-auto"
                >
                  <Plus aria-hidden />
                  Add task
                </Button>
              )}
            </div>
          ) : (
            <NoMatch onClear={clearFilters} />
          ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {drag && (
          <ul className="w-[260px] cursor-grabbing rounded-(--radius-8) shadow-(--effect-overlay)">
            {card(drag.task)}
          </ul>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  group,
  column,
  count,
  target,
  onAdd,
  renderItem,
}: {
  group: string;
  column: Column;
  count: number;
  target: Spot | null;
  onAdd?: (columnKey: string, subgroupKey: string | null) => void;
  renderItem: (task: TaskRead, from: Spot) => ReactNode;
}) {
  const spot: Spot = { columnKey: column.key, subgroupKey: null };
  const { setNodeRef } = useDroppable({ id: spotId(spot), data: spot });
  const headingId = `project-column-${column.key}`;
  const isTarget = target?.columnKey === column.key;
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 min-w-[260px] flex-[0_0_calc((100cqw_-_64px)/5)] flex-col"
    >
      <header className="flex h-7 shrink-0 items-center gap-2">
        <MarkerSquare marker={column.marker} size="column" />
        <h2
          id={headingId}
          className="truncate text-base leading-6 font-semibold text-(--text-primary)"
        >
          {column.title}
        </h2>
        <Counter count={count} />
        {onAdd && (
          <AddButton
            label={`New task in ${column.title}`}
            onPress={() => onAdd(column.key, null)}
          />
        )}
      </header>
      <div
        ref={setNodeRef}
        data-drop-target={column.key}
        className="mt-3.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-6"
      >
        {column.subgroups.map((subgroup) =>
          subgroup.label ? (
            <SubgroupDrop
              key={subgroup.key}
              group={group}
              column={column}
              subgroup={subgroup}
              isTarget={isTarget && target?.subgroupKey === subgroup.key}
              onAdd={onAdd && (() => onAdd(column.key, subgroup.key))}
              renderItem={renderItem}
            />
          ) : (
            <ul key={subgroup.key} className="flex flex-col gap-1.5">
              {subgroup.tasks.map((task) => renderItem(task, spot))}
            </ul>
          ),
        )}
        {isTarget && target?.subgroupKey === null && <DropSlot />}
      </div>
    </section>
  );
}

/** A subgroup that takes drops: they set its property as well as the column's. */
function SubgroupDrop({
  group,
  column,
  subgroup,
  isTarget,
  onAdd,
  renderItem,
}: {
  group: string;
  column: Column;
  subgroup: Subgroup;
  isTarget: boolean;
  onAdd?: () => void;
  renderItem: (task: TaskRead, from: Spot) => ReactNode;
}) {
  const spot: Spot = { columnKey: column.key, subgroupKey: subgroup.key };
  const { setNodeRef } = useDroppable({ id: spotId(spot), data: spot });
  return (
    <div ref={setNodeRef} data-drop-target={`${column.key}/${subgroup.key}`}>
      <SubgroupBlock
        collapseKey={`project/${group}/${column.key}/${subgroup.key}`}
        subgroup={subgroup}
        onAdd={onAdd}
      >
        <ul className="flex flex-col gap-1.5">
          {subgroup.tasks.map((task) => renderItem(task, spot))}
          {isTarget && <DropSlot />}
        </ul>
      </SubgroupBlock>
    </div>
  );
}

/** The drop spot: a dashed outline (dashed borders mean drag-and-drop only). */
function DropSlot() {
  return (
    <li
      aria-hidden
      className="h-14 shrink-0 list-none rounded-(--radius-8) border-[1.5px] border-dashed border-(--color-brand-500) bg-(--bg-surface)"
    />
  );
}

/** An open task's card that can be dragged; while it is, its own spot shows as a dashed slot. */
function DraggableTask({
  task,
  from,
  renderCard,
}: {
  task: TaskRead;
  from: Spot;
  renderCard: (containerProps: React.ComponentPropsWithRef<"li">) => ReactNode;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { task, from },
  });
  if (isDragging) {
    return (
      <li
        ref={setNodeRef}
        aria-hidden
        className="h-14 shrink-0 rounded-(--radius-8) border-[1.5px] border-dashed border-(--color-neutral-300) bg-(--bg-surface)"
      />
    );
  }
  return renderCard({ ref: setNodeRef, ...listeners });
}
