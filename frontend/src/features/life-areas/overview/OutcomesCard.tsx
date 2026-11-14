import { ChartLine } from "lucide-react";
import { useState } from "react";
import type { LifeAreaRead, OutcomeRead, OverviewRead } from "../../../client/types.gen";
import { SectionCard } from "../../../components/SectionCard";
import type { Period } from "../../../period";
import { areaDataAttribute } from "../palette";
import { CardMenu, type MenuOption } from "./CardMenu";
import {
  daysBetween,
  formatAmount,
  formatNumber,
  isCurrency,
  monthName,
  outcomeTone,
  plural,
  shortDate,
  targetPeriodName,
} from "./format";
import { MetricChart } from "./MetricChart";

type Sort = "area" | "behind" | "name";
type Show = "good" | "bad" | "untargeted";

/** Every area-owned metric as a small tile, grouped into one grey panel per area. */
export function OutcomesCard({ overview }: { overview: OverviewRead }) {
  const [sort, setSort] = useState<Sort>("area");
  const [shown, setShown] = useState<Set<Show>>(new Set(["good", "bad", "untargeted"]));
  const [hiddenAreas, setHiddenAreas] = useState<Set<number>>(new Set());
  const [grouped, setGrouped] = useState(true);

  const { outcomes, life_areas: areas } = overview;
  const good = outcomes.filter((o) => outcomeTone(o.status) === "good").length;
  const bad = outcomes.filter((o) => outcomeTone(o.status) === "bad").length;
  const owners = new Set(outcomes.map((o) => o.life_area_id)).size;
  const description =
    outcomes.length === 0
      ? "No metrics yet"
      : `${plural(outcomes.length, "metric")} owned by ${plural(owners, "area")} · ${good} on track or met, ${bad} behind`;

  const visible = sortOutcomes(
    outcomes.filter((o) => !hiddenAreas.has(o.life_area_id) && shown.has(category(o))),
    sort,
    areas,
  );

  const menu: MenuOption[] = [
    { section: "Sort by", id: "sort:area", label: "Area order", selected: sort === "area" },
    { section: "Sort by", id: "sort:behind", label: "Behind first", selected: sort === "behind" },
    { section: "Sort by", id: "sort:name", label: "Name", selected: sort === "name" },
    {
      section: "Show",
      id: "show:good",
      label: "On track or met",
      selected: shown.has("good"),
      check: true,
    },
    { section: "Show", id: "show:bad", label: "Behind", selected: shown.has("bad"), check: true },
    {
      section: "Show",
      id: "show:untargeted",
      label: "Without a target",
      selected: shown.has("untargeted"),
      check: true,
    },
    ...areas.map((area) => ({
      section: "Areas",
      id: `area:${area.id}`,
      label: area.title,
      selected: !hiddenAreas.has(area.id),
      check: true,
      area: area.color,
    })),
    { section: "", id: "group", label: "Group by area", selected: grouped, check: true },
  ];

  const onMenu = (id: string) => {
    const [kind, value] = id.split(":");
    if (kind === "sort") setSort(value as Sort);
    if (kind === "show") setShown(toggled(shown, value as Show));
    if (kind === "area") setHiddenAreas(toggled(hiddenAreas, Number(value)));
    if (kind === "group") setGrouped(!grouped);
  };

  const period = overview.period as Period;
  return (
    <SectionCard
      title="Outcomes"
      description={description}
      action={<CardMenu label="Outcomes" options={menu} onSelect={onMenu} />}
    >
      {grouped ? (
        <div className="grid grid-flow-row-dense grid-cols-5 gap-3">
          {areas
            .filter((area) => !hiddenAreas.has(area.id))
            .map((area) => {
              const own = visible.filter((o) => o.life_area_id === area.id);
              const total = outcomes.filter((o) => o.life_area_id === area.id);
              if (total.length > 0 && own.length === 0) return null;
              return (
                <AreaPanel key={area.id} area={area} outcomes={own} all={total}>
                  {own.length === 0 ? (
                    <NoMetrics />
                  ) : (
                    own.map((outcome) => (
                      <MetricTile
                        key={outcome.metric_id}
                        outcome={outcome}
                        overview={overview}
                        period={period}
                      />
                    ))
                  )}
                </AreaPanel>
              );
            })}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {visible.map((outcome) => (
            <MetricTile
              key={outcome.metric_id}
              outcome={outcome}
              overview={overview}
              period={period}
              area={areas.find((area) => area.id === outcome.life_area_id)}
            />
          ))}
        </div>
      )}
      {visible.length === 0 && outcomes.length > 0 && (
        <p className="py-2 type-meta text-(--text-tertiary)">No metrics match these filters.</p>
      )}
    </SectionCard>
  );
}

