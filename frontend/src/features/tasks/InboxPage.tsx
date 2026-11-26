import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button, Dropdown, Label, Popover } from "@heroui/react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Folder, Sun } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, type ReactNode, useState } from "react";
import type { TaskRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { QueryError } from "../../components/QueryError";
import { Scroll } from "../../components/Scroll";
import { SegmentSwitch } from "../../components/SegmentSwitch";
import { useTaskBoard } from "../../stores/taskBoardStore";
import { areaDataAttribute } from "../life-areas/palette";
import { DatePanel } from "../pickers/DatePicker";
import { PRIORITIES } from "./board";
import { FilterMenu, useClearFilters, useViewFilters } from "./FilterMenu";
import { sortTasks, taskShown } from "./filters";
import {
  addMonths,
  type FileTarget,
  fileCounts,
  inboxList,
  monthGrid,
  monthTitle,
  targetId,
} from "./inbox";
import { NewTaskButton } from "./NewTaskModal";
import { usePageSpot } from "./newTaskShortcut";
import { PRIORITY_COLOR } from "./TaskBoard";
import { TaskCard } from "./TaskCard";
import type { TasksData } from "./TasksLayout";
import { useTasksContext } from "./TasksLayout";
import { useFileTask } from "./useFileTask";

type File = (task: TaskRead, target: FileTarget) => void;

/**
 * The Inbox: open tasks still to be sorted (no area, date or priority) on the left, and a
 * container on the right to file them into (Approved: Tasks › Inbox, with the Nov 16 and
 * Nov 19 decisions). Drag a card onto an area or
 * a project, a day or a priority; or use the card's hover actions, or A, T and D.
 */
export function InboxPage() {
  const { data, error } = useTasksContext();
  usePageSpot({}, data?.today);
  return (
    <>
      <header className="box-content flex h-(--page-header-height) shrink-0 items-center gap-3 px-(--page-gutter) pt-(--page-gutter)">
        <h1 className="truncate type-page-title text-(--page-title)">Inbox</h1>
        <div className="ml-auto flex items-center gap-2">
          {data && <FilterMenu view="inbox" layout="area" lifeAreas={data.lifeAreas} />}
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
        <Inbox data={data} />
      )}
    </>
  );
}

