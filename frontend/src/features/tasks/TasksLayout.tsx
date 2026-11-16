import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarOff,
  Clock,
  Inbox,
  type LucideIcon,
  SquareCheck,
  SquareX,
  Sun,
} from "lucide-react";
import type { ReactNode } from "react";
import { Outlet, useOutletContext } from "react-router";
import {
  getWeekOptions,
  listLifeAreasOptions,
  listProjectsOptions,
  listTasksOptions,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead, TaskRead } from "../../client/types.gen";
import { SIDEBAR_ROW, Sidebar, SidebarLink } from "../../components/Sidebar";
import { isPendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";
import { sidebarCounts } from "./board";

export type TasksData = {
  /** The server's today, which follows Settings › Day ends at. */
  today: string;
  tasks: TaskRead[];
  lifeAreas: LifeAreaRead[];
  projects: ProjectRead[];
};

type TasksContext = { data: TasksData | null; error: unknown };

/** The Tasks group's data, for the boards inside it. */
export function useTasksContext(): TasksContext {
  return useOutletContext<TasksContext>();
}

/**
 * The Tasks group: its sidebar beside the open view. Loading the week first rolls unfinished
 * tasks over to today and creates this week's recurring tasks, as the week board does.
 */
export function TasksLayout() {
  const week = useQuery(getWeekOptions());
  const tasks = useQuery({
    ...listTasksOptions({ query: { include_cancelled: true } }),
    enabled: week.isSuccess,
  });
  const lifeAreas = useQuery(listLifeAreasOptions());
  const projects = useQuery(listProjectsOptions());
  const pending = usePendingDeletes((state) => state.pending);

  const data: TasksData | null =
    week.data && tasks.data && lifeAreas.data && projects.data
      ? {
          today: week.data.today,
          tasks: tasks.data.filter((task) => !isPendingDelete(pending, "task", task.id)),
          lifeAreas: lifeAreas.data,
          projects: projects.data.filter(
            (project) => project.status === "active" && project.archived_at === null,
          ),
        }
      : null;
  const error = week.error ?? tasks.error ?? lifeAreas.error ?? projects.error;
  const counts = data ? sidebarCounts(data.tasks, data.today) : null;

  return (
    <>
      <Sidebar label="Tasks">
        <nav aria-label="Task views" className="flex flex-col gap-(--sidebar-item-gap)">
          <SidebarLink to="/tasks/all">
            <span className="flex-1 pl-0.5 text-[13px] leading-[18px] font-semibold tracking-[0.04em] uppercase">
              All
            </span>
            <SidebarCount value={counts?.all} />
          </SidebarLink>
          <NotBuiltRow icon={Inbox} label="Inbox" count={counts?.inbox} />
          <ViewLink to="/tasks/today" icon={Sun} label="Today" count={counts?.today} />
          <ViewLink
            to="/tasks/unscheduled"
            icon={CalendarOff}
            label="Unscheduled"
            count={counts?.unscheduled}
          />
          <NotBuiltRow icon={CalendarDays} label="Next 7 days" />
          <NotBuiltRow icon={Clock} label="Routines" />
        </nav>

        <div className="flex-1" />
        <div className="my-(--sidebar-divider-space) h-px shrink-0 bg-(--sidebar-divider)" />
        <nav aria-label="Finished tasks" className="mb-8 flex flex-col gap-(--sidebar-item-gap)">
          <ViewLink to="/tasks/completed" icon={SquareCheck} label="Completed" />
          <ViewLink to="/tasks/cancelled" icon={SquareX} label="Cancelled" />
        </nav>
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet context={{ data, error } satisfies TasksContext} />
      </main>
    </>
  );
}

function ViewLink({
  to,
  icon: Icon,
  label,
  count,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  count?: number;
}) {
  return (
    <SidebarLink to={to}>
      <RowIcon icon={Icon} />
      <span className="flex-1 truncate">{label}</span>
      <SidebarCount value={count} />
    </SidebarLink>
  );
}

/** A view that isn't built yet: shown so the sidebar keeps its shape, but not a link. */
function NotBuiltRow({ icon, label, count }: { icon: LucideIcon; label: string; count?: number }) {
  return (
    <span
      title={`${label} — not built yet`}
      className={`${SIDEBAR_ROW} text-(--sidebar-item-text) opacity-50 hover:bg-transparent`}
    >
      <RowIcon icon={icon} />
      <span className="flex-1 truncate">{label}</span>
      <SidebarCount value={count} />
    </span>
  );
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }): ReactNode {
  return (
    <span className="grid size-4 shrink-0 place-items-center text-(--text-tertiary)">
      <Icon aria-hidden className="size-[15px]" strokeWidth={2} />
    </span>
  );
}

function SidebarCount({ value }: { value?: number }) {
  if (value === undefined) return null;
  return <span className="type-meta text-(--text-tertiary) tabular-nums">{value}</span>;
}