function AreaPanel({
  area,
  outcomes,
  all,
  children,
}: {
  area: LifeAreaRead;
  outcomes: OutcomeRead[];
  all: OutcomeRead[];
  children: React.ReactNode;
}) {
  const good = all.filter((o) => outcomeTone(o.status) === "good").length;
  const bad = all.filter((o) => outcomeTone(o.status) === "bad").length;
  const summary =
    all.length === 0
      ? "No metrics"
      : [plural(all.length, "metric"), good && `${good} on track`, bad && `${bad} behind`]
          .filter(Boolean)
          .join(" · ");
  const span = Math.min(Math.max(outcomes.length, 1), 5);
  return (
    <div
      data-area={areaDataAttribute(area.color)}
      style={{ gridColumn: `span ${span}` }}
      className="grid grid-cols-subgrid content-start gap-x-2 self-start rounded-(--radius-12) border border-[#eef0f3] bg-neutral-50 px-2 pt-1.5 pb-2"
    >
      <h3 className="col-span-full mb-1 flex h-7 min-w-0 items-center gap-2 pl-0.5">
        <span aria-hidden className="size-2.5 shrink-0 rounded-[2px] bg-(--area-solid)" />
        <span className="truncate text-sm font-semibold text-(--text-primary)">{area.title}</span>
        <span className="truncate type-meta font-normal text-(--text-tertiary)">{summary}</span>
      </h3>
      {children}
    </div>
  );
}

function NoMetrics() {
  return (
    <div className="flex min-h-[120px] flex-col justify-center gap-1.5 rounded-(--radius-8) border border-dashed border-(--border-default) bg-(--bg-surface) px-2.5 py-2 text-xs text-(--text-tertiary)">
      <ChartLine aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />
      <span>No metrics yet</span>
    </div>
  );
}

function MetricTile({
  outcome,
  overview,
  period,
  area,
}: {
  outcome: OutcomeRead;
  overview: OverviewRead;
  period: Period;
  /** Shown on the tile when tiles aren't grouped by area. */
  area?: LifeAreaRead;
}) {
  const tone = outcomeTone(outcome.status);
  const { number, unit, context } = valueLine(outcome, overview);
  return (
    <article
      aria-label={outcome.title}
      data-area={area ? areaDataAttribute(area.color) : undefined}
      className="flex min-w-0 flex-col rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-2.5 py-2"
    >
      <h4 className="truncate text-[13px] leading-[18px] font-semibold text-(--text-primary)">
        {outcome.title}
      </h4>
      {area && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-(--text-tertiary)">
          <span aria-hidden className="size-1.5 rounded-[2px] bg-(--area-solid)" />
          {area.title}
        </p>
      )}
      <p className="mt-1 mb-0.5 flex items-baseline gap-1 overflow-hidden whitespace-nowrap">
        <span className="text-2xl leading-8 font-semibold text-(--text-primary) tabular-nums">
          {number}
        </span>
        {unit && (
          <span className="mr-1 text-[13px] font-medium text-(--text-tertiary)">{unit}</span>
        )}
        <span className="truncate text-[11px] text-(--text-tertiary)">{context}</span>
      </p>
      <MetricChart
        outcome={outcome}
        range={overview.range}
        today={overview.today}
        period={period}
        tone={tone}
      />
      <p className="mt-1 text-[11px] leading-[14px] text-(--text-tertiary)">
        {summaryLine(outcome, overview)}
      </p>
    </article>
  );
}

