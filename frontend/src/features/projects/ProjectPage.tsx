import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChartLine,
  ChevronDown,
  CircleCheck,
  CircleX,
  Ellipsis,
  Folder,
  ListChecks,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  Rows3,
  Trash2,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  getProjectPageOptions,
  reopenProjectMutation,
  unarchiveProjectMutation,
} from "../../client/@tanstack/react-query.gen";
import type { ProjectPageRead, ProjectRead, TaskRead } from "../../client/types.gen";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { SectionCard } from "../../components/SectionCard";
import { SegmentSwitch } from "../../components/SegmentSwitch";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { useNewEvent } from "../../stores/newEventStore";
import { useNewTask } from "../../stores/newTaskStore";
import { usePendingDeletes } from "../../stores/pendingDeleteStore";
import { usePeriodStore } from "../../stores/periodStore";
import { useTaskBoard } from "../../stores/taskBoardStore";
import { withoutPending } from "../life-areas/AreaPage";
import { NewMetricModal } from "../life-areas/area/NewMetricModal";
import { RoutinesCard } from "../life-areas/area/ProjectsAndRoutines";
import { AgendaCard, TasksCard } from "../life-areas/area/TasksAndAgenda";
import { TimelineCard } from "../life-areas/area/TimelineCard";
import { daysBetween, outcomeTone, plural, shortDate } from "../life-areas/overview/format";
import { MetricTile } from "../life-areas/overview/OutcomesCard";
import { areaDataAttribute } from "../life-areas/palette";
import { FilterMenu } from "../tasks/FilterMenu";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { NewSectionModal } from "./NewSectionModal";
import { ProjectBoard } from "./ProjectBoard";
import { type ProjectChange, ProjectChangeDialog } from "./ProjectChangeDialog";

