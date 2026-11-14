import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { getOverviewOptions } from "../../../client/@tanstack/react-query.gen";
import type {
  LifeAreaRead,
  OverviewRead,
  ProjectsAreaRead,
  RoutinesAreaRead,
  WinRead,
} from "../../../client/types.gen";
import { QueryError } from "../../../components/QueryError";
import { CardEmpty, SectionCard } from "../../../components/SectionCard";
import { type Period, periodInSentence } from "../../../period";
import { usePeriodStore } from "../../../stores/periodStore";
import { areaDataAttribute } from "../palette";
import { formatAmount, monthName, plural, shortDate } from "./format";
import { OutcomesCard } from "./OutcomesCard";

/** The overview's five cards for the selected period. */
export function OverviewCards() {
  const { period, date } = usePeriodStore();
  const overview = useQuery({
    ...getOverviewOptions({ query: { period, date } }),
    placeholderData: keepPreviousData,
  });

  if (overview.isError) return <QueryError error={overview.error} onRetry={overview.refetch} />;
  if (!overview.data) return null;

  const data = overview.data;
  const name = periodInSentence(data.period as Period, data.range.start);
  const isCurrent = data.today >= data.range.start && data.today <= data.range.end;
  return (
    <>
      <EffortCard overview={data} name={name} isCurrent={isCurrent} />
      <OutcomesCard overview={data} />
      <div className="grid grid-cols-3 gap-4">
        <ProjectsCard overview={data} />
        <RoutinesCard overview={data} name={name} />
        <WinsCard overview={data} name={name} isCurrent={isCurrent} />
      </div>
    </>
  );
}

type CardProps = { overview: OverviewRead; name: string; isCurrent: boolean };

function areaOf(overview: OverviewRead, id: number): LifeAreaRead {
  return overview.life_areas.find((area) => area.id === id) as LifeAreaRead;
}

// ---------- Effort ----------

