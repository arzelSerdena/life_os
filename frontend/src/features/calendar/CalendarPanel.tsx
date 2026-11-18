import { Draggable } from "@fullcalendar/react/interaction";
import { PanelRightClose } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef } from "react";
import type { TaskRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { SegmentSwitch } from "../../components/SegmentSwitch";
import { monthName } from "../life-areas/overview/format";
import { EntryRow, type RowContext, TaskRow } from "./AgendaRow";
import { type AgendaDay, agendaTitle, type InboxMode } from "./calendar";

/** The right panel's card: 360 px, a 52 px header with the hide button, a scrolling body. */
function PanelCard({
  title,
  extra,
  onHide,
  bodyRef,
  children,
}: {
  title: string;
  extra?: ReactNode;
  onHide: () => void;
  bodyRef?: React.Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="mt-4 mr-6 mb-6 flex w-[360px] shrink-0 flex-col rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface)"
    >
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-(--border-default) pr-2 pl-4">
        <h2 className="type-column-title text-(--text-primary)">{title}</h2>
        {extra}
        <span className="ml-auto">
          <IconButton label="Hide panel" size="md" onPress={onHide}>
            <PanelRightClose />
          </IconButton>
        </span>
      </header>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto px-2 pt-2 pb-4">
        {children}
      </div>
    </aside>
  );
}

/**
 * The agenda: exactly what the grid shows, by day (Today and Tomorrow named), opening
 * scrolled to today. Quarter and Year add month headings that stay in view.
 */
export function AgendaPanel({
  days,
  context,
  rangeKey,
  monthHeadings = false,
  emptyText,
  onClearFilters,
  onHide,
}: {
  days: AgendaDay[];
  context: RowContext;
  /** Changes with the shown period, to scroll to today again. */
  rangeKey: string;
  monthHeadings?: boolean;
  emptyText: string;
  onClearFilters?: () => void;
  onHide: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const hasDays = days.length > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only when the range changes or first fills
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const first = body.querySelector<HTMLElement>("[data-from-today]");
    // A month heading stays over the top of the list, so today goes just under it.
    const heading = body.querySelector<HTMLElement>("[data-month-heading]")?.offsetHeight ?? 0;
    body.scrollTop = first ? first.offsetTop - body.offsetTop - 8 - heading : 0;
  }, [rangeKey, hasDays]);

  const fromToday = days.find((day) => day.day >= context.today)?.day;
  return (
    <PanelCard title="Agenda" onHide={onHide} bodyRef={bodyRef}>
      {days.map(({ day, entries }, index) => {
        const { label, date } = agendaTitle(day, context.today);
        const newMonth =
          monthHeadings && (index === 0 || days[index - 1].day.slice(0, 7) !== day.slice(0, 7));
        return (
          <Fragment key={day}>
            {newMonth && (
              <h3
                data-month-heading=""
                className="sticky -top-2 z-10 -mx-2 mt-1 border-b border-(--border-default) bg-(--bg-surface) px-4 pt-2 pb-1.5 text-[13px] font-semibold text-(--text-primary) first:mt-0"
              >
                {monthName(day)}
              </h3>
            )}
            <section
              aria-label={`${label} ${date}`}
              data-from-today={day === fromToday ? "" : undefined}
              className="mt-3 first:mt-1"
            >
              <h3 className="flex h-6 items-center gap-2 px-2">
                <span
                  className={`text-[11px] font-semibold tracking-[0.04em] uppercase ${
                    day === context.today ? "text-brand-700" : "text-(--text-tertiary)"
                  }`}
                >
                  {label}
                </span>
                <span className="type-meta text-(--text-tertiary)">{date}</span>
              </h3>
              <ul className="flex flex-col pt-1">
                {entries.map((entry) => (
                  <EntryRow key={entry.key} entry={entry} context={context} />
                ))}
              </ul>
            </section>
          </Fragment>
        );
      })}
      {!hasDays && (
        <div className="flex flex-col items-start gap-2.5 px-2 py-3">
          <p className="type-meta text-(--text-tertiary)">{emptyText}</p>
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-7 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-3 text-xs font-medium text-(--text-secondary) outline-none hover:bg-(--color-neutral-50) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </PanelCard>
  );
}

/**
 * The Inbox panel: open tasks with no scheduled date (Scheduled) or no due date (Due). Drag
 * one onto a day to give it that date.
 */
export function InboxPanel({
  tasks,
  mode,
  context,
  onMode,
  onHide,
  onDragStart,
}: {
  tasks: TaskRead[];
  mode: InboxMode;
  context: RowContext;
  onMode: (mode: InboxMode) => void;
  onHide: () => void;
  /** Quarter and Year drag the rows themselves; Week and Month leave it to FullCalendar. */
  onDragStart?: (task: TaskRead, event: React.PointerEvent) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const ownDrag = !!onDragStart;
  // FullCalendar's own dragging takes the rows onto the grid; `drop` gets the task's id.
  useEffect(() => {
    const list = listRef.current;
    if (!list || ownDrag) return;
    const draggable = new Draggable(list, {
      itemSelector: "[data-task-id]",
      eventData: (element: HTMLElement) => ({ title: element.dataset.title ?? "", create: false }),
    });
    return () => draggable.destroy();
  }, [ownDrag]);

  return (
    <PanelCard
      title="Inbox"
      onHide={onHide}
      extra={
        <>
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-(--color-neutral-200) px-1.5 text-[11px] font-medium text-(--text-secondary)">
            {tasks.length}
          </span>
          <SegmentSwitch
            label="Tasks with no"
            value={mode}
            options={[
              { key: "scheduled", label: "Scheduled" },
              { key: "due", label: "Due" },
            ]}
            onChange={onMode}
          />
        </>
      }
    >
      <ul
        ref={listRef}
        aria-label={mode === "scheduled" ? "No scheduled date" : "No due date"}
        className="flex flex-col pt-1"
      >
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            context={context}
            showArea
            showScheduled={mode === "due"}
            containerProps={{
              "data-task-id": String(task.id),
              "data-title": task.title,
              className: "cursor-grab",
              onPointerDown: onDragStart && ((event) => onDragStart(task, event)),
            }}
          />
        ))}
      </ul>
      {tasks.length === 0 && (
        <p className="px-2 py-3 type-meta text-(--text-tertiary)">
          {mode === "scheduled" ? "Every open task has a date." : "Every open task has a due date."}
        </p>
      )}
    </PanelCard>
  );
}
