import { Folder } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PanelTarget } from "../../stores/detailPanelStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { dayDate } from "../pickers/dates";
import { formatTime, useTimeFormat } from "../tasks/format";
import type { DayRange, Entry } from "./calendar";
import { spanLabel } from "./calendar";
import type { ColorOf } from "./GridEntry";
import {
  type LinearBar,
  linearMonths,
  type MonthRow,
  marksThatFit,
  type PlacedBar,
  SLOTS,
  slotDay,
} from "./linear";
import { canDragBar, type DragSubject } from "./linearDrag";
import { dayAt, type LinearDrag } from "./useLinearDrag";

/** Every slot of a row, 0 to 36. */
const SLOT_LIST = Array.from({ length: SLOTS }, (_, slot) => slot);

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Row sizes: the day numbers' line and each lane of bars (Quarter, Year). */
const SIZES = {
  quarter: { head: 24, lane: 22, marks: 14 },
  year: { head: 18, lane: 16, marks: 10 },
};

export type LinearProps = {
  view: "quarter" | "year";
  range: DayRange;
  today: string;
  bars: LinearBar[];
  marks: Entry[];
  weekends: boolean;
  colorOf: ColorOf;
  /** The day whose popover is open, shaded. */
  openDay: string | null;
  /** A day was clicked: its popover opens beside it. */
  onDay: (day: string, anchor: HTMLElement) => void;
  /** Year: "+n" under a month name lists the bars that didn't fit. */
  onHidden: (row: MonthRow, anchor: HTMLElement) => void;
  /** The drag going on, if any: its days are shaded and the day under the pointer outlined. */
  drag: LinearDrag | null;
  /** A press on a bar or one of its ends, which becomes a drag once the pointer moves. */
  onDragStart: (subject: DragSubject, event: ReactPointerEvent) => void;
};

/**
 * Quarter and Year: the linear calendar. One row per month under repeating weekday letters,
 * a divider before every Monday; bars across days, and each day's marks under its own bars.
 * Weekends off shrinks Saturday and Sunday to 8 px strips that bars still pass through.
 */
export function LinearCalendar(props: LinearProps) {
  const { view, range, weekends } = props;
  const rows = linearMonths(range, props.bars, props.marks, view);
  const columns = `48px ${SLOT_LIST.map((slot) =>
    weekends || slot % 7 < 5 ? "minmax(0,1fr)" : "8px",
  ).join(" ")}`;

  return (
    <div className="flex h-full min-h-0">
      <section
        aria-label={view === "quarter" ? "Quarter" : "Year"}
        className={`linear-grid ${view === "quarter" ? "is-quarter" : "is-year"}`}
      >
        <div aria-hidden className="linear-head" style={{ gridTemplateColumns: columns }}>
          <span aria-hidden className="linear-head-label" />
          {SLOT_LIST.map((slot) => {
            const strip = !weekends && slot % 7 >= 5;
            return (
              <span key={slot} className={slot % 7 === 0 ? "is-monday" : ""}>
                {strip ? "" : LETTERS[slot % 7]}
              </span>
            );
          })}
        </div>
        {rows.map((row) => (
          <Month key={row.month} row={row} columns={columns} {...props} />
        ))}
      </section>
    </div>
  );
}

