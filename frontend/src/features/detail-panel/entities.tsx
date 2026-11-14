import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChartLine,
  CircleCheck,
  Flag,
  Flame,
  Folder,
  ListChecks,
  MapPin,
  Palette,
  Pause,
  Repeat,
  RotateCcw,
  Sun,
  Target,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import {
  archiveTaskMutation,
  completeTaskMutation,
  createSubtaskMutation,
  getAreaPageOptions,
  getEventOptions,
  getEventQueryKey,
  getLifeAreaOptions,
  getLifeAreaQueryKey,
  getMetricOptions,
  getMetricQueryKey,
  getProjectOptions,
  getProjectQueryKey,
  getRoutineOptions,
  getRoutineQueryKey,
  getTaskOptions,
  getTaskQueryKey,
  getTaskTemplateOptions,
  getTaskTemplateQueryKey,
  listEventOccurrencesOptions,
  listEventOccurrencesQueryKey,
  listLifeAreasOptions,
  reopenTaskMutation,
  unarchiveLifeAreaMutation,
  updateEventMutation,
  updateLifeAreaMutation,
  updateMetricMutation,
  updateProjectMutation,
  updateRoutineMutation,
  updateRoutineStepMutation,
  updateSubtaskMutation,
  updateTaskMutation,
  updateTaskTemplateMutation,
} from "../../client/@tanstack/react-query.gen";
import {
  editEventOccurrence,
  updateEvent,
  updateLifeArea,
  updateMetric,
  updateProject,
  updateRoutine,
  updateRoutineStep,
  updateTask,
  updateTaskTemplate,
} from "../../client/sdk.gen";
import type {
  LifeAreaRead,
  MetricRead,
  SubtaskRead,
  TaskRead,
  TaskTemplateRead,
} from "../../client/types.gen";
import { QueryError } from "../../components/QueryError";
import { today } from "../../period";
import { type PanelTarget, useDetailPanel } from "../../stores/detailPanelStore";
import { usePeriodStore } from "../../stores/periodStore";
import { ArchiveAreaDialog } from "../life-areas/ArchiveAreaDialog";
import { describeRule } from "../life-areas/area/timeScale";
import { daysBetween, formatAmount, plural, shortDate } from "../life-areas/overview/format";
import { AREA_PALETTES, areaDataAttribute } from "../life-areas/palette";
import {
  Chip,
  DateChip,
  EditableLine,
  Marker,
  MenuChip,
  type PanelAction,
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
    case "metric":
      return <MetricPanel id={target.id} />;
    case "routine":
      return <RoutinePanel id={target.id} />;
    case "step":
      return <StepPanel id={target.id} routineId={target.routineId} />;
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

function ownerCrumbs(
  area: LifeAreaRead | undefined,
  project: { title: string } | undefined,
): string[] {
  return [area?.title ?? "Inbox", ...(project ? [project.title] : [])];
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
  const restore = useMutation(unarchiveLifeAreaMutation());
  const saveNotes = useNotesSave();
  const [isArchiving, setIsArchiving] = useState(false);

  const area = query.data;
  if (!area) return <Loading error={query.error} />;
  const path = { life_area_id: id };
  const save = (body: Parameters<typeof updateLifeArea>[0]["body"]) =>
    update.mutateAsync({ path, body });
  const isArchived = area.archived_at !== null;
  const contents = page?.contents;

  const actions: PanelAction[] = [
    isArchived
      ? {
          id: "restore",
          label: "Restore area",
          icon: ArchiveRestore,
          onAction: () => restore.mutate({ path }),
        }
      : {
          id: "archive",
          label: "Archive area",
          icon: Archive,
          onAction: () => setIsArchiving(true),
          isDisabled: !contents,
        },
  ];

  return (
    <AreaScope color={area.color}>
      <PanelView
        crumbs={["Life areas"]}
        marker={<Marker />}
        title={area.title}
        onRename={(title) => save({ title })}
        lead={
          <EditableLine
            label="Vision"
            placeholder="Add a vision…"
            maxLength={2000}
            value={area.vision}
            onSave={(vision) => save({ vision })}
          />
        }
        chips={
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
            {isArchived && <Chip icon={Archive}>Archived</Chip>}
          </>
        }
        notes={{
          key: `area-${id}`,
          markdown: area.notes,
          save: (notes) =>
            saveNotes(
              () => updateLifeArea({ path, body: { notes }, throwOnError: true }),
              getLifeAreaQueryKey({ path }),
            ),
        }}
        actions={actions}
        error={update.error ?? restore.error}
      />
      {isArchiving && contents && (
        <ArchiveAreaDialog
          lifeArea={area}
          contents={contents}
          onClose={() => setIsArchiving(false)}
          onArchived={() => {
            close();
            navigate("/areas");
          }}
        />
      )}
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

  const project = query.data;
  if (!project) return <Loading error={query.error} />;
  const path = { project_id: id };
  const { done, total } = project.progress;
  const now = today();
  const left = project.due_date ? daysBetween(now, project.due_date) : null;
  const dates = `${shortDate(project.created_at.slice(0, 10))} – ${
    project.due_date ? shortDate(project.due_date) : "No due date"
  }${
    left === null || project.status !== "active"
      ? ""
      : left < 0
        ? ` · ${plural(-left, "day")} late`
        : ` · ${left}d left`
  }`;

  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={[area?.title ?? "", "Projects"]}
        marker={<Marker icon={Folder} />}
        title={project.title}
        onRename={(title) => update.mutateAsync({ path, body: { title } })}
        chips={
          <>
            <Chip icon={project.status === "done" ? CircleCheck : undefined}>
              {PROJECT_STATUS[project.status]}
            </Chip>
            <DateChip
              icon={CalendarDays}
              label="Due date"
              tone={left !== null && left < 0 && project.status === "active" ? "danger" : "default"}
              value={project.due_date}
              onChange={(due_date) => update.mutate({ path, body: { due_date } })}
            >
              {dates}
            </DateChip>
            <Chip icon={ChartLine}>
              {total
                ? `${done} of ${plural(total, "task")} · ${Math.round((done / total) * 100)}%`
                : "No tasks"}
            </Chip>
          </>
        }
        notes={{
          key: `project-${id}`,
          markdown: project.notes,
          save: (notes) =>
            saveNotes(
              () => updateProject({ path, body: { notes }, throwOnError: true }),
              getProjectQueryKey({ path }),
            ),
        }}
        error={update.error}
      />
    </AreaScope>
  );
}

// ---------- Task ----------

function TaskPanel({ id }: { id: number }) {
  const query = useQuery(getTaskOptions({ path: { task_id: id } }));
  const task = query.data;
  const area = useLifeArea(task?.life_area_id);
  const project = useProject(task?.project_id);
  const template = useQuery({
    ...getTaskTemplateOptions({ path: { template_id: task?.template_id ?? 0 } }),
    enabled: task?.template_id != null,
  }).data;
  const update = useMutation(updateTaskMutation());
  const complete = useMutation(completeTaskMutation());
  const reopen = useMutation(reopenTaskMutation());
  const archive = useMutation(archiveTaskMutation());
  const saveNotes = useNotesSave();

  if (!task) return <Loading error={query.error} />;
  const path = { task_id: id };
  const isDone = task.status === "done";
  const toggleDone = () => (isDone ? reopen : complete).mutate({ path });
  const section = project?.sections.find((s) => s.id === task.section_id);

  const actions: PanelAction[] = [
    isDone
      ? { id: "reopen", label: "Mark not done", icon: RotateCcw, onAction: toggleDone }
      : {
          id: "complete",
          label: "Complete task",
          icon: CircleCheck,
          onAction: toggleDone,
          isDisabled: task.status === "cancelled",
        },
    {
      id: "archive",
      label: "Archive task",
      icon: Archive,
      onAction: () => archive.mutate({ path }),
      isDisabled: task.archived_at !== null,
    },
  ];

  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={[...ownerCrumbs(area, project), ...(section ? [section.title] : [])]}
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
        actions={actions}
        error={update.error ?? complete.error ?? reopen.error ?? archive.error}
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
        onChange={(scheduled_date) => onChange({ scheduled_date })}
      >
        {task.scheduled_date
          ? `${dayDate(task.scheduled_date)}${
              task.rollover_count ? ` · ${plural(task.rollover_count, "rollover")}` : ""
            }`
          : "Schedule"}
      </DateChip>
      {template?.rrule && <Chip icon={Repeat}>{describeRule(template.rrule)}</Chip>}
    </>
  );
}

