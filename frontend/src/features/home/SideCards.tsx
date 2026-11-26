import { CalendarDays, ChartLine, ChevronRight, Folder, Inbox, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import type { HomeRead, ProjectRead, PushProjectRead } from "../../client/types.gen";
import { CardEmpty, SectionCard } from "../../components/SectionCard";
import { useNewTask } from "../../stores/newTaskStore";
import type { RowContext } from "../calendar/AgendaRow";
import { PanelLink } from "../detail-panel/PanelLink";
import { plural, shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { DueBadge, NextUpRow, QuickAction } from "../projects/ProjectsOverviewPage";
import { projectPath } from "../projects/paths";
import { behindLine, type ComingUpDay, comingUpSubtitle, PUSH_ROWS } from "./home";
import { Counter, ScheduleRow } from "./TodayCard";

/** The Inbox count, then Projects (due within 7 days, stalled, no next step) and Metrics
 * (behind target), each heading opening its screen. At most 3 rows a section, then "+n
 * more". Empty sections are hidden. */
export function PushCard({
  home,
  colorOf,
  projects,
}: {
  home: HomeRead;
  colorOf: (lifeAreaId: number | null) => string | null;
  projects: readonly ProjectRead[];
}) {
  const projectRows = home.push_projects;
  const metricRows = home.push_metrics;
  const isCalm = home.inbox === 0 && projectRows.length === 0 && metricRows.length === 0;
  return (
    <SectionCard title="Needs a push">
      {isCalm ? (
        <CardEmpty>Nothing needs a push.</CardEmpty>
      ) : (
        <div className="flex flex-col">
          {home.inbox > 0 && (
            <Link
              to="/tasks/inbox"
              className="-mx-2 flex min-h-11 items-center gap-2.5 rounded-(--radius-6) px-2 outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
            >
              <Inbox aria-hidden className="size-4 text-(--text-tertiary)" strokeWidth={2} />
              <span className="flex-1 text-sm text-(--text-primary)">Inbox</span>
              <Counter count={home.inbox} />
            </Link>
          )}
          {projectRows.length > 0 && (
            <PushSection title="Projects" to="/areas/projects" count={projectRows.length}>
              {projectRows.slice(0, PUSH_ROWS).map((row) => (
                <PushProjectRow
                  key={row.id}
                  row={row}
                  today={home.today}
                  color={colorOf(row.life_area_id)}
                />
              ))}
            </PushSection>
          )}
          {metricRows.length > 0 && (
            <PushSection title="Metrics" to="/areas" count={metricRows.length}>
              {metricRows.slice(0, PUSH_ROWS).map((metric) => {
                const project = projects.find((item) => item.id === metric.project_id);
                return (
                  <li
                    key={metric.metric_id}
                    data-area={areaDataAttribute(colorOf(metric.life_area_id))}
                    className="relative flex items-center gap-2.5 py-1"
                  >
                    <ChartLine
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 self-start text-(--area-solid)"
                      strokeWidth={2}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <PanelLink
                        stretched
                        target={{ kind: "metric", id: metric.metric_id }}
                        className="truncate text-sm leading-5 text-(--text-primary)"
                      >
                        {metric.title}
                      </PanelLink>
                      <span className="flex min-w-0 items-center gap-1 type-meta text-(--text-tertiary)">
                        {project && (
                          <>
                            <Folder
                              aria-hidden
                              className="size-3 shrink-0 text-(--area-solid)"
                              strokeWidth={2}
                            />
                            <span className="truncate">{project.title}</span>
                            <span aria-hidden>·</span>
                          </>
                        )}
                        <span className="shrink-0">{behindLine(metric, home.today)}</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </PushSection>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function PushSection({
  title,
  to,
  count,
  children,
}: {
  title: string;
  to: string;
  count: number;
  children: ReactNode[];
}) {
  const more = count - children.length;
  return (
    <section
      aria-label={title}
      className="mt-1 border-t border-(--border-default) pt-2 first:mt-0 first:border-t-0 first:pt-0"
    >
      <h3 className="flex items-center gap-1.5 pb-1">
        <Link
          to={to}
          className="inline-flex items-center gap-0.5 rounded-(--radius-4) type-label text-(--text-tertiary) outline-none hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          {title}
          <ChevronRight aria-hidden className="size-[13px]" />
        </Link>
        <Counter count={count} />
      </h3>
      <ul className="flex flex-col gap-1">{children}</ul>
      {more > 0 && (
        <Link
          to={to}
          className="inline-block rounded-(--radius-4) py-1 pl-[26px] text-xs font-medium text-(--text-secondary) outline-none hover:text-(--text-primary) hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          +{more} more
        </Link>
      )}
    </section>
  );
}

function PushProjectRow({
  row,
  today,
  color,
}: {
  row: PushProjectRead;
  today: string;
  color: string | null;
}) {
  const openNewTask = useNewTask((state) => state.open);
  const navigate = useNavigate();
  const newTask = (scheduled: boolean) =>
    openNewTask(
      {
        lifeAreaId: row.life_area_id,
        projectId: row.id,
        scheduledDate: scheduled ? today : undefined,
      },
      today,
    );
  if (row.reason === "due" && row.due_date) {
    return (
      <NextUpRow
        project={row}
        color={color}
        leading={<DueBadge due={row.due_date} today={today} />}
        meta={`${shortDate(row.due_date)}${row.open > 0 ? ` · ${row.open} open` : ""}`}
      />
    );
  }
  if (row.reason === "stalled") {
    return (
      <NextUpRow
        project={row}
        color={color}
        meta={`Nothing done for ${plural(row.days, "day")}`}
        action={
          <QuickAction icon={CalendarDays} onPress={() => newTask(true)}>
            Plan task
          </QuickAction>
        }
      />
    );
  }
  return (
    <NextUpRow
      project={row}
      color={color}
      meta={row.open === 0 ? "No tasks yet" : `${row.open} open, none scheduled`}
      action={
        row.open === 0 ? (
          <QuickAction icon={Plus} onPress={() => newTask(false)}>
            Add task
          </QuickAction>
        ) : (
          <QuickAction icon={CalendarDays} onPress={() => navigate(projectPath(row.id))}>
            Schedule
          </QuickAction>
        )
      }
    />
  );
}

/** The next 7 days' fixed-date items (events, project due dates, target deadlines) by day.
 * Tasks are left out: Tasks › Next 7 days has them. */
export function ComingUpCard({
  home,
  days,
  context,
}: {
  home: HomeRead;
  days: ComingUpDay[];
  context: RowContext;
}) {
  return (
    <SectionCard
      title="Coming up"
      description={comingUpSubtitle(home, days)}
      action={
        <Link
          to="/calendar"
          aria-label="Open calendar"
          title="Open calendar"
          className="grid size-6 shrink-0 place-items-center rounded-(--radius-6) text-(--text-tertiary) outline-none hover:bg-(--bg-hover) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          <CalendarDays aria-hidden className="size-4" strokeWidth={2} />
        </Link>
      }
    >
      {days.length === 0 ? (
        <CardEmpty>Nothing in the next 7 days.</CardEmpty>
      ) : (
        <div className="-mx-2 flex flex-col gap-3">
          {days.map((day) => (
            <section key={day.day} aria-label={`${day.title} ${day.subtitle}`}>
              <h3 className="flex h-7 items-center gap-2 px-2 type-label text-(--text-tertiary)">
                {day.title}
                <span className="font-normal tracking-normal normal-case">{day.subtitle}</span>
              </h3>
              <ul className="flex flex-col">
                {day.items.map((item) => (
                  <ScheduleRow key={item.key} item={item} context={context} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
