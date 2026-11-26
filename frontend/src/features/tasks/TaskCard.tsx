import { useMutation } from "@tanstack/react-query";
import { AlignLeft, CalendarClock, ChevronDown, Flag, Folder, Redo, Repeat } from "lucide-react";
import { type ComponentPropsWithRef, type ReactNode, useState } from "react";
import {
  completeTaskMutation,
  reopenTaskMutation,
  updateSubtaskMutation,
} from "../../client/@tanstack/react-query.gen";
import type { ProjectRead, SubtaskRead, TaskRead } from "../../client/types.gen";
import { EntityCheckbox } from "../../components/EntityCheckbox";
import { useChangeToast } from "../../stores/changeToastStore";
import { isPendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { isOverdue } from "./board";
import { formatTime, useTimeFormat } from "./format";

type TaskCardProps = {
  task: TaskRead;
  today: string;
  /** The area's palette key, for the checkbox and the project folder. */
  areaColor: string | null;
  project?: ProjectRead;
  /** Flags are hidden where the column or subgroup already shows priority. */
  showFlag: boolean;
  /** The project name is hidden inside its own project subgroup. */
  showProject: boolean;
  /** Extra props for the card itself, such as a drag handle's (the Inbox). */
  containerProps?: ComponentPropsWithRef<"li">;
  /** Shown over the card's top right on hover and focus, such as the Inbox's actions. */
  actions?: ReactNode;
};

/**
 * A Kanban task card: checkbox in the area colour, title (two lines at most) and one
 * metadata line that wraps. Clicking the card opens the task in the detail panel.
 */
export function TaskCard({
  task,
  today,
  areaColor,
  project,
  showFlag,
  showProject,
  containerProps,
  actions,
}: TaskCardProps) {
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
  const subtasks = task.subtasks.filter(
    (subtask) => subtask.status !== "cancelled" && !isPendingDelete(pending, "subtask", subtask.id),
  );
  const subtasksDone = subtasks.filter((subtask) => subtask.status === "done").length;
  const late = isOverdue(task, today);
  const flagged = showFlag && (task.priority === "high" || task.priority === "medium");

  const dateText = done
    ? `Done ${shortDate((task.completed_at ?? "").slice(0, 10))}`
    : cancelled
      ? `Cancelled ${shortDate((task.cancelled_at ?? "").slice(0, 10))}`
      : task.due_date
        ? [shortDate(task.due_date), task.due_time && formatTime(task.due_time, timeFormat)]
            .filter(Boolean)
            .join(" · ")
        : null;

  const toggle = () => {
    if (done) reopen.mutate({ path: { task_id: task.id } });
    else complete.mutate({ path: { task_id: task.id } });
  };
  const failed = complete.isError || reopen.isError;

  const hasMeta =
    flagged ||
    task.template_id !== null ||
    !!task.notes?.trim() ||
    task.rollover_count > 0 ||
    dateText !== null ||
    (showProject && project) ||
    subtasks.length > 0;

  return (
    <li
      {...containerProps}
      data-area={areaDataAttribute(areaColor)}
      className={`group/card relative flex flex-col gap-0.5 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 py-2 hover:border-(--border-strong) ${containerProps?.className ?? ""}`}
    >
      {actions}
      <div className="flex items-start gap-2">
        <EntityCheckbox
          checked={done}
          disabled={cancelled || complete.isPending || reopen.isPending}
          cancelled={cancelled}
          label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
          onChange={toggle}
          className="z-10 -mx-1 -mt-0.5 -mb-1"
        />
        <PanelLink
          stretched
          target={{ kind: "task", id: task.id }}
          className={`line-clamp-2 flex-1 type-card-title ${
            done || cancelled ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"
          }`}
        >
          {task.title}
        </PanelLink>
      </div>

      {hasMeta && (
        <div className="mt-1 flex min-w-0 flex-nowrap items-center gap-x-2 overflow-hidden border-t border-(--border-default)/40 pt-1 pl-6 type-meta text-(--text-tertiary) [&_svg]:size-3 [&_svg]:shrink-0">
          {flagged && (
            <Flag
              role="img"
              aria-label={`${task.priority === "high" ? "High" : "Medium"} priority`}
              className={
                task.priority === "high" ? "text-(--priority-high)" : "text-(--priority-medium)"
              }
              strokeWidth={2}
            />
          )}
          {task.template_id !== null && <Repeat role="img" aria-label="Repeats" strokeWidth={2} />}
          {!!task.notes?.trim() && <AlignLeft role="img" aria-label="Has notes" strokeWidth={2} />}
          {task.rollover_count > 0 && (
            <span
              className="inline-flex items-center gap-0.5 type-tag"
              title={`Rolled over ${task.rollover_count} times`}
            >
              <Redo aria-hidden strokeWidth={2} />
              <span className="sr-only">Rolled over</span>
              {task.rollover_count}
            </span>
          )}
          {dateText && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${late ? "text-(--text-danger)" : ""}`}
            >
              {task.due_date && !done && !cancelled && (
                <CalendarClock aria-hidden className="size-[11px]!" strokeWidth={2} />
              )}
              {late && <span className="sr-only">Overdue, due</span>}
              {dateText}
            </span>
          )}
          {showProject && project && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1">
              <Folder aria-hidden className="text-(--card-meta-project-icon)" strokeWidth={2} />
              <span className="truncate">{project.title}</span>
            </span>
          )}
          {subtasks.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              aria-label={`Subtasks, ${subtasksDone} of ${subtasks.length} done`}
              onClick={() => setOpen(!open)}
              className="relative z-10 ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-[5px] bg-(--counter-bg) py-px pr-1 pl-1.5 type-counter text-(--text-secondary) app-focus-ring hit-24 hover:bg-(--surface-tertiary)"
            >
              {subtasksDone}/{subtasks.length}
              <ChevronDown
                aria-hidden
                className={`size-[11px]! transition-transform ${open ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
            </button>
          )}
        </div>
      )}

      {open && subtasks.length > 0 && (
        <ul aria-label="Subtasks" className="relative z-10 flex flex-col gap-0.5 pt-1 pb-0.5 pl-6">
          {subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} readOnly={done || cancelled} />
          ))}
        </ul>
      )}

      {failed && (
        <p role="alert" className="pl-6 type-meta text-(--text-danger)">
          Couldn't save. Try again.
        </p>
      )}
    </li>
  );
}

export function SubtaskRow({ subtask, readOnly }: { subtask: SubtaskRead; readOnly: boolean }) {
  const update = useMutation(updateSubtaskMutation());
  const done = subtask.status === "done";
  return (
    <li
      className={`flex items-center gap-[7px] text-xs leading-[18px] ${done ? "text-(--text-tertiary) line-through" : "text-(--text-secondary)"}`}
    >
      <EntityCheckbox
        checked={done}
        size="xs"
        tone="neutral"
        disabled={readOnly || update.isPending}
        label={done ? `Mark ${subtask.title} not done` : `Mark ${subtask.title} done`}
        onChange={() =>
          update.mutate({
            path: { subtask_id: subtask.id },
            body: { status: done ? "todo" : "done" },
          })
        }
        className="-m-1.5"
      />
      <span className="min-w-0 flex-1 truncate">{subtask.title}</span>
      {update.isError && (
        <span role="alert" className="shrink-0 type-meta text-(--text-danger)">
          Couldn't save
        </span>
      )}
    </li>
  );
}
