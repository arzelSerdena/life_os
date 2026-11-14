import { useMutation } from "@tanstack/react-query";
import { CalendarDays, ChartLine, Flag, Folder, Repeat } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { completeTaskMutation } from "../../../client/@tanstack/react-query.gen";
import type { AreaPageRead, OccurrenceRead, TaskRead } from "../../../client/types.gen";
import { QueryError } from "../../../components/QueryError";
import type { PanelTarget } from "../../../stores/detailPanelStore";
import { PanelLink } from "../../detail-panel/PanelLink";
import { daysBetween, formatAmount, outcomeTone, plural, shortDate } from "../overview/format";
import { describeRule, eachDay } from "./timeScale";

type Row = {
  key: string;
  target: PanelTarget;
  icon?: ReactNode;
  title: string;
  note: string;
  danger?: boolean;
};

/** Needs attention, Unscheduled, Recurring and Completed, one 36 px row per item. Notes live
 * in the detail panel. */
export function TasksCard({ page }: { page: AreaPageRead }) {
  const projectTitle = (id: number | null) =>
    page.projects.find((project) => project.id === id)?.title;
  const withProject = (task: TaskRead, note: string) =>
    [projectTitle(task.project_id), note].filter(Boolean).join(" · ");

  const attention: Row[] = [
    ...page.overdue_tasks.map(
      (task): Row => ({
        key: `t${task.id}`,
        target: { kind: "task", id: task.id },
        title: task.title,
        note: withProject(
          task,
          `Overdue ${plural(daysBetween(task.due_date as string, page.today), "day")}`,
        ),
        danger: true,
      }),
    ),
    ...page.rolled_over_tasks.map(
      (task): Row => ({
        key: `r${task.id}`,
        target: { kind: "task", id: task.id },
        title: task.title,
        note: withProject(task, `Rolled over ${task.rollover_count} times`),
      }),
    ),
    ...page.projects
      .filter(
        (p) => p.status === "active" && p.due_date && daysBetween(page.today, p.due_date) <= 14,
      )
      .map(
        (p): Row => ({
          key: `p${p.id}`,
          target: { kind: "project", id: p.id },
          icon: <Folder aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />,
          title: p.title,
          note: `Due in ${plural(Math.max(daysBetween(page.today, p.due_date as string), 0), "day")} · ${
            p.total ? Math.round((p.done / p.total) * 100) : 0
          }% done`,
        }),
      ),
    ...page.metrics
      .filter((metric) => outcomeTone(metric.status) === "bad")
      .map(
        (metric): Row => ({
          key: `m${metric.metric_id}`,
          target: { kind: "metric", id: metric.metric_id },
          icon: <ChartLine aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />,
          title: metric.title,
          note:
            metric.target && metric.value !== null
              ? `${formatAmount(metric.value, metric.unit)} of ${formatAmount(metric.target.target_value, metric.unit)}`
              : "Behind",
        }),
      ),
  ];
  const tabs: { id: string; label: string; rows: Row[] }[] = [
    { id: "attention", label: "Needs attention", rows: attention },
    {
      id: "unscheduled",
      label: "Unscheduled",
      rows: page.unscheduled_tasks.map(
        (task): Row => ({
          key: `u${task.id}`,
          target: { kind: "task", id: task.id },
          title: task.title,
          note: withProject(task, task.due_date ? `Due ${shortDate(task.due_date)}` : ""),
        }),
      ),
    },
    {
      id: "recurring",
      label: "Recurring",
      rows: page.recurring.map(
        (template): Row => ({
          key: `c${template.id}`,
          target: { kind: "template", id: template.id },
          icon: <Repeat aria-hidden className="size-4 text-(--text-tertiary)" strokeWidth={2} />,
          title: template.title,
          note: template.paused_at ? "Paused" : describeRule(template.rrule ?? ""),
        }),
      ),
    },
    {
      id: "completed",
      label: "Completed",
      rows: page.completed_tasks.map(
        (task): Row => ({
          key: `d${task.id}`,
          target: { kind: "task", id: task.id },
          title: task.title,
          note: withProject(task, `Done ${shortDate((task.completed_at ?? "").slice(0, 10))}`),
        }),
      ),
    },
  ];
  const [selected, setSelected] = useState("attention");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = tabs.find((tab) => tab.id === selected) ?? tabs[0];

  const onKey = (event: KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === selected);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = tabs[(index + step + tabs.length) % tabs.length].id;
    setSelected(next);
    refs.current[next]?.focus();
  };

  return (
    <section
      aria-label="Area lists"
      className="rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface)"
    >
      <div
        role="tablist"
        aria-label="Area lists"
        className="flex gap-1 border-b border-(--border-default) px-4"
        onKeyDown={onKey}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === selected ? 0 : -1}
            onClick={() => setSelected(tab.id)}
            className={`-mb-px flex h-11 items-center gap-1.5 border-b-2 px-2 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
              tab.id === selected
                ? "border-(--color-neutral-900) text-(--text-primary)"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            {tab.label}
            {tab.rows.length > 0 && <Counter count={tab.rows.length} />}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${current.id}`}
        aria-labelledby={`tab-${current.id}`}
        className="px-4 py-2"
      >
        {current.rows.length === 0 ? (
          <p className="flex min-h-10 items-center type-meta text-(--text-tertiary)">
            Nothing here.
          </p>
        ) : (
          <ul>
            {current.rows.map((row) => (
              <li
                key={row.key}
                className="relative -mx-2 flex h-9 items-center gap-2.5 rounded-(--radius-6) px-2 hover:bg-(--bg-hover)"
              >
                {row.icon ?? (
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-[4px] border-2 border-(--color-neutral-300)"
                  />
                )}
                <PanelLink
                  stretched
                  target={row.target}
                  className="flex-1 truncate text-[13px] text-(--text-primary)"
                >
                  {row.title}
                </PanelLink>
                <span
                  className={`shrink-0 type-meta ${row.danger ? "text-(--text-danger)" : "text-(--text-tertiary)"}`}
                >
                  {row.note}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Counter({ count }: { count: number }) {
  return (
    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-neutral-100 px-1.5 text-[11px] font-medium text-(--text-secondary)">
      {count}
    </span>
  );
}

// ---------- Agenda ----------

type AgendaItem =
  | { kind: "task"; task: TaskRead }
  | { kind: "event"; event: OccurrenceRead; day: string }
  | { kind: "project"; id: number; title: string }
  | { kind: "deadline"; id: number; title: string; note: string };

/** Overdue first, then each day from today to the period's end. */
export function AgendaCard({ page }: { page: AreaPageRead }) {
  const complete = useMutation(completeTaskMutation());
  const range = page.agenda_range;
  const projectTitle = (id: number | null) => page.projects.find((p) => p.id === id)?.title;

  const byDay = new Map<string, AgendaItem[]>();
  const put = (day: string, item: AgendaItem) => byDay.set(day, [...(byDay.get(day) ?? []), item]);
  if (range) {
    for (const task of page.agenda_tasks) {
      const day =
        task.scheduled_date && task.scheduled_date >= range.start
          ? task.scheduled_date
          : task.due_date;
      if (day && day <= range.end) put(day, { kind: "task", task });
    }
    for (const event of page.events) {
      for (const day of eachDay({ start: event.start_date, end: event.end_date })) {
        if (day >= range.start && day <= range.end) put(day, { kind: "event", event, day });
      }
    }
    for (const project of page.projects) {
      if (
        project.status === "active" &&
        project.due_date &&
        project.due_date >= range.start &&
        project.due_date <= range.end
      ) {
        put(project.due_date, { kind: "project", id: project.id, title: project.title });
      }
    }
    for (const deadline of page.deadlines) {
      put(deadline.day, {
        kind: "deadline",
        id: deadline.metric_id,
        title: deadline.title,
        note: `Target ${formatAmount(deadline.target_value, deadline.unit)}`,
      });
    }
  }
  const days = [...byDay.keys()].sort();
  const label = range
    ? `${range.start === page.today ? "Today" : shortDate(range.start)} – ${shortDate(range.end)}`
    : "";

  const taskNote = (task: TaskRead, day?: string) =>
    [
      task.due_date && (task.due_date === day ? "Due" : shortDate(task.due_date)),
      projectTitle(task.project_id),
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <section
      aria-label="Agenda"
      className="flex flex-col self-start rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface)"
    >
      <header className="flex h-[52px] items-center gap-2 border-b border-(--border-default) px-4">
        <h2 className="type-column-title text-(--text-primary)">Agenda</h2>
        <span className="type-meta text-(--text-tertiary)">{label}</span>
      </header>
      <div className="flex flex-col gap-3 px-2 py-3">
        {complete.isError && <QueryError error={complete.error} />}
        {page.overdue_tasks.length > 0 && (
          <DayGroup
            title={<span className="text-(--text-danger)">Overdue</span>}
            count={page.overdue_tasks.length}
          >
            {page.overdue_tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                note={taskNote(task)}
                late
                onDone={() => complete.mutate({ path: { task_id: task.id } })}
              />
            ))}
          </DayGroup>
        )}
        {days.map((day) => (
          <DayGroup key={day} title={dayTitle(day, page.today)}>
            {(byDay.get(day) ?? []).map((item) => {
              if (item.kind === "task") {
                return (
                  <TaskItem
                    key={`t${item.task.id}`}
                    task={item.task}
                    note={taskNote(item.task, day)}
                    onDone={() => complete.mutate({ path: { task_id: item.task.id } })}
                  />
                );
              }
              if (item.kind === "event") {
                const { event } = item;
                const length = daysBetween(event.start_date, event.end_date) + 1;
                const note =
                  length > 1
                    ? `${event.start_time && day === event.end_date ? `Ends ${event.end_time ? time(event.end_time) : ""}` : "All day"} · day ${daysBetween(event.start_date, day) + 1} of ${length}`
                    : event.start_time
                      ? time(event.start_time)
                      : "All day";
                return (
                  <Item
                    key={`e${event.event_id}-${event.occurrence_date}`}
                    target={{
                      kind: "event",
                      id: event.event_id,
                      day: event.is_repeating ? event.occurrence_date : null,
                    }}
                    tinted
                    icon={
                      <CalendarDays
                        aria-hidden
                        className="size-4 text-(--area-solid)"
                        strokeWidth={2}
                      />
                    }
                    title={event.title}
                    note={note}
                  />
                );
              }
              return (
                <Item
                  key={`${item.kind}${item.id}`}
                  target={{ kind: item.kind === "project" ? "project" : "metric", id: item.id }}
                  icon={
                    item.kind === "project" ? (
                      <Folder aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />
                    ) : (
                      <ChartLine
                        aria-hidden
                        className="size-4 text-(--area-solid)"
                        strokeWidth={2}
                      />
                    )
                  }
                  title={item.title}
                  note={item.kind === "project" ? "Project due" : item.note}
                />
              );
            })}
          </DayGroup>
        ))}
        {!range && <p className="px-2 type-meta text-(--text-tertiary)">This period is over.</p>}
        {range && days.length === 0 && page.overdue_tasks.length === 0 && (
          <p className="px-2 type-meta text-(--text-tertiary)">Nothing scheduled.</p>
        )}
      </div>
    </section>
  );
}

function DayGroup({
  title,
  count,
  children,
}: {
  title: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="flex h-7 items-center gap-2 px-2 text-xs font-semibold tracking-[0.04em] text-(--text-tertiary) uppercase">
        {title}
        {count !== undefined && <Counter count={count} />}
      </h3>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function TaskItem({
  task,
  note,
  late,
  onDone,
}: {
  task: TaskRead;
  note: string;
  late?: boolean;
  onDone: () => void;
}) {
  return (
    <Item
      target={{ kind: "task", id: task.id }}
      icon={
        <input
          type="checkbox"
          aria-label={`Mark ${task.title} done`}
          onChange={onDone}
          className="relative z-10 size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border-2 border-(--area-solid) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        />
      }
      title={task.title}
      note={
        <span className="flex items-center gap-1">
          {task.due_date && (
            <Flag
              aria-hidden
              className={`size-3 ${late ? "text-(--text-danger)" : "text-(--color-warning-600)"}`}
              strokeWidth={2}
            />
          )}
          <span className={late ? "text-(--text-danger)" : ""}>{note || "To do"}</span>
        </span>
      }
    />
  );
}

function Item({
  target,
  icon,
  title,
  note,
  tinted,
}: {
  target: PanelTarget;
  icon: ReactNode;
  title: string;
  note: ReactNode;
  tinted?: boolean;
}) {
  return (
    <li
      className={`relative flex gap-2.5 rounded-(--radius-6) px-2 py-1.5 ${tinted ? "bg-(--area-tint-active)" : "hover:bg-(--bg-hover)"}`}
    >
      <span className="mt-0.5 grid size-4 shrink-0 place-items-center">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <PanelLink
          stretched
          target={target}
          className={`truncate text-[13px] ${tinted ? "text-(--area-ink)" : "text-(--text-primary)"}`}
        >
          {title}
        </PanelLink>
        <span className={`type-meta ${tinted ? "text-(--area-text)" : "text-(--text-tertiary)"}`}>
          {note}
        </span>
      </span>
    </li>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayTitle(day: string, today: string): ReactNode {
  const offset = daysBetween(today, day);
  const weekday = WEEKDAYS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7];
  const prefix = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : weekday;
  return (
    <>
      <span className={offset === 0 ? "text-brand-700" : ""}>{prefix}</span>
      <span className="font-normal tracking-normal normal-case">
        {offset <= 1 ? `${weekday}, ${shortDate(day)}` : shortDate(day)}
      </span>
    </>
  );
}

function time(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
