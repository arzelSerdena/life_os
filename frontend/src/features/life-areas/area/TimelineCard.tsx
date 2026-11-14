import { CalendarDays, ChartLine, ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { AreaPageRead, OutcomeRead } from "../../../client/types.gen";
import { CardEmpty, SectionCard } from "../../../components/SectionCard";
import { type Period, periodInSentence } from "../../../period";
import { formatAmount, plural, shortDate } from "../overview/format";
import { addDays, earlierDate, laterDate, scaleTicks, timeScale } from "./timeScale";

const LABEL_WIDTH = "140px";

/** Projects, events and metrics across the period, with a mark for today. */
export function TimelineCard({ page }: { page: AreaPageRead }) {
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

  const today =
    page.today >= page.range.start && page.today <= page.range.end ? scale.at(page.today) : null;
  const { months, ticks } = scaleTicks(page.range, period);

  return (
    <SectionCard title="Timeline" description={`${description} in ${name}`}>
      <div className="relative">
        {/* Scale */}
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

        <Section title="Projects" count={projects.length}>
          {projects.map((project) => {
            const start = laterDate(project.start, page.range.start);
            const end = project.completed_on ?? project.due_date ?? page.range.end;
            // A project finished before its recorded start still shows as a one-day bar.
            const barStart = earlierDate(start, end);
            if (end < page.range.start || barStart > page.range.end) return null;
            const left = scale.at(barStart);
            const width = Math.max(scale.after(earlierDate(end, page.range.end)) - left, 2);
            const share = project.total ? Math.round((project.done / project.total) * 100) : 0;
            const done = project.status === "done";
            return (
              <Row key={project.id} label="">
                <div
                  className={`absolute top-1 flex h-[22px] items-center overflow-hidden rounded-(--radius-4) px-2 text-xs ${
                    done
                      ? "bg-neutral-200 text-(--text-secondary)"
                      : "bg-(--area-tint-active) text-(--area-ink)"
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    maskImage:
                      project.due_date || done
                        ? undefined
                        : "linear-gradient(to right, #000 75%, transparent)",
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
              </Row>
            );
          })}
        </Section>

        <Section title="Events" count={events.length}>
          {events.map((event) => {
            const left = scale.at(event.start_date);
            const multiDay = event.end_date > event.start_date;
            return (
              <Row key={`${event.event_id}-${event.occurrence_date}`} label="">
                {multiDay && (
                  <span
                    aria-hidden
                    className="absolute top-2 h-4 rounded-(--radius-4) bg-(--area-tint-active)"
                    style={{ left: `${left}%`, width: `${scale.after(event.end_date) - left}%` }}
                  />
                )}
                <span
                  className="absolute top-1.5 flex items-center gap-1.5 text-xs whitespace-nowrap text-(--text-primary)"
                  style={{ left: `${left}%` }}
                  title={`${event.title}, ${shortDate(event.start_date)}`}
                >
                  <span className="grid size-4 place-items-center rounded-[4px] bg-(--area-solid) text-white">
                    <CalendarDays aria-hidden className="size-3" strokeWidth={2} />
                  </span>
                  {event.title}
                </span>
              </Row>
            );
          })}
        </Section>

        <Section title="Metrics" count={metrics.length}>
          {metrics.map((outcome) => (
            <Row
              key={outcome.metric_id}
              label={
                <span className="flex min-w-0 items-center gap-1.5">
                  <ChartLine
                    aria-hidden
                    className="size-3.5 shrink-0 text-(--area-solid)"
                    strokeWidth={2}
                  />
                  <span className="truncate">{outcome.title}</span>
                </span>
              }
            >
              <MetricLane outcome={outcome} page={page} />
            </Row>
          ))}
        </Section>

        {today !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 grid"
            style={{ left: LABEL_WIDTH, right: 0 }}
          >
            <span
              className="absolute top-0 bottom-0 w-px bg-(--color-neutral-900)"
              style={{ left: `${today + 50 / scale.total}%` }}
            >
              <span className="absolute -top-0.5 -translate-x-1/2 rounded-[4px] bg-(--color-neutral-900) px-1 text-[10px] font-semibold text-white">
                Today
              </span>
            </span>
          </div>
        )}
      </div>
    </SectionCard>
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
        className="flex h-7 items-center gap-1.5 rounded-(--radius-6) text-[13px] font-semibold text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
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

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid h-7 items-center" style={{ gridTemplateColumns: `${LABEL_WIDTH} 1fr` }}>
      <span className="min-w-0 pr-2 text-[13px] text-(--text-primary)">{label}</span>
      <div className="relative h-full">{children}</div>
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
      <span className="absolute inset-x-0 top-1/2 flex items-center gap-2 text-[11px] text-(--text-tertiary)">
        <span>No target</span>
        <span className="flex-1 border-t border-dashed border-(--color-neutral-300)" />
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
          title={`${outcome.title}: ${formatAmount(outcome.value ?? 0, outcome.unit)} of ${formatAmount(target.target_value, outcome.unit)}`}
        >
          <span className="block h-full bg-(--area-border)" style={{ width: `${share * 100}%` }} />
        </span>
        {target.end_date <= page.range.end && (
          <span
            aria-hidden
            className="absolute top-2 size-2.5 -translate-x-1/2 rotate-45 border-[1.5px] border-(--color-neutral-600) bg-white"
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
    label: `${shortDate(point.start)}: ${formatAmount(point.value ?? 0, outcome.unit)}${point.status === "met" ? ", met" : ""}`,
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
        const left = scale.at(segment.start);
        const width = scale.after(earlierDate(segment.end, page.range.end)) - left;
        return (
          <span
            key={segment.start}
            title={segment.label}
            className={`absolute top-1.5 h-4 overflow-hidden rounded-[3px] ${
              segment.upcoming
                ? "bg-white shadow-[inset_0_0_0_1px_var(--color-neutral-300)]"
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