function Subtasks({ task }: { task: TaskRead }) {
  const create = useMutation(createSubtaskMutation());
  const update = useMutation(updateSubtaskMutation());
  const [draft, setDraft] = useState("");
  const done = task.subtasks.filter((s) => s.status === "done").length;
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
        {task.subtasks.length > 0 && (
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-neutral-200 px-1.5 text-[11px] font-medium text-(--text-secondary)">
            {done}/{task.subtasks.length}
          </span>
        )}
      </div>
      {(create.error || update.error) && <QueryError error={create.error ?? update.error} />}
      <ul>
        {task.subtasks.map((subtask) => {
          const isDone = subtask.status === "done";
          return (
            <li key={subtask.id} className="flex h-7 items-center gap-2">
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => toggle(subtask)}
                aria-label={subtask.title}
                className="grid size-3.5 shrink-0 cursor-pointer appearance-none place-items-center rounded-[4px] border-2 border-(--area-solid) outline-none checked:bg-(--area-solid) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
              />
              <span
                className={`truncate text-[13px] ${isDone ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"}`}
              >
                {subtask.title}
              </span>
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
        className="h-7 w-full rounded-(--radius-6) bg-transparent pl-[22px] text-[13px] text-(--text-primary) outline-none placeholder:text-(--text-disabled) focus:bg-(--bg-hover)"
      />
    </section>
  );
}

// ---------- Recurring task ----------

function TemplatePanel({ id }: { id: number }) {
  const query = useQuery(getTaskTemplateOptions({ path: { template_id: id } }));
  const template = query.data;
  const area = useLifeArea(template?.life_area_id);
  const project = useProject(template?.project_id);
  const update = useMutation(updateTaskTemplateMutation());
  const saveNotes = useNotesSave();

  if (!template) return <Loading error={query.error} />;
  const path = { template_id: id };
  const priority = PRIORITIES.find((p) => p.id === template.priority);
  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={ownerCrumbs(area, project)}
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
                  <li key={subtask.id} className="flex h-7 items-center gap-2 text-[13px]">
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
        error={update.error}
      />
    </AreaScope>
  );
}

// ---------- Event ----------

function EventPanel({ id, day }: { id: number; day: string | null }) {
  const query = useQuery(getEventOptions({ path: { event_id: id } }));
  const event = query.data;
  const isRepeating = event?.rrule != null && day !== null;
  const occurrenceQuery = {
    query: { first: day ?? "", last: day ?? "", life_area_id: event?.life_area_id },
  };
  const occurrence = useQuery({
    ...listEventOccurrencesOptions(occurrenceQuery),
    enabled: isRepeating,
  }).data?.find((o) => o.event_id === id && o.occurrence_date === day);
  const area = useLifeArea(event?.life_area_id);
  const project = useProject(event?.project_id);
  const update = useMutation(updateEventMutation());
  const saveNotes = useNotesSave();
  const [scope, setScope] = useState<"this" | "all">("this");

  if (!event || (isRepeating && !occurrence)) return <Loading error={query.error} />;
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
        crumbs={ownerCrumbs(area, project)}
        marker={<Marker icon={CalendarDays} solid />}
        title={shown.title}
        // A repeating event's title changes for this one, the following or all: that
        // choice comes with the event form.
        onRename={
          event.rrule ? undefined : (title) => update.mutateAsync({ path, body: { title } })
        }
        chips={
          <>
            <Chip icon={CalendarDays}>{when}</Chip>
            {event.rrule && <Chip icon={Repeat}>{describeRule(event.rrule)}</Chip>}
            {shown.location && <Chip icon={MapPin}>{shown.location}</Chip>}
            {event.cancelled_at && <Chip>Cancelled</Chip>}
          </>
        }
        notes={{
          key: `event-${id}-${forThis ? day : "all"}`,
          markdown: forThis ? occurrence.notes : event.notes,
          header: isRepeating && (
            <div className="mb-1.5 flex items-center gap-2">
              <span className="type-meta text-(--text-tertiary)">Notes for</span>
              <fieldset className="flex h-7 rounded-(--radius-6) bg-neutral-200 p-0.5">
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
                  listEventOccurrencesQueryKey(occurrenceQuery),
                )
              : saveNotes(
                  () => updateEvent({ path, body: { notes }, throwOnError: true }),
                  getEventQueryKey({ path }),
                ),
        }}
        error={update.error}
      />
    </AreaScope>
  );
}

