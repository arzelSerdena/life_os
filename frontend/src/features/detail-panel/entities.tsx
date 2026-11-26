import { Button } from "@heroui/react";
import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowUpRight,
  CalendarDays,
  ChartLine,
  CircleCheck,
  Flag,
  Folder,
  ListChecks,
  MapPin,
  Palette,
  Pause,
  Plus,
  Repeat,
  Sun,
  Target,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import {
  clearRoutineStepDayMutation,
  completeTaskMutation,
  createMetricEntryMutation,
  createSubtaskMutation,
  editEventOccurrenceMutation,
  getArchiveOptions,
  getAreaPageOptions,
  getEventOccurrenceOptions,
  getEventOptions,
  getEventQueryKey,
  getLifeAreaOptions,
  getLifeAreaQueryKey,
  getMetricOptions,
  getMetricQueryKey,
  getProjectOptions,
  getProjectQueryKey,
  getRoutinePageOptions,
  getRoutinePageQueryKey,
  getTaskOptions,
  getTaskQueryKey,
  getTaskTemplateOptions,
  getTaskTemplateQueryKey,
  listEventOccurrencesQueryKey,
  listLifeAreasOptions,
  listMetricEntriesOptions,
  listProjectsOptions,
  reopenTaskMutation,
  setRoutineStepDayMutation,
  updateEventMutation,
  updateLifeAreaMutation,
  updateMetricMutation,
  updateProjectMutation,
  updateRoutineMutation,
  updateSubtaskMutation,
  updateTaskMutation,
  updateTaskTemplateMutation,
} from "../../client/@tanstack/react-query.gen";
import {
  deleteMetricEntry,
  deleteSubtask,
  editEventOccurrence,
  moveEvent,
  moveMetric,
  moveTask,
  moveTaskTemplate,
  updateEvent,
  updateLifeArea,
  updateMetric,
  updateProject,
  updateRoutine,
  updateTask,
  updateTaskTemplate,
} from "../../client/sdk.gen";
import type { MetricRead, SubtaskRead, TaskRead, TaskTemplateRead } from "../../client/types.gen";
import { EntityCheckbox } from "../../components/EntityCheckbox";
import { IconButton } from "../../components/IconButton";
import { QueryError } from "../../components/QueryError";
import { today } from "../../period";
import { useChangeToast } from "../../stores/changeToastStore";
import { type PanelTarget, useDetailPanel } from "../../stores/detailPanelStore";
import { isPendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";
import { usePeriodStore } from "../../stores/periodStore";
import { archiveDate, areaContents } from "../archive/archive";
import { useDeleteWithUndo } from "../deleting/UndoToast";
import {
  useAreaActions,
  useEventActions,
  useMetricActions,
  useProjectActions,
  useTaskActions,
  useTemplateActions,
} from "../item-menu/entityActions";
import { presetFor } from "../life-areas/area/NewMetricModal";
import { describeRule } from "../life-areas/area/timeScale";
import { daysBetween, plural, shortDate } from "../life-areas/overview/format";
import { AREA_PALETTES, areaDataAttribute } from "../life-areas/palette";
import { currentTarget, EditMetricModal } from "../metrics/EditMetricModal";
import { formatValue, inputAffixes, parseValue } from "../metrics/format";
import { PopoverChip } from "../pickers/chips";
import { DatePickerField } from "../pickers/DatePicker";
import { OwnerCrumb, SectionCrumb } from "../pickers/OwnerPicker";
import { TimeRangeChip } from "../pickers/TimeRangeChip";
import { projectPath } from "../projects/paths";
import { formatTime, useTimeFormat } from "../tasks/format";
import {
  Chip,
  chipClass,
  DateChip,
  EditableLine,
  Marker,
  MenuChip,
  PanelView,
  TaskMarker,
} from "./PanelParts";

/** Shows the panel for one item. */
export function EntityPanel({ target }: { target: PanelTarget }) {
  switch (target.kind) {
    case "area":
      return <AreaPanel id={target.id} />;
    case "project":
      return <ProjectPanel id={target.id} />;
    case "task":
      return <TaskPanel id={target.id} />;
    case "template":
      return <TemplatePanel id={target.id} />;
    case "event":
      return <EventPanel id={target.id} day={target.day} />;
    case "routine":
      return <RoutineDetailPanel id={target.id} />;
    case "metric":
      return <MetricPanel id={target.id} />;
  }
}

// ---------- Shared ----------

/** Area colors for everything inside; `contents` keeps the panel's flex layout. */
function AreaScope({ color, children }: { color?: string | null; children: ReactNode }) {
  return (
    <div data-area={areaDataAttribute(color)} className="contents">
      {children}
    </div>
  );
}

function Loading({ error }: { error: unknown }) {
  return (
    <div className="px-6 pt-14">
      {error ? <QueryError error={error} /> : <span className="sr-only">Loading…</span>}
    </div>
  );
}

function useLifeArea(id: number | null | undefined) {
  return useQuery({
    ...getLifeAreaOptions({ path: { life_area_id: id ?? 0 } }),
    enabled: id != null,
  }).data;
}

function useProject(id: number | null | undefined) {
  return useQuery({
    ...getProjectOptions({ path: { project_id: id ?? 0 } }),
    enabled: id != null,
  }).data;
}

/** Saves notes and refreshes only this item, so the rest of the screen stays put. */
function useNotesSave() {
  const queryClient = useQueryClient();
  return async (request: () => Promise<unknown>, key: QueryKey) => {
    await request();
    await queryClient.invalidateQueries({ queryKey: key });
  };
}

type Movable = "task" | "template" | "event" | "metric";
type MoveBody = { life_area_id?: number; project_id?: number; section_id?: number };

/**
 * Sends the item to another owner (or section) with its `/move` endpoint, and returns the
 * batch to undo (none when nothing changed).
 */
async function sendMove(kind: Movable, id: number, body: MoveBody): Promise<string | null> {
  const options = { body, throwOnError: true } as const;
  switch (kind) {
    case "task":
      return (await moveTask({ ...options, path: { task_id: id } })).data.batch_id;
    case "template":
      return (await moveTaskTemplate({ ...options, path: { template_id: id } })).data.batch_id;
    case "event":
      return (await moveEvent({ ...options, path: { event_id: id } })).data.batch_id;
    case "metric":
      return (await moveMetric({ ...options, path: { metric_id: id } })).data.batch_id;
  }
}

type OwnerItem = {
  id: number;
  title: string;
  life_area_id: number | null;
  project_id: number | null;
  section_id?: number | null;
};

/**
 * The breadcrumb's owner (Area / Project) and, for tasks and recurring tasks in a project with
 * sections, its section: each opens its picker (Approved: Pickers). Each move is reported in
 * the change toast, with Undo when the backend recorded it.
 */
function useOwnerCrumbs(kind: Movable, item: OwnerItem | undefined) {
  const showToast = useChangeToast((state) => state.show);
  const lifeAreas = (useQuery(listLifeAreasOptions()).data ?? []).filter(
    (area) => area.archived_at === null,
  );
  const projects = (useQuery(listProjectsOptions()).data ?? []).filter(
    (project) => project.status === "active" && project.archived_at === null,
  );
  const move = useMutation({
    mutationFn: ({ body }: { body: MoveBody; message: string }) =>
      sendMove(kind, item?.id ?? 0, body),
    onSuccess: (batchId, { message }) => {
      showToast(`Moved “${item?.title ?? ""}” · ${message}`, batchId);
    },
  });
  const area = useLifeArea(item?.life_area_id);
  const project = useProject(item?.project_id);

  const crumbs = (): ReactNode[] => {
    if (!item) return [];
    const value = { lifeAreaId: item.life_area_id, projectId: item.project_id };
    const owner = (text: string, label: string) => (
      <OwnerCrumb
        value={value}
        lifeAreas={lifeAreas}
        projects={projects}
        allowInbox={kind === "task" || kind === "template"}
        label={label}
        onChange={(next) => {
          const target = projects.find((p) => p.id === next.projectId);
          const targetArea = lifeAreas.find((a) => a.id === next.lifeAreaId);
          move.mutate({
            body: target
              ? { project_id: target.id }
              : targetArea
                ? { life_area_id: targetArea.id }
                : {},
            message: target?.title ?? targetArea?.title ?? "Inbox",
          });
        }}
      >
        {text}
      </OwnerCrumb>
    );
    const result: ReactNode[] = [owner(area?.title ?? "Inbox", "Owner")];
    if (project) result.push(owner(project.title, "Project"));
    const sections = project?.sections ?? [];
    if (project && item.section_id !== undefined && sections.length > 0) {
      const section = sections.find((s) => s.id === item.section_id);
      result.push(
        <SectionCrumb
          value={section?.id ?? null}
          sections={sections}
          onChange={(sectionId) =>
            move.mutate({
              body:
                sectionId === null
                  ? { project_id: project.id }
                  : { project_id: project.id, section_id: sectionId },
              message: sections.find((s) => s.id === sectionId)?.title ?? "No section",
            })
          }
        >
          {section?.title ?? "No section"}
        </SectionCrumb>,
      );
    }
    return result;
  };

  return { area, crumbs, error: move.error };
}

const PRIORITIES = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "none", label: "No priority" },
] as const;
type Priority = (typeof PRIORITIES)[number]["id"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Sat, Nov 14" */
function dayDate(date: string): string {
  return `${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]}, ${shortDate(date)}`;
}

function clock(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

// ---------- Life area ----------

function AreaPanel({ id }: { id: number }) {
  const navigate = useNavigate();
  const close = useDetailPanel((state) => state.close);
  const { period, date } = usePeriodStore();
  const query = useQuery(getLifeAreaOptions({ path: { life_area_id: id } }));
  const page = useQuery(
    getAreaPageOptions({ path: { life_area_id: id }, query: { period, date } }),
  ).data;
  const lifeAreas = useQuery(listLifeAreasOptions()).data ?? [];
  const update = useMutation(updateLifeAreaMutation());
  const isArchived = query.data ? query.data.archived_at !== null : false;
  // An archived area reads as it does in Finished & archived: what Restore brings back.
  const archived = useQuery({ ...getArchiveOptions(), enabled: isArchived }).data?.areas.find(
    (row) => row.id === id,
  );
  const saveNotes = useNotesSave();
  const menu = useAreaActions(query.data, {
    onArchived: () => {
      close();
      navigate("/areas");
    },
    onDeleted: () => {
      close();
      navigate("/areas", { replace: true });
    },
    onRestored: close,
  });

  const area = query.data;
  if (!area) return <Loading error={query.error} />;
  const path = { life_area_id: id };
  const save = (body: Parameters<typeof updateLifeArea>[0]["body"]) =>
    update.mutateAsync({ path, body });
  const contents = page?.contents;

  return (
    <AreaScope color={area.color}>
      <PanelView
        crumbs={["Life areas"]}
        marker={<Marker />}
        title={area.title}
        onRename={isArchived ? undefined : (title) => save({ title })}
        lead={
          isArchived ? (
            area.vision && (
              <p className="-mt-1.5 type-body leading-[19px] text-(--text-secondary)">
                {area.vision}
              </p>
            )
          ) : (
            <EditableLine
              label="Vision"
              placeholder="Add a vision…"
              maxLength={2000}
              value={area.vision}
              onSave={(vision) => save({ vision })}
            />
          )
        }
        chips={
          isArchived ? (
            <>
              <Chip icon={Archive}>
                Archived
                {archived ? ` ${archiveDate(archived.archived_on, new Date().getFullYear())}` : ""}
              </Chip>
              {archived && areaContents(archived) && (
                <Chip icon={Folder}>{areaContents(archived)}</Chip>
              )}
            </>
          ) : (
            <>
              <MenuChip
                icon={Palette}
                label="Color"
                value={area.color ?? ""}
                onChange={(color) => save({ color })}
                options={AREA_PALETTES.map((palette) => ({
                  id: palette.key,
                  label: palette.name,
                  leading: (
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-[3px]"
                      style={{ background: palette.swatch }}
                    />
                  ),
                  note: lifeAreas.find((other) => other.id !== id && other.color === palette.key)
                    ?.title,
                }))}
              >
                {AREA_PALETTES.find((palette) => palette.key === area.color)?.name ?? "No color"}
              </MenuChip>
              {contents && (
                <>
                  <Chip icon={Folder}>{plural(contents.active_projects, "project")}</Chip>
                  <Chip icon={ListChecks}>{plural(contents.open_tasks, "open task")}</Chip>
                  <Chip icon={ChartLine}>{plural(contents.metrics, "metric")}</Chip>
                </>
              )}
            </>
          )
        }
        notes={{
          key: `area-${id}-${isArchived}`,
          markdown: area.notes,
          readOnly: isArchived,
          save: (notes) =>
            saveNotes(
              () => updateLifeArea({ path, body: { notes }, throwOnError: true }),
              getLifeAreaQueryKey({ path }),
            ),
        }}
        actions={menu.actions}
        error={update.error ?? menu.error}
      />
      {menu.dialogs}
    </AreaScope>
  );
}

// ---------- Project ----------

const PROJECT_STATUS = { active: "Active", done: "Done", cancelled: "Cancelled" } as const;

function ProjectPanel({ id }: { id: number }) {
  const query = useQuery(getProjectOptions({ path: { project_id: id } }));
  const area = useLifeArea(query.data?.life_area_id);
  const update = useMutation(updateProjectMutation());
  const saveNotes = useNotesSave();
  const close = useDetailPanel((state) => state.close);
  const navigate = useNavigate();
  const menu = useProjectActions(query.data, { onDeleted: close });

  const project = query.data;
  if (!project) return <Loading error={query.error} />;
  const path = { project_id: id };
  const { done, total } = project.progress;
  const now = today();
  const left = project.due_date ? daysBetween(now, project.due_date) : null;
  const dates = `${shortDate(project.start_date ?? project.created_at.slice(0, 10))} – ${
    project.due_date ? shortDate(project.due_date) : "No due date"
  }${
    left === null || project.status !== "active"
      ? ""
      : left < 0
        ? ` · ${plural(-left, "day")} late`
        : ` · ${left}d left`
  }`;
  const isArchived = project.archived_at !== null;

  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={[area?.title ?? "", "Projects"]}
        marker={<Marker icon={Folder} />}
        title={project.title}
        headerAction={
          <IconButton
            label="Open project"
            onPress={() => {
              close();
              navigate(projectPath(id));
            }}
          >
            <ArrowUpRight />
          </IconButton>
        }
        onRename={isArchived ? undefined : (title) => update.mutateAsync({ path, body: { title } })}
        chips={
          <>
            <Chip icon={project.status === "done" ? CircleCheck : undefined}>
              {PROJECT_STATUS[project.status]}
            </Chip>
            {isArchived && <Chip icon={Archive}>Archived</Chip>}
            {isArchived ? (
              <Chip icon={CalendarDays}>{dates}</Chip>
            ) : (
              <DateChip
                icon={CalendarDays}
                label="Due date"
                tone={
                  left !== null && left < 0 && project.status === "active" ? "danger" : "default"
                }
                value={project.due_date}
                onChange={(due_date) => update.mutate({ path, body: { due_date } })}
              >
                {dates}
              </DateChip>
            )}
            <Chip icon={ChartLine}>
              {total
                ? `${done} of ${plural(total, "task")} · ${Math.round((done / total) * 100)}%`
                : "No tasks"}
            </Chip>
          </>
        }
        notes={{
          key: `project-${id}-${isArchived}`,
          markdown: project.notes,
          readOnly: isArchived,
          save: (notes) =>
            saveNotes(
              () => updateProject({ path, body: { notes }, throwOnError: true }),
              getProjectQueryKey({ path }),
            ),
        }}
        actions={menu.actions}
        error={update.error ?? menu.error}
      />
      {menu.dialogs}
    </AreaScope>
  );
}

// ---------- Task ----------

function TaskPanel({ id }: { id: number }) {
  const query = useQuery(getTaskOptions({ path: { task_id: id } }));
  const task = query.data;
  const owner = useOwnerCrumbs("task", task);
  const area = owner.area;
  const template = useQuery({
    ...getTaskTemplateOptions({ path: { template_id: task?.template_id ?? 0 } }),
    enabled: task?.template_id != null,
  }).data;
  const update = useMutation(updateTaskMutation());
  // The marker checks the task off in place; the ⋯ menu's Complete also offers Undo.
  const complete = useMutation(completeTaskMutation());
  const reopen = useMutation(reopenTaskMutation());
  const saveNotes = useNotesSave();
  const close = useDetailPanel((state) => state.close);
  const menu = useTaskActions(task, { onDeleted: close });

  if (!task) return <Loading error={query.error} />;
  const path = { task_id: id };
  const isDone = task.status === "done";
  const toggleDone = () => (isDone ? reopen : complete).mutate({ path });

  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={owner.crumbs()}
        marker={<TaskMarker done={isDone} title={task.title} onToggle={toggleDone} />}
        title={task.title}
        onRename={(title) => update.mutateAsync({ path, body: { title } })}
        chips={
          <TaskChips
            task={task}
            template={template}
            onChange={(body) => update.mutate({ path, body })}
          />
        }
        content={<Subtasks task={task} />}
        notes={{
          key: `task-${id}`,
          markdown: task.notes,
          save: (notes) =>
            saveNotes(
              () => updateTask({ path, body: { notes }, throwOnError: true }),
              getTaskQueryKey({ path }),
            ),
        }}
        actions={menu.actions}
        error={owner.error ?? update.error ?? complete.error ?? reopen.error ?? menu.error}
      />
    </AreaScope>
  );
}

