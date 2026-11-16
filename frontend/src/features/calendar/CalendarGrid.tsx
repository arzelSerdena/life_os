import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import "@fullcalendar/react/skeleton.css";
import "./calendar.css";
import type { EventDropInfo, EventResizeDoneInfo } from "@fullcalendar/react";
import { shortMonth } from "../life-areas/overview/format";
import { addDays, weekdayIndex } from "../pickers/dates";
import type { RoutineDay } from "../tasks/next7";
import { ProgressRing } from "../tasks/RoutinesPage";
import {
  type CalendarView,
  canMove,
  type DayRange,
  type Entry,
  exclusiveEnd,
  isBar,
} from "./calendar";
import { type ColorOf, GridEntry } from "./GridEntry";

export type GridProps = {
  view: CalendarView;
  range: DayRange;
  /** The month shown ("2026-11"); days outside it are greyed. */
  month: string;
  today: string;
  entries: Entry[];
  weekends: boolean;
  /** Month: each day's routine steps as one ring beside the date. */
  rings: Map<string, { done: number; total: number }>;
  colorOf: ColorOf;
  onRoutine: (routine: RoutineDay, anchor: HTMLElement) => void;
  onRing: (day: string, anchor: HTMLElement) => void;
  onMore: (day: string, anchor: HTMLElement) => void;
  onDayClick: (day: string, point: { x: number; y: number }) => void;
  /** A drag or resize ended; `revert` puts the entry back if saving fails. */
  onMove: (
    entry: Entry,
    start: string,
    end: string,
    how: "move" | "resize",
    revert: () => void,
  ) => void;
  /** Something from the Inbox panel was dropped on a day. */
  onDrop: (taskId: number, day: string) => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Week and Month: FullCalendar's day grid (no time grid), Monday first. Bars sit across the
 * top of each week row, and a day's entries fill the free lines beside them first.
 */
export function CalendarGrid(props: GridProps) {
  const { view, range, month, today, entries, weekends, rings, colorOf } = props;
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));

  const changed = (how: "move" | "resize") => (info: EventDropInfo | EventResizeDoneInfo) => {
    const entry = byKey.get(info.event.id);
    if (!entry) return info.revert();
    const start = info.event.startStr.slice(0, 10);
    const end = info.event.endStr ? addDays(info.event.endStr.slice(0, 10), -1) : start;
    props.onMove(entry, start, end, how, info.revert);
  };

  // "+3 more" opens the approved day popover, not FullCalendar's: its clicks are caught on
  // the way down, before the link's own handler sees them.
  const openMore = (event: React.SyntheticEvent) => {
    const link = (event.target as HTMLElement).closest<HTMLElement>(".calendar-more");
    const day = link?.closest<HTMLElement>("[data-date]")?.dataset.date;
    if (!link || !day) return;
    event.stopPropagation();
    event.preventDefault();
    props.onMore(day, link);
  };

  return (
    <div
      className={`calendar-grid h-full ${view === "week" ? "is-week" : "is-month"}`}
      onClickCapture={openMore}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") openMore(event);
      }}
    >
      <FullCalendar
        // A new range or view starts a fresh calendar on its first day.
        key={`${view}:${range.start}:${weekends}`}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView={view === "week" ? "dayGridWeek" : "dayGridMonth"}
        initialDate={view === "week" ? range.start : `${month}-01`}
        headerToolbar={false}
        height="100%"
        firstDay={1}
        weekends={weekends}
        fixedWeekCount={false}
        showNonCurrentDates
        dayMaxEvents={view === "month"}
        eventOrder="start,-duration,order"
        editable
        droppable
        eventResizableFromStart={false}
        events={entries.map((entry) => ({
          id: entry.key,
          start: entry.start,
          end: exclusiveEnd(entry.end),
          allDay: true,
          order: entry.order,
          startEditable: canMove(entry),
          durationEditable: canMove(entry) && isBar(entry),
          extendedProps: { kind: entry.kind },
        }))}
        eventContent={(info) => {
          const entry = byKey.get(info.event.id);
          if (!entry) return null;
          return (
            <GridEntry
              entry={entry}
              today={today}
              colorOf={colorOf}
              segment={{
                isStart: info.isStart,
                isEnd: info.isEnd,
                firstOfRange: info.event.startStr.slice(0, 10) < range.start,
              }}
              onRoutine={props.onRoutine}
            />
          );
        }}
        eventClass={(info) =>
          `calendar-entry ${info.isDragging ? "opacity-35" : ""} ${info.isMirror ? "calendar-mirror" : ""}`
        }
        rowEventAfterClass={(info) => (info.isEndResizable ? "calendar-resizer" : "")}
        eventDrop={changed("move")}
        eventResize={changed("resize")}
        drop={(info) => {
          const id = Number(info.draggedEl.dataset.taskId);
          if (id) props.onDrop(id, info.dateStr.slice(0, 10));
        }}
        dateClick={(info) =>
          props.onDayClick(info.dateStr.slice(0, 10), {
            x: info.jsEvent.clientX,
            y: info.jsEvent.clientY,
          })
        }
        moreLinkContent={(info) => `+${info.num} more`}
        moreLinkClass="calendar-more"
        tableClass="calendar-table"
        tableHeaderClass="calendar-head"
        dayHeaderRowClass="calendar-head-row"
        dayCellTopClass="calendar-cell-top-slot"
        dayRowClass="calendar-week"
        dayHeaderClass="calendar-day-header"
        dayHeaderContent={(info) => {
          const day = dayString(info.date);
          const name = WEEKDAYS[weekdayIndex(day)];
          if (view === "month") return <span className="calendar-weekday">{name}</span>;
          return (
            <span className={`calendar-week-head ${dayState(day, today)}`}>
              <span className="calendar-weekday">{name}</span>
              <span className="calendar-date">{Number(day.slice(8))}</span>
            </span>
          );
        }}
        dayCellClass={(info) => `calendar-day ${info.isOther ? "is-other" : ""}`}
        dayCellTopContent={(info) => {
          if (view === "week") return null;
          const day = dayString(info.date);
          const ring = rings.get(day);
          const inMonth = day.slice(0, 7) === month;
          return (
            <span
              className={`calendar-cell-top ${dayState(day, today)} ${inMonth ? "" : "is-other"}`}
            >
              <span className="calendar-date">
                {day.endsWith("-01") ? `${shortMonth(day)} 1` : Number(day.slice(8))}
              </span>
              {ring && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`Routines, ${ring.done} of ${ring.total} steps done`}
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onRing(day, event.currentTarget);
                  }}
                  className="calendar-ring"
                >
                  <ProgressRing done={ring.done} total={ring.total} />
                </button>
              )}
            </span>
          );
        }}
      />
    </div>
  );
}

/** FullCalendar hands out local midnight Dates; this is that calendar day as "YYYY-MM-DD". */
function dayString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayState(day: string, today: string): string {
  if (day === today) return "is-today";
  return day < today ? "is-past" : "";
}
