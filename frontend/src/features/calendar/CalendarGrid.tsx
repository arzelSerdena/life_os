import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "./calendar.css";
import type { EventDropInfo, EventResizeDoneInfo } from "@fullcalendar/react";
import type { RoutineStepDay } from "../../client/types.gen";
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
  dayCount?: number;
  timed?: boolean;
  range: DayRange;
  /** The month shown ("2026-11"); days outside it are greyed. */
  month: string;
  today: string;
  entries: Entry[];
  weekends: boolean;
  /** Month: each day's routine steps as one ring beside the date. */
  rings: Map<string, { done: number; total: number; steps?: RoutineStepDay[] }>;
  colorOf: ColorOf;
  onRoutine: (routine: RoutineDay, anchor: HTMLElement) => void;
  onInspect?: (entry: Entry, anchor: HTMLElement) => void;
  onRing: (day: string, anchor: HTMLElement) => void;
  onMore: (day: string, anchor: HTMLElement) => void;
  onDayClick: (day: string, point: { x: number; y: number }) => void;
  /** Drag-selecting a time range in Timed view. */
  onTimeSelect?: (
    day: string,
    startTime: string,
    endTime: string,
    point: { x: number; y: number },
  ) => void;
  /** A drag or resize ended; `revert` puts the entry back if saving fails. */
  onMove: (
    entry: Entry,
    start: string,
    end: string,
    how: "move" | "resize",
    revert: () => void,
    startTime?: string | null,
    endTime?: string | null,
  ) => void;
  /** Something from the Inbox panel was dropped on a day (and optional time in Timed view). */
  onDrop: (taskId: number, day: string, startTime?: string) => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Week and Month: FullCalendar's day grid (no time grid), Monday first. Bars sit across the
 * top of each week row, and a day's entries fill the free lines beside them first.
 */
