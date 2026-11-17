import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Check, Plus, SquareCheck, X } from "lucide-react";
import {
  clearRoutineStepDayMutation,
  setRoutineStepDayMutation,
} from "../../client/@tanstack/react-query.gen";
import type { RoutineStepDay } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { areaDataAttribute } from "../life-areas/palette";
import { dayDate } from "../pickers/dates";
import type { RoutineDay } from "../tasks/next7";
import { ProgressRing } from "../tasks/RoutinesPage";
import { EntryRow, type RowContext } from "./AgendaRow";
import type { Entry } from "./calendar";
import type { ColorOf } from "./GridEntry";

/** A day's routines with their steps; checking a step logs it for that day. */
export function RoutinePopover({
  routines,
  today,
  colorOf,
}: {
  routines: RoutineDay[];
  today: string;
  colorOf: ColorOf;
}) {
  return (
    <>
      {routines.map((routine, index) => (
        <div key={routine.routineId} className="flex flex-col">
          {index > 0 && <div className="-mx-1.5 my-1.5 h-px bg-(--border-default)" />}
          <div className="flex items-center gap-2 px-2 pt-1.5 pb-1 [&_svg]:size-4!">
            <ProgressRing done={routine.done} total={routine.steps.length} />
            <span className="min-w-0 truncate text-[13px] font-semibold text-(--text-primary)">
              {routine.title}
            </span>
            <span className="ml-auto text-xs text-(--text-tertiary) tabular-nums">
              {dayDate(routine.day)} · {routine.done}/{routine.steps.length}
            </span>
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
      className={`flex h-[30px] items-center gap-2 rounded-(--radius-6) px-2 text-[13px] ${
        done
          ? "text-(--text-tertiary) line-through"
          : muted
            ? "text-(--text-tertiary)"
            : "text-(--text-primary)"
      }`}
    >
      <label className="relative -m-1 grid size-6 shrink-0 cursor-pointer place-items-center has-disabled:cursor-default">
        <input
          type="checkbox"
          checked={done}
          disabled={future || check.isPending || clear.isPending}
          aria-label={done ? `Mark ${step.title} not done` : `Mark ${step.title} done`}
          onChange={() =>
            done ? clear.mutate({ path }) : check.mutate({ path, body: { status: "done" } })
          }
          className={`size-[15px] cursor-pointer appearance-none rounded-full border-[1.5px] outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:cursor-default ${
            done
              ? "border-(--area-solid) bg-(--area-solid)"
              : muted || future
                ? "border-(--color-neutral-300)"
                : "border-(--area-solid)"
          }`}
        />
        {done && (
          <Check
            aria-hidden
            className="pointer-events-none absolute size-2.5 text-white"
            strokeWidth={3}
          />
        )}
      </label>
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
}: {
  day: string;
  entries: Entry[];
  context: RowContext;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="-mx-1.5 -mt-1.5 mb-1.5 flex items-center gap-1.5 border-b border-(--border-default) py-2 pr-2 pl-3.5">
        <span className="text-[13px] font-semibold text-(--text-primary)">{dayDate(day)}</span>
        <span className="ml-auto flex gap-0.5">
          <IconButton label={`New task on ${dayDate(day)}`} onPress={onAdd}>
            <Plus />
          </IconButton>
          <IconButton label="Close" onPress={onClose}>
            <X />
          </IconButton>
        </span>
      </div>
      <ul className="flex max-h-[420px] flex-col overflow-auto">
        {entries.map((entry) => (
          <EntryRow key={entry.key} entry={entry} context={context} />
        ))}
      </ul>
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
    "flex h-[30px] items-center gap-2 rounded-(--radius-6) px-2 text-left text-[13px] text-(--text-primary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring) [&_svg]:size-[15px] [&_svg]:text-(--text-tertiary)";
  return (
    <>
      <span className="px-2 pt-2 pb-1 text-[11px] leading-[14px] font-semibold tracking-[0.04em] text-(--text-tertiary) uppercase">
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
