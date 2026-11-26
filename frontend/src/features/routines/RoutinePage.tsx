import { Button } from "@heroui/react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import {
  getRoutinePageOptions,
  listLifeAreasOptions,
  listProjectsOptions,
} from "../../client/@tanstack/react-query.gen";
import { updateRoutine } from "../../client/sdk.gen";
import type {
  LifeAreaRead,
  ProjectRead,
  RoutinePageRead,
  RoutineRead,
} from "../../client/types.gen";
import { QueryError } from "../../components/QueryError";
import { Scroll } from "../../components/Scroll";
import { CardEmpty, SectionCard } from "../../components/SectionCard";
import type { Period } from "../../period";
import { usePeriodStore } from "../../stores/periodStore";
import { NotesEditor } from "../detail-panel/NotesEditor";
import { areaDataAttribute } from "../life-areas/palette";
import { DayCard } from "./DayCard";
import { EditableStepLabel } from "./EditableStepLabel";
import { NewStepModal } from "./NewStepModal";
import { RoutineHeader } from "./RoutineHeader";
import {
  completionSubtitle,
  heatmap,
  type ScheduleHistory,
  scheduleHistory,
  stepAreaIds,
  tiles,
} from "./routine";
import { SquarePopover, type SquareTarget } from "./SquarePopover";
import { StatTiles } from "./StatTiles";
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
  // An archived routine opens on its archive day, in the period that holds it.
  const lastDay = page.archived_on ?? page.today;
  const [selected, setSelected] = useState(lastDay);
  const setDate = usePeriodStore((state) => state.setDate);
  const archivedOn = page.archived_on;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the routine opens
  useEffect(() => {
    if (archivedOn && (archivedOn < page.start || archivedOn > page.end)) setDate(archivedOn);
  }, [archivedOn, setDate]);
  const [square, setSquare] = useState<SquareTarget | null>(null);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const { routine } = page;
  const isArchived = routine.archived_at !== null;
  const hasSteps = page.steps.length > 0;
  const projectOf = (id: number | null) => projects.find((project) => project.id === id);
  const history = scheduleHistory(page, period);
  const lastStep = page.steps.at(-1)?.step;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RoutineHeader
        page={page}
        areas={areas}
        hasSteps={hasSteps}
        onAddStep={() => setIsAddingStep(true)}
      />

      <Scroll
        direction="both"
        className="flex min-h-0 flex-1 flex-col gap-4 px-(--page-gutter) pt-4 pb-(--page-gutter)"
      >
        {hasSteps && <StatTiles tiles={tiles(page, period)} />}
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-4">
          <div className="flex min-w-0 flex-col gap-4">
            <SectionCard title="Steps" description={hasSteps ? stepsSubtitle(page) : undefined}>
              {hasSteps ? (
                <StepsHeatmap
                  routineId={routine.id}
                  map={heatmap(page, period)}
                  period={period}
                  selected={selected === lastDay ? null : selected}
                  onSelect={setSelected}
                  onSquare={isArchived ? undefined : setSquare}
                  label={
                    isArchived
                      ? undefined
                      : (row) => <EditableStepLabel row={row} areas={areas} projects={projects} />
                  }
                  areas={areas}
                  projects={projects}
                />
              ) : (
                <div className="flex min-h-10 items-center justify-between gap-3">
                  <CardEmpty>No steps yet.</CardEmpty>
                  {!isArchived && (
                    <Button size="sm" variant="ghost" onPress={() => setIsAddingStep(true)}>
                      <Plus aria-hidden />
                      Add step
                    </Button>
                  )}
                </div>
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
                onToday={isArchived ? undefined : () => setSelected(page.today)}
                onSelectDay={isArchived ? undefined : setSelected}
                areas={areas}
                projects={projects}
              />
            ) : (
              <SectionCard title="Today" description={undefined}>
                <CardEmpty>No steps yet.</CardEmpty>
              </SectionCard>
            )}
            <RoutineNotes routine={routine} />
          </div>
        </div>
      </Scroll>
      {square && (
        <SquarePopover target={square} today={page.today} onClose={() => setSquare(null)} />
      )}
      {isAddingStep && (
        <NewStepModal
          routine={routine}
          today={page.today}
          owner={{
            lifeAreaId: lastStep?.life_area_id ?? null,
            projectId: lastStep?.project_id ?? null,
          }}
          lifeAreas={areas.filter((area) => area.archived_at === null)}
          projects={projects.filter(
            (project) => project.status === "active" && project.archived_at === null,
          )}
          onClose={() => setIsAddingStep(false)}
        />
      )}
    </div>
  );
}

/** The Notes card under the Day card: the routine's Markdown notes, saved as you type. */
function RoutineNotes({ routine }: { routine: RoutineRead }) {
  const queryClient = useQueryClient();
  return (
    <NotesEditor
      key={`routine-${routine.id}-${routine.archived_at !== null}`}
      variant="card"
      readOnly={routine.archived_at !== null}
      initialMarkdown={routine.notes}
      showSource={false}
      toolbarContainer={null}
      onSave={async (notes) => {
        await updateRoutine({
          path: { routine_id: routine.id },
          body: { notes },
          throwOnError: true,
        });
        // Marked stale without a refetch, so the page doesn't reload while typing.
        await queryClient.invalidateQueries({
          predicate: (query) => (query.queryKey[0] as { _id?: string })?._id === "getRoutinePage",
          refetchType: "none",
        });
      }}
    />
  );
}

/** "5 steps in 3 areas". */
function stepsSubtitle(page: RoutinePageRead): string {
  const steps = page.steps.length;
  const areas = stepAreaIds(page).length;
  return `${steps} ${steps === 1 ? "step" : "steps"} in ${areas} ${areas === 1 ? "area" : "areas"}`;
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
              <span className="h-2 overflow-hidden rounded-full bg-(--bg-hover)">
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
                  <span className="text-right type-body font-semibold tabular-nums">{share}%</span>
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
              className={`absolute top-0 ml-px flex h-6 items-center overflow-hidden rounded-[5px] bg-(--bg-hover) px-2 shadow-[inset_0_0_0_1px_var(--border-default)] ${segment.cutLeft ? "rounded-l-none" : ""} ${segment.openRight ? "rounded-r-none" : ""}`}
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
                className="absolute top-0 h-6 rounded-[5px] bg-[repeating-linear-gradient(135deg,var(--border-default)_0_2px,var(--bg-surface)_2px_5px)] shadow-[inset_0_0_0_1px_var(--border-default)]"
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
      <span className="type-body font-medium text-(--text-primary)">{name}</span>
      <div className="relative h-6">{children}</div>
    </div>
  );
}
