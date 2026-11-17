import { ChartLine, Folder } from "lucide-react";
import type { CSSProperties } from "react";
import type { LifeAreaRead, ProjectRead, RoutinePageStepRead } from "../../client/types.gen";
import type { Period } from "../../period";
import { areaDataAttribute } from "../life-areas/palette";
import type { DayState, HeatCell, Heatmap } from "./routine";

/** Squares grow as the period shrinks: a quarter or year is dense, a week is wide. */
const SIZE: Record<Period, string> = {
  year: "h-3 gap-0.5 [&>i]:rounded-[2px]",
  quarter: "h-3 gap-0.5 [&>i]:rounded-[2px]",
  month: "h-[18px] gap-[3px] [&>i]:rounded-[3px]",
  week: "h-7 gap-1.5 [&>i]:rounded-[5px]",
};

/** A step's day, in its area's colours (the routine key under the heatmap names them). */
const STEP_STATE: Record<DayState, string> = {
  done: "bg-(--area-solid)",
  skipped: "bg-(--area-border)",
  missed: "bg-(--color-neutral-200)",
  paused:
    "bg-[repeating-linear-gradient(135deg,var(--color-neutral-200)_0_1.5px,white_1.5px_3.5px)]",
  todo: "bg-white shadow-[inset_0_0_0_1.5px_var(--area-solid)]",
  upcoming: "bg-white shadow-[inset_0_0_0_1px_var(--color-neutral-300)]",
  // A 2 px dot in the middle.
  not_due: "bg-[radial-gradient(circle,var(--color-neutral-300)_1px,transparent_1.2px)] bg-center",
  none: "",
};

/** The All steps row: the share of due steps done, in the accent. */
const ALL_STATE: Partial<Record<DayState, string>> = {
  skipped: "bg-(--color-neutral-300)",
};

function cellStyle(cell: HeatCell, isAll: boolean, selected: string | null) {
  let className: string;
  let style: CSSProperties | undefined;
  const color = isAll ? "var(--color-brand-600)" : "var(--area-solid)";
  if (cell.state === "share") {
    const share = Math.max(cell.share, 0.08);
    if (cell.isCurrent && cell.day) {
      // Today in the All steps row: filled as far as it has got, outlined in the accent.
      className = "shadow-[inset_0_0_0_1.5px_var(--color-brand-600)]";
      style = {
        background: `color-mix(in oklab, ${color} ${Math.round(share * 100)}%, white)`,
      };
    } else {
      className = "";
      style = { background: color, opacity: share };
    }
  } else {
    className = (isAll && ALL_STATE[cell.state]) || STEP_STATE[cell.state];
  }
  if (cell.isCurrent && !cell.day)
    className += " outline-[1.5px] outline-offset-1 outline-(--text-primary) outline-solid";
  if (cell.day && cell.day === selected) {
    className += " outline-[1.5px] outline-offset-1 outline-(--color-neutral-900) outline-solid";
  }
  return { className, style };
}

