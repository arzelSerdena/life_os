import type { DateRangeRead, OutcomeRead } from "../../../client/types.gen";
import type { Period } from "../../../period";
import { daysBetween, formatAmount, parts, shortDate, shortMonth, type Tone } from "./format";

const WIDTH = 300;
const LEFT = 4;
const RIGHT = 296;
const TOP = 6;
const BOTTOM = 50;
const LINE_COLOR: Record<Tone, string> = {
  good: "var(--color-positive-600)",
  bad: "var(--color-negative-600)",
  neutral: "var(--color-neutral-400)",
};
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type MetricChartProps = {
  outcome: OutcomeRead;
  range: DateRangeRead;
  today: string;
  period: Period;
  tone: Tone;
};

/**
 * One chart style for every metric: a smooth line through the finished points, the current
 * point hollow with no line to it, the target as a flat line, ◆ at a reach-by deadline,
 * and a mark for today.
 */
export function MetricChart({ outcome, range, today, period, tone }: MetricChartProps) {
  const totalDays = daysBetween(range.start, range.end) + 1;
  const x = (date: string) =>
    LEFT +
    ((RIGHT - LEFT) * (clampDays(daysBetween(range.start, date), totalDays) + 0.5)) / totalDays;

  const points = outcome.points
    .filter((point) => point.value !== null)
    .map((point) => {
      const start = laterDate(point.start, range.start);
      const end = earlierDate(point.end, range.end);
      return { ...point, x: (x(start) + x(end)) / 2, value: point.value as number };
    });
  const target = outcome.target?.target_value;
  const values = [...points.map((point) => point.value), ...(target === undefined ? [] : [target])];
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (!Number.isFinite(low)) {
    low = 0;
    high = 1;
  }
  if (low === high) {
    low -= 1;
    high += 1;
  }
  const pad = (high - low) * 0.12;
  const y = (value: number) =>
    BOTTOM - ((BOTTOM - TOP) * (value - (low - pad))) / (high + pad - (low - pad));

  const lined = points
    .filter((point) => !point.is_current)
    .map((point) => ({ x: point.x, y: y(point.value) }));
  const current = points.find((point) => point.is_current);
  const line = smoothPath(lined);
  const color = LINE_COLOR[tone];
  const todayX = today >= range.start && today <= range.end ? x(today) : null;
  const deadline =
    outcome.target?.kind === "reach_by" && outcome.target.end_date
      ? outcome.target.end_date > range.end
        ? RIGHT
        : x(outcome.target.end_date)
      : null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} 64`}
      role="img"
      aria-label={chartLabel(outcome)}
      className="block h-auto w-full overflow-visible"
    >
      {ticks(range, period).map((tick, index) => (
        <g key={tick.date}>
          {index > 0 && (
            <line x1={x(tick.date)} x2={x(tick.date)} y1={TOP} y2={BOTTOM} stroke="#f1f2f4" />
          )}
          <text
            x={index === 0 ? LEFT : x(tick.date) + 3}
            y={60}
            fontSize={9}
            fill="var(--text-tertiary)"
          >
            {tick.label}
          </text>
        </g>
      ))}
      {target !== undefined && (
        <line
          x1={LEFT}
          x2={RIGHT}
          y1={y(target)}
          y2={y(target)}
          stroke="var(--color-neutral-500)"
        />
      )}
      {lined.length > 1 && (
        <>
          <path
            d={`${line} L${lined[lined.length - 1].x},${BOTTOM} L${lined[0].x},${BOTTOM}Z`}
            fill={color}
            opacity={0.08}
          />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {lined.map((point) => (
        <circle key={point.x} cx={point.x} cy={point.y} r={2.5} fill={color} />
      ))}
      {current && (
        <circle
          cx={current.x}
          cy={y(current.value)}
          r={4}
          fill="#fff"
          stroke={color}
          strokeWidth={2}
        />
      )}
      {todayX !== null && (
        <line x1={todayX} x2={todayX} y1={TOP} y2={BOTTOM} stroke="var(--color-neutral-900)" />
      )}
      {deadline !== null && target !== undefined && (
        <path
          d={`M${deadline},${y(target) - 5} l5,5 -5,5 -5,-5z`}
          fill="#fff"
          stroke="var(--color-neutral-600)"
          strokeWidth={1.5}
        />
      )}
    </svg>
  );
}

/** ISO dates compare as strings. */
function laterDate(a: string, b: string): string {
  return [a, b].sort()[1];
}

function earlierDate(a: string, b: string): string {
  return [a, b].sort()[0];
}

function clampDays(days: number, total: number): number {
  return Math.min(Math.max(days, 0), total - 1);
}

/** Month starts for a quarter or year, Mondays for a month, every day for a week. */
function ticks(range: DateRangeRead, period: Period): { date: string; label: string }[] {
  const found: { date: string; label: string }[] = [];
  const start = parts(range.start);
  const totalDays = daysBetween(range.start, range.end) + 1;
  for (let offset = 0; offset < totalDays; offset += 1) {
    const day = new Date(Date.UTC(start.year, start.month, start.day + offset));
    const date = day.toISOString().slice(0, 10);
    if (period === "week") {
      found.push({ date, label: WEEKDAYS[(day.getUTCDay() + 6) % 7] });
    } else if (period === "month") {
      if (offset === 0 || day.getUTCDay() === 1) found.push({ date, label: `${day.getUTCDate()}` });
    } else if (offset === 0 || day.getUTCDate() === 1) {
      found.push({ date, label: shortMonth(date) });
    }
  }
  return found;
}

/** A smooth curve through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 2] ?? points[index - 1];
    const from = points[index - 1];
    const to = points[index];
    const after = points[index + 1] ?? to;
    const c1x = from.x + (to.x - before.x) / 6;
    const c1y = from.y + (to.y - before.y) / 6;
    const c2x = to.x - (after.x - from.x) / 6;
    const c2y = to.y - (after.y - from.y) / 6;
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${to.x},${to.y}`;
  }
  return path;
}

function chartLabel(outcome: OutcomeRead): string {
  const values = outcome.points
    .filter((point) => point.value !== null)
    .map(
      (point) => `${shortDate(point.start)}: ${formatAmount(point.value as number, outcome.unit)}`,
    );
  const target = outcome.target
    ? `, target ${formatAmount(outcome.target.target_value, outcome.unit)}`
    : "";
  return `${outcome.title}${target}. ${values.join(", ") || "No entries yet"}`;
}
