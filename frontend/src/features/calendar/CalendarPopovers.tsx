import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Folder, MapPin, PanelRight, Plus, SquareCheck, X } from "lucide-react";
import {
  clearRoutineStepDayMutation,
  completeTaskMutation,
  reopenTaskMutation,
  setRoutineStepDayMutation,
  updateSubtaskMutation,
} from "../../client/@tanstack/react-query.gen";
import type { RoutineStepDay } from "../../client/types.gen";
import { EntityCheckbox } from "../../components/EntityCheckbox";
import { IconButton } from "../../components/IconButton";
import { Scroll } from "../../components/Scroll";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { areaDataAttribute } from "../life-areas/palette";
import { dayDate } from "../pickers/dates";
import type { RoutineDay } from "../tasks/next7";
import { ProgressRing } from "../tasks/RoutinesPage";
import { EntryRow, ProjectSpanRow, type RowContext } from "./AgendaRow";
import type { Entry } from "./calendar";
import type { ColorOf } from "./GridEntry";
import type { LinearBar } from "./linear";
import { canDragEntry } from "./linearDrag";

/** A day's routines with their steps; checking a step logs it for that day. */
export function RoutinePopover({
  routines,
  today,
  colorOf,
  onClose,
}: {
  routines: RoutineDay[];
  today: string;
  colorOf: ColorOf;
  onClose?: () => void;
}) {
  const openPanel = useDetailPanel((state) => state.open);
  const openRoutinePanel = (routineId: number) => {
    onClose?.();
    openPanel({ kind: "routine", id: routineId });
  };
  return (
    <>
      {routines.map((routine, index) => (
        <div key={routine.routineId} className="flex flex-col">
          {index > 0 && <div className="-mx-1.5 my-1.5 h-px bg-(--border-default)" />}
          <div className="flex items-center gap-2 px-2 pt-1.5 pb-1 [&_svg]:size-4!">
            <ProgressRing
              done={routine.done}
              total={routine.steps.length}
              segments={routine.steps.map((s) => ({
                done: s.status === "done",
                color: colorOf(s.life_area_id),
              }))}
            />
            <button
              type="button"
              onClick={() => openRoutinePanel(routine.routineId)}
              className="min-w-0 cursor-pointer truncate text-left type-body font-semibold text-(--text-primary) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
            >
              {routine.title}
            </button>
            <span className="ml-auto shrink-0 text-xs text-(--text-tertiary) tabular-nums">
              {dayDate(routine.day)} · {routine.done}/{routine.steps.length}
            </span>
            <IconButton
              label={`Open ${routine.title} in side panel`}
              onPress={() => openRoutinePanel(routine.routineId)}
            >
              <PanelRight />
            </IconButton>
          </div>
          <div className="-mx-1.5 my-1 h-px bg-(--border-default)" />
          <ul aria-label={`${routine.title} steps`} className="flex flex-col">
            {routine.steps.map((step) => (
              <StepRow
                key={step.step_id}
                step={step}
                color={colorOf(step.life_area_id)}
                future={step.day > today}
              />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** A step: 30 px row, a round checkbox in its area colour. Days to come can't be checked. */
function StepRow({
  step,
  color,
  future,
}: {
  step: RoutineStepDay;
  color: string | null;
  future: boolean;
}) {
  const check = useMutation(setRoutineStepDayMutation());
  const clear = useMutation(clearRoutineStepDayMutation());
  const done = step.status === "done";
  const muted = step.status === "skipped" || step.status === "missed";
  const path = { step_id: step.step_id, day: step.day };
  return (
    <li
      data-area={areaDataAttribute(color)}
      className={`flex h-[30px] items-center gap-2 rounded-(--radius-6) px-2 type-body ${
        done
          ? "text-(--text-tertiary) line-through"
          : muted
            ? "text-(--text-tertiary)"
            : "text-(--text-primary)"
      }`}
    >
      <EntityCheckbox
        shape="round"
        checked={done}
        disabled={future || check.isPending || clear.isPending}
        cancelled={muted || future}
        label={done ? `Mark ${step.title} not done` : `Mark ${step.title} done`}
        onChange={() =>
          done ? clear.mutate({ path }) : check.mutate({ path, body: { status: "done" } })
        }
        className="-m-1"
      />
      <span className="min-w-0 truncate">{step.title}</span>
      {(check.isError || clear.isError) && (
        <span role="alert" className="ml-auto text-xs text-(--text-danger) no-underline">
          Couldn't save
        </span>
      )}
    </li>
  );
}

/** "+3 more": the whole day, as agenda rows, with + (New task on that day) and ×. */
export function DayPopover({
  day,
  entries,
  context,
  onAdd,
  onClose,
  onDragStart,
}: {
  day: string;
  entries: Entry[];
  context: RowContext;
  onAdd: () => void;
  onClose: () => void;
  /** Quarter and Year: a press on a row that can move, which becomes a drag onto a day. */
  onDragStart?: (entry: Entry, event: React.PointerEvent) => void;
}) {
  return (
    <>
      <div className="-mx-1.5 -mt-1.5 mb-1.5 flex items-center gap-1.5 border-b border-(--border-default) py-2 pr-2 pl-3.5">
        <span className="type-body font-semibold text-(--text-primary)">{dayDate(day)}</span>
        <span className="ml-auto flex gap-0.5">
          <IconButton label={`New task on ${dayDate(day)}`} onPress={onAdd}>
            <Plus />
          </IconButton>
          <IconButton label="Close" onPress={onClose}>
            <X />
          </IconButton>
        </span>
      </div>
      <Scroll
        as="ul"
        direction="both"
        className="flex max-h-[420px] flex-col"
        onPointerDown={
          onDragStart &&
          ((event: React.PointerEvent<HTMLUListElement>) => {
            // The rows are the list's items, in the entries' order.
            const row = (event.target as HTMLElement).closest("li");
            const index = row ? [...event.currentTarget.children].indexOf(row) : -1;
            const entry = entries[index];
            if (entry && canDragEntry(entry)) onDragStart(entry, event);
          })
        }
      >
        {entries.map((entry) => (
          <EntryRow
            key={entry.key}
            entry={entry}
            context={context}
            draggable={!!onDragStart && canDragEntry(entry)}
          />
        ))}
      </Scroll>
      {entries.length === 0 && (
        <p className="px-2 pt-1 pb-2 type-meta text-(--text-tertiary)">Nothing on this day.</p>
      )}
    </>
  );
}

/** Clicking a day: add an Event or a Task on that day. */
export function AddMenu({
  day,
  onEvent,
  onTask,
}: {
  day: string;
  onEvent: () => void;
  onTask: () => void;
}) {
  const row =
    "flex h-[30px] items-center gap-2 rounded-(--radius-6) px-2 text-left type-body text-(--text-primary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring) [&_svg]:size-[15px] [&_svg]:text-(--text-tertiary)";
  return (
    <>
      <span className="px-2 pt-2 pb-1 type-tag leading-[14px] font-semibold tracking-[0.04em] text-(--text-tertiary) uppercase">
        {dayDate(day)}
      </span>
      <button type="button" onClick={onEvent} className={row}>
        <CalendarDays aria-hidden strokeWidth={2} />
        Event
      </button>
      <button type="button" onClick={onTask} className={row}>
        <SquareCheck aria-hidden strokeWidth={2} />
        Task
      </button>
    </>
  );
}

/** Year's "+n" under a month name: the bars that didn't fit its three lanes. */
export function HiddenBarsPopover({
  month,
  bars,
  context,
  onClose,
}: {
  /** "November" */
  month: string;
  bars: LinearBar[];
  context: RowContext;
  onClose: () => void;
}) {
  return (
    <>
      <div className="-mx-1.5 -mt-1.5 mb-1.5 flex items-center gap-1.5 border-b border-(--border-default) py-2 pr-2 pl-3.5">
        <span className="type-body font-semibold text-(--text-primary)">{month}</span>
        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-(--counter-bg) px-1.5 type-tag font-medium text-(--text-secondary)">
          {bars.length}
        </span>
        <span className="ml-auto">
          <IconButton label="Close" onPress={onClose}>
            <X />
          </IconButton>
        </span>
      </div>
      <Scroll as="ul" direction="both" className="flex max-h-[420px] flex-col">
        {bars.map((bar) =>
          bar.kind === "event" ? (
            <EntryRow key={bar.key} entry={bar.entry} context={context} />
          ) : (
            <ProjectSpanRow
              key={bar.key}
              project={bar.project}
              start={bar.start}
              context={context}
            />
          ),
        )}
      </Scroll>
    </>
  );
}

/** Floating detail card when clicking an item on the calendar, with clickable subtasks/steps and a discrete side-panel button. */
export function EntryPreviewPopover({
  entry,
  context,
  onOpenPanel,
  onClose,
}: {
  entry: Entry;
  context: RowContext;
  onOpenPanel: () => void;
  onClose: () => void;
}) {
  const completeTask = useMutation(completeTaskMutation());
  const reopenTask = useMutation(reopenTaskMutation());
  const updateSubtask = useMutation(updateSubtaskMutation());

  const title =
    entry.kind === "event"
      ? entry.event.title
      : entry.kind === "task"
        ? entry.task.title
        : entry.kind === "project"
          ? entry.project.title
          : entry.routine.title;
  const areaId =
    entry.kind === "event"
      ? entry.event.life_area_id
      : entry.kind === "task"
        ? entry.task.life_area_id
        : entry.kind === "project"
          ? entry.project.life_area_id
          : null;
  const color = context.colorOf(areaId);
  const areaLabel = context.areaName(areaId);

  return (
    <div data-area={areaDataAttribute(color)} className="flex flex-col gap-2 p-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {entry.kind === "task" ? (
            <EntityCheckbox
              size="sm"
              checked={entry.task.status === "done"}
              disabled={
                entry.task.status === "cancelled" || completeTask.isPending || reopenTask.isPending
              }
              label={
                entry.task.status === "done"
                  ? `Mark ${entry.task.title} not done`
                  : `Mark ${entry.task.title} done`
              }
              onChange={() =>
                entry.task.status === "done"
                  ? reopenTask.mutate({ path: { task_id: entry.task.id } })
                  : completeTask.mutate({ path: { task_id: entry.task.id } })
              }
              className="-m-1"
            />
          ) : (
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] bg-(--area-solid)" />
          )}
          <span className="truncate type-body font-semibold text-(--text-primary)">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="Open side panel" onPress={onOpenPanel}>
            <PanelRight />
          </IconButton>
          <IconButton label="Close" onPress={onClose}>
            <X />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-col gap-1 pl-4.5 type-meta text-(--text-secondary)">
        {areaLabel && (
          <span className="flex items-center gap-1.5">
            <Folder aria-hidden className="size-3.5 text-(--text-tertiary)" />
            {areaLabel}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <CalendarDays aria-hidden className="size-3.5 text-(--text-tertiary)" />
          {entry.start === entry.end
            ? dayDate(entry.start)
            : `${dayDate(entry.start)} – ${dayDate(entry.end)}`}
        </span>
        {entry.kind === "event" && entry.event.location && (
          <span className="flex items-center gap-1.5">
            <MapPin aria-hidden className="size-3.5 text-(--text-tertiary)" />
            {entry.event.location}
          </span>
        )}
      </div>
      {entry.kind === "task" && entry.task.subtasks.length > 0 && (
        <ul
          aria-label="Subtasks"
          className="flex flex-col gap-0.5 border-t border-(--border-default) pt-1.5"
        >
          {entry.task.subtasks
            .filter((s) => s.status !== "cancelled")
            .map((sub) => {
              const done = sub.status === "done";
              return (
                <li
                  key={sub.id}
                  className="flex items-center gap-2 rounded-(--radius-6) px-1 py-0.5"
                >
                  <EntityCheckbox
                    size="sm"
                    checked={done}
                    disabled={updateSubtask.isPending}
                    label={done ? `Mark ${sub.title} not done` : `Mark ${sub.title} done`}
                    onChange={() =>
                      updateSubtask.mutate({
                        path: { subtask_id: sub.id },
                        body: { status: done ? "todo" : "done" },
                      })
                    }
                    className="-m-1"
                  />
                  <span
                    className={`min-w-0 truncate type-body ${
                      done ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"
                    }`}
                  >
                    {sub.title}
                  </span>
                </li>
              );
            })}
        </ul>
      )}
      {entry.kind === "routine" && entry.routine.steps.length > 0 && (
        <ul
          aria-label="Routine steps"
          className="flex flex-col gap-0.5 border-t border-(--border-default) pt-1.5"
        >
          {entry.routine.steps.map((step) => (
            <StepRow
              key={step.step_id}
              step={step}
              color={context.colorOf(step.life_area_id)}
              future={step.day > context.today}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