function Month({ row, columns, ...props }: LinearProps & { row: MonthRow; columns: string }) {
  const { view, today, weekends } = props;
  const size = SIZES[view];
  const lanes = row.lanes > 0 ? `repeat(${row.lanes}, ${size.lane}px) ` : "";
  const style: CSSProperties = {
    gridTemplateColumns: columns,
    gridTemplateRows: `${size.head}px ${lanes}minmax(0, 1fr)`,
    minHeight: size.head + row.lanes * size.lane + size.marks,
  };
  const name = MONTHS[Number(row.month.slice(5, 7)) - 1];

  return (
    <div data-month={row.month} className="linear-row" style={style}>
      <div className="linear-month">
        <span>{name}</span>
        {row.hidden.length > 0 && (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${row.hidden.length} more bars in ${name}`}
            onClick={(event) => props.onHidden(row, event.currentTarget)}
            className="linear-more"
          >
            +{row.hidden.length}
          </button>
        )}
      </div>
      {SLOT_LIST.map((slot) => {
        const day = slotDay(row, slot);
        const monday = slot % 7 === 0 ? " is-monday" : "";
        const strip = !weekends && slot % 7 >= 5;
        const column = { gridColumn: slot + 2 };
        if (!day)
          return (
            <div key={slot} aria-hidden className={`linear-day is-out${monday}`} style={column} />
          );
        if (strip)
          return (
            <div
              key={day}
              aria-hidden
              data-date={day}
              className={`linear-day is-strip${monday}`}
              style={column}
            />
          );
        const marks = row.marks.get(day) ?? [];
        const span = props.drag?.span;
        const state =
          (day === today ? " is-today" : day < today ? " is-past" : "") +
          (day === props.openDay ? " is-open" : "") +
          (span && span.start <= day && day <= span.end ? " is-in-range" : "") +
          (day === props.drag?.over ? " is-drop" : "");
        return (
          <button
            key={day}
            type="button"
            aria-label={`${dayDate(day)}${marks.length ? `, ${marks.length} ${marks.length === 1 ? "item" : "items"}` : ""}`}
            aria-current={day === today ? "date" : undefined}
            aria-haspopup="dialog"
            data-date={day}
            onClick={(event) => props.onDay(day, event.currentTarget)}
            className={`linear-day${monday}${state}`}
            style={column}
          >
            <span className="linear-num">
              <i>{Number(day.slice(8))}</i>
            </span>
            {marks.length > 0 && (
              <Marks
                marks={marks}
                view={view}
                today={today}
                colorOf={props.colorOf}
                row={row.markLane[slot] + 2}
              />
            )}
          </button>
        );
      })}
      {row.bars.map((placed) => (
        <Bar
          key={placed.bar.key}
          placed={placed}
          colorOf={props.colorOf}
          since={view === "quarter" && placed.cutStart && placed.bar.start < props.range.start}
          dragging={
            props.drag?.subject.kind === "bar" && props.drag.subject.bar.key === placed.bar.key
          }
          onDragStart={props.onDragStart}
        />
      ))}
    </div>
  );
}

/** A bar: an event (area tint, coloured edge) or a project (white, area border, folder). */
function Bar({
  placed,
  colorOf,
  since,
  dragging,
  onDragStart,
}: {
  placed: PlacedBar;
  colorOf: ColorOf;
  since: boolean;
  dragging: boolean;
  onDragStart: LinearProps["onDragStart"];
}) {
  const { bar, lane, from, to, cutStart, cutEnd } = placed;
  const item = bar.kind === "event" ? bar.entry.event : bar.project;
  // Bars of 1–2 days show only their colour, with the title on hover.
  const short = to - from < 2 && !cutStart && !cutEnd;
  const target: PanelTarget =
    bar.kind === "project"
      ? { kind: "project", id: bar.project.id }
      : {
          kind: "event",
          id: bar.entry.event.event_id,
          day: bar.entry.event.is_repeating ? bar.entry.event.occurrence_date : null,
        };
  const cancelled = bar.kind === "event" && bar.entry.event.is_cancelled;
  const draggable = canDragBar(bar);
  // An end can be dragged where the bar really ends, not where a month row cuts it.
  const grip = (how: "start" | "end") =>
    draggable && (
      <span
        aria-hidden
        data-edge={how}
        className={`linear-grip is-${how}`}
        onPointerDown={(event) => {
          event.stopPropagation();
          onDragStart({ kind: "bar", bar, how, grab: bar[how] }, event);
        }}
      />
    );
  return (
    <div
      data-area={areaDataAttribute(colorOf(item.life_area_id))}
      title={`${item.title} · ${spanLabel(bar.start, bar.end)}`}
      className={`linear-bar is-${bar.kind}${bar.past ? " is-past" : ""}${cutStart ? " is-cut-start" : ""}${cutEnd ? " is-cut-end" : ""}${cancelled ? " line-through" : ""}${draggable ? " is-draggable" : ""}${dragging ? " is-dragging" : ""}`}
      style={{ gridColumn: `${from + 2} / ${to + 3}`, gridRow: lane + 2 }}
      onPointerDown={
        draggable
          ? (event) =>
              onDragStart(
                {
                  kind: "bar",
                  bar,
                  how: "move",
                  grab: dayAt(event.clientX, event.clientY) ?? bar.start,
                },
                event,
              )
          : undefined
      }
    >
      {!cutStart && grip("start")}
      {bar.kind === "project" && !short && <Folder aria-hidden strokeWidth={2} />}
      <PanelLink stretched target={target} className="min-w-0 truncate">
        <span className={short ? "sr-only" : ""}>{item.title}</span>
      </PanelLink>
      {since && !short && <span className="linear-since">since {shortDate(bar.start)}</span>}
      {!cutEnd && grip("end")}
    </div>
  );
}

/**
 * A day's marks: event = a filled area square, task = an area checkbox outline (light when
 * finished), project due date = a tiny folder. They wrap, and end with "+n" when the day's box
 * is full.
 */
function Marks({
  marks,
  view,
  today,
  colorOf,
  row,
}: {
  marks: Entry[];
  view: "quarter" | "year";
  today: string;
  colorOf: ColorOf;
  row: number;
}) {
  const timeFormat = useTimeFormat();
  const ref = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((old) => (old?.width === width && old.height === height ? old : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { shown, more } = box
    ? marksThatFit(marks.length, box, view)
    : { shown: marks.length, more: 0 };

  return (
    <span ref={ref} aria-hidden className="linear-marks" style={{ gridRow: `${row} / -1` }}>
      {marks.slice(0, shown).map((entry) => (
        <Mark
          key={entry.key}
          entry={entry}
          today={today}
          colorOf={colorOf}
          time={(value) => formatTime(value, timeFormat)}
        />
      ))}
      {more > 0 && <span className="linear-marks-more">+{more}</span>}
    </span>
  );
}

function Mark({
  entry,
  today,
  colorOf,
  time,
}: {
  entry: Entry;
  today: string;
  colorOf: ColorOf;
  time: (value: string) => string;
}) {
  switch (entry.kind) {
    case "event": {
      const { event } = entry;
      const when = event.start_time ? time(event.start_time) : "All day";
      return (
        <i
          data-area={areaDataAttribute(colorOf(event.life_area_id))}
          title={`${event.title} · ${when}`}
          className={`linear-mark is-event${entry.start < today ? " is-past" : ""}`}
        />
      );
    }
    case "project":
      return (
        <i
          data-area={areaDataAttribute(colorOf(entry.project.life_area_id))}
          title={`${entry.project.title} · project due`}
          className="linear-mark is-project"
        >
          <Folder strokeWidth={2.5} />
        </i>
      );
    case "task":
      return (
        <i
          data-area={areaDataAttribute(colorOf(entry.task.life_area_id))}
          title={entry.task.title}
          className={`linear-mark is-task${entry.task.status === "todo" ? "" : " is-finished"}`}
        />
      );
    default:
      return null;
  }
}