// ---------- Metric ----------

const AGGREGATION = { sum: "Sum", average: "Average", latest: "Latest" } as const;

/** The target in force today, or the next one. */
function currentTarget(metric: MetricRead) {
  return (
    metric.targets.find((t) => t.state === "in_progress") ??
    metric.targets.find((t) => t.state === "upcoming")
  );
}

function MetricPanel({ id }: { id: number }) {
  const query = useQuery(getMetricOptions({ path: { metric_id: id } }));
  const metric = query.data;
  const area = useLifeArea(metric?.life_area_id);
  const project = useProject(metric?.project_id);
  const update = useMutation(updateMetricMutation());
  const saveNotes = useNotesSave();

  if (!metric) return <Loading error={query.error} />;
  const path = { metric_id: id };
  const target = currentTarget(metric);
  const amount = (value: number) => formatAmount(value, metric.unit);
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

  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={ownerCrumbs(area, project)}
        marker={<Marker icon={ChartLine} />}
        title={metric.title}
        onRename={(title) => update.mutateAsync({ path, body: { title } })}
        chips={
          <>
            {progress && <Chip>{progress}</Chip>}
            <Chip>{AGGREGATION[metric.aggregation]}</Chip>
            <Chip icon={Target}>{goal}</Chip>
            <Chip>{metric.direction === "higher" ? "Higher is better" : "Lower is better"}</Chip>
          </>
        }
        notes={{
          key: `metric-${id}`,
          markdown: metric.notes,
          save: (notes) =>
            saveNotes(
              () => updateMetric({ path, body: { notes }, throwOnError: true }),
              getMetricQueryKey({ path }),
            ),
        }}
        error={update.error}
      />
    </AreaScope>
  );
}

