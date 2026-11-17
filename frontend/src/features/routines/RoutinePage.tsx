import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pause, Repeat } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import {
  getRoutinePageOptions,
  listLifeAreasOptions,
  listProjectsOptions,
  listRoutineStepsForDayOptions,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead, RoutinePageRead } from "../../client/types.gen";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { CardEmpty, SectionCard } from "../../components/SectionCard";
import type { Period } from "../../period";
import { usePeriodStore } from "../../stores/periodStore";
import { shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { ProgressRing } from "../tasks/RoutinesPage";
import { DayCard } from "./DayCard";
import {
  completionSubtitle,
  heatmap,
  type ScheduleHistory,
  scheduleHistory,
  scheduleLabel,
  stepAreaIds,
  type Tile,
  tiles,
} from "./routine";
import { Sparkline } from "./Sparkline";
import { StepLabel, StepsHeatmap } from "./StepsHeatmap";

/** One routine over the selected period (Approved: routine page). Routines and their steps
 * are edited here, never in the detail panel. */
export function RoutinePage() {
  const routineId = Number(useParams().routineId);
  const { period, date } = usePeriodStore();
  const page = useQuery({
    ...getRoutinePageOptions({ path: { routine_id: routineId }, query: { period, date } }),
    placeholderData: keepPreviousData,
  });
  const areas = useQuery(listLifeAreasOptions());
  const projects = useQuery(listProjectsOptions());

  if (page.isError) {
    return (
      <div className="p-(--page-gutter)">
        <QueryError error={page.error} onRetry={page.refetch} />
      </div>
    );
  }
  if (!page.data) return null;
  // A previous routine's page stays up while the next one loads; key on its id.
  return (
    <RoutineView
      key={page.data.routine.id}
      page={page.data}
      period={period}
      areas={areas.data ?? []}
      projects={projects.data ?? []}
    />
  );
}

function RoutineView({
  page,
  period,
  areas,
  projects,
}: {
  page: RoutinePageRead;
  period: Period;
  areas: LifeAreaRead[];
  projects: ProjectRead[];
}) {
  const [selected, setSelected] = useState(page.today);
  const { routine } = page;
  const hasSteps = page.steps.length > 0;
  const areaOf = (id: number) => areas.find((area) => area.id === id);
  const projectOf = (id: number | null) => projects.find((project) => project.id === id);
  const history = scheduleHistory(page, period);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-start gap-4 px-(--page-gutter) pt-(--page-gutter)">
        <div className="min-w-0">
          <div className="flex h-(--page-header-height) items-center gap-2.5">
            <TodayRing page={page} />
            <h1 className="truncate type-page-title text-(--page-title)">{routine.title}</h1>
          </div>
          <div className="mt-0.5 flex min-h-6 flex-wrap items-center gap-2 pl-7">
            {page.paused_since && (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-(--color-neutral-100) px-2 text-[11px] font-medium text-(--text-secondary)">
                <Pause aria-hidden className="size-[11px] fill-current stroke-none" />
                Paused since {shortDate(page.paused_since)}
              </span>
            )}
            <span className="inline-flex h-6 items-center gap-1.5 rounded-(--radius-6) border border-(--border-default) px-2 text-xs font-medium text-(--text-secondary)">
              <Repeat aria-hidden className="size-3" />
              {scheduleLabel(page)}
            </span>
            {stepAreaIds(page).map((id) => {
              const area = areaOf(id);
              if (!area) return null;
              return (
                <span
                  key={id}
                  data-area={areaDataAttribute(area.color)}
                  className="inline-flex h-5 items-center gap-1 rounded-full bg-(--area-tint-active) px-2 text-[11px] font-medium text-(--text-primary)"
                >
                  <span aria-hidden className="size-1.5 rounded-[2px] bg-(--area-solid)" />
                  {area.title}
                </span>
              );
            })}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <PeriodSwitch isDisabled={!hasSteps} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
        {routine.archived_at && (
          <p className="type-body text-(--text-tertiary)">This routine is archived.</p>
        )}
        {hasSteps && <Tiles tiles={tiles(page, period)} />}
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-4">
          <div className="flex min-w-0 flex-col gap-4">
            <SectionCard title="Steps" description={hasSteps ? stepsSubtitle(page) : undefined}>
              {hasSteps ? (
                <StepsHeatmap
                  map={heatmap(page, period)}
                  period={period}
                  selected={selected === page.today ? null : selected}
                  onSelect={setSelected}
                  areas={areas}
                  projects={projects}
                />
              ) : (
                <CardEmpty>No steps yet.</CardEmpty>
              )}
            </SectionCard>
            <CompletionCard page={page} period={period} areas={areas} projectOf={projectOf} />
            {history && <ScheduleCard history={history} />}
          </div>
          <div className="sticky top-0 flex min-w-0 flex-col gap-4">
            {hasSteps ? (
              <DayCard
                page={page}
                day={selected}
                onToday={() => setSelected(page.today)}
                areas={areas}
                projects={projects}
              />
            ) : (
              <SectionCard title="Today" description={undefined}>
                <CardEmpty>No steps yet.</CardEmpty>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "5 steps in 3 areas". */
function stepsSubtitle(page: RoutinePageRead): string {
  const steps = page.steps.length;
  const areas = stepAreaIds(page).length;
  return `${steps} ${steps === 1 ? "step" : "steps"} in ${areas} ${areas === 1 ? "area" : "areas"}`;
}

/** Today's ring in the header: done out of today's due steps; a pause icon while paused. */
function TodayRing({ page }: { page: RoutinePageRead }) {
  const due = useQuery(listRoutineStepsForDayOptions({ query: { day: page.today } }));
  if (page.paused_since) {
    return (
      <Pause
        role="img"
        aria-label="Paused"
        className="size-[18px] shrink-0 fill-(--color-neutral-500) stroke-none"
      />
    );
  }
  const mine = (due.data ?? []).filter(
    (item) => item.routine_id === page.routine.id && item.status !== "skipped",
  );
  return (
    <ProgressRing done={mine.filter((item) => item.status === "done").length} total={mine.length} />
  );
}

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-5 gap-4">
      {tiles.map((tile) => (
        <article
          key={tile.label}
          aria-label={tile.label}
          className="flex min-w-0 flex-col gap-1 rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface) px-4 py-3"
        >
          <h3 className="truncate text-xs leading-4 font-medium text-(--text-tertiary)">
            {tile.label}
          </h3>
          <div className="flex h-8 items-end gap-0.5">
            <span
              className={`text-2xl leading-8 font-semibold tabular-nums ${tile.value === "—" ? "text-(--text-disabled)" : "text-(--text-primary)"}`}
            >
              {tile.value}
            </span>
            {tile.unit && (
              <span className="text-[13px] leading-6 font-medium text-(--text-tertiary)">
                {tile.unit}
              </span>
            )}
            <Sparkline points={tile.points} tips={tile.tips} good={tile.good} />
          </div>
          <p className="min-h-4 truncate type-meta text-(--text-tertiary)">{tile.line}</p>
        </article>
      ))}
    </div>
  );
}

function CompletionCard({
  page,
  period,
  areas,
  projectOf,
}: {
  page: RoutinePageRead;
  period: Period;
  areas: LifeAreaRead[];
  projectOf: (id: number | null) => ProjectRead | undefined;
}) {
  const subtitle = completionSubtitle(page, period);
  if (!subtitle) {
    return (
      <SectionCard title="Completion by step">
        <CardEmpty>Nothing done yet.</CardEmpty>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Completion by step" description={subtitle}>
      <ul className="flex flex-col">
        {page.steps.map((row) => {
          const counted = row.done + row.missed;
          const share = counted ? Math.round((100 * row.done) / counted) : null;
          return (
            <li
              key={row.step.id}
              data-area={areaDataAttribute(
                areas.find((area) => area.id === row.step.life_area_id)?.color,
              )}
              className="grid min-h-8 grid-cols-[240px_minmax(0,1fr)_40px_64px] items-center gap-3"
            >
              <StepLabel row={row} project={projectOf(row.step.project_id)} />
              <span className="h-2 overflow-hidden rounded-full bg-(--color-neutral-100)">
                {share !== null && (
                  <i
                    className="block h-full rounded-full bg-(--area-solid)"
                    style={{ width: `${share}%` }}
                  />
                )}
              </span>
              {share === null ? (
                <span className="col-span-2 type-meta whitespace-nowrap text-(--text-tertiary)">
                  Nothing due yet
                </span>
              ) : (
                <>
                  <span className="text-right text-[13px] font-semibold tabular-nums">
                    {share}%
                  </span>
                  <span className="type-meta whitespace-nowrap text-(--text-tertiary)">
                    {row.done} of {counted}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function ScheduleCard({ history }: { history: ScheduleHistory }) {
  return (
    <SectionCard title="Schedule history" description={history.subtitle}>
      <div className="flex flex-col gap-2">
        <Strip name="Schedule">
          {history.schedules.map((segment) => (
            <div
              key={segment.key}
              title={segment.label}
              className={`absolute top-0 ml-px flex h-6 items-center overflow-hidden rounded-[5px] bg-(--color-neutral-100) px-2 shadow-[inset_0_0_0_1px_var(--color-neutral-200)] ${segment.cutLeft ? "rounded-l-none" : ""} ${segment.openRight ? "rounded-r-none" : ""}`}
              style={{ left: `${segment.left}%`, width: `calc(${segment.width}% - 2px)` }}
            >
              {segment.width >= 8 && (
                <span className="truncate text-xs font-medium text-(--text-secondary)">
                  {segment.label}
                </span>
              )}
            </div>
          ))}
        </Strip>
        {history.pauses.length > 0 && (
          <Strip name="Pauses">
            {history.pauses.map((segment) => (
              <div
                key={segment.key}
                title={segment.label}
                className="absolute top-0 h-6 rounded-[5px] bg-[repeating-linear-gradient(135deg,var(--color-neutral-200)_0_2px,white_2px_5px)] shadow-[inset_0_0_0_1px_var(--color-neutral-200)]"
                style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
              >
                <span className="absolute left-[calc(100%+8px)] text-xs leading-6 font-medium whitespace-nowrap text-(--text-tertiary)">
                  {segment.label}
                </span>
              </div>
            ))}
          </Strip>
        )}
      </div>
    </SectionCard>
  );
}

function Strip({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] items-center gap-3">
      <span className="text-[13px] leading-[18px] font-medium text-(--text-primary)">{name}</span>
      <div className="relative h-6">{children}</div>
    </div>
  );
}
