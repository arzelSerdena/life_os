import { ChevronDown, Folder } from "lucide-react";
import type { ProjectRead } from "../../client/types.gen";
import { useTaskBoard } from "../../stores/taskBoardStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { daysBetween, shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import type { BoardContext, BoardGroup, Column, Marker, Subgroup, TaskView } from "./board";
import { TaskCard } from "./TaskCard";

type BoardProps = {
  view: TaskView;
  group: BoardGroup;
  columns: Column[];
  context: BoardContext;
};

/** Columns one fifth of the board wide (at least 260 px); more columns scroll sideways. */
export function Board({ view, group, columns, context }: BoardProps) {
  return (
    <div className="@container min-h-0 flex-1 overflow-x-auto px-(--page-gutter) pt-4">
      <div className="flex h-full min-w-min gap-4">
        {columns.map((column) => (
          <BoardColumn
            key={column.key}
            view={view}
            group={group}
            column={column}
            context={context}
          />
        ))}
      </div>
    </div>
  );
}

function BoardColumn({
  view,
  group,
  column,
  context,
}: {
  view: TaskView;
  group: BoardGroup;
  column: Column;
  context: BoardContext;
}) {
  const headingId = `column-${view}-${column.key}`;
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
        <Counter count={column.count} />
      </header>
      <div className="mt-3.5 flex min-h-0 flex-col gap-1.5 overflow-y-auto pb-6">
        {column.subgroups.map((subgroup) =>
          subgroup.label ? (
            <SubgroupBlock
              key={subgroup.key}
              collapseKey={`${view}/${group}/${column.key}/${subgroup.key}`}
              subgroup={subgroup}
            >
              <Cards view={view} group={group} subgroup={subgroup} context={context} />
            </SubgroupBlock>
          ) : (
            <Cards
              key={subgroup.key}
              view={view}
              group={group}
              subgroup={subgroup}
              context={context}
            />
          ),
        )}
      </div>
    </section>
  );
}

export function SubgroupBlock({
  collapseKey,
  subgroup,
  children,
}: {
  collapseKey: string;
  subgroup: Subgroup;
  children: React.ReactNode;
}) {
  const collapsed = useTaskBoard((state) => state.collapsed.includes(collapseKey));
  const toggle = useTaskBoard((state) => state.toggleCollapsed);
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <h3>
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
      </h3>
      {!collapsed && children}
    </div>
  );
}

function Cards({
  view,
  group,
  subgroup,
  context,
}: {
  view: TaskView;
  group: BoardGroup;
  subgroup: Subgroup;
  context: BoardContext;
}) {
  const finished = view === "completed" || view === "cancelled";
  const colorOf = (lifeAreaId: number | null) =>
    context.lifeAreas.find((area) => area.id === lifeAreaId)?.color ?? null;
  return (
    <ul className="flex flex-col gap-1.5">
      {subgroup.project && (
        <ProjectCard
          project={subgroup.project}
          today={context.today}
          color={colorOf(subgroup.project.life_area_id)}
        />
      )}
      {subgroup.tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          today={context.today}
          areaColor={colorOf(task.life_area_id)}
          project={context.projects.find((project) => project.id === task.project_id)}
          showFlag={finished || group !== "priority"}
          showProject={!subgroup.project}
        />
      ))}
    </ul>
  );
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
      className="relative flex flex-col gap-0.5 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 py-2 hover:border-(--color-neutral-300)"
    >
      <div className="flex items-start gap-2">
        <Folder
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-(--area-solid)"
          strokeWidth={2}
        />
        {/* Until the project page exists, a project opens in the detail panel. */}
        <PanelLink
          stretched
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
      <div className="flex items-center gap-2 pl-6 type-meta text-(--text-tertiary)">
        {project.due_date && (
          <span>
            {shortDate(project.due_date)} · {daysBetween(today, project.due_date)}d
          </span>
        )}
        <span className="ml-auto">
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

function MarkerSquare({ marker, size }: { marker: Marker; size: "column" | "subgroup" }) {
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

/** The grey counter pill used everywhere on the board. */
export function Counter({ count }: { count: number }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-(--color-neutral-200) px-1.5 text-[11px] leading-4 font-medium tracking-normal text-(--text-secondary) normal-case">
      {count}
    </span>
  );
}
