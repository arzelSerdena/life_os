import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Folder, Repeat, X } from "lucide-react";
import { useState } from "react";
import { completeTaskMutation, reopenTaskMutation } from "../../client/@tanstack/react-query.gen";
import type { OccurrenceRead, TaskRead } from "../../client/types.gen";
import { EntityCheckbox } from "../../components/EntityCheckbox";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { isPendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { itemMenuProps } from "../item-menu/target";
import { shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { useRoutineDragGuard } from "../routines/useRoutineDragGuard";
import { formatTime, useTimeFormat } from "../tasks/format";
import type { RoutineDay } from "../tasks/next7";
import { ProgressRing } from "../tasks/RoutinesPage";
import { SubtaskRow } from "../tasks/TaskCard";
import { type Entry, eventSpan } from "./calendar";

export type ColorOf = (lifeAreaId: number | null) => string | null;

/** Where an entry sits in its week row, from FullCalendar: cut where a bar continues. */
export type Segment = { isStart: boolean; isEnd: boolean; firstOfRange: boolean };

/**
 * One entry on the day grid: a 24 px row (Approved: Calendar). Text never takes area
 * colours; the area colour stays on the checkbox, the event edge and tint, and icons.
 */
export function GridEntry({
  entry,
  today,
  timed = false,
  colorOf,
  segment,
  onRoutine,
  onInspect,
}: {
  entry: Entry;
  today: string;
  timed?: boolean;
  colorOf: ColorOf;
  segment: Segment;
  onRoutine: (routine: RoutineDay, anchor: HTMLElement) => void;
  onInspect?: (entry: Entry, anchor: HTMLElement) => void;
}) {
  const inspect = onInspect ? (anchor: HTMLElement) => onInspect(entry, anchor) : undefined;
  switch (entry.kind) {
    case "event":
      return (
        <EventEntry
          event={entry.event}
          timed={timed}
          color={colorOf(entry.event.life_area_id)}
          segment={segment}
          onInspect={inspect}
        />
      );
    case "routine":
      return (
        <RoutineEntry
          routine={entry.routine}
          past={entry.start < today}
          timed={timed}
          colorOf={colorOf}
          onOpen={onRoutine}
        />
      );
    case "project":
      return (
        <div
          data-area={areaDataAttribute(colorOf(entry.project.life_area_id))}
          className="relative flex h-6 min-w-0 items-center gap-1.5 rounded-[5px] border border-dashed border-(--area-border) bg-(--bg-surface) px-1.5 text-xs"
        >
          <Folder
            aria-hidden
            className="size-[13px] shrink-0 text-(--area-solid)"
            strokeWidth={2}
          />
          <PanelLink
            stretched
            target={{ kind: "project", id: entry.project.id }}
            onInspect={inspect}
            className="min-w-0 flex-1 truncate font-medium text-(--text-primary)"
          >
            {entry.project.title}
          </PanelLink>
          <span className="shrink-0 type-tag text-(--text-tertiary)">Due</span>
        </div>
      );
    case "task":
      return (
        <TaskEntry
          task={entry.task}
          timed={timed}
          color={colorOf(entry.task.life_area_id)}
          onInspect={inspect}
        />
      );
  }
}

/** A timed event (time, title) or a bar (title, then when). Past events take the lighter tint. */
function EventEntry({
  event,
  timed,
  color,
  segment,
  onInspect,
}: {
  event: OccurrenceRead;
  timed: boolean;
  color: string | null;
  segment: Segment;
  onInspect?: (anchor: HTMLElement) => void;
}) {
  const timeFormat = useTimeFormat();
  const time = (value: string) => formatTime(value, timeFormat);
  const bar = event.start_date !== event.end_date || event.start_time === null;
  const past = event.is_past;
  // A bar cut at the left (it started in an earlier row) keeps no edge; the first row of the
  // range says since when.
  const edge = !bar || segment.isStart;
  const meta = bar
    ? segment.isStart
      ? event.start_time
        ? eventSpan(event, time)
        : null
      : segment.firstOfRange
        ? `since ${shortDate(event.start_date)}`
        : null
    : null;
  return (
    <div
      data-area={areaDataAttribute(color)}
      className={`relative flex min-w-0 gap-1.5 pr-1.5 text-xs ${
        timed ? "h-full items-start py-1" : "h-6 items-center"
      } ${bar ? "font-semibold" : ""} ${
        past ? "bg-(--event-area-bg-past)" : "bg-(--event-area-bg-upcoming)"
      } ${
        edge
          ? `pl-[9px] ${past ? "shadow-[inset_3px_0_0_var(--area-border)]" : "shadow-[inset_3px_0_0_var(--area-solid)]"}`
          : "pl-2"
      } ${segment.isStart ? "rounded-l-[5px]" : ""} ${segment.isEnd ? "rounded-r-[5px]" : ""} ${
        event.is_cancelled ? "line-through" : ""
      }`}
    >
      {!bar && event.start_time && (
        <span
          className={`shrink-0 type-tag font-normal ${past ? "text-(--text-tertiary)" : "text-(--text-secondary)"}`}
        >
          {time(event.start_time)}
        </span>
      )}
      <PanelLink
        stretched
        target={{
          kind: "event",
          id: event.event_id,
          day: event.is_repeating ? event.occurrence_date : null,
        }}
        onInspect={onInspect}
        className={`min-w-0 truncate ${bar ? "" : "flex-1 font-medium"} ${past ? "text-(--text-tertiary)" : "text-(--text-primary)"}`}
      >
        {event.title}
      </PanelLink>
      {meta && (
        <span
          className={`min-w-0 shrink truncate type-tag font-normal ${past ? "text-(--text-tertiary)" : "text-(--text-secondary)"}`}
        >
          {meta}
        </span>
      )}
      {!bar && event.is_repeating && (
        <Repeat
          role="img"
          aria-label="Repeats"
          className={`size-[11px] shrink-0 ${past ? "text-(--text-tertiary)" : "text-(--text-secondary)"}`}
          strokeWidth={2}
        />
      )}
    </div>
  );
}

/** A routine on a day: progress ring, name, done / total. Single-click opens steps, double-click opens side panel. */
function RoutineEntry({
  routine,
  past,
  timed,
  colorOf,
  onOpen,
}: {
  routine: RoutineDay;
  past: boolean;
  timed: boolean;
  colorOf: ColorOf;
  onOpen: (routine: RoutineDay, anchor: HTMLElement) => void;
}) {
  const openPanel = useDetailPanel((state) => state.open);
  const timeFormat = useTimeFormat();
  const { shakeClass, onPointerDown } = useRoutineDragGuard();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      {...itemMenuProps({ kind: "routine", id: routine.routineId })}
      aria-label={`${routine.title}, ${routine.done} of ${routine.steps.length} steps done`}
      onPointerDown={onPointerDown}
      onClick={(event) => onOpen(routine, event.currentTarget)}
      onDoubleClick={() => openPanel({ kind: "routine", id: routine.routineId })}
      className={`flex w-full min-w-0 gap-1.5 rounded-[5px] border border-(--border-default) bg-(--bg-surface) px-1.5 text-left text-xs outline-none hover:bg-(--color-neutral-50) focus-visible:ring-2 focus-visible:ring-(--focus-ring) [&_svg]:size-3.5! ${
        timed ? "h-full items-start py-1" : "h-6 items-center"
      } ${shakeClass}`}
    >
      <ProgressRing
        done={routine.done}
        total={routine.steps.length}
        segments={routine.steps.map((s) => ({
          done: s.status === "done",
          color: colorOf(s.life_area_id),
        }))}
      />
      {routine.startTime && (
        <span
          className={`shrink-0 type-tag font-normal ${past ? "text-(--text-tertiary)" : "text-(--text-secondary)"}`}
        >
          {formatTime(routine.startTime, timeFormat)}
        </span>
      )}
      <span
        className={`min-w-0 flex-1 truncate font-medium ${past ? "text-(--text-tertiary)" : "text-(--text-primary)"}`}
      >
        {routine.title}
      </span>
      <span className="shrink-0 type-tag text-(--text-tertiary) tabular-nums">
        {routine.done}/{routine.steps.length}
      </span>
    </button>
  );
}

/** A task: checkbox in the area colour, title, and the subtasks toggle (done / total). */
function TaskEntry({
  task,
  timed,
  color,
  onInspect,
}: {
  task: TaskRead;
  timed: boolean;
  color: string | null;
  onInspect?: (anchor: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);
  const pending = usePendingDeletes((state) => state.pending);
  const showToast = useChangeToast((state) => state.show);
  const complete = useMutation({
    ...completeTaskMutation(),
    onSuccess: (change) => showToast(`Completed “${task.title}”`, change.batch_id ?? null),
  });
  const reopen = useMutation(reopenTaskMutation());
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  const subtasks = task.subtasks.filter(
    (subtask) => subtask.status !== "cancelled" && !isPendingDelete(pending, "subtask", subtask.id),
  );
  const subtasksDone = subtasks.filter((subtask) => subtask.status === "done").length;
  const toggle = () => {
    if (done) reopen.mutate({ path: { task_id: task.id } });
    else complete.mutate({ path: { task_id: task.id } });
  };

  return (
    <div
      data-area={areaDataAttribute(color)}
      className={`flex min-w-0 flex-col rounded-[6px] border border-(--border-default) bg-(--bg-surface) ${timed ? "h-full" : ""} ${open ? "pb-1" : ""}`}
    >
      <div className="relative -m-px flex h-6 min-w-0 items-center gap-1.5 rounded-[5px] px-1.5 text-xs hover:bg-[rgb(17_24_39/0.05)]">
        <EntityCheckbox
          size="xs"
          checked={done}
          disabled={cancelled || complete.isPending || reopen.isPending}
          cancelled={cancelled}
          label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
          onChange={toggle}
          overlay={
            cancelled ? (
              <X
                aria-hidden
                className="pointer-events-none absolute size-[9px] text-(--color-neutral-500)"
                strokeWidth={3}
              />
            ) : undefined
          }
          className="z-10 -m-1.5"
        />
        <PanelLink
          stretched
          target={{ kind: "task", id: task.id }}
          onInspect={onInspect}
          className={`min-w-0 flex-1 truncate ${
            done || cancelled
              ? "text-(--text-disabled) line-through"
              : "font-medium text-(--text-primary)"
          }`}
        >
          {task.title}
        </PanelLink>
        {subtasks.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`Subtasks, ${subtasksDone} of ${subtasks.length} done`}
            onClick={() => setOpen(!open)}
            className="relative z-10 inline-flex h-4 shrink-0 items-center gap-px rounded-[4px] bg-(--counter-bg) pr-[3px] pl-[5px] type-tag font-medium text-(--text-secondary) outline-none hit-24 hover:bg-(--bg-pressed) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          >
            {subtasksDone}/{subtasks.length}
            <ChevronDown
              aria-hidden
              className={`size-2.5 transition-transform ${open ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
        )}
      </div>
      {open && subtasks.length > 0 && (
        <ul aria-label="Subtasks" className="flex flex-col pr-1.5 pl-[25px]">
          {subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} readOnly={done || cancelled} />
          ))}
        </ul>
      )}
      {(complete.isError || reopen.isError) && (
        <p role="alert" className="px-1.5 type-tag text-(--text-danger)">
          Couldn't save. Try again.
        </p>
      )}
    </div>
  );
}
