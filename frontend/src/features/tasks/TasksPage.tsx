import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Navigate, useParams } from "react-router";
import { QueryError } from "../../components/QueryError";
import { type GroupedView, useTaskBoard } from "../../stores/taskBoardStore";
import { type BoardGroup, buildColumns, isTaskView, type TaskView, tasksForView } from "./board";
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

  if (!isTaskView(view)) return <Navigate to="/tasks/all" replace />;

  const grouped = view === "all" || view === "today" || view === "unscheduled";
  const group: BoardGroup = grouped ? groups[view as GroupedView] : "area";
  const tasks = data ? tasksForView(view, data.tasks, data.today) : [];
  const columns = data ? buildColumns(view, group, tasks, data) : [];

  return (
    <>
      {/* Title, a divider and the group switch on one 32 px row (Approved: Tasks). */}
      <header className="flex h-(--page-header-height) shrink-0 items-center gap-3 px-(--page-gutter) pt-(--page-gutter) box-content">
        <h1 className="truncate type-page-title text-(--page-title)">{TITLES[view]}</h1>
        {grouped && (
          <>
            <span aria-hidden className="h-5 w-px bg-(--border-default)" />
            <GroupSwitch value={group} onChange={(next) => setGroup(view as GroupedView, next)} />
          </>
        )}
      </header>
      {error ? (
        <div className="p-(--page-gutter)">
          <QueryError error={error} />
        </div>
      ) : !data ? (
        <p className="p-(--page-gutter) type-meta text-(--text-tertiary)">Loading…</p>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <Board view={view} group={group} columns={columns} context={data} />
          {tasks.length === 0 && (
            <p className="pointer-events-none absolute inset-0 grid place-items-center type-body text-(--text-secondary)">
              {EMPTY[view]}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function GroupSwitch({
  value,
  onChange,
}: {
  value: BoardGroup;
  onChange: (group: BoardGroup) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Group by"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [selected] = keys;
        onChange(selected as BoardGroup);
      }}
      className="h-7 gap-0 rounded-(--switch-container-radius) bg-(--switch-container-bg) p-0.5"
    >
      {(["priority", "area"] as const).map((key) => (
        <ToggleButton
          key={key}
          id={key}
          className="h-6 min-w-0 rounded-(--switch-item-radius) bg-transparent px-3 text-xs font-medium text-(--switch-default-text) hover:bg-white/60 data-[selected=true]:bg-(--switch-active-bg) data-[selected=true]:text-(--text-primary) data-[selected=true]:shadow-(--effect-raised)"
        >
          {key === "priority" ? "Priority" : "Area"}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
