import { Button } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Archive, Download, Pause, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  getRoutinesHistoryOptions,
  getRoutinesOverviewOptions,
  listLifeAreasOptions,
} from "../../client/@tanstack/react-query.gen";
import type {
  LifeAreaRead,
  OverviewRoutineRead,
  RoutinesOverviewRead,
} from "../../client/types.gen";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { Scroll } from "../../components/Scroll";
import { CardEmpty, SectionCard } from "../../components/SectionCard";
import type { Period } from "../../period";
import { usePeriodStore } from "../../stores/periodStore";
import { PanelMenu } from "../detail-panel/PanelParts";
import { type ItemTarget, itemMenuProps } from "../item-menu/target";
import { useAreasContext } from "../life-areas/AreasLayout";
import { CardMenu, type MenuOption } from "../life-areas/overview/CardMenu";
import { areaDataAttribute } from "../life-areas/palette";
import { ProgressRing, type ProgressRingSegment } from "../tasks/RoutinesPage";
import { routineColumn } from "../tasks/routines";
import {
  type OverviewSort,
  openToday,
  overviewCompletionSubtitle,
  overviewCsv,
  overviewTiles,
  pickUpLine,
  routineCells,
  routineMeta,
  routinesSubtitle,
  shownRoutines,
} from "./overview";
import { heatHeader } from "./routine";
import { StatTiles } from "./StatTiles";
import { Cells, HeatmapHeader, ROW, RoutineKey } from "./StepsHeatmap";

/** Common routines offered when there are none yet; each opens New routine with its name. */
const QUICK_STARTS = ["Morning routine", "Evening routine", "Weekly reset", "Workout"];

/**
 * The Routines overview, behind the ROUTINES heading (Approved: Routines overview): every
 * active routine over the selected period. With no routines it shows "Set up your first
 * routine" instead.
 */
