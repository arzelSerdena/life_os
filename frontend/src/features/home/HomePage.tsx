import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Dropdown, Label } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChartLine, Check, ChevronDown, House, ListChecks, Plus } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  getHomeOptions,
  listLifeAreasOptions,
  listProjectsOptions,
} from "../../client/@tanstack/react-query.gen";
import type { HomeRead, LifeAreaRead, ProjectRead } from "../../client/types.gen";
import { PageHeader } from "../../components/PageHeader";
import { QueryError } from "../../components/QueryError";
import { Scroll } from "../../components/Scroll";
import {
  type HomeCardId,
  type HomeColumnRatios,
  type HomeColumns,
  useHomeStore,
} from "../../stores/homeStore";
import { useNewEvent } from "../../stores/newEventStore";
import { useNewTask } from "../../stores/newTaskStore";
import { usePendingDeletes } from "../../stores/pendingDeleteStore";
import type { RowContext } from "../calendar/AgendaRow";
import { LifeAreaFormModal } from "../life-areas/LifeAreaFormModal";
import { shortDate } from "../life-areas/overview/format";
import { nextFreePalette } from "../life-areas/palette";
import { WEEKDAY_NAMES, weekdayIndex } from "../pickers/dates";
import { NewRoutineModal } from "../routines/NewRoutineModal";
import { formatTime, useTimeFormat } from "../tasks/format";
import { usePageSpot } from "../tasks/newTaskShortcut";
import { DumpNoteCard } from "./DumpNoteCard";
import { comingUpDays, doneCount, isFirstRun, nextUp, withoutPending } from "./home";
import { LogTodayCard } from "./LogTodayCard";
import { MiniCalendarCard } from "./MiniCalendarCard";
import { RoutinesTodayCard } from "./RoutinesTodayCard";
import { ComingUpCard, PushCard } from "./SideCards";
import { TodayCard } from "./TodayCard";