// ---------- Routine and routine step ----------

function RoutinePanel({ id }: { id: number }) {
  const query = useQuery(getRoutineOptions({ path: { routine_id: id } }));
  const update = useMutation(updateRoutineMutation());
  const saveNotes = useNotesSave();

  const routine = query.data;
  if (!routine) return <Loading error={query.error} />;
  const path = { routine_id: id };
  const schedule = routine.schedules.at(-1);
  return (
    <AreaScope>
      <PanelView
        crumbs={["Routines"]}
        marker={<Marker icon={Repeat} />}
        title={routine.title}
        onRename={(title) => update.mutateAsync({ path, body: { title } })}
        chips={
          <>
            {schedule && <Chip icon={Repeat}>{describeRule(schedule.rrule)}</Chip>}
            <Chip icon={ListChecks}>{plural(routine.steps.length, "step")}</Chip>
            {routine.is_paused && <Chip icon={Pause}>Paused</Chip>}
          </>
        }
        notes={{
          key: `routine-${id}`,
          markdown: routine.notes,
          save: (notes) =>
            saveNotes(
              () => updateRoutine({ path, body: { notes }, throwOnError: true }),
              getRoutineQueryKey({ path }),
            ),
        }}
        error={update.error}
      />
    </AreaScope>
  );
}

function StepPanel({ id, routineId }: { id: number; routineId: number }) {
  const query = useQuery(getRoutineOptions({ path: { routine_id: routineId } }));
  const step = query.data?.steps.find((s) => s.id === id);
  const area = useLifeArea(step?.life_area_id);
  const project = useProject(step?.project_id);
  const update = useMutation(updateRoutineStepMutation());
  const saveNotes = useNotesSave();

  const routine = query.data;
  if (!routine || !step) return <Loading error={query.error} />;
  const path = { step_id: id };
  const schedule = routine.schedules.at(-1);
  return (
    <AreaScope color={area?.color}>
      <PanelView
        crumbs={[...ownerCrumbs(area, project), routine.title]}
        marker={<Marker icon={Repeat} />}
        title={step.title}
        onRename={(title) => update.mutateAsync({ path, body: { title } })}
        chips={
          <>
            {schedule && <Chip icon={Repeat}>{describeRule(schedule.rrule)}</Chip>}
            <Chip icon={Flame}>
              Streak {step.current_streak} · best {step.best_streak}
            </Chip>
            <Chip icon={CalendarDays}>Since {shortDate(step.starts_on)}</Chip>
            {(step.is_paused || routine.is_paused) && <Chip icon={Pause}>Paused</Chip>}
          </>
        }
        notes={{
          key: `step-${id}`,
          markdown: step.notes,
          save: (notes) =>
            saveNotes(
              () => updateRoutineStep({ path, body: { notes }, throwOnError: true }),
              getRoutineQueryKey({ path: { routine_id: routineId } }),
            ),
        }}
        error={update.error}
      />
    </AreaScope>
  );
}
