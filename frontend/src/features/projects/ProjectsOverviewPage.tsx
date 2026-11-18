import { Button } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Archive, CalendarDays, ChevronDown, Folder, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  getProjectsOverviewOptions,
  listLifeAreasOptions,
} from "../../client/@tanstack/react-query.gen";
import type {
  LifeAreaRead,
  OverviewProjectRead,
  ProjectsOverviewRead,
} from "../../client/types.gen";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { CardEmpty, SectionCard } from "../../components/SectionCard";
import type { Period } from "../../period";
import { useNewTask } from "../../stores/newTaskStore";
import { usePeriodStore } from "../../stores/periodStore";
import { useProjectsOverviewStore } from "../../stores/projectsOverviewStore";
import { PanelMenu } from "../detail-panel/PanelParts";
import { useAreasContext } from "../life-areas/AreasLayout";
import { LABEL_WIDTH, ProjectBar, TimelineScale, TodayLine } from "../life-areas/area/TimelineCard";
import { CardMenu, type MenuOption } from "../life-areas/overview/CardMenu";
import { plural, shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { StatTiles } from "../routines/StatTiles";
import {
  boardSubtitle,
  cardDateLine,
  daysLeft,
  nextUpSubtitle,
  type ProjectsGroup,
  type ProjectsSort,
  projectColumns,
  projectTiles,
  timelineSubtitle,
} from "./overview";
import { projectPath } from "./paths";

/**
 * The Projects overview, behind the PROJECTS heading (Approved: Projects overview): execution
 * stats from project tasks, the timeline, Next up and the Projects board over the selected
 * period. With no projects it shows "Start your first project" instead.
 */
export function ProjectsOverviewPage() {
  const { openNewProject } = useAreasContext();
  const { period, date } = usePeriodStore();
  const overview = useQuery({
    ...getProjectsOverviewOptions({ query: { period, date } }),
    placeholderData: keepPreviousData,
  });
  const lifeAreas = useQuery(listLifeAreasOptions());
  const navigate = useNavigate();
  const data = overview.data;
  const isEmpty = data !== undefined && !data.has_projects;
  const areas = lifeAreas.data ?? [];
  const canCreate = areas.some((area) => area.archived_at === null);

  return (
    <>
      <PageHeader
        title="Projects"
        actions={
          <>
            <PeriodSwitch isDisabled={!data || isEmpty} />
            <PanelMenu
              actions={[
                {
                  id: "archived",
                  label: "Finished & archived",
                  icon: Archive,
                  onAction: () => navigate("/areas/archived?tab=projects"),
                },
              ]}
            />
            <Button onPress={() => openNewProject()} isDisabled={!canCreate} className="ml-2">
              <Plus aria-hidden strokeWidth={2} />
              New project
            </Button>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
        {overview.isError && <QueryError error={overview.error} onRetry={overview.refetch} />}
        {isEmpty && <FirstProjectWelcome canCreate={canCreate} onCreate={() => openNewProject()} />}
        {data && !isEmpty && <OverviewBody overview={data} period={period} areas={areas} />}
      </div>
    </>
  );
}

function OverviewBody({
  overview,
  period,
  areas,
}: {
  overview: ProjectsOverviewRead;
  period: Period;
  areas: LifeAreaRead[];
}) {
  return (
    <>
      <StatTiles tiles={projectTiles(overview, period)} />
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-stretch gap-4">
        <ProjectsTimeline overview={overview} period={period} areas={areas} />
        <NextUpCard overview={overview} period={period} areas={areas} />
      </div>
      <ProjectsBoard overview={overview} period={period} areas={areas} />
    </>
  );
}

/** One lane per area, one bar per project; finished projects grey. */
function ProjectsTimeline({
  overview,
  period,
  areas,
}: {
  overview: ProjectsOverviewRead;
  period: Period;
  areas: LifeAreaRead[];
}) {
  const lanes = [...new Set(overview.projects.map((project) => project.life_area_id))].map(
    (id) => ({
      area: areas.find((area) => area.id === id),
      id,
      projects: overview.projects.filter((project) => project.life_area_id === id),
    }),
  );
  if (lanes.length === 0) {
    return (
      <SectionCard title="Timeline" className="h-full">
        <CardEmpty>No active projects.</CardEmpty>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title="Timeline"
      description={timelineSubtitle(overview, period)}
      className="h-full"
    >
      <div className="relative">
        <TimelineScale range={overview.range} period={period} />
        {lanes.map((lane) => (
          <TimelineLane
            key={lane.id}
            title={lane.area?.title ?? "Life area"}
            color={lane.area?.color ?? null}
            projects={lane.projects}
            overview={overview}
          />
        ))}
        <TodayLine range={overview.range} today={overview.today} />
      </div>
    </SectionCard>
  );
}

function TimelineLane({
  title,
  color,
  projects,
  overview,
}: {
  title: string;
  color: string | null;
  projects: OverviewProjectRead[];
  overview: ProjectsOverviewRead;
}) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div
      data-area={areaDataAttribute(color)}
      className="grid border-b border-(--border-default) py-1.5 last-of-type:border-b-0"
      style={{ gridTemplateColumns: `${LABEL_WIDTH} 1fr` }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 min-w-0 items-center gap-1.5 self-start rounded-(--radius-6) pr-2 text-[13px] font-semibold text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
      >
        <ChevronDown
          aria-hidden
          className={`size-3 shrink-0 text-(--text-tertiary) transition-transform ${isOpen ? "" : "-rotate-90"}`}
          strokeWidth={2}
        />
        <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-(--area-solid)" />
        <span className="truncate">{title}</span>
      </button>
      <div className="flex flex-col">
        {(isOpen ? projects : []).map((project) => (
          <div key={project.id} className="relative h-7">
            <ProjectBar project={project} range={overview.range} />
          </div>
        ))}
        {!isOpen && <div className="h-7" />}
      </div>
    </div>
  );
}

/** Due next, Stalled and No next step (360 px, right). Empty sections are hidden. */
function NextUpCard({
  overview,
  period,
  areas,
}: {
  overview: ProjectsOverviewRead;
  period: Period;
  areas: LifeAreaRead[];
}) {
  const openNewTask = useNewTask((state) => state.open);
  const navigate = useNavigate();
  const projectOf = (id: number) => overview.projects.find((project) => project.id === id);
  const colorOf = (project: OverviewProjectRead) =>
    areas.find((area) => area.id === project.life_area_id)?.color ?? null;
  const newTask = (project: OverviewProjectRead, scheduled: boolean) =>
    openNewTask(
      {
        lifeAreaId: project.life_area_id,
        projectId: project.id,
        scheduledDate: scheduled ? overview.today : undefined,
      },
      overview.today,
    );

  const sections: { title: string; rows: ReactNode[] }[] = [
    {
      title: "Due next",
      rows: overview.due_next.flatMap((id) => {
        const project = projectOf(id);
        if (!project?.due_date) return [];
        const badge = daysLeft(project.due_date, overview.today);
        return [
          <NextUpRow
            key={id}
            project={project}
            color={colorOf(project)}
            leading={
              <span
                className={`grid h-6 min-w-10 place-items-center rounded-(--radius-6) px-1.5 text-xs font-semibold tabular-nums ${
                  badge.urgent
                    ? "bg-(--color-negative-50) text-(--color-negative-600)"
                    : "bg-(--color-neutral-100) text-(--text-primary)"
                }`}
              >
                {badge.label}
              </span>
            }
            meta={
              <>
                {shortDate(project.due_date)}
                {project.open > 0 && ` · ${project.open} open`}
                {project.overdue > 0 && (
                  <>
                    {" · "}
                    <span className="text-(--color-negative-600)">{project.overdue} overdue</span>
                  </>
                )}
              </>
            }
          />,
        ];
      }),
    },
    {
      title: "Stalled",
      rows: overview.stalled.flatMap(({ project_id: id, days }) => {
        const project = projectOf(id);
        if (!project) return [];
        return [
          <NextUpRow
            key={id}
            project={project}
            color={colorOf(project)}
            meta={`Nothing done for ${plural(days, "day")}`}
            action={
              <QuickAction icon={CalendarDays} onPress={() => newTask(project, true)}>
                Plan task
              </QuickAction>
            }
          />,
        ];
      }),
    },
    {
      title: "No next step",
      rows: overview.no_next_step.flatMap(({ project_id: id, open }) => {
        const project = projectOf(id);
        if (!project) return [];
        return [
          <NextUpRow
            key={id}
            project={project}
            color={colorOf(project)}
            meta={open === 0 ? "No tasks yet" : `${open} open, none scheduled`}
            action={
              open === 0 ? (
                <QuickAction icon={Plus} onPress={() => newTask(project, false)}>
                  Add task
                </QuickAction>
              ) : (
                <QuickAction icon={CalendarDays} onPress={() => navigate(projectPath(id))}>
                  Schedule
                </QuickAction>
              )
            }
          />,
        ];
      }),
    },
  ].filter((section) => section.rows.length > 0);

  const subtitle = nextUpSubtitle(overview, period);
  return (
    <SectionCard title="Next up" description={subtitle || undefined} className="h-full">
      {sections.length === 0 ? (
        <CardEmpty>Nothing needs a push.</CardEmpty>
      ) : (
        <div className="flex flex-col">
          {sections.map((section) => (
            <section
              key={section.title}
              aria-label={section.title}
              className="border-b border-(--border-default) py-2 first:pt-0 last:border-b-0 last:pb-0"
            >
              <h3 className="flex items-center gap-1.5 pb-1 type-label text-(--text-tertiary)">
                {section.title}
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-(--color-neutral-100) px-1 text-[11px] font-medium tracking-normal text-(--text-secondary)">
                  {section.rows.length}
                </span>
              </h3>
              <ul className="flex flex-col gap-1">{section.rows}</ul>
            </section>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function NextUpRow({
  project,
  color,
  leading,
  meta,
  action,
}: {
  project: OverviewProjectRead;
  color: string | null;
  leading?: ReactNode;
  meta: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li data-area={areaDataAttribute(color)} className="flex items-center gap-2.5 py-1">
      {leading}
      <Folder
        aria-hidden
        className="size-4 shrink-0 self-start text-(--area-solid) mt-0.5"
        strokeWidth={2}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <Link
          to={projectPath(project.id)}
          className="truncate rounded-(--radius-4) text-sm leading-5 text-(--text-primary) outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          {project.title}
        </Link>
        <span className="truncate type-meta text-(--text-tertiary)">{meta}</span>
      </span>
      {action}
    </li>
  );
}

/** A 28 px solid accent button with an icon and a word: Plan task, Schedule, Add task. */
function QuickAction({
  icon: Icon,
  onPress,
  children,
}: {
  icon: typeof Plus;
  onPress: () => void;
  children: string;
}) {
  return (
    <Button size="sm" onPress={onPress} className="h-7 shrink-0 gap-1.5 px-2.5 text-xs">
      <Icon aria-hidden className="size-3.5" strokeWidth={2} />
      {children}
    </Button>
  );
}

const GROUPS: [ProjectsGroup, string][] = [
  ["area", "Area"],
  ["pace", "Pace"],
  ["due", "Due date"],
];
const SORTS: [ProjectsSort, string][] = [
  ["due", "Due date"],
  ["progress", "Progress"],
  ["name", "Name"],
];

/** Project cards in columns, grouped, sorted and filtered from the card's corner menu. */
function ProjectsBoard({
  overview,
  period,
  areas,
}: {
  overview: ProjectsOverviewRead;
  period: Period;
  areas: LifeAreaRead[];
}) {
  const { group, sort, showFinished, setGroup, setSort, toggleFinished } =
    useProjectsOverviewStore();
  const columns = projectColumns(overview, areas, group, sort, showFinished);
  const menu: MenuOption[] = [
    ...GROUPS.map(([id, label]) => ({
      section: "Group by",
      id: `group-${id}`,
      label,
      selected: group === id,
    })),
    ...SORTS.map(([id, label]) => ({
      section: "Sort by",
      id: `sort-${id}`,
      label,
      selected: sort === id,
    })),
    {
      section: "",
      id: "finished",
      label: "Show finished projects",
      selected: showFinished,
      check: true,
    },
  ];
  const onMenu = (id: string) => {
    if (id === "finished") toggleFinished();
    else if (id.startsWith("group-")) setGroup(id.slice(6) as ProjectsGroup);
    else setSort(id.slice(5) as ProjectsSort);
  };
  const colorOf = (project: OverviewProjectRead) =>
    areas.find((area) => area.id === project.life_area_id)?.color ?? null;

  return (
    <SectionCard
      title="Projects"
      description={boardSubtitle(overview, period)}
      action={<CardMenu label="Projects" options={menu} onSelect={onMenu} />}
    >
      {columns.length === 0 ? (
        <CardEmpty>No active projects.</CardEmpty>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {columns.map((column) => (
            <section key={column.key} aria-label={column.title} className="flex flex-col gap-2">
              <h3
                data-area={column.area === undefined ? undefined : areaDataAttribute(column.area)}
                className="flex h-7 items-center gap-2 text-sm font-semibold text-(--text-primary)"
              >
                {column.area !== undefined && (
                  <span aria-hidden className="size-2.5 rounded-[2px] bg-(--area-solid)" />
                )}
                <span className="truncate">{column.title}</span>
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-(--color-neutral-100) px-1 text-[11px] font-medium text-(--text-secondary)">
                  {column.projects.length}
                </span>
              </h3>
              {column.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  color={colorOf(project)}
                  today={overview.today}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/** Folder, name, progress bar, the date line and "3 / 5". Finished: struck through, grey. */
function ProjectCard({
  project,
  color,
  today,
}: {
  project: OverviewProjectRead;
  color: string | null;
  today: string;
}) {
  const done = project.status === "done";
  const share = project.total ? (project.done / project.total) * 100 : 0;
  return (
    <Link
      to={projectPath(project.id)}
      data-area={areaDataAttribute(color)}
      className="flex flex-col gap-2 rounded-(--radius-8) border border-(--card-border) bg-(--bg-surface) px-3 py-2 outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Folder
          aria-hidden
          className={`size-4 shrink-0 ${done ? "text-(--text-disabled)" : "text-(--area-solid)"}`}
          strokeWidth={2}
        />
        <span
          className={`truncate text-sm leading-5 font-medium ${
            done ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"
          }`}
        >
          {project.title}
        </span>
      </span>
      {project.total > 0 || !done ? (
        <span className="ml-6 h-1 rounded-full bg-(--area-tint-active)">
          <span
            className={`block h-full rounded-full ${done ? "bg-neutral-300" : "bg-(--area-solid)"}`}
            style={{ width: `${share}%` }}
          />
        </span>
      ) : null}
      <span className="ml-6 flex items-center gap-2 type-meta text-(--text-tertiary)">
        <span className="truncate">{cardDateLine(project, today)}</span>
        {project.total > 0 && (
          <span className="ml-auto shrink-0 tabular-nums">
            {project.done} / {project.total}
          </span>
        )}
      </span>
    </Link>
  );
}

function FirstProjectWelcome({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="m-auto flex max-w-[420px] flex-col items-center gap-3 pb-20 text-center">
      <Folder aria-hidden className="size-10 text-(--color-brand-600)" strokeWidth={1.5} />
      <h2 className="mt-1.5 type-page-title text-(--text-primary)">Start your first project</h2>
      <p className="text-[13px] leading-5 text-(--text-secondary)">
        A project is a piece of work with an end, like a portfolio or a room makeover. It lives in
        one life area and holds its own tasks, sections, events, routine steps and metrics.
      </p>
      <Button onPress={onCreate} isDisabled={!canCreate} className="h-9 px-4 text-[13px]">
        <Plus aria-hidden />
        New project
      </Button>
      {!canCreate && <p className="type-meta text-(--text-tertiary)">Add a life area first.</p>}
    </div>
  );
}