/** The local time as "HH:MM". */
function readNow(): string {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** The local time, updated every half minute for the now line. */
function useNow(): string {
  const [now, setNow] = useState(readNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(readNow()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Home: today, right now. No sidebar and no period switch. */
export function HomePage() {
  const home = useQuery(getHomeOptions());
  const lifeAreas = useQuery(listLifeAreasOptions());
  const projectList = useQuery(listProjectsOptions());
  const pending = usePendingDeletes((state) => state.pending);
  const data = useMemo(() => home.data && withoutPending(home.data, pending), [home.data, pending]);
  const timeFormat = useTimeFormat();
  const now = useNow();
  const today = data?.today;
  usePageSpot({ scheduledDate: today }, today);

  const time = (value: string) => formatTime(value, timeFormat);
  const areas = lifeAreas.data ?? [];
  const projects = projectList.data ?? [];

  if (home.isError) {
    return (
      <main className="flex min-w-0 flex-1 flex-col p-(--page-gutter)">
        <QueryError error={home.error} onRetry={home.refetch} />
      </main>
    );
  }
  if (!data) return <main className="flex-1" />;

  const firstRun = isFirstRun(data);
  const { done, total } = doneCount(data);
  const next = nextUp(data, now, time);
  const line = [total > 0 && `${done} of ${total} done`, next && `Next: ${next}`]
    .filter(Boolean)
    .join(" · ");
  const title = `${WEEKDAY_NAMES[weekdayIndex(data.today)]}, ${shortDate(data.today)}`;

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={title}
        description={firstRun ? null : line || null}
        actions={<NewSplitButton today={data.today} />}
      />
      {firstRun ? (
        <FirstRun home={data} areas={areas} projects={projects} />
      ) : (
        <HomeGrid home={data} areas={areas} projects={projects} now={now} time={time} />
      )}
    </main>
  );
}

function HomeGrid({
  home,
  areas,
  projects,
  now,
  time,
}: {
  home: HomeRead;
  areas: LifeAreaRead[];
  projects: ProjectRead[];
  now: string;
  time: (value: string) => string;
}) {
  const columns = useHomeStore((state) => state.columns);
  const setColumns = useHomeStore((state) => state.setColumns);
  const columnRatios = useHomeStore((state) => state.columnRatios);
  const setColumnRatios = useHomeStore((state) => state.setColumnRatios);
  const resetColumnRatios = useHomeStore((state) => state.resetColumnRatios);
  const gridRef = useRef<HTMLDivElement>(null);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<HomeCardId | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const startResize = (dividerIndex: 0 | 1, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const grid = gridRef.current;
    if (!grid) return;
    const style = getComputedStyle(grid);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const totalWidth = grid.getBoundingClientRect().width - padX - 32; // subtract padding and two 16px gaps
    if (totalWidth <= 0) return;
    const startX = event.clientX;
    const startRatios: HomeColumnRatios = [...columnRatios];
    const sum = startRatios[0] + startRatios[1] + startRatios[2];
    const pairSum = startRatios[dividerIndex] + startRatios[dividerIndex + 1];
    const effectiveMin = Math.min(Math.max(18, (260 / totalWidth) * sum), pairSum / 2);
    const handle = event.currentTarget;
    handle.setPointerCapture?.(event.pointerId);
    setResizingCol(dividerIndex);

    const onMove = (move: PointerEvent) => {
      const deltaRatio = ((move.clientX - startX) / totalWidth) * sum;
      const nextA = Math.min(
        Math.max(startRatios[dividerIndex] + deltaRatio, effectiveMin),
        pairSum - effectiveMin,
      );
      const nextB = pairSum - nextA;
      const next: HomeColumnRatios = [...startRatios];
      next[dividerIndex] = Number(nextA.toFixed(2));
      next[dividerIndex + 1] = Number(nextB.toFixed(2));
      setColumnRatios(next);
    };
    const stop = () => {
      setResizingCol(null);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  const colorOf = (lifeAreaId: number | null) =>
    areas.find((area) => area.id === lifeAreaId)?.color ?? null;
  const context: RowContext = {
    today: home.today,
    colorOf,
    projects,
    areaName: (lifeAreaId) => areas.find((area) => area.id === lifeAreaId)?.title ?? null,
    // Routine steps have their own card; agenda rows on Home never show a routine.
    onRoutine: () => {},
  };
  const days = comingUpDays(home, time);

  const renderCard = (id: HomeCardId): ReactNode => {
    switch (id) {
      case "today":
        return (
          <TodayCard home={home} context={context} now={now} nowLabel={time(now)} time={time} />
        );
      case "routines":
        return <RoutinesTodayCard home={home} colorOf={colorOf} projects={projects} />;
      case "log":
        return <LogTodayCard metrics={home.log} colorOf={colorOf} />;
      case "dump":
        return <DumpNoteCard />;
      case "calendar":
        return <MiniCalendarCard today={home.today} />;
      case "push":
        return <PushCard home={home} colorOf={colorOf} projects={projects} />;
      case "coming":
        return <ComingUpCard home={home} days={days} context={context} />;
    }
  };

  const findColumn = (cols: HomeColumns, id: string): number => {
    if (id.startsWith("col:")) return Number(id.slice(4));
    return cols.findIndex((col) => col.includes(id as HomeCardId));
  };

  const dragSnapshot = useRef<HomeColumns | null>(null);

  const onDragStart = (event: DragStartEvent) => {
    dragSnapshot.current = [[...columns[0]], [...columns[1]], [...columns[2]]];
    setDraggingId(event.active.id as HomeCardId);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as HomeCardId;
    const overId = String(over.id);
    const fromCol = findColumn(columns, activeId);
    const toCol = findColumn(columns, overId);
    if (fromCol === -1 || toCol === -1 || fromCol === toCol) return;

    const next: HomeColumns = [[...columns[0]], [...columns[1]], [...columns[2]]];
    next[fromCol] = next[fromCol].filter((id) => id !== activeId);
    const overIndex = next[toCol].indexOf(overId as HomeCardId);
    if (overIndex === -1) next[toCol].push(activeId);
    else next[toCol].splice(overIndex, 0, activeId);
    setColumns(next);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as HomeCardId;
    const overId = String(over.id);
    const fromCol = findColumn(columns, activeId);
    const toCol = findColumn(columns, overId);
    if (fromCol === -1 || toCol === -1 || fromCol !== toCol) return;
    const oldIndex = columns[fromCol].indexOf(activeId);
    const newIndex = columns[toCol].indexOf(overId as HomeCardId);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const next: HomeColumns = [[...columns[0]], [...columns[1]], [...columns[2]]];
      next[toCol] = arrayMove(next[toCol], oldIndex, newIndex);
      setColumns(next);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        if (dragSnapshot.current) {
          setColumns(dragSnapshot.current);
          dragSnapshot.current = null;
        }
        setDraggingId(null);
      }}
    >
      <div
        ref={gridRef}
        style={{
          gridTemplateColumns: columnRatios.map((r) => `minmax(240px, ${r}fr)`).join(" "),
        }}
        className="grid min-h-0 flex-1 gap-4 px-(--page-gutter) pt-4 pb-(--page-gutter)"
      >
        {columns.map((col, colIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3 columns
          <div key={colIndex} className="relative flex min-h-0 min-w-0 flex-col">
            <HomeColumn id={`col:${colIndex}`} items={col}>
              {col.map((cardId) => (
                <SortableHomeCard key={cardId} id={cardId}>
                  {renderCard(cardId)}
                </SortableHomeCard>
              ))}
            </HomeColumn>
            {colIndex < 2 && (
              // biome-ignore lint/a11y/useSemanticElements: focusable column resizer
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize column ${colIndex + 1}`}
                aria-valuenow={Math.round(columnRatios[colIndex])}
                tabIndex={0}
                onPointerDown={(event) => startResize(colIndex as 0 | 1, event)}
                onDoubleClick={resetColumnRatios}
                data-dragging={resizingCol === colIndex}
                className="group absolute top-0 bottom-0 -right-[13px] z-10 w-2.5 cursor-col-resize outline-none"
              >
                <span className="absolute top-3 bottom-3 left-1 hidden w-0.5 rounded-full bg-brand-400 group-hover:block group-focus-visible:block group-data-[dragging=true]:block" />
                <span className="absolute top-1/2 left-px -mt-[18px] hidden h-9 w-2 rounded-[4px] bg-brand-600 group-hover:block group-focus-visible:block group-data-[dragging=true]:block" />
              </div>
            )}
          </div>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {draggingId ? (
          <div className="w-[340px] cursor-grabbing rounded-(--radius-12) opacity-90 shadow-(--effect-overlay)">
            {renderCard(draggingId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function HomeColumn({
  id,
  items,
  children,
}: {
  id: string;
  items: HomeCardId[];
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      <Scroll
        ref={setNodeRef}
        className="flex min-h-0 min-w-0 flex-col gap-4 overscroll-contain pr-0.5"
      >
        {children}
      </Scroll>
    </SortableContext>
  );
}

function SortableHomeCard({ id, children }: { id: HomeCardId; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const headerListeners = listeners
    ? {
        ...listeners,
        onPointerDown: (event: React.PointerEvent) => {
          const target = event.target as HTMLElement;
          if (!target.closest("header")) return;
          if (target.closest("button, a, input, textarea, select")) return;
          listeners.onPointerDown?.(event);
        },
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...headerListeners}
      className={`[&_header_h2]:cursor-grab ${
        isDragging
          ? "rounded-(--radius-12) border-[1.5px] border-dashed border-(--color-brand-500) bg-(--bg-surface) [&>*]:invisible"
          : ""
      }`}
    >
      {children}
    </div>
  );
}

const ICON = "size-4 shrink-0 text-(--text-tertiary)";

/** New task (scheduled today), and ▾ for Task, Event and Metric entry (not drawn yet). */
function NewSplitButton({ today }: { today: string }) {
  const openNewTask = useNewTask((state) => state.open);
  const openNewEvent = useNewEvent((state) => state.open);
  const newTask = () => openNewTask({ scheduledDate: today }, today);
  return (
    <div className="flex">
      <Button onPress={newTask} className="rounded-r-none">
        <Plus aria-hidden strokeWidth={2} />
        New task
      </Button>
      <Dropdown>
        <Button
          isIconOnly
          aria-label="More to create"
          className="w-[30px] min-w-0 rounded-l-none before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-white/35"
        >
          <ChevronDown aria-hidden />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-[220px]">
          <Dropdown.Menu
            aria-label="Create"
            disabledKeys={["entry"]}
            onAction={(key) => {
              if (key === "task") newTask();
              if (key === "event") openNewEvent({ day: today }, today);
            }}
          >
            <MenuItem id="task" label="Task" icon={<ListChecks aria-hidden className={ICON} />} />
            <MenuItem
              id="event"
              label="Event"
              icon={<CalendarDays aria-hidden className={ICON} />}
            />
            <MenuItem
              id="entry"
              label="Metric entry"
              icon={<ChartLine aria-hidden className={ICON} />}
            />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

function MenuItem({ id, label, icon }: { id: string; label: string; icon: ReactNode }) {
  return (
    <Dropdown.Item id={id} textValue={label}>
      {icon}
      <Label>{label}</Label>
    </Dropdown.Item>
  );
}

/** "Set up Life OS": Life area, Routine and Task, each with its status and New button, and a
 * green check once that kind exists. */
function FirstRun({
  home,
  areas,
  projects,
}: {
  home: HomeRead;
  areas: LifeAreaRead[];
  projects: ProjectRead[];
}) {
  const [creating, setCreating] = useState<"area" | "routine" | null>(null);
  const openNewTask = useNewTask((state) => state.open);
  const navigate = useNavigate();
  const activeAreas = areas.filter((area) => area.archived_at === null);
  const activeProjects = projects.filter(
    (project) => project.status === "active" && project.archived_at === null,
  );
  const { setup } = home;
  return (
    <Scroll
      direction="both"
      className="flex flex-1 flex-col items-center justify-center px-(--page-gutter) pb-16"
    >
      <div className="flex w-full max-w-[460px] flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-(--radius-12) bg-brand-50 text-brand-700">
          <House aria-hidden className="size-6" strokeWidth={2} />
        </span>
        <h2 className="type-page-title text-(--text-primary)">Set up Life OS</h2>
        <p className="type-body text-(--text-secondary)">
          Life areas hold your projects, tasks and metrics. Routines are steps you repeat on a
          schedule.
        </p>
        <ul
          aria-label="Setup"
          className="mt-3 w-full rounded-(--radius-12) border border-(--border-default) px-4 py-1 text-left"
        >
          <SetupRow
            label="Life area"
            name={setup.life_area}
            action="New area"
            onPress={() => setCreating("area")}
          />
          <SetupRow
            label="Routine"
            name={setup.routine}
            action="New routine"
            onPress={() => setCreating("routine")}
          />
          <SetupRow
            label="Task"
            name={setup.task}
            action="New task"
            onPress={() => openNewTask({ scheduledDate: home.today }, home.today)}
          />
        </ul>
      </div>
      {creating === "area" && (
        <LifeAreaFormModal
          lifeAreas={activeAreas}
          defaultColor={nextFreePalette(activeAreas)}
          onClose={() => setCreating(null)}
        />
      )}
      {creating === "routine" && (
        <NewRoutineModal
          today={home.today}
          lifeAreas={activeAreas}
          projects={activeProjects}
          onClose={() => setCreating(null)}
          onCreated={(routine) => {
            setCreating(null);
            navigate(`/areas/routines/${routine.id}`);
          }}
        />
      )}
    </Scroll>
  );
}

function SetupRow({
  label,
  name,
  action,
  onPress,
}: {
  label: string;
  name: string | null;
  action: string;
  onPress: () => void;
}) {
  const done = name !== null;
  return (
    <li className="flex min-h-14 items-center gap-3 not-first:border-t not-first:border-(--color-neutral-100)">
      {done ? (
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-(--color-positive-600) text-white">
          <Check aria-label="Done" className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-hidden
          className="size-5 shrink-0 rounded-full border-2 border-dashed border-(--color-neutral-300)"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-(--text-primary)">{label}</span>
        <span className="truncate type-meta text-(--text-tertiary)">{name ?? "None yet"}</span>
      </span>
      {!done && (
        <Button size="sm" variant="secondary" onPress={onPress}>
          <Plus aria-hidden />
          {action}
        </Button>
      )}
    </li>
  );
}