function EffortCard({ overview, name, isCurrent }: CardProps) {
  const total = overview.effort.reduce((sum, area) => sum + area.done, 0);
  const previousTotal = overview.effort.reduce((sum, area) => sum + area.previous_done, 0);
  const previousName = periodInSentence(overview.period as Period, overview.previous_range.start);

  if (total === 0) {
    const empty = `No tasks completed in ${name}${isCurrent ? " yet" : ""}`;
    return (
      <SectionCard title="Effort">
        <CardEmpty>{empty}.</CardEmpty>
      </SectionCard>
    );
  }

  const shares = overview.effort
    .filter((area) => area.done > 0)
    .sort((a, b) => b.done - a.done)
    .map((area) => {
      const share = Math.round((area.done / total) * 100);
      let change = "";
      if (previousTotal > 0) {
        const points = share - Math.round((area.previous_done / previousTotal) * 100);
        change =
          points === 0
            ? `Same as ${previousName}`
            : `${points > 0 ? "+" : "−"}${plural(Math.abs(points), "pt")} vs ${previousName}`;
      }
      return { area: areaOf(overview, area.life_area_id), done: area.done, share, change };
    });

  return (
    <SectionCard
      title="Effort"
      description={`Where your completed tasks went in ${name} · ${total} in total`}
    >
      <div className="flex h-6 gap-0.5">
        {shares.map(({ area, done, share }) => (
          <div
            key={area.id}
            data-area={areaDataAttribute(area.color)}
            style={{ flex: done }}
            title={`${area.title}: ${plural(done, "task")}, ${share}%`}
            className="flex min-w-0 items-center bg-(--area-solid) px-2 text-xs font-semibold text-white first:rounded-l-[6px] last:rounded-r-[6px]"
          >
            {share >= 5 && <span>{share}%</span>}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {shares.map(({ area, done, change }) => (
          <div key={area.id} style={{ flex: done }} className="flex min-w-0 flex-col px-2">
            <span className="truncate text-[13px] font-semibold text-(--text-primary)">
              {area.title}
            </span>
            <span className="truncate text-[11px] text-(--text-tertiary)">
              {[plural(done, "task"), change].filter(Boolean).join(" · ")}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ---------- Projects ----------

function ProjectsCard({ overview }: { overview: OverviewRead }) {
  const rows = overview.projects.filter((area) => area.active_projects > 0);
  if (rows.length === 0) {
    return (
      <SectionCard title="Projects">
        <CardEmpty>No active projects.</CardEmpty>
      </SectionCard>
    );
  }
  const count = (status: ProjectsAreaRead["pace_status"]) =>
    rows.filter((area) => area.pace_status === status).length;
  const projects = rows.reduce((sum, area) => sum + area.active_projects, 0);
  const description = `${plural(projects, "active project")} in ${plural(rows.length, "area")} · ${count("ahead")} ahead of pace, ${count("behind")} behind, ${count("on_pace")} on pace`;

  return (
    <SectionCard title="Projects" description={description}>
      {rows.map((row) => (
        <ProjectsRow key={row.life_area_id} row={row} area={areaOf(overview, row.life_area_id)} />
      ))}
    </SectionCard>
  );
}

function ProjectsRow({ row, area }: { row: ProjectsAreaRead; area: LifeAreaRead }) {
  const share = row.total === 0 ? 0 : Math.round((row.done / row.total) * 100);
  const pace = row.pace === null ? null : Math.round(row.pace * 100);
  const points = pace === null ? 0 : Math.abs(share - pace);
  const note =
    row.pace_status === "ahead"
      ? { text: `${plural(points, "pt")} ahead of pace`, good: true }
      : row.pace_status === "behind"
        ? { text: `${plural(points, "pt")} behind pace`, good: false }
        : row.pace_status === "on_pace"
          ? { text: "On pace", good: true }
          : { text: row.total === 0 ? "No tasks yet" : "No due dates", good: null };
  return (
    <div
      data-area={areaDataAttribute(area.color)}
      title={`${area.title}: ${row.done} of ${row.total} project tasks done (${share}%)${pace === null ? "" : `; ${pace}% of the time has passed`}`}
      className="grid h-10 grid-cols-[minmax(0,1fr)_64px_112px] items-center gap-2.5"
    >
      <AreaLabel area={area} />
      <span className="relative h-2 rounded-full bg-(--area-tint-active)">
        <i
          className="absolute inset-y-0 left-0 rounded-full bg-(--area-solid)"
          style={{ width: `${share}%` }}
        />
        {pace !== null && (
          <b
            className="absolute -inset-y-1 -ml-px w-0.5 rounded-[1px] bg-(--color-neutral-900)"
            style={{ left: `${pace}%` }}
          />
        )}
      </span>
      <span className="flex flex-col items-end text-xs leading-4 font-semibold tabular-nums">
        {share}%
        <span
          className={`text-[11px] leading-[14px] font-medium ${
            note.good === null
              ? "text-(--text-tertiary)"
              : note.good
                ? "text-positive-700"
                : "text-(--text-danger)"
          }`}
        >
          {note.text}
        </span>
      </span>
    </div>
  );
}

// ---------- Routine steps done ----------

function RoutinesCard({ overview, name }: { overview: OverviewRead; name: string }) {
  const rows = overview.routines.filter((area) => area.steps > 0);
  if (rows.length === 0) {
    return (
      <SectionCard title="Routine steps done">
        <CardEmpty>No routine steps in these areas.</CardEmpty>
      </SectionCard>
    );
  }
  const due = rows.reduce((sum, area) => sum + area.due, 0);
  const done = rows.reduce((sum, area) => sum + area.done, 0);
  const steps = rows.reduce((sum, area) => sum + area.steps, 0);
  const routines = rows.reduce((sum, area) => sum + area.routines, 0);
  const description =
    due > 0
      ? `${Math.round((done / due) * 100)}% of due steps done in ${name}`
      : `${plural(steps, "step")} in ${plural(routines, "routine")}`;
  return (
    <SectionCard title="Routine steps done" description={description}>
      {rows.map((row) => (
        <RoutinesRow
          key={row.life_area_id}
          row={row}
          area={areaOf(overview, row.life_area_id)}
          name={name}
        />
      ))}
    </SectionCard>
  );
}

function RoutinesRow({
  row,
  area,
  name,
}: {
  row: RoutinesAreaRead;
  area: LifeAreaRead;
  name: string;
}) {
  const current = row.weeks.find((week) => week.is_current);
  const [value, when] =
    current && current.due > 0
      ? [Math.round((current.done / current.due) * 100), "this week"]
      : row.due > 0
        ? [Math.round((row.done / row.due) * 100), `in ${name}`]
        : [null, "nothing due"];
  return (
    <div
      data-area={areaDataAttribute(area.color)}
      className="grid h-10 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_64px] items-center gap-2.5"
    >
      <AreaLabel area={area} />
      <span
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${row.weeks.length}, minmax(0, 1fr))` }}
      >
        {row.weeks.map((week) => {
          const share = week.due > 0 ? week.done / week.due : null;
          const label = `${area.title}, week of ${shortDate(week.start)}: ${
            share === null
              ? week.is_upcoming
                ? "upcoming"
                : "nothing due"
              : `${Math.round(share * 100)}% of due steps done${week.is_current ? " so far" : ""}`
          }`;
          return (
            <i
              key={week.start}
              title={label}
              style={share === null ? undefined : { opacity: 0.2 + 0.8 * share }}
              className={`block h-[18px] rounded-[3px] ${
                share === null
                  ? "bg-white shadow-[inset_0_0_0_1px_var(--color-neutral-300)]"
                  : "bg-(--area-solid)"
              } ${week.is_current && share !== null ? "shadow-[inset_0_0_0_1.5px_#fff,0_0_0_1.5px_var(--area-solid)]" : ""}`}
            />
          );
        })}
      </span>
      <span className="flex flex-col items-end text-xs leading-4 font-semibold tabular-nums">
        {value === null ? "–" : `${value}%`}
        <span className="text-[11px] leading-[14px] font-normal text-(--text-tertiary)">
          {when}
        </span>
      </span>
    </div>
  );
}

// ---------- Wins ----------

function WinsCard({ overview, name, isCurrent }: CardProps) {
  const { wins } = overview;
  if (wins.length === 0) {
    return (
      <SectionCard title="Wins">
        <CardEmpty>
          {isCurrent ? `Nothing yet this ${overview.period}.` : `Nothing in ${name}.`}
        </CardEmpty>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Wins" description={`${wins.length} in ${name}`}>
      <ul>
        {wins.map((win) => {
          const area = areaOf(overview, win.life_area_id);
          return (
            <li
              key={`${win.kind}-${win.project_id ?? win.metric_id}-${win.day}`}
              className="flex min-h-10 items-center gap-2.5"
            >
              <CircleCheck
                aria-hidden
                className="size-4 shrink-0 text-positive-600"
                strokeWidth={2}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium text-(--text-primary)">
                  {win.title}
                </span>
                <span className="truncate type-meta text-(--text-tertiary)">{winNote(win)}</span>
              </span>
              <span
                data-area={areaDataAttribute(area.color)}
                className="flex shrink-0 items-center gap-1.5 text-xs text-(--text-tertiary)"
              >
                <span aria-hidden className="size-1.5 rounded-[2px] bg-(--area-solid)" />
                {area.title}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

const PERIOD_ADJECTIVES: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

function winNote(win: WinRead): string {
  if (win.kind === "project_finished") return `Project finished ${shortDate(win.day)}`;
  const amount = formatAmount(win.target_value ?? 0, win.unit);
  if (win.kind === "target_reached") return `Reached ${amount} on ${shortDate(win.day)}`;
  const adjective = PERIOD_ADJECTIVES[win.period ?? ""] ?? "";
  if (win.direction === "lower") {
    return win.times === 1 && win.period === "month"
      ? `Stayed under ${amount} in ${monthName(win.day)}`
      : `Stayed under ${amount} ${win.times === 1 ? "once" : `${win.times} times`}`;
  }
  if (win.times === 1) {
    return win.period === "month" ? `${monthName(win.day)} target met` : `${adjective} target met`;
  }
  return `${adjective} target met ${win.times} times`;
}

// ---------- Shared ----------

function AreaLabel({ area }: { area: LifeAreaRead }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden className="size-1.5 shrink-0 rounded-[2px] bg-(--area-solid)" />
      <span className="truncate text-xs font-medium text-(--text-primary)">{area.title}</span>
    </span>
  );
}