/** One project's page over the selected period: the area page's cards for its own items. */
export function ProjectPage() {
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const openPanel = useDetailPanel((state) => state.open);
  const openNewTask = useNewTask((state) => state.open);
  const openNewEvent = useNewEvent((state) => state.open);
  const { period, date } = usePeriodStore();
  const [adding, setAdding] = useState<"metric" | "section" | null>(null);
  const [change, setChange] = useState<ProjectChange | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Overview or Board, in the URL so links and Back keep it.
  const [params, setParams] = useSearchParams();
  const view: PageView = params.get("view") === "board" ? "board" : "overview";
  const group = useTaskBoard((state) => state.projectGroup);
  const setGroup = useTaskBoard((state) => state.setProjectGroup);

  const page = useQuery({
    ...getProjectPageOptions({ path: { project_id: projectId }, query: { period, date } }),
    placeholderData: keepPreviousData,
  });
  const reopen = useMutation(reopenProjectMutation());
  const restore = useMutation(unarchiveProjectMutation());
  const pending = usePendingDeletes((state) => state.pending);
  const shown = useMemo(
    () => page.data && withoutPending(page.data, pending),
    [page.data, pending],
  );

  if (page.isPending) return null;
  if (page.isError && !page.data) {
    return (
      <div className="p-(--page-gutter)">
        <QueryError error={page.error} onRetry={page.refetch} />
      </div>
    );
  }
  if (!shown) return null;

  const { project, life_area: area } = shown;
  const isArchived = project.archived_at !== null;
  const isActive = project.status === "active" && !isArchived;
  const canAdd = isActive && area.archived_at === null;
  const path = { path: { project_id: project.id } };
  const owner = { lifeAreaId: area.id, projectId: project.id };
  const addTask = () => openNewTask(owner, shown.today);

  return (
    <div data-area={areaDataAttribute(area.color)} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-start gap-4 px-(--page-gutter) pt-(--page-gutter)">
        <div className="min-w-0">
          <div className="flex h-(--page-header-height) items-center gap-2.5">
            <Folder
              aria-hidden
              className="size-[18px] shrink-0 text-(--area-solid)"
              strokeWidth={2}
            />
            <h1 className="truncate type-page-title text-(--page-title)">{project.title}</h1>
            <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-(--border-default)" />
            <SegmentSwitch
              label="Page view"
              value={view}
              options={[
                { key: "overview", label: "Overview" },
                { key: "board", label: "Board" },
              ]}
              onChange={(next) =>
                setParams(next === "board" ? { view: "board" } : {}, { replace: true })
              }
            />
            {view === "board" && (
              <>
                <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-(--border-default)" />
                <SegmentSwitch
                  label="Group by"
                  value={group}
                  options={[
                    { key: "priority", label: "Priority" },
                    { key: "section", label: "Section" },
                  ]}
                  onChange={setGroup}
                />
              </>
            )}
          </div>
          <HeaderFacts page={shown} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {view === "board" ? (
            <FilterMenu view="project" layout={group} lifeAreas={[]} sections={project.sections} />
          ) : (
            !isArchived && <PeriodSwitch />
          )}
          <ProjectMenu
            project={project}
            onAction={(key) => {
              if (key === "edit") openPanel({ kind: "project", id: project.id });
              if (key === "complete" || key === "cancel" || key === "archive") setChange(key);
              if (key === "reopen") reopen.mutate(path);
              if (key === "restore") restore.mutate(path);
              if (key === "delete") setIsDeleting(true);
            }}
          />
          {canAdd && (
            <AddMenu
              onAction={(key) => {
                if (key === "task") addTask();
                if (key === "event") openNewEvent(owner, shown.today);
                if (key === "metric" || key === "section") setAdding(key);
              }}
            />
          )}
        </div>
      </header>
      {view === "board" ? (
        <ProjectBoard project={project} area={area} today={shown.today} canAdd={canAdd} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
          {isArchived && (
            <p className="type-body text-(--text-tertiary)">
              This project is archived. Restore it to plan in it again.
            </p>
          )}
          {(reopen.error ?? restore.error) && <QueryError error={reopen.error ?? restore.error} />}
          {page.isError && <QueryError error={page.error} onRetry={page.refetch} />}
          <ProjectCards
            page={shown}
            onAddMetric={canAdd ? () => setAdding("metric") : undefined}
            onAddEvent={canAdd ? () => openNewEvent(owner, shown.today) : undefined}
            onAddTask={canAdd ? addTask : undefined}
          />
        </div>
      )}
      {adding === "metric" && (
        <NewMetricModal lifeArea={area} project={project} onClose={() => setAdding(null)} />
      )}
      {adding === "section" && (
        <NewSectionModal project={project} onClose={() => setAdding(null)} />
      )}
      {change && (
        <ProjectChangeDialog project={project} change={change} onClose={() => setChange(null)} />
      )}
      {isDeleting && (
        <DeleteProjectDialog
          project={project}
          onClose={() => setIsDeleting(false)}
          onDeleted={() => navigate(`/areas/${area.id}`, { replace: true })}
        />
      )}
    </div>
  );
}

type PageView = "overview" | "board";

const STATUS = { active: "Active", done: "Done", cancelled: "Cancelled" } as const;
const PACE = { on_pace: "on pace", ahead: "ahead of pace", behind: "behind pace" } as const;
const CHIP =
  "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap";