export function RoutinesOverviewPage() {
  const { openNewRoutine } = useAreasContext();
  const { period, date } = usePeriodStore();
  const overview = useQuery({
    ...getRoutinesOverviewOptions({ query: { period, date } }),
    placeholderData: keepPreviousData,
  });
  const areas = useQuery(listLifeAreasOptions());
  const navigate = useNavigate();
  const data = overview.data;
  const isEmpty = data !== undefined && data.routines.length === 0;

  const exportCsv = () => {
    if (!data) return;
    const blob = new Blob([overviewCsv(data, areas.data ?? [])], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `routines-${data.period}-${data.start}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Routines"
        actions={
          <>
            <PeriodSwitch isDisabled={!data || isEmpty} />
            <PanelMenu
              actions={[
                {
                  id: "archived",
                  label: "Archived routines",
                  icon: Archive,
                  onAction: () => navigate("/areas/archived?tab=routines"),
                },
                {
                  id: "export",
                  label: "Export as CSV",
                  icon: Download,
                  onAction: exportCsv,
                  isDisabled: !data || isEmpty,
                },
              ]}
            />
            <Button onPress={() => openNewRoutine()} className="ml-2">
              <Plus aria-hidden strokeWidth={2} />
              New routine
            </Button>
          </>
        }
      />
      <Scroll
        direction="both"
        className="flex min-h-0 flex-1 flex-col gap-4 px-(--page-gutter) pt-4 pb-(--page-gutter)"
      >
        {overview.isError && <QueryError error={overview.error} onRetry={overview.refetch} />}
        {isEmpty && <FirstRoutineWelcome onCreate={openNewRoutine} />}
        {data && !isEmpty && (
          <OverviewBody overview={data} period={period} areas={areas.data ?? []} />
        )}
      </Scroll>
    </>
  );
}

function OverviewBody({
  overview,
  period,
  areas,
}: {
  overview: RoutinesOverviewRead;
  period: Period;
  areas: LifeAreaRead[];
}) {
  const [sort, setSort] = useState<OverviewSort>("manual");
  const [showPaused, setShowPaused] = useState(true);
  const routines = shownRoutines(overview.routines, sort, showPaused);
  const menu: MenuOption[] = [
    ...(
      [
        ["manual", "Manual"],
        ["rate", "Completion rate"],
        ["name", "Name"],
      ] as const
    ).map(([id, label]) => ({ section: "Sort by", id, label, selected: sort === id })),
    { section: "Show", id: "paused", label: "Paused routines", selected: showPaused, check: true },
  ];
  const onMenu = (id: string) => {
    if (id === "paused") setShowPaused((shown) => !shown);
    else setSort(id as OverviewSort);
  };
  const cardMenu = (label: string) => <CardMenu label={label} options={menu} onSelect={onMenu} />;

  return (
    <>
      <StatTiles tiles={overviewTiles(overview, period)} />
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-stretch gap-4">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard
            title="Routines"
            description={routinesSubtitle(routines)}
            action={cardMenu("Routines")}
          >
            <RoutinesHeatmap overview={overview} routines={routines} period={period} />
          </SectionCard>
          <CompletionByRoutine
            overview={overview}
            routines={routines}
            period={period}
            action={cardMenu("Completion by routine")}
          />
        </div>
        <PickUpCard overview={overview} areas={areas} />
      </div>
    </>
  );
}

/** Today's ring (a pause icon while paused), the name linking to the routine page, and
 * "Every day · 4 steps" under it. */
function RoutineLabel({
  routine,
  segments,
}: {
  routine: OverviewRoutineRead;
  segments?: ProgressRingSegment[];
}) {
  return (
    <span className="flex min-w-0 flex-col pr-2">
      <span className="flex min-w-0 items-center gap-2">
        {routine.paused_since ? (
          <Pause
            aria-label="Paused"
            className="size-4 shrink-0 fill-(--color-neutral-500) stroke-none"
          />
        ) : (
          <ProgressRing
            done={routine.today_done}
            total={routine.today_due}
            segments={segments}
            className="size-4"
          />
        )}
        <Link
          to={`/areas/routines/${routine.id}`}
          className="truncate rounded-(--radius-4) type-body font-medium text-(--text-primary) outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          {routine.title}
        </Link>
      </span>
      <span className="truncate pl-6 type-tag text-(--text-tertiary)">{routineMeta(routine)}</span>
    </span>
  );
}

function RoutinesHeatmap({
  overview,
  routines,
  period,
}: {
  overview: RoutinesOverviewRead;
  routines: OverviewRoutineRead[];
  period: Period;
}) {
  const history = useQuery(getRoutinesHistoryOptions());
  const areas = useQuery(listLifeAreasOptions());
  const head = heatHeader(period, overview.start, overview.end, overview.today);
  const segmentsFor = (routineId: number): ProgressRingSegment[] | undefined => {
    const h = history.data?.routines.find((r) => r.id === routineId);
    if (!h || !history.data) return undefined;
    const col = routineColumn(h, history.data.today);
    return col.steps
      .filter((s) => s.dueToday)
      .map((s) => ({
        done: s.done,
        color: areas.data?.find((a) => a.id === s.step.life_area_id)?.color ?? null,
      }));
  };
  return (
    <div className="flex flex-col">
      <HeatmapHeader map={head} period={period} />
      {routines.length === 0 ? (
        <CardEmpty>Every routine is paused.</CardEmpty>
      ) : (
        routines.map((routine) => (
          <div
            key={routine.id}
            {...itemMenuProps({ kind: "routine", id: routine.id })}
            className={`${ROW} mt-2.5`}
          >
            <RoutineLabel routine={routine} segments={segmentsFor(routine.id)} />
            <Cells
              cells={routineCells(routine, overview, period)}
              columns={head.columns}
              period={period}
              isAll
              selected={null}
            />
          </div>
        ))
      )}
      <RoutineKey />
    </div>
  );
}

function CompletionByRoutine({
  overview,
  routines,
  period,
  action,
}: {
  overview: RoutinesOverviewRead;
  routines: OverviewRoutineRead[];
  period: Period;
  action: ReactNode;
}) {
  const subtitle = overviewCompletionSubtitle(overview, period);
  if (!subtitle) {
    return (
      <SectionCard title="Completion by routine">
        <CardEmpty>Nothing done yet.</CardEmpty>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Completion by routine" description={subtitle} action={action}>
      <ul className="flex flex-col gap-1.5">
        {routines.map((routine) => {
          const { done, missed, completion_rate: share } = routine.totals;
          return (
            <li
              key={routine.id}
              {...itemMenuProps({ kind: "routine", id: routine.id })}
              className="grid min-h-9 grid-cols-[240px_minmax(0,1fr)_40px_96px] items-center gap-3"
            >
              <RoutineLabel routine={routine} />
              <span className="h-2 overflow-hidden rounded-full bg-(--bg-hover)">
                {share !== null && (
                  <i
                    className="block h-full rounded-full bg-(--color-brand-600)"
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
                    {done} of {done + missed}
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

/** Pick up (360 px, right): Open today, Most missed and Streaks ended this week. Empty
 * sections are hidden. */
function PickUpCard({
  overview,
  areas,
}: {
  overview: RoutinesOverviewRead;
  areas: LifeAreaRead[];
}) {
  const history = useQuery(getRoutinesHistoryOptions());
  const open = openToday(overview.routines);
  const colorOf = (id: number) => areas.find((area) => area.id === id)?.color;
  const segmentsFor = (routineId: number): ProgressRingSegment[] | undefined => {
    const h = history.data?.routines.find((r) => r.id === routineId);
    if (!h || !history.data) return undefined;
    const col = routineColumn(h, history.data.today);
    return col.steps
      .filter((s) => s.dueToday)
      .map((s) => ({ done: s.done, color: colorOf(s.step.life_area_id) ?? null }));
  };
  const sections: { title: string; rows: ReactNode[] }[] = [
    {
      title: "Open today",
      rows: open.map((routine) => (
        <PickUpRow
          key={routine.id}
          to={routine.id}
          item={{ kind: "routine", id: routine.id }}
          marker={
            <ProgressRing
              done={routine.today_done}
              total={routine.today_due}
              segments={segmentsFor(routine.id)}
              className="size-4"
            />
          }
          title={routine.title}
          meta={`${routine.today_due - routine.today_done} of ${routine.today_due} ${routine.today_due === 1 ? "step" : "steps"} left`}
        />
      )),
    },
    {
      title: "Most missed",
      rows: overview.most_missed.map((step) => (
        <PickUpRow
          key={step.step_id}
          to={step.routine_id}
          item={{ kind: "step", id: step.step_id, routineId: step.routine_id }}
          area={colorOf(step.life_area_id)}
          title={step.title}
          meta={step.routine_title}
          trailing={`${step.missed} missed`}
        />
      )),
    },
    {
      title: "Streaks ended this week",
      rows: overview.pick_up.map((step) => (
        <PickUpRow
          key={step.step_id}
          to={step.routine_id}
          item={{ kind: "step", id: step.step_id, routineId: step.routine_id }}
          area={colorOf(step.life_area_id)}
          title={step.title}
          meta={step.routine_title}
          trailing={pickUpLine(step.run, step.ended_on)}
        />
      )),
    },
  ].filter((section) => section.rows.length > 0);

  return (
    <SectionCard title="Pick up" className="h-full">
      {sections.length === 0 ? (
        <CardEmpty>Nothing to pick up.</CardEmpty>
      ) : (
        <div className="-mx-2 flex flex-col gap-2.5">
          {sections.map((section) => (
            <section key={section.title} aria-label={section.title}>
              <h3 className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5 type-label text-(--text-tertiary)">
                {section.title}
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-(--counter-bg) px-1 type-tag font-medium tracking-normal text-(--text-secondary)">
                  {section.rows.length}
                </span>
              </h3>
              <ul>{section.rows}</ul>
            </section>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function PickUpRow({
  to,
  item,
  marker,
  area,
  title,
  meta,
  trailing,
}: {
  /** The routine whose page the row opens. */
  to: number;
  /** The routine or step the row stands for: right-click opens its ⋯ menu. */
  item: ItemTarget;
  marker?: ReactNode;
  /** A step's area colour, for its round marker. */
  area?: string | null;
  title: string;
  meta: string;
  trailing?: string;
}) {
  return (
    <li
      {...itemMenuProps(item)}
      data-area={area === undefined ? undefined : areaDataAttribute(area)}
    >
      <Link
        to={`/areas/routines/${to}`}
        className="flex items-start gap-2.5 rounded-(--radius-6) px-2 py-1.5 outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
      >
        <span className="grid h-5 w-4 shrink-0 place-items-center">
          {marker ?? (
            <span aria-hidden className="size-3.5 rounded-full border-2 border-(--area-solid)" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm leading-5 text-(--text-primary)">{title}</span>
          <span className="truncate type-meta text-(--text-tertiary)">{meta}</span>
        </span>
        {trailing && (
          <span className="shrink-0 type-meta leading-5 whitespace-nowrap text-(--text-tertiary)">
            {trailing}
          </span>
        )}
      </Link>
    </li>
  );
}

function FirstRoutineWelcome({ onCreate }: { onCreate: (title?: string) => void }) {
  return (
    <div className="m-auto flex max-w-[420px] flex-col items-center gap-3 pb-20 text-center">
      <ProgressRing done={2} total={3} className="size-10" />
      <h2 className="mt-1.5 type-page-title text-(--text-primary)">Set up your first routine</h2>
      <p className="type-body leading-5 text-(--text-secondary)">
        A routine is a list of steps you repeat on a schedule. Each step belongs to a life area or a
        project.
      </p>
      <Button onPress={() => onCreate()} className="h-9 px-4 type-body">
        <Plus aria-hidden />
        New routine
      </Button>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {QUICK_STARTS.map((title) => (
          <button
            key={title}
            type="button"
            onClick={() => onCreate(title)}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-(--border-default) bg-(--bg-surface) px-2.5 text-xs font-medium text-(--text-secondary) outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          >
            <ProgressRing done={0} total={0} className="size-3.5" />
            {title}
          </button>
        ))}
      </div>
    </div>
  );
}
