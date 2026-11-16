import { Button } from "@heroui/react";
import { Navigate, useParams } from "react-router";
import { QueryError } from "../../components/QueryError";
import { SegmentSwitch } from "../../components/SegmentSwitch";
import { useNewTask } from "../../stores/newTaskStore";
import { type GroupedView, useTaskBoard } from "../../stores/taskBoardStore";
import { type BoardGroup, buildColumns, isTaskView, type TaskView, tasksForView } from "./board";
import { FilterMenu, useClearFilters, useViewFilters } from "./FilterMenu";
import { areaShown, openFirst, sortTasks, taskShown } from "./filters";
import { NewTaskButton } from "./NewTaskModal";
import { spotFor, type TaskSpot } from "./newTask";
import { Board } from "./TaskBoard";
import { useTasksContext } from "./TasksLayout";

const TITLES: Record<TaskView, string> = {
  all: "All",
  today: "Today",
  unscheduled: "Unscheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Says its status once, in the middle of the board. */
const EMPTY: Record<TaskView, string> = {
  all: "No tasks yet.",
  today: "All done for today.",
  unscheduled: "No unscheduled tasks.",
  completed: "No completed tasks.",
  cancelled: "No cancelled tasks.",
};

/** One Tasks view: All, Today, Unscheduled, Completed or Cancelled. */
export function TasksPage() {
  const { view } = useParams();
  const { data, error } = useTasksContext();
  const groups = useTaskBoard((state) => state.groups);
  const setGroup = useTaskBoard((state) => state.setGroup);
  const valid = isTaskView(view);
  const grouped = view === "all" || view === "today" || view === "unscheduled";
  const group: BoardGroup = grouped ? groups[view as GroupedView] : "area";
  const filterView = valid ? view : "all";
  const filters = useViewFilters(filterView, group);
  const clearFilters = useClearFilters(filterView);
  const openNewTask = useNewTask((state) => state.open);

  if (!valid) return <Navigate to="/tasks/all" replace />;

  const finished = view === "completed" || view === "cancelled";
  // What the view lists before any filter, for its own empty state.
  const unfiltered = data ? tasksForView(view, data.tasks, data.today) : [];
  const listed = data
    ? tasksForView(view, data.tasks, data.today, filters.show).filter((task) =>
        taskShown(filters, task),
      )
    : [];
  const tasks = finished ? listed : openFirst(sortTasks(listed, filters.sort));
  // Hidden priorities and areas take their columns with them.
  const columns = data
    ? buildColumns(view, group, tasks, data, filters.subgroup).filter((column) =>
        column.marker.kind === "priority"
          ? !filters.hiddenPriorities.includes(column.marker.priority)
          : column.marker.kind === "area"
            ? areaShown(
                filters,
                column.key === "no-area" ? null : Number(column.key.slice("area-".length)),
              )
            : true,
      )
    : [];
  const showFlag = finished || (group !== "priority" && filters.subgroup !== "priority");
  // A task added in Today is scheduled today, so it shows up where it was added.
  const base: TaskSpot = view === "today" && data ? { scheduledDate: data.today } : {};
  const onAdd = (columnKey: string, subgroupKey: string | null) =>
    data && openNewTask(spotFor(columnKey, subgroupKey, data.projects, base), data.today);

  return (
    <>
      {/* Title, a divider and the group switch on one 32 px row (Approved: Tasks). */}
      <header className="flex h-(--page-header-height) shrink-0 items-center gap-3 px-(--page-gutter) pt-(--page-gutter) box-content">
        <h1 className="truncate type-page-title text-(--page-title)">{TITLES[view]}</h1>
        {grouped && (
          <>
            <span aria-hidden className="h-5 w-px bg-(--border-default)" />
            <SegmentSwitch
              label="Group by"
              value={group}
              options={[
                { key: "priority", label: "Priority" },
                { key: "area", label: "Area" },
              ]}
              onChange={(next) => setGroup(view as GroupedView, next)}
            />
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {data && <FilterMenu view={view} layout={group} lifeAreas={data.lifeAreas} />}
          {grouped && <NewTaskButton spot={base} today={data?.today} />}
        </div>
      </header>
      {error ? (
        <div className="p-(--page-gutter)">
          <QueryError error={error} />
        </div>
      ) : !data ? (
        <p className="p-(--page-gutter) type-meta text-(--text-tertiary)">Loading…</p>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <Board
            view={view}
            group={group}
            columns={columns}
            context={data}
            showFlag={showFlag}
            onAdd={grouped ? onAdd : undefined}
          />
          {tasks.length === 0 &&
            (unfiltered.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
                <p className="type-body text-(--text-secondary)">{EMPTY[view]}</p>
                {view === "all" && (
                  <span className="pointer-events-auto">
                    <NewTaskButton today={data.today} />
                  </span>
                )}
              </div>
            ) : (
              <NoMatch onClear={clearFilters} />
            ))}
        </div>
      )}
    </>
  );
}

/** "No tasks match the filters." with Clear filters, in the middle of the board. */
export function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
      <p className="type-body text-(--text-secondary)">No tasks match the filters.</p>
      <Button variant="secondary" size="sm" onPress={onClear} className="pointer-events-auto">
        Clear filters
      </Button>
    </div>
  );
}