function TaskChips({
  task,
  template,
  onChange,
}: {
  task: TaskRead;
  template?: TaskTemplateRead;
  onChange: (body: Parameters<typeof updateTask>[0]["body"]) => void;
}) {
  const now = today();
  const isOpen = task.status === "todo";
  const overdue = isOpen && task.due_date !== null && task.due_date < now;
  const priority = PRIORITIES.find((p) => p.id === task.priority) ?? PRIORITIES[3];
  return (
    <>
      {task.status !== "todo" && (
        <Chip icon={CircleCheck}>
          {task.status === "done"
            ? `Done ${shortDate((task.completed_at ?? now).slice(0, 10))}`
            : "Cancelled"}
        </Chip>
      )}
      <MenuChip<Priority>
        icon={Flag}
        label="Priority"
        tone={task.priority === "high" ? "danger" : task.priority === "none" ? "ghost" : "default"}
        value={task.priority}
        options={[...PRIORITIES]}
        onChange={(value) => onChange({ priority: value })}
      >
        {task.priority === "none" ? "Priority" : priority.label}
      </MenuChip>
      <DateChip
        icon={CalendarDays}
        label="Due date"
        tone={overdue ? "danger" : task.due_date ? "default" : "ghost"}
        value={task.due_date}
        onChange={(due_date) => onChange({ due_date })}
      >
        {task.due_date ? `${shortDate(task.due_date)}${overdue ? " · Overdue" : ""}` : "Due date"}
      </DateChip>
      <DateChip
        icon={Sun}
        label="Scheduled for"
        tone={task.scheduled_date ? "default" : "ghost"}
        value={task.scheduled_date}
        onChange={(scheduled_date) =>
          onChange(
            scheduled_date
              ? { scheduled_date }
              : { scheduled_date, scheduled_time: null, scheduled_end_time: null },
          )
        }
      >
        {task.scheduled_date
          ? `${dayDate(task.scheduled_date)}${
              task.rollover_count ? ` · ${plural(task.rollover_count, "rollover")}` : ""
            }`
          : "Schedule"}
      </DateChip>
      <TimeRangeChip
        label="Scheduled time"
        startTime={task.scheduled_time ?? null}
        endTime={task.scheduled_end_time ?? null}
        requireEndAfterStart
        onChange={({ startTime, endTime }) =>
          onChange({
            ...(startTime && !task.scheduled_date ? { scheduled_date: now } : {}),
            scheduled_time: startTime,
            scheduled_end_time: endTime,
          })
        }
      />
      {template?.rrule && <Chip icon={Repeat}>{describeRule(template.rrule)}</Chip>}
    </>
  );
}

