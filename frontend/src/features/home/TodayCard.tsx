import { Button } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  ChartLine,
  ChevronDown,
  Folder,
  Inbox,
  Plus,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import { updateTaskMutation } from "../../client/@tanstack/react-query.gen";
import type { HomeRead, TaskRead } from "../../client/types.gen";
import { AnchoredPopover } from "../../components/AnchoredPopover";
import { Counter } from "../../components/Counter";
import { IconButton } from "../../components/IconButton";
import { SectionCard } from "../../components/SectionCard";
import { useChangeToast } from "../../stores/changeToastStore";
import type { PanelTarget } from "../../stores/detailPanelStore";
import { useNewTask } from "../../stores/newTaskStore";
import { EventRow, type RowContext, TaskRow } from "../calendar/AgendaRow";
import { PanelLink } from "../detail-panel/PanelLink";
import { areaDataAttribute } from "../life-areas/palette";
import { formatValue } from "../metrics/format";
import { DatePanel } from "../pickers/DatePicker";
import { addDays, dayDate } from "../pickers/dates";
import { isOverdue } from "../tasks/board";
import { type ComingUpItem, scheduleItems, todaySubtitle } from "./home";

/** Today: Overdue (only when not empty), Schedule with the now line, Tasks, then Completed
 * (collapsed). Routine steps have their own card. */