/** The big number, its unit, and what it is measured against. */
function valueLine(
  outcome: OutcomeRead,
  overview: OverviewRead,
): { number: string; unit: string; context: string } {
  const { value, unit, target } = outcome;
  const currency = isCurrency(unit);
  const number =
    value === null ? "–" : currency ? `${unit}${formatNumber(value)}` : formatNumber(value);
  const shownUnit = currency || !unit ? "" : unit;
  const amount = (n: number) => formatAmount(n, unit);

  if (value === null) return { number, unit: shownUnit, context: "no entries yet" };
  if (target?.kind === "per_period" && target.period) {
    const point = outcome.points.find((p) => p.is_current) ?? outcome.points.at(-1);
    const when = point ? targetPeriodName(target.period, point.start, point.is_current) : "";
    if (outcome.aggregation === "sum") {
      return { number, unit: shownUnit, context: `of ${amount(target.target_value)} ${when}` };
    }
    return {
      number,
      unit: shownUnit,
      context: `${outcome.aggregation} ${when} · target ${amount(target.target_value)}`,
    };
  }
  if (target?.kind === "reach_by" && target.end_date) {
    const by = shortDate(target.end_date);
    const prefix =
      outcome.aggregation === "sum" && outcome.direction === "higher" ? "of" : "target";
    return {
      number,
      unit: shownUnit,
      context: `${prefix} ${amount(target.target_value)} by ${by}`,
    };
  }
  const point = outcome.points.at(-1);
  const step = stepName(overview.period as Period);
  const context = point?.is_current
    ? `this ${step}${outcome.aggregation === "sum" ? " so far" : ""}`
    : "";
  return { number, unit: shownUnit, context };
}

/** One line under the chart saying how it's going. */
function summaryLine(outcome: OutcomeRead, overview: OverviewRead): string {
  const { target, value, unit, direction, status } = outcome;
  const lower = direction === "lower" ? "Lower is better · " : "";
  if (target?.kind === "per_period" && target.period) {
    if (outcome.finished_periods > 0) {
      return `${outcome.met_periods} of ${plural(outcome.finished_periods, target.period)} met`;
    }
    const current = outcome.points.find((p) => p.is_current);
    if (current) {
      const left = daysBetween(overview.today, current.end);
      return `${lower}${plural(left, "day")} left this ${target.period}`;
    }
    return "No finished periods yet";
  }
  if (target?.kind === "reach_by" && target.end_date) {
    if (status === "met") return "Reached";
    if (status === "missed") return `Missed on ${shortDate(target.end_date)}`;
    const left = Math.max(daysBetween(overview.today, target.end_date), 0);
    if (outcome.aggregation === "sum" && direction === "higher" && value !== null) {
      const needed = Math.max(target.target_value - value, 0);
      return `Needs ${formatAmount(needed, unit)} more in ${plural(left, "day")}`;
    }
    return `${lower}${status === "on_track" ? "ahead of pace" : "behind pace"}`;
  }
  const previous = outcome.points.at(-2);
  if (value === null || outcome.previous_value === null || !previous) {
    return direction === "lower" ? "Lower is better" : "No earlier entries";
  }
  const before = previousName(overview.period as Period, previous.start);
  const change =
    value === outcome.previous_value
      ? "same as"
      : value < outcome.previous_value
        ? "down from"
        : "up from";
  const text = `${change} ${before}`;
  return lower ? `${lower}${text}` : text.charAt(0).toUpperCase() + text.slice(1);
}

function stepName(period: Period): string {
  return { week: "day", month: "week", quarter: "month", year: "month" }[period];
}

function previousName(period: Period, start: string): string {
  if (period === "week") return shortDate(start);
  if (period === "month") return `the week of ${shortDate(start)}`;
  return monthName(start);
}

function category(outcome: OutcomeRead): Show {
  if (outcome.target === null) return "untargeted";
  return outcomeTone(outcome.status) === "bad" ? "bad" : "good";
}

function sortOutcomes(outcomes: OutcomeRead[], sort: Sort, areas: LifeAreaRead[]): OutcomeRead[] {
  const areaIndex = (o: OutcomeRead) => areas.findIndex((area) => area.id === o.life_area_id);
  const sorted = [...outcomes];
  if (sort === "area") sorted.sort((a, b) => areaIndex(a) - areaIndex(b));
  if (sort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "behind") {
    const rank = (o: OutcomeRead) => (outcomeTone(o.status) === "bad" ? 0 : 1);
    sorted.sort((a, b) => rank(a) - rank(b) || areaIndex(a) - areaIndex(b));
  }
  return sorted;
}

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