/** The line under the name: area tag, status, dates, and progress against pace. */
function HeaderFacts({ page }: { page: ProjectPageRead }) {
  const { project, life_area: area } = page;
  const start = project.start_date ?? project.created_at.slice(0, 10);
  const { done, total } = project.progress;
  const share = total ? Math.round((done / total) * 100) : 0;
  const isActive = project.status === "active";

  let dates: string;
  if (!project.due_date) {
    dates = `${start > page.today ? "Starts" : "Started"} ${shortDate(start)} · no due date`;
  } else {
    const left = daysBetween(page.today, project.due_date);
    const when = !isActive
      ? ""
      : left < 0
        ? ` · ${plural(-left, "day")} late`
        : left === 0
          ? " · due today"
          : ` · ${plural(left, "day")} left`;
    dates = `${shortDate(start)} – ${shortDate(project.due_date)}${when}`;
  }
  const finished =
    project.status === "done" && project.completed_at
      ? ` · Done ${shortDate(project.completed_at.slice(0, 10))}`
      : project.status === "cancelled" && project.cancelled_at
        ? ` · Cancelled ${shortDate(project.cancelled_at.slice(0, 10))}`
        : "";

  return (
    <div className="flex flex-wrap items-center gap-2 pl-7 type-meta text-(--text-tertiary)">
      <span className={`${CHIP} bg-(--area-tint-active) text-(--text-primary)`}>
        <span aria-hidden className="size-1.5 rounded-[2px] bg-(--area-solid)" />
        {area.title}
      </span>
      <span className={`${CHIP} bg-(--color-neutral-100) text-(--text-secondary)`}>
        {STATUS[project.status]}
      </span>
      {project.archived_at && (
        <span className={`${CHIP} bg-(--color-neutral-100) text-(--text-secondary)`}>
          <Archive aria-hidden className="size-[11px]" />
          Archived
        </span>
      )}
      <span className="whitespace-nowrap">
        {dates}
        {finished}
      </span>
      {total > 0 && (
        // The bar and its numbers wrap together.
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span aria-hidden className="mx-1 h-4 w-px bg-(--border-default)" />
          <span
            role="img"
            aria-label={`${share}% done${
              isActive && page.pace !== null && page.pace !== undefined
                ? `, ${Math.round(page.pace * 100)}% of the time passed`
                : ""
            }`}
            className="relative h-1.5 w-[120px] rounded-full bg-(--area-tint-active)"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-(--area-solid)"
              style={{ width: `${share}%` }}
            />
            {isActive && page.pace !== null && page.pace !== undefined && (
              <span
                aria-hidden
                className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-(--color-neutral-900)"
                style={{ left: `${page.pace * 100}%` }}
              />
            )}
          </span>
          <span>
            {share}% · {done} of {plural(total, "task")}
            {isActive && page.pace_status ? ` · ${PACE[page.pace_status]}` : ""}
          </span>
        </span>
      )}
    </div>
  );
}

/** Metrics, then the timeline, the project's routine steps and the task lists, with the
 * agenda on the right. The Routines card shows only while the project owns steps. */
function ProjectCards({
  page,
  onAddMetric,
  onAddEvent,
  onAddTask,
}: {
  page: ProjectPageRead;
  onAddMetric?: () => void;
  onAddEvent?: () => void;
  onAddTask?: () => void;
}) {
  const sections = new Map(page.project.sections.map((section) => [section.id, section.title]));
  const place = (task: TaskRead) =>
    task.section_id === null ? undefined : sections.get(task.section_id);
  const behind = page.metrics.filter((m) => outcomeTone(m.status) === "bad").length;
  const hasSteps = page.routines.some((group) => group.steps.length > 0);
  const nothingTimed = page.events.length + page.metrics.length === 0;
  const hasTasks = page.contents.open_tasks + page.completed_tasks.length > 0;

  return (
    <>
      <SectionCard
        title="Metrics"
        description={
          page.metrics.length === 0
            ? undefined
            : [
                `${plural(page.metrics.length, "metric")} owned by this project`,
                behind && `${behind} behind`,
              ]
                .filter(Boolean)
                .join(" · ")
        }
      >
        {page.metrics.length === 0 ? (
          <EmptyLine text="No metrics yet." action="Add metric" onPress={onAddMetric} />
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {page.metrics.map((outcome) => (
              <MetricTile
                key={outcome.metric_id}
                outcome={outcome}
                view={page}
                canLog={onAddMetric !== undefined}
              />
            ))}
          </div>
        )}
      </SectionCard>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-4">
        <div className="flex min-w-0 flex-col gap-4">
          {nothingTimed ? (
            <SectionCard title="Timeline">
              <EmptyLine text="No events or metrics yet." action="New event" onPress={onAddEvent} />
            </SectionCard>
          ) : (
            <TimelineCard page={page} onProjectPage />
          )}
          {hasSteps && <RoutinesCard page={page} owner="this project" />}
          {hasTasks || page.recurring.length > 0 ? (
            <TasksCard page={page} place={place} />
          ) : (
            <SectionCard title="Tasks">
              <EmptyLine text="No tasks yet." action="Add task" onPress={onAddTask} />
            </SectionCard>
          )}
        </div>
        <AgendaCard page={page} place={place} />
      </div>
    </>
  );
}

/** An empty card's one muted line, with its action when the project takes new items. */
function EmptyLine({
  text,
  action,
  onPress,
}: {
  text: string;
  action: string;
  onPress?: () => void;
}) {
  return (
    <div className="flex min-h-10 items-center gap-3 type-meta text-(--text-tertiary)">
      {text}
      {onPress && (
        <Button size="sm" onPress={onPress} className="button--area">
          <Plus aria-hidden />
          {action}
        </Button>
      )}
    </div>
  );
}