function Inbox({ data }: { data: TasksData }) {
  const { file, error } = useFileTask(data);
  const [dragged, setDragged] = useState<TaskRead | null>(null);
  const [tab, setTab] = useState<"all" | "area" | "scheduled" | "due">("all");
  // A short move starts a drag, so a click still opens the card.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const filters = useViewFilters("inbox", "area");
  const clearFilters = useClearFilters("inbox");
  const inbox = inboxList(data.tasks).filter((task) => {
    if (tab === "area") return task.life_area_id === null;
    if (tab === "scheduled") return task.scheduled_date === null;
    if (tab === "due") return task.due_date === null;
    return true;
  });
  const tasks = sortTasks(
    inbox.filter((task) => taskShown(filters, task)),
    filters.sort,
  );

  const onDragStart = (event: DragStartEvent) =>
    setDragged((event.active.data.current?.task as TaskRead | undefined) ?? null);
  const onDragEnd = (event: DragEndEvent) => {
    setDragged(null);
    const task = event.active.data.current?.task as TaskRead | undefined;
    const target = event.over?.data.current?.target as FileTarget | undefined;
    if (task && target) file(task, target);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragged(null)}
    >
      <div className="@container flex min-h-0 flex-1 gap-6 px-(--page-gutter) pt-[14px]">
        <section
          aria-label="Inbox tasks"
          className="flex min-h-0 min-w-[260px] flex-[0_0_calc((100cqw_-_64px)/5)] flex-col gap-2.5"
        >
          <SegmentSwitch
            label="Inbox filter"
            value={tab}
            options={[
              { key: "all", label: "All" },
              { key: "area", label: "No area" },
              { key: "scheduled", label: "No scheduled" },
              { key: "due", label: "No due" },
            ]}
            onChange={setTab}
          />
          {error && (
            <p role="alert" className="mb-2 type-meta text-(--text-danger)">
              Couldn't file the task. Try again.
            </p>
          )}
          {inbox.length === 0 ? (
            <p className="px-0.5 py-2 type-body text-(--text-tertiary)">Inbox is empty.</p>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-start gap-3 px-0.5 py-2">
              <p className="type-body text-(--text-tertiary)">No tasks match the filters.</p>
              <Button variant="secondary" size="sm" onPress={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <Scroll as="ul" className="flex min-h-0 flex-col gap-1.5 pb-6">
              {tasks.map((task) => (
                <InboxCard
                  key={task.id}
                  task={task}
                  data={data}
                  file={file}
                  dragging={dragged?.id === task.id}
                />
              ))}
            </Scroll>
          )}
        </section>
        <DropContainer data={data} />
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged && (
          <ul className="w-[300px] cursor-grabbing rounded-(--radius-8) shadow-(--effect-overlay)">
            <TaskCard
              task={dragged}
              today={data.today}
              areaColor={areaColorOf(data, dragged)}
              project={projectOf(data, dragged)}
              showFlag
              showProject
            />
          </ul>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** The task's area colour, so a card that already has an area shows it. */
function areaColorOf(data: TasksData, task: TaskRead) {
  return data.lifeAreas.find((area) => area.id === task.life_area_id)?.color ?? null;
}

function projectOf(data: TasksData, task: TaskRead) {
  return data.projects.find((project) => project.id === task.project_id);
}

/** A task card that can be dragged, with Area ▾, Today and Date on hover (keys A, T, D). */
function InboxCard({
  task,
  data,
  file,
  dragging,
}: {
  task: TaskRead;
  data: TasksData;
  file: File;
  dragging: boolean;
}) {
  const [areaOpen, setAreaOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const { setNodeRef, listeners } = useDraggable({ id: `task:${task.id}`, data: { task } });

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    // Only keys pressed on the card itself, not in its menus (portals bubble here too).
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === "a") setAreaOpen(true);
    else if (key === "t") file(task, { kind: "date", date: data.today });
    else if (key === "d") setDateOpen(true);
    else return;
    event.preventDefault();
  };

  return (
    <TaskCard
      task={task}
      today={data.today}
      areaColor={areaColorOf(data, task)}
      project={projectOf(data, task)}
      showFlag
      showProject
      containerProps={{
        ref: setNodeRef,
        ...listeners,
        onKeyDown,
        className: dragging
          ? "border-[1.5px] border-dashed border-(--color-brand-500) bg-(--bg-surface) [&>*]:invisible"
          : "",
      }}
      actions={
        <div
          className={`absolute top-1.5 right-1.5 z-20 items-center gap-1 rounded-(--radius-6) bg-(--bg-surface) group-focus-within/card:flex group-hover/card:flex ${
            areaOpen || dateOpen ? "flex" : "hidden"
          }`}
        >
          <AreaMenu
            task={task}
            data={data}
            file={file}
            isOpen={areaOpen}
            onOpenChange={setAreaOpen}
          />
          <ActionButton
            label={`Schedule ${task.title} for today`}
            shortcut="T"
            onPress={() => file(task, { kind: "date", date: data.today })}
          >
            <Sun aria-hidden strokeWidth={2} />
            Today
          </ActionButton>
          <DatePopover
            task={task}
            today={data.today}
            file={file}
            isOpen={dateOpen}
            onOpenChange={setDateOpen}
          />
        </div>
      }
    />
  );
}

const ACTION =
  "h-6 min-w-0 gap-1 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-1.5 type-tag font-medium text-(--text-secondary) hover:bg-(--color-neutral-100) [&_svg]:size-3";

function ActionButton({
  label,
  shortcut,
  onPress,
  children,
}: {
  label: string;
  shortcut: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button aria-label={label} aria-keyshortcuts={shortcut} onPress={onPress} className={ACTION}>
      {children}
    </Button>
  );
}

/** Area ▾: every area with its active projects under it. */
function AreaMenu({
  task,
  data,
  file,
  isOpen,
  onOpenChange,
}: {
  task: TaskRead;
  data: TasksData;
  file: File;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projectsOf = (areaId: number) =>
    data.projects
      .filter((project) => project.life_area_id === areaId)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  return (
    <Dropdown isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button aria-label={`Move ${task.title} to an area`} aria-keyshortcuts="A" className={ACTION}>
        Area
        <ChevronDown aria-hidden strokeWidth={2} />
      </Button>
      <Dropdown.Popover placement="bottom start" className="max-h-80 min-w-[200px]">
        <Dropdown.Menu
          aria-label="Move to"
          onAction={(key) => {
            const [kind, id] = String(key).split(":");
            file(task, { kind: kind as "area" | "project", id: Number(id) });
          }}
        >
          {data.lifeAreas.flatMap((area) => [
            <Dropdown.Item key={`area:${area.id}`} id={`area:${area.id}`} textValue={area.title}>
              <span
                aria-hidden
                data-area={areaDataAttribute(area.color)}
                className="size-2.5 shrink-0 rounded-[3px] bg-(--area-solid)"
              />
              <Label>{area.title}</Label>
            </Dropdown.Item>,
            ...projectsOf(area.id).map((project) => (
              <Dropdown.Item
                key={`project:${project.id}`}
                id={`project:${project.id}`}
                textValue={project.title}
                className="pl-6"
              >
                <Folder
                  aria-hidden
                  data-area={areaDataAttribute(area.color)}
                  className="size-3.5 shrink-0 text-(--area-solid)"
                  strokeWidth={2}
                />
                <Label>{project.title}</Label>
              </Dropdown.Item>
            )),
          ])}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** Date: the shared date picker (typed date, Today, Tomorrow, Next week, the month). */
function DatePopover({
  task,
  today,
  file,
  isOpen,
  onOpenChange,
}: {
  task: TaskRead;
  today: string;
  file: File;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label={`Schedule ${task.title}`}
        aria-keyshortcuts="D"
        className={`inline-flex items-center ${ACTION}`}
      >
        <CalendarDays aria-hidden strokeWidth={2} />
        Date
      </Popover.Trigger>
      <Popover.Content
        placement="bottom end"
        style={{ width: 252 }}
        className="rounded-[10px] border border-(--border-default) p-0"
      >
        <Popover.Dialog aria-label="Schedule" className="flex flex-col p-1.5 outline-none">
          <DatePanel
            value={task.scheduled_date}
            today={today}
            onPick={(date) => {
              onOpenChange(false);
              if (date && date !== task.scheduled_date) file(task, { kind: "date", date });
            }}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** The right container: Areas | Calendar | Priority, each a set of drop targets. */
function DropContainer({ data }: { data: TasksData }) {
  const panel = useTaskBoard((state) => state.inboxPanel);
  const setPanel = useTaskBoard((state) => state.setInboxPanel);
  const counts = fileCounts(data.tasks);
  return (
    <section
      aria-label="File into"
      className="mb-6 flex min-h-0 min-w-0 flex-1 flex-col rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface)"
    >
      <div className="flex h-14 shrink-0 items-center px-4">
        <SegmentSwitch
          label="File by"
          value={panel}
          options={[
            { key: "areas", label: "Areas" },
            { key: "calendar", label: "Calendar" },
            { key: "priority", label: "Priority" },
          ]}
          onChange={setPanel}
        />
      </div>
      <Scroll className="min-h-0 flex-1 px-4 pb-4">
        {panel === "areas" && <AreasPanel data={data} counts={counts} />}
        {panel === "calendar" && <CalendarPanel today={data.today} counts={counts.dates} />}
        {panel === "priority" && <PriorityPanel counts={counts.priorities} />}
      </Scroll>
    </section>
  );
}

type Counts = ReturnType<typeof fileCounts>;

/** A drop target: an accent-600 2 px border on brand 50 while a card is over it. */
function useDropTarget(target: FileTarget) {
  const { setNodeRef, isOver } = useDroppable({ id: targetId(target), data: { target } });
  const over = isOver ? "border-(--color-brand-600) bg-(--color-brand-50)" : "border-transparent";
  return { ref: setNodeRef, over, isOver };
}

/** The Inbox container's counters take a light tint of their area or priority colour. */
function TintCounter({ count, tint }: { count: number; tint?: string }) {
  return (
    <span
      style={tint ? ({ "--tint": tint } as CSSProperties) : undefined}
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tint,var(--color-neutral-400))_16%,var(--bg-surface))] px-1.5 type-tag font-medium text-(--text-secondary) tabular-nums"
    >
      {count}
    </span>
  );
}

function AreasPanel({ data, counts }: { data: TasksData; counts: Counts }) {
  if (data.lifeAreas.length === 0) {
    return <p className="py-2 type-body text-(--text-tertiary)">No life areas yet.</p>;
  }
  return (
    <div className="columns-3 gap-4">
      {data.lifeAreas.map((area) => (
        <div
          key={area.id}
          data-area={areaDataAttribute(area.color)}
          className="mb-4 flex break-inside-avoid flex-col rounded-[10px] border border-(--area-border) bg-(--area-tint-past) p-1"
        >
          <AreaTarget id={area.id} title={area.title} count={counts.areas.get(area.id) ?? 0} />
          {data.projects
            .filter((project) => project.life_area_id === area.id)
            .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
            .map((project) => (
              <ProjectTarget
                key={project.id}
                id={project.id}
                title={project.title}
                count={counts.projects.get(project.id) ?? 0}
              />
            ))}
        </div>
      ))}
    </div>
  );
}

function AreaTarget({ id, title, count }: { id: number; title: string; count: number }) {
  const { ref, over } = useDropTarget({ kind: "area", id });
  return (
    <div
      ref={ref}
      data-drop-target={`area ${title}`}
      className={`flex h-9 items-center gap-2 rounded-[7px] border-2 px-2 text-sm font-semibold text-(--text-primary) ${over}`}
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] bg-(--area-solid)" />
      <span className="truncate">{title}</span>
      <TintCounter count={count} tint="var(--area-solid)" />
    </div>
  );
}

function ProjectTarget({ id, title, count }: { id: number; title: string; count: number }) {
  const { ref, over, isOver } = useDropTarget({ kind: "project", id });
  return (
    <div
      ref={ref}
      data-drop-target={`project ${title}`}
      className={`mb-0.5 flex h-[30px] items-center gap-2 rounded-(--radius-6) border-2 px-2 type-body text-(--text-primary) ${
        isOver ? over : "border-transparent bg-(--bg-surface)/75"
      }`}
    >
      <Folder aria-hidden className="size-3.5 shrink-0 text-(--area-solid)" strokeWidth={2} />
      <span className="truncate">{title}</span>
      <span className="ml-auto">
        <TintCounter count={count} tint="var(--area-solid)" />
      </span>
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarPanel({ today, counts }: { today: string; counts: Map<string, number> }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const weeks = monthGrid(month);
  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-[10px] border border-(--border-default)">
      <div className="flex h-11 shrink-0 items-center pr-2 pl-3.5">
        <h3 className="text-sm font-semibold text-(--text-primary)">{monthTitle(month)}</h3>
        <span className="ml-auto flex gap-0.5">
          <IconButton label="Previous month" onPress={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Next month" onPress={() => setMonth(addMonths(month, 1))}>
            <ChevronRight />
          </IconButton>
        </span>
      </div>
      <div className="grid shrink-0 grid-cols-7 border-t border-(--border-default)">
        {WEEKDAYS.map((day) => (
          <span key={day} className="px-2.5 py-1.5 text-xs font-medium text-(--text-tertiary)">
            {day}
          </span>
        ))}
      </div>
      <div
        className="grid flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(72px, 1fr))` }}
      >
        {weeks.flat().map((date) => (
          <DayTarget
            key={date}
            date={date}
            today={today}
            inMonth={date.slice(0, 7) === month}
            count={counts.get(date) ?? 0}
          />
        ))}
      </div>
    </div>
  );
}

function DayTarget({
  date,
  today,
  inMonth,
  count,
}: {
  date: string;
  today: string;
  inMonth: boolean;
  count: number;
}) {
  const { ref, isOver } = useDropTarget({ kind: "date", date });
  const isToday = date === today;
  const dim = !inMonth || date < today;
  return (
    <div
      ref={ref}
      data-drop-target={`day ${date}`}
      className={`flex items-start justify-between border-t border-l border-(--border-default) px-2 py-1.5 [&:nth-child(7n+1)]:border-l-0 ${
        isOver ? "bg-(--color-brand-50) shadow-[inset_0_0_0_2px_var(--color-brand-600)]" : ""
      }`}
    >
      <span
        className={`grid h-[22px] min-w-[22px] place-items-center rounded-(--radius-6) type-body font-medium ${
          isToday
            ? "bg-(--color-brand-700) px-1 text-white"
            : dim
              ? "text-(--color-neutral-400)"
              : "text-(--text-primary)"
        }`}
      >
        {Number(date.slice(8))}
      </span>
      {count > 0 && <TintCounter count={count} />}
    </div>
  );
}

function PriorityPanel({ counts }: { counts: Counts["priorities"] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {PRIORITIES.map(({ key, label }) => (
        <PriorityTarget key={key} priority={key} label={label} count={counts.get(key) ?? 0} />
      ))}
    </div>
  );
}

function PriorityTarget({
  priority,
  label,
  count,
}: {
  priority: TaskRead["priority"];
  label: string;
  count: number;
}) {
  const { ref, isOver } = useDropTarget({ kind: "priority", priority });
  return (
    <div
      ref={ref}
      data-drop-target={`priority ${label}`}
      className={`h-40 rounded-[10px] border px-3.5 py-3 ${
        isOver
          ? "border-(--color-brand-600) bg-(--color-brand-50) outline outline-1 outline-(--color-brand-600)"
          : "border-(--border-default)"
      }`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className={`size-3 shrink-0 rounded-[3px] ${PRIORITY_COLOR[priority]}`} />
        <span className="text-base font-semibold text-(--text-primary)">{label}</span>
        <TintCounter count={count} tint={`var(--priority-${priority})`} />
      </div>
    </div>
  );
}