function Subtasks({ task }: { task: TaskRead }) {
  const create = useMutation(createSubtaskMutation());
  const update = useMutation(updateSubtaskMutation());
  const deleteWithUndo = useDeleteWithUndo();
  const pending = usePendingDeletes((state) => state.pending);
  const [draft, setDraft] = useState("");
  const subtasks = task.subtasks.filter((s) => !isPendingDelete(pending, "subtask", s.id));
  const done = subtasks.filter((s) => s.status === "done").length;
  const toggle = (subtask: SubtaskRead) =>
    update.mutate({
      path: { subtask_id: subtask.id },
      body: { status: subtask.status === "done" ? "todo" : "done" },
    });
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    create.mutate(
      { path: { task_id: task.id }, body: { title } },
      { onSuccess: () => setDraft("") },
    );
  };
  return (
    <section aria-label="Subtasks" className="mt-1">
      <div className="mb-0.5 flex h-6 items-center gap-1.5">
        <h3 className="type-label text-(--text-tertiary)">Subtasks</h3>
        {subtasks.length > 0 && (
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-(--counter-bg) px-1.5 type-tag font-medium text-(--text-secondary)">
            {done}/{subtasks.length}
          </span>
        )}
      </div>
      {(create.error || update.error) && <QueryError error={create.error ?? update.error} />}
      <ul>
        {subtasks.map((subtask) => {
          const isDone = subtask.status === "done";
          return (
            <li key={subtask.id} className="group flex h-7 items-center gap-2">
              <EntityCheckbox
                size="sm"
                checked={isDone}
                onChange={() => toggle(subtask)}
                label={subtask.title}
                className="-m-[5px]"
              />
              <span
                className={`truncate type-body ${isDone ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"}`}
              >
                {subtask.title}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                aria-label={`Delete ${subtask.title}`}
                onClick={() =>
                  deleteWithUndo({ kind: "subtask", id: subtask.id, label: subtask.title }, () =>
                    deleteSubtask({
                      path: { subtask_id: subtask.id },
                      throwOnError: true,
                      keepalive: true,
                    }),
                  )
                }
                className="grid size-6 shrink-0 place-items-center rounded-(--radius-6) text-(--text-tertiary) opacity-0 outline-none group-hover:opacity-100 hover:bg-(--bg-hover) hover:text-(--text-primary) focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      <input
        aria-label="Add subtask"
        placeholder="Add subtask"
        maxLength={200}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") add();
          if (event.key === "Escape" && draft) {
            event.stopPropagation();
            setDraft("");
          }
        }}
        className="h-7 w-full rounded-(--radius-6) bg-transparent pl-[22px] type-body text-(--text-primary) outline-none placeholder:text-(--text-disabled) focus:bg-(--bg-hover)"
      />
    </section>
  );
}

// ---------- Recurring task ----------

function TemplatePanel({ id }: { id: number }) {
  const query = useQuery(getTaskTemplateOptions({ path: { template_id: id } }));
  const template = query.data;
  const owner = useOwnerCrumbs("template", template);
  const area = owner.area;
  const update = useMutation(updateTaskTemplateMutation());
  const saveNotes = useNotesSave();
  const close = useDetailPanel((state) => state.close);
  const menu = useTemplateActions(template, { onDeleted: close });

  if (!template) return <Loading error={query.error} />;
  const path = { template_id: id };
  const priority = PRIORITIES.find((p) => p.id === template.priority);
  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={owner.crumbs()}
        marker={<Marker icon={Repeat} />}
        title={template.title}
        onRename={(title) => update.mutateAsync({ path, body: { title } })}
        chips={
          <>
            {template.rrule && (
              <Chip icon={Repeat}>
                {describeRule(template.rrule)}
                {template.repeat_from === "completion" ? " after done" : ""}
              </Chip>
            )}
            {template.priority !== "none" && priority && (
              <Chip icon={Flag} tone={template.priority === "high" ? "danger" : "default"}>
                {priority.label}
              </Chip>
            )}
            {template.starts_on && (
              <Chip icon={CalendarDays}>
                {template.ends_on
                  ? `${shortDate(template.starts_on)} – ${shortDate(template.ends_on)}`
                  : `From ${shortDate(template.starts_on)}`}
              </Chip>
            )}
            {template.paused_at && <Chip icon={Pause}>Paused</Chip>}
          </>
        }
        content={
          template.subtasks.length > 0 && (
            <section aria-label="Subtasks" className="mt-1">
              <h3 className="mb-0.5 flex h-6 items-center type-label text-(--text-tertiary)">
                Subtasks
              </h3>
              <ul>
                {template.subtasks.map((subtask) => (
                  <li key={subtask.id} className="flex h-7 items-center gap-2 type-body">
                    <span
                      aria-hidden
                      className="size-3.5 shrink-0 rounded-[4px] border-2 border-(--area-solid)"
                    />
                    {subtask.title}
                  </li>
                ))}
              </ul>
            </section>
          )
        }
        notes={{
          key: `template-${id}`,
          markdown: template.notes,
          save: (notes) =>
            saveNotes(
              () => updateTaskTemplate({ path, body: { notes }, throwOnError: true }),
              getTaskTemplateQueryKey({ path }),
            ),
        }}
        actions={menu.actions}
        error={owner.error ?? update.error}
      />
      {menu.dialogs}
    </AreaScope>
  );
}