export function TodayCard({
  home,
  context,
  now,
  nowLabel,
  time,
}: {
  home: HomeRead;
  context: RowContext;
  /** "14:40", to place the now line and grey out past events. */
  now: string;
  /** "2:40 PM", the now line's label. */
  nowLabel: string;
  time: (value: string) => string;
}) {
  const navigate = useNavigate();
  const openNewTask = useNewTask((state) => state.open);
  const showToast = useChangeToast((state) => state.show);
  const failToast = useChangeToast((state) => state.fail);
  const moveTask = useMutation(updateTaskMutation());
  const [showCompleted, setShowCompleted] = useState(false);
  const schedule = scheduleItems(home, now, time);
  const open = home.overdue.length + home.tasks.length;
  const isEmpty = open + home.completed.length === 0 && schedule.length === 0;
  const moveOverdueToToday = async () => {
    const results = await Promise.allSettled(
      home.overdue.map((task) =>
        moveTask.mutateAsync({
          path: { task_id: task.id },
          body: {
            due_date: home.today,
            ...(task.scheduled_date ? { scheduled_date: home.today } : {}),
          },
        }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      failToast(`Couldn't move ${failed} overdue ${failed === 1 ? "task" : "tasks"}`, null);
    } else {
      showToast(`Moved ${home.overdue.length} overdue to today`, null);
    }
  };
  const taskRow = (task: TaskRead) => (
    <TaskRow
      key={task.id}
      task={task}
      context={context}
      actions={task.status === "todo" ? <RowActions task={task} today={home.today} /> : undefined}
    />
  );

  return (
    <SectionCard
      title="Today"
      description={todaySubtitle(home) || undefined}
      action={
        <IconButton
          label="New task for today"
          onPress={() => openNewTask({ scheduledDate: home.today }, home.today)}
        >
          <Plus />
        </IconButton>
      }
    >
      {isEmpty ? (
        <div className="flex flex-col items-start gap-2 pb-1">
          <p className="type-meta text-(--text-tertiary)">Nothing scheduled today.</p>
          <Button variant="ghost" size="sm" onPress={() => navigate("/tasks/inbox")}>
            <Inbox aria-hidden />
            Plan from Inbox
            {home.inbox > 0 && <Counter count={home.inbox} />}
          </Button>
        </div>
      ) : (
        <div className="-mx-2 flex flex-col gap-3">
          {home.overdue.length > 0 && (
            <Group
              title={<span className="text-(--text-danger)">Overdue</span>}
              count={home.overdue.length}
              action={
                <button
                  type="button"
                  disabled={moveTask.isPending}
                  onClick={moveOverdueToToday}
                  className="ml-auto rounded-(--radius-4) px-1.5 py-0.5 text-xs font-medium text-(--text-tertiary) outline-none hover:bg-(--bg-hover) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
                >
                  Move all to today
                </button>
              }
            >
              {home.overdue.map(taskRow)}
            </Group>
          )}
          {schedule.length > 0 && (
            <Group title="Schedule">
              {schedule.map((item) =>
                item.kind === "now" ? (
                  <NowLine key={item.key} label={nowLabel} />
                ) : (
                  <ScheduleRow key={item.key} item={item} context={context} />
                ),
              )}
            </Group>
          )}
          {home.tasks.length > 0 && (
            <Group title="Tasks" count={home.tasks.length}>
              {home.tasks.map(taskRow)}
            </Group>
          )}
          {open === 0 && home.completed.length > 0 && (
            <p className="px-2 type-meta text-(--text-tertiary)">All done for today.</p>
          )}
          {home.completed.length > 0 && (
            <section aria-label="Completed">
              <h3>
                <button
                  type="button"
                  aria-expanded={showCompleted}
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex h-7 w-full items-center gap-2 rounded-(--radius-6) px-2 type-label text-(--text-tertiary) outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
                >
                  <ChevronDown
                    aria-hidden
                    className={`-ml-1 size-3.5 transition-transform ${showCompleted ? "" : "-rotate-90"}`}
                  />
                  Completed
                  <Counter count={home.completed.length} />
                </button>
              </h3>
              {showCompleted && <ul className="flex flex-col">{home.completed.map(taskRow)}</ul>}
            </section>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** An event, a project due date or a target deadline, in the agenda card look. */
export function ScheduleRow({ item, context }: { item: ComingUpItem; context: RowContext }) {
  switch (item.kind) {
    case "event":
      return (
        <EventRow
          event={item.event}
          color={context.colorOf(item.event.life_area_id)}
          when={item.when}
          past={item.past}
        />
      );
    case "project":
      return (
        <DueRow
          color={context.colorOf(item.project.life_area_id)}
          icon={<Folder aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />}
          target={{ kind: "project", id: item.project.id }}
          title={item.project.title}
          meta="Project due"
        />
      );
    case "deadline":
      return (
        <DueRow
          color={context.colorOf(item.deadline.life_area_id)}
          icon={<ChartLine aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />}
          target={{ kind: "metric", id: item.deadline.metric_id }}
          title={item.deadline.title}
          meta={`Target ${formatValue(item.deadline.target_value, item.deadline)}`}
        />
      );
  }
}

function DueRow({
  color,
  icon,
  target,
  title,
  meta,
}: {
  color: string | null;
  icon: ReactNode;
  target: PanelTarget;
  title: string;
  meta: string;
}) {
  return (
    <li
      data-area={areaDataAttribute(color)}
      className="relative mb-1.5 flex items-start gap-2 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 py-2 hover:border-(--border-strong)"
    >
      <span className="mt-0.5 grid size-4 shrink-0 place-items-center">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <PanelLink
          stretched
          target={target}
          className="truncate text-sm font-medium text-(--text-primary)"
        >
          {title}
        </PanelLink>
        <span className="type-meta text-(--text-tertiary)">{meta}</span>
      </span>
    </li>
  );
}

function NowLine({ label }: { label: string }) {
  return (
    <li aria-label={`Now, ${label}`} className="mb-1.5 flex h-4 items-center gap-1.5 px-2">
      <span className="type-tag font-semibold text-brand-700 tabular-nums">{label}</span>
      <span className="relative h-0.5 flex-1 rounded-full bg-brand-600 before:absolute before:-top-[3px] before:-left-[3px] before:size-2 before:rounded-full before:bg-brand-600" />
    </li>
  );
}

export function Group({
  title,
  count,
  action,
  children,
}: {
  title: ReactNode;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={typeof title === "string" ? title : undefined}>
      <h3 className="flex h-7 items-center gap-2 px-2 type-label text-(--text-tertiary)">
        {title}
        {count !== undefined && <Counter count={count} />}
        {action}
      </h3>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

export { Counter };

const ROW_BUTTON =
  "inline-flex h-6 items-center gap-1 rounded-[5px] border border-(--border-default) bg-(--bg-surface) px-1.5 text-xs font-medium text-(--text-secondary) outline-none hover:border-(--color-neutral-300) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring)";

/** Tomorrow and Pick date on an open task. They move the date that puts it on today: the
 * scheduled date, or, for an overdue task, the due date (and its scheduled date with it). */
function RowActions({ task, today }: { task: TaskRead; today: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const showToast = useChangeToast((state) => state.show);
  const update = useMutation(updateTaskMutation());
  const tomorrow = addDays(today, 1);
  const move = (day: string) => {
    const late = isOverdue(task, today);
    const body = late
      ? { due_date: day, ...(task.scheduled_date ? { scheduled_date: day } : {}) }
      : { scheduled_date: day };
    update.mutate(
      { path: { task_id: task.id }, body },
      {
        onSuccess: (change) =>
          showToast(
            `Moved “${task.title}” · ${day === tomorrow ? "Tomorrow" : dayDate(day)}`,
            change.batch_id ?? null,
          ),
      },
    );
  };
  return (
    <>
      <button
        type="button"
        title={`Schedule for ${dayDate(tomorrow)}`}
        disabled={update.isPending}
        onClick={() => move(tomorrow)}
        className={ROW_BUTTON}
      >
        <ArrowRight aria-hidden className="size-[13px] text-(--text-tertiary)" />
        Schedule tomorrow
      </button>
      <button
        type="button"
        aria-label={`Pick scheduled date for ${task.title}`}
        aria-expanded={anchor !== null}
        title="Pick scheduled date"
        disabled={update.isPending}
        onClick={(event) => setAnchor(event.currentTarget)}
        className={`${ROW_BUTTON} w-6 justify-center px-0`}
      >
        <CalendarDays aria-hidden className="size-[13px] text-(--text-tertiary)" />
      </button>
      {anchor && (
        <AnchoredPopover
          anchor={anchor}
          label="Pick date"
          width={252}
          placement="bottom"
          onClose={() => setAnchor(null)}
        >
          <DatePanel
            value={null}
            today={today}
            onPick={(day) => {
              setAnchor(null);
              if (day && day !== today) move(day);
            }}
          />
        </AnchoredPopover>
      )}
    </>
  );
}
