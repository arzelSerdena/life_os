import { CalendarDays, ChartLine, ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import type {
  AreaPageRead,
  AreaProjectRead,
  DateRangeRead,
  OutcomeRead,
} from "../../../client/types.gen";
import { CardEmpty, SectionCard } from "../../../components/SectionCard";
import { type Period, periodInSentence } from "../../../period";
import { PanelLink } from "../../detail-panel/PanelLink";
import { type ItemTarget, itemMenuProps } from "../../item-menu/target";
import { formatValue } from "../../metrics/format";
import { plural, shortDate } from "../overview/format";
import { addDays, earlierDate, laterDate, scaleTicks, timeScale } from "./timeScale";

export const LABEL_WIDTH = "140px";

/** Projects, events and metrics across the period, with a mark for today. On a project page
 * the one project is the project itself. */
export function TimelineCard({
  page,
  onProjectPage = false,
}: {
  page: AreaPageRead;
  onProjectPage?: boolean;
}) {
  const period = page.period as Period;
  const name = periodInSentence(period, page.range.start);
  const { projects, events, metrics } = page;
  const scale = timeScale(page.range);
  const description = [
    plural(projects.length, "project"),
    plural(events.length, "event"),
    plural(metrics.length, "metric"),
  ].join(" · ");

  if (projects.length + events.length + metrics.length === 0) {
    return (
      <SectionCard title="Timeline">
        <CardEmpty>No projects, events or metrics in {name}.</CardEmpty>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Timeline" description={`${description} in ${name}`}>
      <div className="relative">
        <TimelineScale range={page.range} period={period} />

        <Section title={onProjectPage ? "Project" : "Projects"} count={projects.length}>
          {projects.map((project) => (
            <Row key={project.id} label="" item={{ kind: "project", id: project.id }}>
              <PanelLink stretched target={{ kind: "project", id: project.id }} className="sr-only">
                {project.title}
              </PanelLink>
              <ProjectBar project={project} range={page.range} />
            </Row>
          ))}
        </Section>

        <Section title="Events" count={events.length}>
          {Array.from(
            events
              .reduce((map, ev) => {
                const list = map.get(ev.event_id) ?? [];
                list.push(ev);
                map.set(ev.event_id, list);
                return map;
              }, new Map<number, typeof events>())
              .values(),
          ).map((occurrences) => {
            const first = occurrences[0];
            const labelEl = (
              <PanelLink
                target={{
                  kind: "event",
                  id: first.event_id,
                  day: first.is_repeating ? first.occurrence_date : null,
                }}
                className="flex min-w-0 items-center gap-1.5 text-xs text-(--text-primary)"
              >
                <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-(--area-solid) text-white">
                  <CalendarDays aria-hidden className="size-3" strokeWidth={2.5} />
                </span>
                <span className="truncate">{first.title}</span>
              </PanelLink>
            );
            return (
              <Row
                key={first.event_id}
                label={occurrences.length > 1 ? labelEl : ""}
                item={{
                  kind: "event",
                  id: first.event_id,
                  day: first.is_repeating ? first.occurrence_date : null,
                }}
              >
                {occurrences.length > 1 ? (
                  occurrences.map((ev) => {
                    const left = scale.at(laterDate(ev.start_date, page.range.start));
                    return (
                      <PanelLink
                        key={ev.occurrence_date}
                        target={{
                          kind: "event",
                          id: ev.event_id,
                          day: ev.is_repeating ? ev.occurrence_date : null,
                        }}
                        className="absolute top-2.5 size-2 -translate-x-1/2 rounded-[2px] bg-(--area-solid) hover:scale-125"
                      >
                        <span
                          className="sr-only"
                          style={{ left: `${left}%` }}
                        >{`${ev.title}, ${shortDate(ev.start_date)}`}</span>
                      </PanelLink>
                    );
                  })
                ) : (
                  <>
                    {first.end_date > first.start_date && (
                      <span
                        aria-hidden
                        className="absolute top-2 h-4 rounded-(--radius-4) bg-(--area-tint-active)"
                        style={{
                          left: `${scale.at(laterDate(first.start_date, page.range.start))}%`,
                          width: `${
                            scale.after(earlierDate(first.end_date, page.range.end)) -
                            scale.at(laterDate(first.start_date, page.range.start))
                          }%`,
                        }}
                      />
                    )}
                    <span
                      className="absolute top-1.5"
                      style={{
                        left: `${scale.at(laterDate(first.start_date, page.range.start))}%`,
                      }}
                      title={`${first.title}, ${shortDate(first.start_date)}`}
                    >
                      {labelEl}
                    </span>
                  </>
                )}
              </Row>
            );
          })}
        </Section>

        <Section title="Metrics" count={metrics.length}>
          {metrics.map((outcome) => (
            <Row
              key={outcome.metric_id}
              item={{ kind: "metric", id: outcome.metric_id }}
              label={
                <PanelLink
                  target={{ kind: "metric", id: outcome.metric_id }}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <ChartLine
                    aria-hidden
                    className="size-3.5 shrink-0 text-(--area-solid)"
                    strokeWidth={2}
                  />
                  <span className="truncate">{outcome.title}</span>
                </PanelLink>
              }
            >
              <MetricLane outcome={outcome} page={page} />
            </Row>
          ))}
        </Section>

        <TodayLine range={page.range} today={page.today} />
      </div>
    </SectionCard>
  );
}

/** Month names along the top, and smaller ticks under them, right of the label column. */
export function TimelineScale({ range, period }: { range: DateRangeRead; period: Period }) {
  const scale = timeScale(range);
  const { months, ticks } = scaleTicks(range, period);
  return (
    <div className="grid" style={{ gridTemplateColumns: `${LABEL_WIDTH} 1fr` }}>
      <span />
      <div className="relative h-10 border-b border-(--border-default) text-xs">
        {months.map((month) => (
          <span
            key={month.date}
            className="absolute top-0 border-l border-(--border-default) pl-1 font-medium text-(--text-secondary)"
            style={{ left: `${scale.at(month.date)}%` }}
          >
            {month.label}
          </span>
        ))}
        {ticks.map((tick) => (
          <span
            key={tick.date}
            className="absolute top-5 -translate-x-1/2 text-(--text-tertiary)"
            style={{ left: `${scale.at(tick.date) + 50 / scale.total}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The black Today line across a timeline whose parent is `relative`; none outside the range. */
export function TodayLine({ range, today }: { range: DateRangeRead; today: string }) {
  if (today < range.start || today > range.end) return null;
  const scale = timeScale(range);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 bottom-0 grid"
      style={{ left: LABEL_WIDTH, right: 0 }}
    >
      <span
        className="absolute top-0 bottom-0 w-px bg-(--text-primary)"
        style={{ left: `${scale.at(today) + 50 / scale.total}%` }}
      >
        <span className="absolute -top-0.5 -translate-x-1/2 rounded-[4px] bg-(--text-primary) px-1.5 type-tag font-semibold text-(--bg-surface)">
          Today
        </span>
      </span>
    </div>
  );
}

type BarProject = Pick<
  AreaProjectRead,
  "title" | "status" | "start" | "due_date" | "completed_on" | "done" | "total"
>;

/** One project's bar from its start to its due date (fading out without one) or the day it
 * was finished (grey), filled to its progress. Inside a `relative` lane, in an area's
 * `data-area`. Nothing when the project falls outside the range. */
export function ProjectBar({ project, range }: { project: BarProject; range: DateRangeRead }) {
  const scale = timeScale(range);
  const start = laterDate(project.start, range.start);
  const end = project.completed_on ?? project.due_date ?? range.end;
  // A project finished before its recorded start still shows as a one-day bar.
  const barStart = earlierDate(start, end);
  if (end < range.start || barStart > range.end) return null;
  const left = scale.at(barStart);
  const width = Math.max(scale.after(earlierDate(end, range.end)) - left, 2);
  const share = project.total ? Math.round((project.done / project.total) * 100) : 0;
  const done = project.status === "done";
  return (
    <div
      className={`absolute top-1 flex h-[22px] items-center overflow-hidden rounded-(--radius-4) px-2 text-xs ${
        done
          ? "bg-(--bg-pressed) text-(--text-secondary)"
          : "bg-(--area-tint-active) text-(--area-ink)"
      }`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        maskImage:
          project.due_date || done
            ? undefined
            : "linear-gradient(to right, black 75%, transparent)",
      }}
      title={`${project.title}: ${project.done} of ${project.total} tasks done${
        project.due_date ? `, due ${shortDate(project.due_date)}` : ""
      }`}
    >
      {!done && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-(--area-border)"
          style={{ width: `${share}%` }}
        />
      )}
      <span className="relative truncate">{project.title}</span>
      {!done && project.total > 0 && (
        <span className="relative ml-auto pl-2 font-semibold">{share}%</span>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  if (count === 0) return null;
  return (
    <div className="border-b border-(--border-default) py-2 last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 items-center gap-1.5 rounded-(--radius-6) type-body font-semibold text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
      >
        <ChevronDown
          aria-hidden
          className={`size-3 text-(--text-tertiary) transition-transform ${isOpen ? "" : "-rotate-90"}`}
          strokeWidth={2}
        />
        {title}
      </button>
      {isOpen && children}
    </div>
  );
}

/** One lane; right-clicking it (label or bar) opens its item's ⋯ menu. */
function Row({
  label,
  item,
  children,
}: {
  label: ReactNode;
  item: ItemTarget;
  children: ReactNode;
}) {
  return (
    <div
      {...itemMenuProps(item)}
      className="grid h-7 items-center"
      style={{ gridTemplateColumns: `${LABEL_WIDTH} 1fr` }}
    >
      <span className="min-w-0 overflow-hidden pr-2 type-body text-(--text-primary)">{label}</span>
      <div className="relative h-full overflow-hidden">{children}</div>
    </div>
  );
}

/** A metric's targets: one segment per target period, one bar to a reach-by deadline, or a
 * dashed line when it has no target. */
function MetricLane({ outcome, page }: { outcome: OutcomeRead; page: AreaPageRead }) {
  const scale = timeScale(page.range);
  const target = outcome.target;
  if (!target) {
    return (
      <span className="absolute inset-x-0 top-1/2 flex items-center gap-2 type-tag text-(--text-tertiary)">
        <span>No target</span>
        <span className="flex-1 border-t border-dashed border-(--border-strong)" />
      </span>
    );
  }
  if (target.kind === "reach_by" && target.end_date) {
    const start = laterDate(target.start_date, page.range.start);
    const left = scale.at(start);
    const right = target.end_date > page.range.end ? 100 : scale.after(target.end_date);
    const share = outcome.value === null ? 0 : Math.min(outcome.value / target.target_value, 1);
    return (
      <>
        <span
          className="absolute top-1.5 h-4 overflow-hidden rounded-[4px] bg-(--area-tint-active)"
          style={{ left: `${left}%`, width: `${right - left}%` }}
          title={`${outcome.title}: ${formatValue(outcome.value ?? 0, outcome)} of ${formatValue(target.target_value, outcome)}`}
        >
          <span className="block h-full bg-(--area-border)" style={{ width: `${share * 100}%` }} />
        </span>
        {target.end_date <= page.range.end && (
          <span
            aria-hidden
            className="absolute top-2 size-2.5 -translate-x-1/2 rotate-45 border-[1.5px] border-(--text-secondary) bg-(--bg-surface)"
            style={{ left: `${right}%` }}
          />
        )}
      </>
    );
  }
  // Every period: the started periods come from the API; later ones are outlined.
  const segments = outcome.points.map((point) => ({
    start: point.start,
    end: point.end,
    fill:
      point.status === "met"
        ? 1
        : point.value === null
          ? 0
          : Math.min(point.value / target.target_value, 1),
    upcoming: false,
    label: `${shortDate(point.start)}: ${formatValue(point.value ?? 0, outcome)}${point.status === "met" ? ", met" : ""}`,
  }));
  let next = segments.length ? addDays(segments[segments.length - 1].end, 1) : target.start_date;
  while (next <= page.range.end && (!target.end_date || next <= target.end_date)) {
    const end = periodEnd(next, target.period ?? "week");
    segments.push({
      start: next,
      end,
      fill: 0,
      upcoming: true,
      label: `${shortDate(next)}: upcoming`,
    });
    next = addDays(end, 1);
  }
  return (
    <>
      {segments.map((segment) => {
        const clampedStart = laterDate(segment.start, page.range.start);
        const left = scale.at(clampedStart);
        const width = Math.max(scale.after(earlierDate(segment.end, page.range.end)) - left, 0);
        return (
          <span
            key={segment.start}
            title={segment.label}
            className={`absolute top-1.5 h-4 overflow-hidden rounded-[3px] ${
              segment.upcoming
                ? "bg-(--bg-surface) shadow-[inset_0_0_0_1px_var(--border-strong)]"
                : "bg-(--area-tint-active)"
            }`}
            style={{ left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)` }}
          >
            <span
              className="block h-full bg-(--area-border)"
              style={{ width: `${segment.fill * 100}%` }}
            />
          </span>
        );
      })}
    </>
  );
}

function periodEnd(start: string, period: string): string {
  if (period === "day") return start;
  if (period === "week") return addDays(start, 6);
  const [year, month] = start.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