const ICON = "size-4 shrink-0 text-(--text-tertiary)";
const MENU_SECTION = "border-(--border-default) not-first:mt-1 not-first:border-t not-first:pt-1";

function MenuItem({ id, label, icon }: { id: string; label: string; icon: ReactNode }) {
  return (
    <Dropdown.Item id={id} textValue={label}>
      {icon}
      <Label>{label}</Label>
    </Dropdown.Item>
  );
}

/** Edit (the detail panel), Complete, Cancel or Reopen, Archive or Restore, then Delete,
 * which only an empty project allows. */
function ProjectMenu({
  project,
  onAction,
}: {
  project: ProjectRead;
  onAction: (key: string) => void;
}) {
  const isArchived = project.archived_at !== null;
  const isActive = project.status === "active";
  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="secondary"
        size="sm"
        aria-label={`More actions for ${project.title}`}
        className="size-7 min-w-0 border border-(--button-secondary-border) bg-(--bg-surface) px-0 text-(--button-secondary-text) [&_svg]:size-4"
      >
        <Ellipsis aria-hidden />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[240px]">
        <Dropdown.Menu
          disabledKeys={project.has_items ? ["delete"] : []}
          onAction={(key) => onAction(String(key))}
        >
          <MenuItem id="edit" label="Edit project" icon={<Pencil aria-hidden className={ICON} />} />
          {!isArchived && isActive && (
            <MenuItem
              id="complete"
              label="Complete project"
              icon={<CircleCheck aria-hidden className={ICON} />}
            />
          )}
          {!isArchived && isActive && (
            <MenuItem
              id="cancel"
              label="Cancel project"
              icon={<CircleX aria-hidden className={ICON} />}
            />
          )}
          {!isArchived && !isActive && (
            <MenuItem
              id="reopen"
              label="Reopen project"
              icon={<RotateCcw aria-hidden className={ICON} />}
            />
          )}
          {isArchived ? (
            <MenuItem
              id="restore"
              label="Restore project"
              icon={<ArchiveRestore aria-hidden className={ICON} />}
            />
          ) : (
            <MenuItem
              id="archive"
              label="Archive project"
              icon={<Archive aria-hidden className={ICON} />}
            />
          )}
          <Separator />
          <Dropdown.Item
            id="delete"
            textValue="Delete project"
            variant="danger"
            className="items-start"
          >
            <Trash2 aria-hidden className="mt-1 size-4 shrink-0" />
            <span className="flex flex-col py-1">
              <Label>Delete project</Label>
              {project.has_items && (
                <span className="text-[11px] leading-[14px] text-(--text-tertiary)">
                  Only empty projects can be deleted. Archive it instead.
                </span>
              )}
            </span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** The Add split button in the area's solid color: Task, Section, Event, then Metric and
 * Routine step (which waits for a routine picker, as on the area page). */
function AddMenu({ onAction }: { onAction: (key: string) => void }) {
  return (
    <Dropdown>
      <Button className="button--area gap-0 px-0">
        <span className="flex items-center gap-1.5 px-2.5">
          <Plus aria-hidden />
          Add
        </span>
        <span aria-hidden className="h-4 w-px bg-white/40" />
        <span className="grid place-items-center px-1.5">
          <ChevronDown aria-hidden />
        </span>
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[200px]">
        <Dropdown.Menu
          aria-label="Add to this project"
          disabledKeys={["step"]}
          onAction={(key) => onAction(String(key))}
        >
          <Dropdown.Section className={MENU_SECTION}>
            <MenuItem id="task" label="Task" icon={<ListChecks aria-hidden className={ICON} />} />
            <MenuItem id="section" label="Section" icon={<Rows3 aria-hidden className={ICON} />} />
            <MenuItem
              id="event"
              label="Event"
              icon={<CalendarDays aria-hidden className={ICON} />}
            />
          </Dropdown.Section>
          <Dropdown.Section className={MENU_SECTION}>
            <MenuItem
              id="metric"
              label="Metric"
              icon={<ChartLine aria-hidden className={ICON} />}
            />
            <MenuItem
              id="step"
              label="Routine step"
              icon={<Repeat aria-hidden className={ICON} />}
            />
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
