import { Folder } from "lucide-react";
import type { AreaPageRead, StepRowRead } from "../../../client/types.gen";
import { CardEmpty, SectionCard } from "../../../components/SectionCard";
import { type Period, periodInSentence } from "../../../period";
import { PanelLink } from "../../detail-panel/PanelLink";
import { daysBetween, plural, shortDate } from "../overview/format";
import { describeRule, eachDay, scaleTicks, timeScale } from "./timeScale";

/** Board-style project cards with the strong area progress bar. */
export function ProjectsCard({ page }: { page: AreaPageRead }) {
  const active = page.projects.filter((project) => project.status === "active");
  const finished = page.projects.length - active.length;
  const name = periodInSentence(page.period as Period, page.range.start);
  if (page.projects.length === 0) {
    return (
      <SectionCard title="Projects">
        <CardEmpty>No active projects.</CardEmpty>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title="Projects"
      description={`${active.length} active${finished ? ` · ${finished} done in ${name}` : ""}`}
    >
      <ul className="grid grid-cols-4 gap-2">
        {page.projects.map((project) => {
          const done = project.status === "done";
          const share = project.total ? (project.done / project.total) * 100 : 0;
          const left = project.due_date ? daysBetween(page.today, project.due_date) : null;
          const when = done
            ? `Done ${shortDate(project.completed_on ?? page.today)}`
            : project.due_date
              ? `Due ${shortDate(project.due_date)} · ${
                  left !== null && left < 0
                    ? `${plural(-left, "day")} late`
                    : `in ${plural(left ?? 0, "day")}`
                }`
              : "No due date";
          return (
            <li
              key={project.id}
              className="relative flex min-w-0 flex-col gap-1.5 rounded-(--radius-8) border border-(--border-default) px-3 py-2 hover:bg-(--bg-hover)"
            >
              <span className="flex min-w-0 items-start gap-2">
                <Folder
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-(--area-solid)"
                  strokeWidth={2}
                />
                <PanelLink
                  stretched
                  target={{ kind: "project", id: project.id }}
                  className={`text-sm font-medium ${done ? "text-(--text-disabled) line-through" : "text-(--text-primary)"}`}
                >
                  {project.title}
                </PanelLink>
              </span>
              <span className="ml-6 h-1 rounded-full bg-(--area-tint-active)">
                <span
                  className={`block h-full rounded-full ${done ? "bg-neutral-300" : "bg-(--area-solid)"}`}
                  style={{ width: `${share}%` }}
                />
              </span>
              <span className="ml-6 flex justify-between gap-2 type-meta text-(--text-tertiary)">
                <span>{when}</span>
                <span className="font-semibold whitespace-nowrap text-(--text-secondary) tabular-nums">
                  {project.done} / {project.total}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

const DAY_STYLE: Record<StepRowRead["days"][number], string> = {
  done: "bg-(--area-solid)",
  skipped: "bg-(--area-border)",
  missed: "bg-neutral-200",
  paused:
    "bg-[repeating-linear-gradient(135deg,var(--color-neutral-300)_0_2px,transparent_2px_4px)]",
  todo: "bg-white shadow-[inset_0_0_0_1.5px_var(--area-solid)]",
  upcoming: "bg-white shadow-[inset_0_0_0_1px_var(--color-neutral-300)]",
  not_due: "",
};
const DAY_NAMES: Record<StepRowRead["days"][number], string> = {
  done: "done",
  skipped: "skipped",
  missed: "missed",
  paused: "paused",
  todo: "today, to do",
  upcoming: "upcoming",
  not_due: "not due",
};

/** One heatmap row per step in this area, grouped under its routine; one square per day. */
export function RoutinesCard({ page }: { page: AreaPageRead }) {
  const steps = page.routines.reduce((sum, group) => sum + group.steps.length, 0);
  if (steps === 0) {
    return (
      <SectionCard title="Routines">
        <CardEmpty>No routine steps in this area.</CardEmpty>
      </SectionCard>
    );
  }
  const days = eachDay(page.range);
  const scale = timeScale(page.range);
  const { months } = scaleTicks(page.range, page.period as Period);
  const columns = { gridTemplateColumns: "minmax(0, 180px) 1fr" };
  return (
    <SectionCard
      title="Routines"
      description={`${plural(steps, "step")} in ${plural(page.routines.length, "routine")}`}
    >
      <div className="grid" style={columns}>
        <span />
        <div className="relative h-6 border-b border-(--border-default) text-xs font-medium text-(--text-secondary)">
          {months.map((month) => (
            <span
              key={month.date}
              className="absolute top-0 pl-1"
              style={{ left: `${scale.at(month.date)}%` }}
            >
              {month.label}
            </span>
          ))}
        </div>
      </div>
      {page.routines.map((group) => (
        <div
          key={group.routine_id}
          className="border-b border-(--border-default) py-2 last:border-b-0"
        >
          <p className="flex h-7 items-center gap-2 text-xs">
            <PanelLink
              target={{ kind: "routine", id: group.routine_id }}
              className="font-semibold tracking-[0.04em] text-(--text-tertiary) uppercase"
            >
              {group.title}
            </PanelLink>
            <span className="text-(--text-tertiary)">{describeRule(group.rrule)}</span>
            <span className="ml-auto text-(--text-tertiary)">
              {group.steps.length} of its {plural(group.total_steps, "step")}{" "}
              {group.steps.length === 1 ? "is" : "are"} in {page.life_area.title}
            </span>
          </p>
          {group.steps.map((row) => (
            <div key={row.step_id} className="grid h-7 items-center" style={columns}>
              <PanelLink
                target={{ kind: "step", id: row.step_id, routineId: group.routine_id }}
                className="truncate pr-2 text-[13px] text-(--text-primary)"
              >
                {row.title}
              </PanelLink>
              <span
                className="grid h-3 items-center gap-px"
                style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
              >
                {row.days.map((status, index) => (
                  <i
                    key={days[index]}
                    title={`${row.title}, ${shortDate(days[index])}: ${DAY_NAMES[status]}`}
                    className={`block rounded-[1px] ${
                      status === "not_due"
                        ? "mx-auto size-[2px] bg-neutral-300"
                        : `h-3 ${DAY_STYLE[status]}`
                    }`}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      ))}
    </SectionCard>
  );
}