export function CalendarGrid(props: GridProps) {
  const {
    view,
    dayCount = 3,
    timed = false,
    range,
    month,
    today,
    entries,
    weekends,
    rings,
    colorOf,
  } = props;
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const isTimeGrid = timed && (view === "week" || view === "days");
  const fcView = isTimeGrid
    ? view === "week"
      ? "timeGridWeek"
      : "timeGrid"
    : view === "days"
      ? "dayGrid"
      : view === "week"
        ? "dayGridWeek"
        : "dayGridMonth";

  const changed = (how: "move" | "resize") => (info: EventDropInfo | EventResizeDoneInfo) => {
    const entry = byKey.get(info.event.id);
    if (!entry) return info.revert();
    const start = info.event.startStr.slice(0, 10);
    const hasTime = !info.event.allDay && info.event.startStr.includes("T");
    const startTime = hasTime ? info.event.startStr.slice(11, 19) : null;
    const endTime =
      hasTime && info.event.endStr?.includes("T") ? info.event.endStr.slice(11, 19) : null;
    const end = info.event.endStr
      ? hasTime
        ? info.event.endStr.slice(0, 10)
        : addDays(info.event.endStr.slice(0, 10), -1)
      : start;
    props.onMove(
      entry,
      start,
      end,
      how,
      info.revert,
      isTimeGrid ? startTime : undefined,
      isTimeGrid ? endTime : undefined,
    );
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
      className={`calendar-grid h-full ${view === "week" || view === "days" ? "is-week" : "is-month"} ${isTimeGrid ? "is-timed" : ""}`}
      onClickCapture={openMore}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") openMore(event);
      }}
    >
      <FullCalendar
        // A new range or view starts a fresh calendar on its first day.
        key={`${view}:${dayCount}:${timed}:${range.start}:${weekends}`}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={fcView}
        duration={view === "days" ? { days: dayCount } : undefined}
        initialDate={view === "month" ? `${month}-01` : range.start}
        headerToolbar={false}
        height="100%"
        scrollTime="07:00:00"
        nowIndicator={isTimeGrid}
        firstDay={1}
        weekends={weekends}
        fixedWeekCount={false}
        showNonCurrentDates
        dayMaxEvents={view === "month"}
        eventOrder="start,-duration,order"
        editable
        selectable={isTimeGrid}
        selectMirror={isTimeGrid}
        eventResizableFromStart={false}
        events={entries.map((entry) => {
          if (isTimeGrid) {
            if (entry.kind === "event" && entry.event.start_time) {
              return {
                id: entry.key,
                start: `${entry.start}T${entry.event.start_time}`,
                end: entry.event.end_time ? `${entry.end}T${entry.event.end_time}` : undefined,
                allDay: false,
                order: entry.order,
                startEditable: canMove(entry),
                durationEditable: canMove(entry),
                extendedProps: { kind: entry.kind },
              };
            }
            if (entry.kind === "task" && entry.task.scheduled_time) {
              const endDay =
                entry.task.scheduled_end_time &&
                entry.task.scheduled_end_time <= entry.task.scheduled_time
                  ? addDays(entry.start, 1)
                  : entry.start;
              return {
                id: entry.key,
                start: `${entry.start}T${entry.task.scheduled_time}`,
                end: entry.task.scheduled_end_time
                  ? `${endDay}T${entry.task.scheduled_end_time}`
                  : undefined,
                allDay: false,
                order: entry.order,
                startEditable: canMove(entry),
                durationEditable: canMove(entry),
                extendedProps: { kind: entry.kind },
              };
            }
            if (entry.kind === "routine" && entry.routine.startTime) {
              const endDay =
                entry.routine.endTime && entry.routine.endTime <= entry.routine.startTime
                  ? addDays(entry.start, 1)
                  : entry.start;
              return {
                id: entry.key,
                start: `${entry.start}T${entry.routine.startTime}`,
                end: entry.routine.endTime ? `${endDay}T${entry.routine.endTime}` : undefined,
                allDay: false,
                order: entry.order,
                startEditable: true,
                durationEditable: true,
                extendedProps: { kind: entry.kind },
              };
            }
          }
          return {
            id: entry.key,
            start: entry.start,
            end: exclusiveEnd(entry.end),
            allDay: true,
            order: entry.order,
            startEditable: canMove(entry),
            durationEditable: canMove(entry) && isBar(entry),
            extendedProps: { kind: entry.kind },
          };
        })}
        eventContent={(info) => {
          const entry = byKey.get(info.event.id);
          if (!entry) return null;
          return (
            <GridEntry
              entry={entry}
              today={today}
              timed={isTimeGrid && !info.event.allDay}
              colorOf={colorOf}
              segment={{
                isStart: info.isStart,
                isEnd: info.isEnd,
                firstOfRange: info.event.startStr.slice(0, 10) < range.start,
              }}
              onRoutine={props.onRoutine}
              onInspect={props.onInspect}
            />
          );
        }}
        eventClass={(info) =>
          `calendar-entry ${isTimeGrid && !info.event.allDay ? "is-timed-entry" : ""} ${info.isDragging ? "opacity-35" : ""} ${info.isMirror ? "calendar-mirror" : ""}`
        }
        rowEventAfterClass={(info) => (info.isEndResizable ? "calendar-resizer" : "")}
        columnEventAfterClass={(info) =>
          info.isEndResizable ? "calendar-resizer is-column-resizer" : ""
        }
        eventDrop={changed("move")}
        eventResize={changed("resize")}
        drop={(info) => {
          const id = Number(info.draggedEl.dataset.taskId);
          const time =
            !info.allDay && info.dateStr.includes("T") ? info.dateStr.slice(11, 19) : undefined;
          if (id) props.onDrop(id, info.dateStr.slice(0, 10), time);
        }}
        select={(info) => {
          if (!isTimeGrid || info.allDay || !props.onTimeSelect) return;
          const day = info.startStr.slice(0, 10);
          const startTime = info.startStr.slice(11, 16);
          const endTime = info.endStr.slice(11, 16);
          props.onTimeSelect(day, startTime, endTime, {
            x: info.jsEvent?.clientX ?? 200,
            y: info.jsEvent?.clientY ?? 200,
          });
        }}
        dateClick={(info) => {
          if (isTimeGrid && !info.allDay) return;
          props.onDayClick(info.dateStr.slice(0, 10), {
            x: info.jsEvent.clientX,
            y: info.jsEvent.clientY,
          });
        }}
        moreLinkContent={(info) => `+${info.num} more`}
        moreLinkClass="calendar-more"
        tableClass="calendar-table"
        tableHeaderClass="calendar-head"
        dayHeaderRowClass="calendar-head-row"
        dayCellTopClass="calendar-cell-top-slot"
        dayRowClass="calendar-week"
        dayHeaderClass="calendar-day-header"
        slotLaneClass={(info) => `calendar-slot-lane ${info.isMinor ? "is-minor" : "is-major"}`}
        slotHeaderClass="calendar-slot-header"
        slotHeaderInnerClass="calendar-slot-label"
        dayLaneClass="calendar-day-lane"
        allDayHeaderClass="calendar-allday-header"
        allDayHeaderInnerClass="calendar-allday-label"
        allDayDividerClass="calendar-allday-divider"
        nowIndicatorLineClass="calendar-now-line"
        nowIndicatorDotClass="calendar-now-dot"
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
          if (view === "week" || view === "days") return null;
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
                  <ProgressRing
                    done={ring.done}
                    total={ring.total}
                    segments={ring.steps?.map((s) => ({
                      done: s.status === "done",
                      color: colorOf(s.life_area_id),
                    }))}
                  />
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
