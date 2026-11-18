import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, Flag, Folder } from "lucide-react";
import { type ComponentPropsWithRef, type ReactNode, useState } from "react";
import { completeTaskMutation, reopenTaskMutation } from "../../client/@tanstack/react-query.gen";
import type { OccurrenceRead, ProjectRead, TaskRead } from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { isPendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { itemMenuProps } from "../item-menu/target";
import { shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { dayDate } from "../pickers/dates";
import { isOverdue } from "../tasks/board";
import { formatTime, useTimeFormat } from "../tasks/format";
import type { RoutineDay } from "../tasks/next7";
import { ProgressRing } from "../tasks/RoutinesPage";
import { SubtaskRow } from "../tasks/TaskCard";
import { type Entry, eventSpan, spanLabel } from "./calendar";
import type { ColorOf } from "./GridEntry";

export type RowContext = {
  today: string;
  colorOf: ColorOf;
  projects: readonly ProjectRead[];
  areaName: (lifeAreaId: number | null) => string | null;
  onRoutine: (routine: RoutineDay, anchor: HTMLElement) => void;
};

/** An agenda row (the approved agenda design) for an entry of the grid. */
export function EntryRow({
  entry,
  context,
  draggable = false,
}: {
  entry: Entry;
  context: RowContext;
  /** Quarter and Year's day popover: the row can be dragged onto a day. */
  draggable?: boolean;
}) {
  const past = entry.end < context.today;
  const grab = draggable ? "cursor-grab" : "";
  switch (entry.kind) {
    case "event":
      return (
        <EventRow
          event={entry.event}
          color={context.colorOf(entry.event.life_area_id)}
          className={grab}
        />
      );
    case "routine": {
      const { routine } = entry;
      return (
        <li
          {...itemMenuProps({ kind: "routine", id: routine.routineId })}
          className="relative mb-1.5 flex items-start gap-2 rounded-(--radius-8) border border-(--border-default) px-3 py-2 hover:bg-(--color-neutral-50)"
        >
          <span className="mt-0.5 grid size-4 shrink-0 place-items-center [&_svg]:size-4!">
            <ProgressRing done={routine.done} total={routine.steps.length} />
          </span>
          <span className="flex min-w-0 flex-col">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={(event) =>
                context.onRoutine(routine, event.currentTarget.closest("li") ?? event.currentTarget)
              }
              className={`min-w-0 truncate text-left text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-(--focus-ring) ${past ? "text-(--text-tertiary)" : "text-(--text-primary)"}`}
            >
              {routine.title}
            </button>
            <span className="type-meta text-(--text-tertiary)">
              Routine · {routine.done}/{routine.steps.length}
            </span>
          </span>
        </li>
      );
    }
    case "project":
      return (
        <Row
          color={context.colorOf(entry.project.life_area_id)}
          icon={<Folder aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />}
          title={
            <PanelLink
              stretched
              target={{ kind: "project", id: entry.project.id }}
              className={`truncate text-sm font-medium ${past ? "text-(--text-tertiary)" : "text-(--text-primary)"}`}
            >
              {entry.project.title}
            </PanelLink>
          }
          meta="Project due"
          className={grab}
        />
      );
    case "task":
      return <TaskRow task={entry.task} context={context} containerProps={{ className: grab }} />;
  }
}

/** An event: the area tint, a calendar badge, the title and when it happens. */
export function EventRow({
  event,
  color,
  className = "",
  when,
  past = event.is_past,
}: {
  event: OccurrenceRead;
  color: string | null;
  className?: string;
  /** Home says when as seen on one day ("Until 3 PM"); the span by default. */
  when?: string;
  /** Home greys an event out once it is over at the current time. */
  past?: boolean;
}) {
  const timeFormat = useTimeFormat();
  return (
    <li
      data-area={areaDataAttribute(color)}
      className={`relative mb-1.5 flex items-start gap-2 rounded-(--radius-8) px-3 py-2 ${
        past ? "bg-(--event-area-bg-past)" : "bg-(--event-area-bg-upcoming)"
      } ${className}`}
    >
      <span
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] text-(--event-icon) ${
          past ? "bg-(--area-border)" : "bg-(--event-area-icon-bg-upcoming)"
        }`}
      >
        <CalendarDays aria-hidden className="size-[11px]" strokeWidth={2.25} />
      </span>
      <span className="flex min-w-0 flex-col">
        <PanelLink
          stretched
          target={{
            kind: "event",
            id: event.event_id,
            day: event.is_repeating ? event.occurrence_date : null,
          }}
          className={`truncate text-sm font-medium ${past ? "text-(--text-tertiary)" : "text-(--text-primary)"} ${
            event.is_cancelled ? "line-through" : ""
          }`}
        >
          {event.title}
        </PanelLink>
        <span
          className={`type-meta ${past ? "text-(--text-tertiary)" : "text-(--text-secondary)"}`}
        >
          {when ?? eventSpan(event, (value) => formatTime(value, timeFormat))}
        </span>
      </span>
    </li>
  );
}

/** A project's bar as a row (Year's "+n" list): folder, name, then its dates. */
export function ProjectSpanRow({
  project,
  start,
  context,
}: {
  project: ProjectRead;
  start: string;
  context: RowContext;
}) {
  const end = project.due_date ?? start;
  return (
    <Row
      color={context.colorOf(project.life_area_id)}
      icon={<Folder aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />}
      title={
        <PanelLink
          stretched
          target={{ kind: "project", id: project.id }}
          className={`truncate text-sm font-medium ${end < context.today ? "text-(--text-tertiary)" : "text-(--text-primary)"}`}
        >
          {project.title}
        </PanelLink>
      }
      meta={spanLabel(start, end)}
    />
  );
}

function Row({
  color,
  icon,
  title,
  meta,
  className = "",
}: {
  color: string | null;
  icon: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  className?: string;
}) {
  return (
    <li
      data-area={areaDataAttribute(color)}
      className={`relative mb-1.5 flex items-start gap-2 rounded-(--radius-8) border border-(--border-default) px-3 py-2 hover:bg-(--color-neutral-50) ${className}`}
    >
      <span className="mt-0.5 grid size-4 shrink-0 place-items-center">{icon}</span>
      <span className="flex min-w-0 flex-col">
        {title}
        <span className="type-meta text-(--text-tertiary)">{meta}</span>
      </span>
    </li>
  );
}

/**
 * A task: checkbox in the area colour, title, then its due date (red when overdue), and its
 * project, area or the Inbox. In the Inbox panel the row can be dragged onto a day.
 */
export function TaskRow({
  task,
  context,
  showArea = false,
  showScheduled = false,
  containerProps,
  actions,
}: {
  task: TaskRead;
  context: RowContext;
  /** The Inbox panel names a task's area when it has no project. */
  showArea?: boolean;
  /** The Inbox panel's Due tab shows the scheduled date instead of the due date. */
  showScheduled?: boolean;
  containerProps?: ComponentPropsWithRef<"li"> & Record<`data-${string}`, string>;
  /** Shown on the right while the row is hovered or holds focus (Home's Tomorrow, Pick date). */
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pending = usePendingDeletes((state) => state.pending);
  const showToast = useChangeToast((state) => state.show);
  const complete = useMutation({
    ...completeTaskMutation(),
    onSuccess: (change) => showToast(`Completed “${task.title}”`, change.batch_id ?? null),
  });
  const reopen = useMutation(reopenTaskMutation());
  const timeFormat = useTimeFormat();
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  const late = isOverdue(task, context.today);
  const project = context.projects.find((item) => item.id === task.project_id);
  const subtasks = task.subtasks.filter(
    (subtask) => subtask.status !== "cancelled" && !isPendingDelete(pending, "subtask", subtask.id),
  );
  const subtasksDone = subtasks.filter((subtask) => subtask.status === "done").length;
  const flagged = task.priority === "high" || task.priority === "medium";

  const date = showScheduled
    ? task.scheduled_date && dayDate(task.scheduled_date)
    : task.due_date &&
      `Due ${shortDate(task.due_date)}${task.due_time ? ` · ${formatTime(task.due_time, timeFormat)}` : ""}`;
  const owner = project ? (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Folder aria-hidden className="size-3 shrink-0" strokeWidth={2} />
      <span className="truncate">{project.title}</span>
    </span>
  ) : task.life_area_id === null ? (
    "Inbox"
  ) : showArea ? (
    context.areaName(task.life_area_id)
  ) : null;
  const toggle = () => {
    if (done) reopen.mutate({ path: { task_id: task.id } });
    else complete.mutate({ path: { task_id: task.id } });
  };

  return (
    <li
      {...containerProps}
      data-area={areaDataAttribute(context.colorOf(task.life_area_id))}
      className={`group/row relative mb-1.5 flex flex-col rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 py-2 hover:bg-(--color-neutral-50) ${containerProps?.className ?? ""}`}
    >
      {actions && (
        <div className="absolute top-1.5 right-1.5 z-20 hidden items-center gap-0.5 bg-(--color-neutral-50) pl-2 shadow-[-10px_0_8px_-2px_var(--color-neutral-50)] group-focus-within/row:flex group-hover/row:flex">
          {actions}
        </div>
      )}
      <div className="flex items-start gap-2">
        <label className="relative z-10 -m-1 mt-px grid size-6 shrink-0 cursor-pointer place-items-center">
          <input
            type="checkbox"
            checked={done}
            disabled={cancelled || complete.isPending || reopen.isPending}
            aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
            onChange={toggle}
            className={`size-4 cursor-pointer appearance-none rounded-[4px] border-2 outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:cursor-default ${
              done
                ? "border-(--checkbox-area-done) bg-(--checkbox-area-done)"
                : cancelled
                  ? "border-(--color-neutral-300)"
                  : "border-(--checkbox-area-todo)"
            }`}
          />
          {done && (
            <Check
              aria-hidden
              className="pointer-events-none absolute size-2.5 text-white"
              strokeWidth={3.5}
            />
          )}
        </label>
        <span className="flex min-w-0 flex-1 flex-col">
          <PanelLink
            stretched
            target={{ kind: "task", id: task.id }}
            className={`truncate text-sm ${
              done || cancelled
                ? "text-(--text-disabled) line-through"
                : "font-medium text-(--text-primary)"
            }`}
          >
            {task.title}
          </PanelLink>
          {(date || owner || flagged || subtasks.length > 0) && (
            <span className="flex min-w-0 items-center gap-1 type-meta text-(--text-tertiary)">
              {flagged && !done && !cancelled && (
                <Flag
                  role="img"
                  aria-label={`${task.priority === "high" ? "High" : "Medium"} priority`}
                  className={`size-3 shrink-0 ${task.priority === "high" ? "text-(--priority-high)" : "text-(--priority-medium)"}`}
                  strokeWidth={2}
                />
              )}
              {date && (
                <span
                  className={`shrink-0 whitespace-nowrap ${late && !showScheduled ? "text-(--text-danger)" : ""}`}
                >
                  {late && !showScheduled && <span className="sr-only">Overdue, </span>}
                  {date}
                </span>
              )}
              {date && owner && <span aria-hidden>·</span>}
              {owner && <span className="flex min-w-0">{owner}</span>}
              {subtasks.length > 0 && (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={`Subtasks, ${subtasksDone} of ${subtasks.length} done`}
                  onClick={() => setOpen(!open)}
                  className="relative z-10 ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-[5px] bg-(--color-neutral-100) py-px pr-1 pl-1.5 text-[11px] font-medium text-(--text-secondary) outline-none hit-24 hover:bg-(--color-neutral-200) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
                >
                  {subtasksDone}/{subtasks.length}
                  <ChevronDown
                    aria-hidden
                    className={`size-[11px] transition-transform ${open ? "rotate-180" : ""}`}
                    strokeWidth={2}
                  />
                </button>
              )}
            </span>
          )}
        </span>
      </div>
      {open && subtasks.length > 0 && (
        <ul aria-label="Subtasks" className="relative z-10 flex flex-col gap-0.5 pt-1.5 pl-6">
          {subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} readOnly={done || cancelled} />
          ))}
        </ul>
      )}
      {(complete.isError || reopen.isError) && (
        <p role="alert" className="pl-6 type-meta text-(--text-danger)">
          Couldn't save. Try again.
        </p>
      )}
    </li>
  );
}