// ---------- Event ----------

function EventPanel({ id, day }: { id: number; day: string | null }) {
  const query = useQuery(getEventOptions({ path: { event_id: id } }));
  const event = query.data;
  const isRepeating = event?.rrule != null && day !== null;
  const occQuery = useQuery({
    ...getEventOccurrenceOptions({ path: { event_id: id, day: day ?? "" } }),
    enabled: isRepeating,
  });
  const occurrence = occQuery.data;
  const owner = useOwnerCrumbs("event", event);
  const area = owner.area;
  const update = useMutation(updateEventMutation());
  const editOcc = useMutation(editEventOccurrenceMutation());
  const saveNotes = useNotesSave();
  const [scope, setScope] = useState<"this" | "all">("this");
  const close = useDetailPanel((state) => state.close);
  const menu = useEventActions(event, day, { onDeleted: close });

  if (!event || (isRepeating && !occurrence))
    return <Loading error={query.error ?? occQuery.error} />;
  const path = { event_id: id };
  const shown = occurrence ?? event;
  const start = shown.start_date;
  const end = shown.end_date ?? start;
  const when = [
    end === start ? dayDate(start) : `${dayDate(start)} – ${dayDate(end)}`,
    shown.start_time &&
      `${clock(shown.start_time)}${shown.end_time ? ` – ${clock(shown.end_time)}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const forThis = isRepeating && scope === "this" && occurrence && day;

  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={owner.crumbs()}
        marker={<Marker icon={CalendarDays} solid />}
        title={shown.title}
        // A repeating event's title changes for this one, the following or all: that
        // choice comes with the event form.
        onRename={
          event.rrule ? undefined : (title) => update.mutateAsync({ path, body: { title } })
        }
        chips={
          <>
            <EventWhenChip
              when={when}
              startDate={start}
              endDate={shown.end_date ?? ""}
              startTime={shown.start_time ?? ""}
              endTime={shown.end_time ?? ""}
              onSave={async (fields) => {
                if (forThis) {
                  await editOcc.mutateAsync({
                    path: { event_id: id, day },
                    body: { scope: "this", ...fields },
                  });
                } else {
                  await update.mutateAsync({ path, body: fields });
                }
              }}
            />
            {event.rrule && <Chip icon={Repeat}>{describeRule(event.rrule)}</Chip>}
            <EventLocationChip
              location={shown.location ?? null}
              onSave={async (location) => {
                if (forThis) {
                  await editOcc.mutateAsync({
                    path: { event_id: id, day },
                    body: { scope: "this", location },
                  });
                } else {
                  await update.mutateAsync({ path, body: { location } });
                }
              }}
            />
            {event.cancelled_at && <Chip>Cancelled</Chip>}
          </>
        }
        notes={{
          key: `event-${id}-${forThis ? day : "all"}`,
          markdown: forThis ? occurrence.notes : event.notes,
          header: isRepeating && (
            <div className="mb-1.5 flex items-center gap-2">
              <span className="type-meta text-(--text-tertiary)">Notes for</span>
              <fieldset className="flex h-7 rounded-(--radius-6) bg-(--switch-container-bg) p-0.5">
                <legend className="sr-only">Notes for</legend>
                {(
                  [
                    ["this", "This event"],
                    ["all", "All events"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center rounded-[4px] px-3 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-(--focus-ring) ${
                      scope === value
                        ? "bg-(--bg-surface) text-(--text-primary) shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                        : "text-(--text-secondary)"
                    }`}
                  >
                    <input
                      type="radio"
                      name="notes-scope"
                      value={value}
                      checked={scope === value}
                      onChange={() => setScope(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>
          ),
          save: (notes) =>
            forThis
              ? saveNotes(
                  () =>
                    editEventOccurrence({
                      path: { event_id: id, day },
                      body: { scope: "this", notes },
                      throwOnError: true,
                    }),
                  listEventOccurrencesQueryKey({ query: { first: day, last: day } }),
                )
              : saveNotes(
                  () => updateEvent({ path, body: { notes }, throwOnError: true }),
                  getEventQueryKey({ path }),
                ),
        }}
        actions={menu.actions}
        error={owner.error ?? update.error ?? editOcc.error ?? menu.error}
      />
      {menu.dialogs}
    </AreaScope>
  );
}

// ---------- Metric ----------

const MANUAL_AGGREGATIONS = [
  { id: "sum", label: "Total" },
  { id: "average", label: "Average" },
  { id: "latest", label: "Latest" },
] as const;

const STEP_AGGREGATIONS = [
  { id: "sum", label: "Days done" },
  { id: "average", label: "Completion rate" },
] as const;

const DIRECTIONS = [
  { id: "higher", label: "Higher is better" },
  { id: "lower", label: "Lower is better" },
] as const;

function MetricPanel({ id }: { id: number }) {
  const query = useQuery(getMetricOptions({ path: { metric_id: id } }));
  const metric = query.data;
  const owner = useOwnerCrumbs("metric", metric);
  const area = owner.area;
  const update = useMutation(updateMetricMutation());
  const saveNotes = useNotesSave();
  const close = useDetailPanel((state) => state.close);
  const [editing, setEditing] = useState(false);
  const menu = useMetricActions(metric, { onArchived: close, onDeleted: close });

  if (!metric) return <Loading error={query.error} />;
  const path = { metric_id: id };
  const isArchived = metric.archived_at !== null;
  const target = currentTarget(metric);
  const amount = (value: number) => formatValue(value, metric);
  let progress: string | null = null;
  let goal = "No target";
  if (target?.kind === "per_period" && target.period) {
    goal = `Target · ${amount(target.target_value)} per ${target.period}`;
    if (target.current_period) {
      progress = `${amount(target.current_period.value ?? 0)} of ${amount(target.target_value)} this ${target.period}`;
    }
  } else if (target?.kind === "reach_by") {
    goal = `Target · ${amount(target.target_value)} by ${shortDate(target.end_date ?? target.start_date)}`;
    if (target.value !== null)
      progress = `${amount(target.value)} of ${amount(target.target_value)}`;
  }

  const aggregationOptions =
    metric.source === "routine_step" ? [...STEP_AGGREGATIONS] : [...MANUAL_AGGREGATIONS];
  const aggregationLabel =
    aggregationOptions.find((option) => option.id === metric.aggregation)?.label ??
    metric.aggregation;
  const directionLabel = metric.direction === "higher" ? "Higher is better" : "Lower is better";
  const preset = presetFor(metric);
  const measureLabel =
    metric.format === "currency" || (metric.format === "number" && metric.unit)
      ? `${preset.label} · ${metric.unit}`
      : preset.label;

  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={owner.crumbs()}
        marker={<Marker icon={ChartLine} />}
        title={metric.title}
        onRename={isArchived ? undefined : (title) => update.mutateAsync({ path, body: { title } })}
        chips={
          <>
            {isArchived && <Chip icon={Archive}>Archived</Chip>}
            {progress && <Chip>{progress}</Chip>}
            {isArchived ? (
              <>
                <Chip>{aggregationLabel}</Chip>
                <Chip icon={Target}>{goal}</Chip>
                <Chip>{directionLabel}</Chip>
              </>
            ) : (
              <>
                {metric.source === "manual" && (
                  <button
                    type="button"
                    aria-label="Edit format and unit"
                    onClick={() => setEditing(true)}
                    className={chipClass("default", true)}
                  >
                    <preset.icon aria-hidden className="size-3.5 text-(--text-tertiary)" />
                    {measureLabel}
                  </button>
                )}
                <MenuChip
                  label="Aggregation"
                  value={metric.aggregation}
                  options={aggregationOptions}
                  onChange={(aggregation) =>
                    update.mutate({
                      path,
                      body: { aggregation: aggregation as MetricRead["aggregation"] },
                    })
                  }
                >
                  {aggregationLabel}
                </MenuChip>
                <button
                  type="button"
                  aria-label="Edit target"
                  onClick={() => setEditing(true)}
                  className={chipClass(target ? "default" : "ghost", true)}
                >
                  <Target aria-hidden className="size-3.5 text-(--text-tertiary)" />
                  {goal}
                </button>
                <MenuChip
                  label="Direction"
                  value={metric.direction}
                  options={[...DIRECTIONS]}
                  onChange={(direction) =>
                    update.mutate({
                      path,
                      body: { direction: direction as MetricRead["direction"] },
                    })
                  }
                >
                  {directionLabel}
                </MenuChip>
              </>
            )}
          </>
        }
        content={<MetricEntries metric={metric} />}
        notes={{
          key: `metric-${id}-${isArchived}`,
          markdown: metric.notes,
          readOnly: isArchived,
          save: (notes) =>
            saveNotes(
              () => updateMetric({ path, body: { notes }, throwOnError: true }),
              getMetricQueryKey({ path }),
            ),
        }}
        actions={menu.actions}
        error={owner.error ?? update.error ?? menu.error}
      />
      {editing && <EditMetricModal metric={metric} onClose={() => setEditing(false)} />}
      {menu.dialogs}
    </AreaScope>
  );
}

const ENTRIES_PREVIEW_LIMIT = 8;

function MetricEntries({ metric }: { metric: MetricRead }) {
  const entriesQuery = useQuery(listMetricEntriesOptions({ path: { metric_id: metric.id } }));
  const log = useMutation(createMetricEntryMutation());
  const showToast = useChangeToast((state) => state.show);
  const deleteWithUndo = useDeleteWithUndo();
  const pending = usePendingDeletes((state) => state.pending);
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => today());
  const [invalid, setInvalid] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const isManual = metric.source === "manual";
  const canLog = isManual && metric.archived_at === null;
  const { prefix, suffix } = inputAffixes(metric);
  const maxDay = today();

  const submit = () => {
    const value = parseValue(text, metric.format);
    if (value === null || !date || date > maxDay) {
      setInvalid(true);
      return;
    }
    log.mutate(
      { path: { metric_id: metric.id }, body: { value, date } },
      {
        onSuccess: (change) => {
          setText("");
          setInvalid(false);
          showToast(`Logged ${formatValue(value, metric)} · ${metric.title}`, change.batch_id);
        },
      },
    );
  };

  const entries = [...(entriesQuery.data ?? [])]
    .filter((entry) => entry.id === null || !isPendingDelete(pending, "metric_entry", entry.id))
    .reverse();
  const visible = showAll ? entries : entries.slice(0, ENTRIES_PREVIEW_LIMIT);

  return (
    <section aria-label="Entries" className="mt-1 flex flex-col gap-2">
      <div className="flex h-6 items-center gap-1.5">
        <h3 className="type-label text-(--text-tertiary)">Entries</h3>
        {entries.length > 0 && (
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-(--counter-bg) px-1.5 type-tag font-medium text-(--text-secondary) tabular-nums">
            {entries.length}
          </span>
        )}
      </div>
      {canLog && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label className="flex h-8 min-w-0 flex-1 cursor-text items-center gap-1 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-200">
              {prefix && <span className="text-xs text-(--text-tertiary)">{prefix}</span>}
              <input
                aria-label="Log value"
                inputMode={metric.format === "duration" ? "text" : "decimal"}
                placeholder={metric.format === "duration" ? "1:30" : "Log a value…"}
                value={text}
                disabled={log.isPending}
                onChange={(event) => {
                  setText(event.target.value);
                  setInvalid(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
                className="w-full min-w-0 bg-transparent type-body text-(--text-primary) tabular-nums outline-none placeholder:text-(--text-disabled)"
              />
              {suffix && <span className="shrink-0 text-xs text-(--text-tertiary)">{suffix}</span>}
            </label>
            <span className="w-[136px] shrink-0">
              <DatePickerField
                label="Entry date"
                value={date}
                onChange={(next) => {
                  setDate(next);
                  setInvalid(false);
                }}
              />
            </span>
            <Button
              size="sm"
              isDisabled={log.isPending || text.trim() === ""}
              onPress={submit}
              className="button--area h-8 shrink-0 px-2.5"
            >
              <Plus aria-hidden className="size-3.5" />
              Log
            </Button>
          </div>
          {invalid && (
            <p role="alert" className="type-meta text-(--text-danger)">
              {date > maxDay ? "Pick today or an earlier date." : "Enter a valid number."}
            </p>
          )}
          {log.error && <QueryError error={log.error} />}
        </div>
      )}
      {entries.length === 0 ? (
        <p className="type-meta text-(--text-tertiary)">
          {isManual ? "No entries yet." : "Entries are counted from this metric’s routine step."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {visible.map((entry, index) => {
            const label = formatValue(entry.value, metric);
            return (
              <li
                key={entry.id ?? `${entry.date}-${index}`}
                className="group flex min-h-7 items-center gap-2 type-body"
              >
                <span className="w-[62px] shrink-0 type-meta text-(--text-tertiary) tabular-nums">
                  {shortDate(entry.date)}
                </span>
                <span className="shrink-0 font-medium text-(--text-primary) tabular-nums">
                  {label}
                </span>
                {entry.note && (
                  <span className="min-w-0 flex-1 truncate type-meta text-(--text-secondary)">
                    {entry.note}
                  </span>
                )}
                <span className="flex-1" />
                {canLog && entry.id !== null && (
                  <button
                    type="button"
                    aria-label={`Delete ${label} on ${shortDate(entry.date)}`}
                    onClick={() => {
                      const entryId = entry.id;
                      if (entryId === null) return;
                      deleteWithUndo({ kind: "metric_entry", id: entryId, label }, () =>
                        deleteMetricEntry({
                          path: { entry_id: entryId },
                          throwOnError: true,
                          keepalive: true,
                        }),
                      );
                    }}
                    className="grid size-6 shrink-0 place-items-center rounded-(--radius-6) text-(--text-tertiary) opacity-0 outline-none group-hover:opacity-100 hover:bg-(--bg-hover) hover:text-(--text-primary) focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {entries.length > ENTRIES_PREVIEW_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="self-start type-meta text-(--text-secondary) hover:text-(--text-primary)"
        >
          {showAll ? "Show fewer" : `Show all ${entries.length} entries`}
        </button>
      )}
    </section>
  );
}

function RoutineDetailPanel({ id }: { id: number }) {
  const navigate = useNavigate();
  const close = useDetailPanel((state) => state.close);
  const { period, date } = usePeriodStore();
  const query = useQuery(
    getRoutinePageOptions({ path: { routine_id: id }, query: { period, date } }),
  );
  const lifeAreas = useQuery(listLifeAreasOptions()).data ?? [];
  const saveNotes = useNotesSave();
  const update = useMutation(updateRoutineMutation());
  const check = useMutation(setRoutineStepDayMutation());
  const clear = useMutation(clearRoutineStepDayMutation());
  const timeFormat = useTimeFormat();
  const data = query.data;

  if (!data) return <Loading error={query.error} />;
  const { routine, steps, today: currentToday } = data;
  const isArchived = routine.archived_at !== null;
  const activeRule =
    data.rrule ?? routine.schedules[routine.schedules.length - 1]?.rrule ?? "FREQ=DAILY";
  const colorOf = (lifeAreaId: number) => lifeAreas.find((a) => a.id === lifeAreaId)?.color ?? null;

  return (
    <AreaScope color={null}>
      <PanelView
        crumbs={["Routines"]}
        marker={<Marker icon={Repeat} />}
        title={routine.title}
        onRename={
          isArchived
            ? undefined
            : async (title) => {
                await updateRoutine({
                  path: { routine_id: id },
                  body: { title },
                  throwOnError: true,
                });
              }
        }
        headerAction={
          <IconButton
            label="Open routine page"
            onPress={() => {
              close();
              navigate(`/areas/routines/${id}`);
            }}
          >
            <ArrowUpRight />
          </IconButton>
        }
        chips={
          <>
            <Chip icon={Repeat}>{describeRule(activeRule)}</Chip>
            {isArchived ? (
              <>
                {routine.start_time && (
                  <Chip>
                    {routine.end_time
                      ? `${formatTime(routine.start_time, timeFormat)} – ${formatTime(routine.end_time, timeFormat)}`
                      : formatTime(routine.start_time, timeFormat)}
                  </Chip>
                )}
                <Chip icon={Archive}>Archived</Chip>
              </>
            ) : (
              <TimeRangeChip
                label="Routine time"
                startTime={routine.start_time ?? null}
                endTime={routine.end_time ?? null}
                onChange={({ startTime, endTime }) =>
                  update.mutate({
                    path: { routine_id: id },
                    body: { start_time: startTime, end_time: endTime },
                  })
                }
              />
            )}
          </>
        }
        content={
          <section aria-label="Today's steps" className="flex flex-col gap-1">
            <h3 className="type-label text-(--text-tertiary)">Steps</h3>
            {steps.length === 0 ? (
              <p className="type-meta text-(--text-tertiary)">No steps yet.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {steps
                  .filter((s) => s.step.archived_at === null)
                  .map((s) => {
                    const todayState = s.days.find((d) => d.day === currentToday);
                    const done = todayState?.state === "done";
                    const actionable =
                      todayState?.state === "todo" ||
                      todayState?.state === "done" ||
                      todayState?.state === "missed";
                    const path = { step_id: s.step.id, day: currentToday };
                    return (
                      <li
                        key={s.step.id}
                        data-area={areaDataAttribute(colorOf(s.step.life_area_id))}
                        className="flex min-h-7 items-center gap-2 rounded-(--radius-6) px-1"
                      >
                        <EntityCheckbox
                          shape="round"
                          size="sm"
                          checked={done}
                          disabled={!actionable || isArchived || check.isPending || clear.isPending}
                          label={
                            done ? `Mark ${s.step.title} not done` : `Mark ${s.step.title} done`
                          }
                          onChange={() =>
                            done
                              ? clear.mutate({ path })
                              : check.mutate({ path, body: { status: "done" } })
                          }
                        />
                        <span
                          className={`min-w-0 flex-1 truncate type-body ${
                            done ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"
                          }`}
                        >
                          {s.step.title}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
        }
        notes={{
          key: `routine-${id}`,
          markdown: routine.notes,
          readOnly: isArchived,
          save: (notes) =>
            saveNotes(
              () =>
                updateRoutine({
                  path: { routine_id: id },
                  body: { notes },
                  throwOnError: true,
                }),
              getRoutinePageQueryKey({ path: { routine_id: id }, query: { period, date } }),
            ),
        }}
        error={update.error ?? check.error ?? clear.error}
      />
    </AreaScope>
  );
}

function EventWhenChip({
  when,
  startDate,
  endDate,
  startTime,
  endTime,
  onSave,
}: {
  when: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  onSave: (fields: {
    start_date: string;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
  }) => Promise<unknown>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sDate, setSDate] = useState(startDate);
  const [eDate, setEDate] = useState(endDate === startDate ? "" : endDate);
  const [sTime, setSTime] = useState(startTime.slice(0, 5));
  const [eTime, setETime] = useState(endTime.slice(0, 5));
  const [saving, setSaving] = useState(false);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setSDate(startDate);
      setEDate(endDate === startDate ? "" : endDate);
      setSTime(startTime.slice(0, 5));
      setETime(endTime.slice(0, 5));
    }
    setIsOpen(next);
  };

  const apply = async () => {
    setSaving(true);
    try {
      await onSave({
        start_date: sDate,
        end_date: eDate && eDate >= sDate ? eDate : null,
        start_time: sTime || null,
        end_time: sTime && eTime ? eTime : null,
      });
      setIsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PopoverChip
      icon={CalendarDays}
      label="Event date and time"
      width={280}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      chip={<span className="truncate">{when}</span>}
    >
      <div className="flex flex-col gap-2.5 p-1">
        <div className="flex flex-col gap-1">
          <span className="type-meta text-(--text-tertiary)">Start date</span>
          <DatePickerField label="Start date" value={sDate} onChange={setSDate} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="type-meta text-(--text-tertiary)">End date (optional)</span>
          <DatePickerField
            label="End date"
            value={eDate}
            onChange={setEDate}
            placeholder="Same day"
            clearLabel="Same day"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="type-meta text-(--text-tertiary)">Start time</span>
            <input
              type="time"
              value={sTime}
              onChange={(e) => setSTime(e.target.value)}
              className="h-8 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2 type-body text-(--text-primary)"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="type-meta text-(--text-tertiary)">End time</span>
            <input
              type="time"
              value={eTime}
              disabled={!sTime}
              onChange={(e) => setETime(e.target.value)}
              className="h-8 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2 type-body text-(--text-primary) disabled:opacity-45"
            />
          </label>
        </div>
        <div className="flex justify-end gap-1.5 pt-1">
          <Button size="sm" variant="ghost" onPress={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" isDisabled={saving || !sDate} onPress={apply}>
            Save
          </Button>
        </div>
      </div>
    </PopoverChip>
  );
}

function EventLocationChip({
  location,
  onSave,
}: {
  location: string | null;
  onSave: (location: string | null) => Promise<unknown>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(location ?? "");
  const [saving, setSaving] = useState(false);

  const onOpenChange = (next: boolean) => {
    if (next) setDraft(location ?? "");
    setIsOpen(next);
  };

  const apply = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim() || null);
      setIsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PopoverChip
      icon={MapPin}
      tone={location ? "default" : "ghost"}
      label="Event location"
      width={260}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      chip={<span className="truncate">{location || "Add location"}</span>}
    >
      <div className="flex flex-col gap-2 p-1">
        <input
          type="text"
          aria-label="Location"
          placeholder="Add location…"
          maxLength={300}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
          className="h-8 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 type-body text-(--text-primary) outline-none focus:border-(--color-brand-600)"
        />
        <div className="flex justify-end gap-1.5">
          {location && (
            <Button
              size="sm"
              variant="ghost"
              isDisabled={saving}
              onPress={async () => {
                setSaving(true);
                try {
                  await onSave(null);
                  setIsOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Clear
            </Button>
          )}
          <Button size="sm" isDisabled={saving} onPress={apply}>
            Save
          </Button>
        </div>
      </div>
    </PopoverChip>
  );
}
