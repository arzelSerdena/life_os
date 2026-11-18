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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, MapPin, Repeat } from "lucide-react";
import { type ComponentPropsWithRef, type ReactNode, useState } from "react";
import {
  clearRoutineStepDayMutation,
  listTasksQueryKey,
  reorderTasksMutation,
  setRoutineStepDayMutation,
  updateTaskMutation,
} from "../../client/@tanstack/react-query.gen";
import type { OccurrenceRead, RoutineStepDay, TaskRead } from "../../client/types.gen";
import { QueryError } from "../../components/QueryError";
import { useChangeToast } from "../../stores/changeToastStore";
import { useNewTask } from "../../stores/newTaskStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { itemMenuProps } from "../item-menu/target";
import { areaDataAttribute } from "../life-areas/palette";
import { splitTasks } from "./board";
import { FilterMenu, useViewFilters } from "./FilterMenu";
import { type Filters, openFirst, sortTasks } from "./filters";
import { formatTime, useTimeFormat } from "./format";
import { NewTaskButton } from "./NewTaskModal";
import { spotFor } from "./newTask";
import { usePageSpot } from "./newTaskShortcut";
import {
  applyDrop,
  buildDayColumns,
  canDrag,
  canDrop,
  type DayColumn,
  eventTime,
  NO_DATE,
  type RoutineDay,
} from "./next7";
import { ProgressRing } from "./RoutinesPage";
import { AddButton, Counter, ProjectCard, SubgroupBlock } from "./TaskBoard";
import { TaskCard } from "./TaskCard";
import type { TasksData } from "./TasksLayout";
import { useTasksContext } from "./TasksLayout";
import { dayName } from "./useFileTask";

const TASKS_KEY = listTasksQueryKey({ query: { include_cancelled: true } });

/** Tasks › Next 7 days: No date plus today and the six days after it. */
export function Next7Page() {
  const { data, error } = useTasksContext();
  usePageSpot({}, data?.today);
  return (
    <>
      <header className="box-content flex h-(--page-header-height) shrink-0 items-center gap-3 px-(--page-gutter) pt-(--page-gutter)">
        <h1 className="truncate type-page-title text-(--page-title)">Next 7 days</h1>
        <div className="ml-auto flex items-center gap-2">
          {data && <FilterMenu view="next7" layout="days" lifeAreas={data.lifeAreas} />}
          <NewTaskButton today={data?.today} />
        </div>
      </header>
      {error ? (
        <div className="p-(--page-gutter)">
          <QueryError error={error} />
        </div>
      ) : !data ? (
        <p className="p-(--page-gutter) type-meta text-(--text-tertiary)">Loading…</p>
      ) : (
        <Next7Board data={data} />
      )}
    </>
  );
}

/** Cards keep their places while a task is dragged over them (any sort but Manual). */
const noShift: SortingStrategy = () => null;

/** Where a dragged task is now: each column's open task ids while the drag lasts. */
type Drag = { task: TaskRead; from: string; lists: Record<string, number[]> };

const taskKey = (id: number) => `task:${id}`;

/**
 * The column under the pointer, and the card under it if any (so the slot follows the
 * pointer, not the dragged card's corners); off every column, the nearest one.
 */
const pointerFirst: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length === 0) return closestCorners(args);
  const cards = within.filter((collision) => String(collision.id).startsWith("task:"));
  return cards.length > 0 ? cards : within;
};
const columnKey = (key: string) => `column:${key}`;

/**
 * The board. Dragging a task inside a day reorders it; dragging it to another day schedules
 * it there (No date clears the scheduled date, and only takes tasks with no due date).
 */