function Cells({
  cells,
  columns,
  period,
  isAll,
  selected,
  onSelect,
}: {
  cells: HeatCell[];
  columns: number;
  period: Period;
  isAll: boolean;
  selected: string | null;
  onSelect: (day: string) => void;
}) {
  return (
    <div
      className={`grid ${SIZE[period]}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cells.map((cell) => {
        const { className, style } = cellStyle(cell, isAll, selected);
        const { day } = cell;
        return (
          // Squares are pointer shortcuts to the Day card; its Today button and the
          // period switch reach the same days from the keyboard.
          // biome-ignore lint/a11y/noStaticElementInteractions: see above
          // biome-ignore lint/a11y/useKeyWithClickEvents: see above
          <i
            key={cell.key}
            title={cell.label}
            onClick={day ? () => onSelect(day) : undefined}
            className={`block h-full ${day ? "cursor-pointer hover:outline-[1.5px] hover:outline-offset-1 hover:outline-(--color-neutral-500) hover:outline-solid" : ""} ${className}`}
            style={style}
          />
        );
      })}
    </div>
  );
}

const ROW = "grid grid-cols-[240px_minmax(0,1fr)] items-center gap-3";

/** A step's name with its round marker, then its project and the metric it feeds. */
export function StepLabel({
  row,
  project,
}: {
  row: RoutinePageStepRead;
  project: ProjectRead | undefined;
}) {
  return (
    <span className="flex min-w-0 flex-col pr-2">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-(--area-solid)" />
        <span className="truncate text-[13px] leading-[18px] font-medium text-(--text-primary)">
          {row.step.title}
        </span>
      </span>
      {(project || row.metric) && (
        <span className="flex min-w-0 gap-2.5 overflow-hidden pl-5 text-[11px] leading-4 whitespace-nowrap text-(--text-tertiary)">
          {project && (
            <span className="inline-flex min-w-0 items-center gap-[3px]">
              <Folder aria-hidden className="size-[11px] shrink-0 text-(--area-solid)" />
              <span className="truncate">{project.title}</span>
            </span>
          )}
          {row.metric && (
            <span
              className="inline-flex min-w-0 items-center gap-[3px]"
              title={`Feeds ${row.metric.title}`}
            >
              <ChartLine aria-hidden className="size-[11px] shrink-0" />
              <span className="truncate">{row.metric.title}</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/** The Steps card's body: day labels, the All steps row, one row per step, and the key. */
export function StepsHeatmap({
  map,
  period,
  selected,
  onSelect,
  areas,
  projects,
}: {
  map: Heatmap;
  period: Period;
  selected: string | null;
  onSelect: (day: string) => void;
  areas: LifeAreaRead[];
  projects: ProjectRead[];
}) {
  const isDaily = period === "week" || period === "month";
  return (
    <div className="flex flex-col">
      <div className={ROW}>
        <span />
        <div className="relative isolate h-4 text-[11px] text-(--text-tertiary)">
          {map.header.map((label) =>
            isDaily ? (
              <span
                key={label.key}
                className={`absolute top-0 text-center font-medium leading-4 ${
                  label.key === map.todayKey ? "text-white" : ""
                }`}
                style={{ left: `${label.left}%`, width: `${label.width}%` }}
              >
                {label.key === map.todayKey && (
                  <span
                    aria-hidden
                    className="absolute inset-y-[-1px] left-1/2 -z-10 w-[min(100%,48px)] -translate-x-1/2 rounded-(--radius-4) bg-(--color-brand-600)"
                  />
                )}
                {label.label}
                {label.bold && (
                  <b
                    className={`ml-1 font-semibold ${label.key === map.todayKey ? "text-white" : "text-(--text-secondary)"}`}
                  >
                    {label.bold}
                  </b>
                )}
              </span>
            ) : (
              <span
                key={label.key}
                className="absolute top-0 border-l border-(--border-default) pl-1 leading-4"
                style={{ left: `${label.left}%` }}
              >
                {label.label}
              </span>
            ),
          )}
        </div>
      </div>

      <div className={`${ROW} mt-1.5 border-b border-(--color-neutral-100) pb-1.5`}>
        <span className="text-[13px] leading-[18px] font-semibold text-(--text-primary)">
          All steps
        </span>
        <Cells
          cells={map.all}
          columns={map.columns}
          period={period}
          isAll
          selected={selected}
          onSelect={onSelect}
        />
      </div>

      {map.steps.map(({ row, cells }) => (
        <div
          key={row.step.id}
          data-area={areaDataAttribute(
            areas.find((area) => area.id === row.step.life_area_id)?.color,
          )}
          className={`${ROW} mt-1.5`}
        >
          <StepLabel
            row={row}
            project={projects.find((project) => project.id === row.step.project_id)}
          />
          <Cells
            cells={cells}
            columns={map.columns}
            period={period}
            isAll={false}
            selected={selected}
            onSelect={onSelect}
          />
        </div>
      ))}

      <RoutineKey />
    </div>
  );
}

const KEY: [string, string][] = [
  ["Done", "bg-(--color-neutral-700)"],
  ["Skipped", "bg-(--color-neutral-400)"],
  ["Missed", "bg-(--color-neutral-200)"],
  ["Paused", STEP_STATE.paused],
  ["Today, to do", "bg-white shadow-[inset_0_0_0_1.5px_var(--color-neutral-700)]"],
  ["Upcoming", STEP_STATE.upcoming],
  ["Not due", STEP_STATE.not_due],
];

/** The routine key: the one legend the style guide allows. */
function RoutineKey() {
  return (
    <ul aria-label="Key" className="mt-3 flex flex-wrap gap-4 text-xs text-(--text-secondary)">
      {KEY.map(([label, className]) => (
        <li key={label} className="flex items-center gap-1.5">
          <i aria-hidden className={`block size-2.5 rounded-[2px] ${className}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