function Next7Board({ data }: { data: TasksData }) {
  const queryClient = useQueryClient();
  const showToast = useChangeToast((state) => state.show);
  const update = useMutation(updateTaskMutation());
  const reorder = useMutation(reorderTasksMutation());
  const [drag, setDrag] = useState<Drag | null>(null);
  // A short move starts a drag, so a click still opens the card.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filters = useViewFilters("next7", "days");
  const columns = buildDayColumns(data.tasks, data.days, data.projects, data.today, filters);
  // A day can be reordered by hand only in Manual order with no subgroups; any other sort or
  // a subgroup decides the order, so a drop then only moves the task to another day.
  const reorderable = filters.sort === "manual" && filters.subgroup === "none";
  const byId = new Map(data.tasks.map((task) => [task.id, task]));

  /** The column holding a task or column droppable id, as the drag has it now. */
  const containerOf = (id: string, lists: Record<string, number[]>): string | null => {
    if (id.startsWith("column:")) return id.slice("column:".length);
    const taskId = Number(id.slice("task:".length));
    return Object.keys(lists).find((key) => lists[key].includes(taskId)) ?? null;
  };

  const onDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as TaskRead | undefined;
    const from = event.active.data.current?.column as string | undefined;
    if (!task || !from) return;
    const lists = Object.fromEntries(
      columns.map((column) => [column.key, column.open.map((item) => item.id)]),
    );
    setDrag({ task, from, lists });
  };

  // Moving over another column moves the task's spot there, so that column shows the slot.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!drag || !over) return;
    const current = containerOf(String(active.id), drag.lists);
    const target = containerOf(String(over.id), drag.lists);
    if (!current || !target || current === target || !canDrop(drag.task, target)) return;
    const into = drag.lists[target];
    const overIndex = into.indexOf(Number(String(over.id).slice("task:".length)));
    const at = overIndex === -1 ? into.length : overIndex;
    setDrag({
      ...drag,
      lists: {
        ...drag.lists,
        [current]: drag.lists[current].filter((id) => id !== drag.task.id),
        [target]: [...into.slice(0, at), drag.task.id, ...into.slice(at)],
      },
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const ended = drag;
    setDrag(null);
    if (!ended || !over) return;
    const { task, from } = ended;
    const to = containerOf(String(active.id), ended.lists);
    if (!to) return;
    let order = ended.lists[to];
    const overId = String(over.id);
    if (overId.startsWith("task:")) {
      const overIndex = order.indexOf(Number(overId.slice("task:".length)));
      const index = order.indexOf(task.id);
      if (overIndex !== -1 && overIndex !== index) order = arrayMove(order, index, overIndex);
    }
    const day = to === NO_DATE ? null : to;
    const before = columns.find((column) => column.key === to)?.open.map((item) => item.id);
    if (to === from && (!reorderable || (before && before.join() === order.join()))) return;
    if (!reorderable) order = [];

    // Show the drop at once; the refetch after the save replaces it.
    void queryClient.cancelQueries({ queryKey: TASKS_KEY });
    queryClient.setQueryData<TaskRead[]>(TASKS_KEY, (old) =>
      old ? applyDrop(old, order, to === from ? undefined : { taskId: task.id, day }) : old,
    );
    const saveOrder = () => reorder.mutate({ body: { day, task_ids: order } });
    if (to === from) {
      saveOrder();
      return;
    }
    update.mutate(
      { path: { task_id: task.id }, body: { scheduled_date: day } },
      {
        onSuccess: (change) => {
          if (change.batch_id) {
            const where = day ? `Scheduled “${task.title}” · ${dayName(day, data.today)}` : null;
            showToast(where ?? `Moved “${task.title}” · No date`, change.batch_id);
          }
          if (order.length > 1) saveOrder();
        },
      },
    );
  };

  const colorOf = (lifeAreaId: number | null) =>
    data.lifeAreas.find((area) => area.id === lifeAreaId)?.color ?? null;
  const failed = update.isError || reorder.isError;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerFirst}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      {failed && (
        <p role="alert" className="px-(--page-gutter) pt-2 type-meta text-(--text-danger)">
          Couldn't move the task. Try again.
        </p>
      )}
      <div className="@container min-h-0 flex-1 overflow-x-auto px-(--page-gutter) pt-4">
        <div className="flex h-full min-w-min gap-4">
          {columns.map((column) => {
            const ids = drag?.lists[column.key] ?? column.open.map((task) => task.id);
            const listed = ids.flatMap((id) => byId.get(id) ?? []);
            // The target column's counter shows the dragged task (+1), the source's drops it.
            const shift = drag
              ? Number(ids.includes(drag.task.id)) -
                Number(column.open.some((task) => task.id === drag.task.id))
              : 0;
            return (
              <DayColumnView
                key={column.key}
                column={column}
                open={reorderable ? listed : sortTasks(listed, filters.sort)}
                count={column.count + shift}
                data={data}
                colorOf={colorOf}
                filters={filters}
                reorderable={reorderable}
              />
            );
          })}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {drag && (
          <ul className="w-[260px] cursor-grabbing rounded-(--radius-8) shadow-(--effect-overlay)">
            <TaskCard
              task={drag.task}
              today={data.today}
              areaColor={colorOf(drag.task.life_area_id)}
              project={data.projects.find((project) => project.id === drag.task.project_id)}
              showFlag={filters.subgroup !== "priority"}
              showProject
            />
          </ul>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DayColumnView({
  column,
  open,
  count,
  data,
  colorOf,
  filters,
  reorderable,
}: {
  column: DayColumn;
  open: TaskRead[];
  count: number;
  data: TasksData;
  colorOf: (lifeAreaId: number | null) => string | null;
  filters: Filters;
  reorderable: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: columnKey(column.key) });
  const openNewTask = useNewTask((state) => state.open);
  // The + fills in the day (No date adds nothing) and the subgroup's area or priority.
  const add = (subgroupKey: string | null) =>
    openNewTask(spotFor(column.key, subgroupKey, data.projects), data.today);
  const headingId = `day-${column.key}`;
  const card = (task: TaskRead, containerProps?: ComponentPropsWithRef<"li">) => (
    <TaskCard
      key={task.id}
      task={task}
      today={data.today}
      areaColor={colorOf(task.life_area_id)}
      project={data.projects.find((project) => project.id === task.project_id)}
      showFlag={filters.subgroup !== "priority"}
      showProject
      containerProps={containerProps}
    />
  );
  // Open tasks can be dragged; done and cancelled ones can't.
  const item = (task: TaskRead) =>
    task.status === "todo" ? (
      <SortableTask
        key={task.id}
        task={task}
        column={column.key}
        data={data}
        renderCard={(containerProps) => card(task, containerProps)}
      />
    ) : (
      card(task)
    );
  const subgroups =
    filters.subgroup === "none"
      ? []
      : splitTasks(openFirst([...open, ...column.done]), filters.subgroup, data);
  // The sortable items in the order they are drawn.
  const sortable =
    filters.subgroup === "none"
      ? open
      : subgroups.flatMap((subgroup) => subgroup.tasks.filter((task) => task.status === "todo"));

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 min-w-[260px] flex-[0_0_calc((100cqw_-_64px)/5)] flex-col"
    >
      <header className="shrink-0 px-0.5">
        <div className="flex h-7 items-center gap-2">
          <h2
            id={headingId}
            className="truncate text-base leading-6 font-semibold text-(--text-primary)"
          >
            {column.title}
          </h2>
          <Counter count={count} />
          <AddButton label={`New task in ${column.title}`} onPress={() => add(null)} />
        </div>
        <p className="-mt-0.5 type-meta text-(--text-tertiary)">{column.subtitle}</p>
      </header>
      <div
        ref={setNodeRef}
        data-drop-target={column.key}
        className="mt-3.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-6"
      >
        {column.overdue.length > 0 && (
          <SubgroupBlock
            collapseKey={`next7/${column.key}/overdue`}
            subgroup={{
              key: "overdue",
              label: "Overdue",
              marker: { kind: "none" },
              danger: true,
              tasks: column.overdue,
            }}
          >
            <ul className="flex flex-col gap-1.5">{column.overdue.map((task) => card(task))}</ul>
          </SubgroupBlock>
        )}
        <ul className="flex flex-col gap-1.5">
          {column.routines.map((routine) => (
            <RoutineCard
              key={routine.routineId}
              routine={routine}
              today={data.today}
              colorOf={colorOf}
            />
          ))}
          {column.events.map((event) => (
            <EventCard
              key={`${event.event_id}-${event.occurrence_date}`}
              event={event}
              day={column.key}
              color={colorOf(event.life_area_id)}
            />
          ))}
          {column.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              today={data.today}
              color={colorOf(project.life_area_id)}
            />
          ))}
        </ul>
        <SortableContext
          id={column.key}
          items={sortable.map((task) => taskKey(task.id))}
          strategy={reorderable ? verticalListSortingStrategy : noShift}
        >
          {filters.subgroup === "none" ? (
            <>
              <ul className="flex flex-col gap-1.5">{open.map(item)}</ul>
              {column.done.length > 0 && (
                <ul className="flex flex-col gap-1.5">{column.done.map((task) => card(task))}</ul>
              )}
            </>
          ) : (
            subgroups.map((subgroup) => (
              <SubgroupBlock
                key={subgroup.key}
                collapseKey={`next7/${filters.subgroup}/${column.key}/${subgroup.key}`}
                subgroup={subgroup}
                onAdd={() => add(subgroup.key)}
              >
                <ul className="flex flex-col gap-1.5">{subgroup.tasks.map(item)}</ul>
              </SubgroupBlock>
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}

/** A task card that can be dragged; while it is, its spot shows as a dashed slot. */
function SortableTask({
  task,
  column,
  data,
  renderCard,
}: {
  task: TaskRead;
  column: string;
  data: TasksData;
  renderCard: (containerProps: ComponentPropsWithRef<"li">) => ReactNode;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: taskKey(task.id),
    data: { task, column },
    disabled: !canDrag(task, data.today),
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

/** A routine on a day: progress ring, name, done / total; its steps open below. */
function RoutineCard({
  routine,
  today,
  colorOf,
}: {
  routine: RoutineDay;
  today: string;
  colorOf: (lifeAreaId: number | null) => string | null;
}) {
  const total = routine.steps.length;
  // Today's unfinished routines start open.
  const [open, setOpen] = useState(routine.day === today && routine.done < total);
  const listId = `routine-${routine.routineId}-${routine.day}`;
  return (
    <li
      {...itemMenuProps({ kind: "routine", id: routine.routineId })}
      className="flex flex-col rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 py-2"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="-mx-1 flex items-center gap-2 rounded-(--radius-6) px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
      >
        <ProgressRing done={routine.done} total={total} />
        <span className="min-w-0 flex-1 truncate type-card-title text-(--text-primary)">
          {routine.title}
        </span>
        <span className="type-meta text-(--text-tertiary) tabular-nums">
          {routine.done}/{total}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-[13px] shrink-0 text-(--text-tertiary) transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <ul
          id={listId}
          aria-label={`${routine.title} steps`}
          className="flex flex-col pt-1 pl-[26px]"
        >
          {routine.steps.map((step) => (
            <RoutineStepRow
              key={step.step_id}
              routineId={routine.routineId}
              step={step}
              color={colorOf(step.life_area_id)}
              future={step.day > today}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A step: round checkbox in its area colour. Days that haven't come can't be checked. */
function RoutineStepRow({
  routineId,
  step,
  color,
  future,
}: {
  routineId: number;
  step: RoutineStepDay;
  color: string | null;
  future: boolean;
}) {
  const check = useMutation(setRoutineStepDayMutation());
  const clear = useMutation(clearRoutineStepDayMutation());
  const done = step.status === "done";
  const muted = step.status === "skipped" || step.status === "missed";
  const path = { step_id: step.step_id, day: step.day };
  const toggle = () => {
    if (done) clear.mutate({ path });
    else check.mutate({ path, body: { status: "done" } });
  };
  return (
    <li
      {...itemMenuProps({ kind: "step", id: step.step_id, routineId })}
      data-area={areaDataAttribute(color)}
      className={`flex items-center gap-2 text-xs leading-[22px] ${
        done
          ? "text-(--text-tertiary) line-through"
          : muted
            ? "text-(--text-tertiary)"
            : "text-(--text-secondary)"
      }`}
    >
      <label className="relative -m-[5px] grid size-6 shrink-0 cursor-pointer place-items-center has-disabled:cursor-default">
        <input
          type="checkbox"
          checked={done}
          disabled={future || check.isPending || clear.isPending}
          aria-label={done ? `Mark ${step.title} not done` : `Mark ${step.title} done`}
          onChange={toggle}
          className={`size-3.5 cursor-pointer appearance-none rounded-full border-2 outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:cursor-default ${
            done
              ? "border-(--area-border) bg-(--area-border)"
              : muted
                ? "border-(--color-neutral-300)"
                : "border-(--area-solid)"
          }`}
        />
        {done && (
          <Check
            aria-hidden
            className="pointer-events-none absolute size-2 text-white"
            strokeWidth={3.5}
          />
        )}
      </label>
      <span className="min-w-0 truncate">{step.title}</span>
      {(check.isError || clear.isError) && (
        <span role="alert" className="ml-auto text-(--text-danger) no-underline">
          Couldn't save
        </span>
      )}
    </li>
  );
}

/** The approved event card: the area tint, a calendar badge, the title and when it happens. */
function EventCard({
  event,
  day,
  color,
}: {
  event: OccurrenceRead;
  day: string;
  color: string | null;
}) {
  const timeFormat = useTimeFormat();
  return (
    <li
      data-area={areaDataAttribute(color)}
      className={`relative flex flex-col gap-0.5 rounded-(--radius-8) px-3 py-2 ${
        event.is_past ? "bg-(--event-area-bg-past)" : "bg-(--event-area-bg-upcoming)"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] bg-(--event-area-icon-bg-upcoming) text-(--event-icon)">
          <CalendarDays aria-hidden className="size-[11px]" strokeWidth={2.25} />
        </span>
        <PanelLink
          stretched
          target={{
            kind: "event",
            id: event.event_id,
            day: event.is_repeating ? event.occurrence_date : null,
          }}
          className="line-clamp-2 flex-1 type-card-title text-(--event-title)"
        >
          {event.title}
        </PanelLink>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 pl-6 type-meta text-(--event-meta) [&_svg]:size-3 [&_svg]:shrink-0">
        {event.is_repeating && <Repeat role="img" aria-label="Repeats" strokeWidth={2} />}
        {event.location && <MapPin role="img" aria-label={event.location} strokeWidth={2} />}
        <span>{eventTime(event, day, (value) => formatTime(value, timeFormat))}</span>
      </div>
    </li>
  );
}
