import { Button } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChartLine, Check, CircleMinus, Folder, Minus, Play, X } from "lucide-react";
import {
  clearRoutineStepDayMutation,
  listRoutineStepsForDayOptions,
  resumeRoutineMutation,
  setRoutineStepDayMutation,
  skipRoutineDayMutation,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead, RoutinePageRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { QueryError } from "../../components/QueryError";
import { shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { ProgressRing } from "../tasks/RoutinesPage";
import { type DayRow, dayCard, weekdayDate } from "./routine";

/**
 * The Day card beside the heatmap: today by default, or the day clicked in the heatmap.
 * Each due step with a round checkbox in its area colour; Skip on hover, and Skip day.
 * A day that hasn't come can be skipped but not checked.
 */
export function DayCard({
  page,
  day,
  onToday,
  areas,
  projects,
}: {
  page: RoutinePageRead;
  day: string;
  onToday: () => void;
  areas: LifeAreaRead[];
  projects: ProjectRead[];
}) {
  const due = useQuery(listRoutineStepsForDayOptions({ query: { day } }));
  const skipDay = useMutation(skipRoutineDayMutation());
  const resume = useMutation(resumeRoutineMutation());
  const isToday = day === page.today;
  const card = due.data ? dayCard(page, day, due.data) : null;
  const label = weekdayDate(day);
  const isArchived = page.routine.archived_at !== null;

  return (
    <section
      aria-label="Day"
      className="flex min-w-0 flex-col rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface)"
    >
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-(--border-default) pr-2 pl-4">
        <h2 className="type-column-title text-(--text-primary)">
          {isToday ? "Today" : label.slice(0, 3)}
        </h2>
        <span className="type-meta text-(--text-tertiary)">{isToday ? label : label.slice(5)}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {!isToday && (
            <Button size="sm" variant="secondary" onPress={onToday}>
              Today
            </Button>
          )}
          {card?.kind === "steps" && card.total > 0 && (
            <>
              <ProgressRing done={card.done} total={card.total} />
              <span className="type-meta text-(--text-tertiary) tabular-nums">
                {card.done}/{card.total}
              </span>
            </>
          )}
        </span>
      </header>
      <div className="flex flex-col p-2">
        {due.isError && <QueryError error={due.error} onRetry={due.refetch} />}
        {(skipDay.error || resume.error) && <QueryError error={skipDay.error ?? resume.error} />}
        {card?.kind === "not_due" && (
          <p className="px-2 py-3 type-meta text-(--text-tertiary)">
            Not due.{card.next ? ` Next: ${weekdayDate(card.next)}.` : ""}
          </p>
        )}
        {card?.kind === "paused" && (
          <div className="flex flex-col items-start gap-2 px-2 py-3">
            <p className="type-meta text-(--text-tertiary)">
              Paused since {shortDate(card.since)}.
            </p>
            {isToday && !isArchived && (
              <Button
                size="sm"
                variant="secondary"
                isDisabled={resume.isPending}
                onPress={() => resume.mutate({ path: { routine_id: page.routine.id } })}
              >
                <Play aria-hidden />
                Resume
              </Button>
            )}
          </div>
        )}
        {card?.kind === "steps" && (
          <>
            <ul aria-label={`Steps on ${label}`} className="flex flex-col">
              {card.rows.map((item) => (
                <StepRow
                  key={item.row.step.id}
                  item={item}
                  day={day}
                  isToday={isToday}
                  isPast={day < page.today}
                  isArchived={isArchived}
                  color={
                    areas.find((area) => area.id === item.row.step.life_area_id)?.color ?? undefined
                  }
                  project={projects.find((project) => project.id === item.row.step.project_id)}
                />
              ))}
            </ul>
            {card.canSkipDay && !isArchived && (
              <div className="flex px-1 pt-2 pb-1">
                <Button
                  size="sm"
                  variant="ghost"
                  isDisabled={skipDay.isPending}
                  onPress={() => skipDay.mutate({ path: { routine_id: page.routine.id, day } })}
                >
                  <CircleMinus aria-hidden />
                  Skip day
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const STATE_LABEL: Partial<Record<DayRow["state"], string>> = {
  skipped: "Skipped",
  missed: "Missed",
};

function StepRow({
  item,
  day,
  isToday,
  isPast,
  isArchived,
  color,
  project,
}: {
  item: DayRow;
  day: string;
  isToday: boolean;
  isPast: boolean;
  isArchived: boolean;
  color: string | undefined;
  project: ProjectRead | undefined;
}) {
  const set = useMutation(setRoutineStepDayMutation());
  const clear = useMutation(clearRoutineStepDayMutation());
  const { row, state } = item;
  const { step } = row;
  const path = { step_id: step.id, day };
  const isDone = state === "done";
  const busy = set.isPending || clear.isPending;
  const canCheck = state !== "upcoming" && !isArchived;
  const canSkip =
    !isArchived && (state === "todo" || state === "upcoming" || (state === "missed" && isPast));
  const toggle = () => {
    if (isDone) clear.mutate({ path });
    else set.mutate({ path, body: { status: "done" } });
  };
  const muted = state === "skipped" || state === "missed";
  return (
    <li
      data-area={areaDataAttribute(color)}
      className="group relative flex items-start gap-2.5 rounded-(--radius-6) px-2 py-[7px] hover:bg-(--bg-hover)"
    >
      <label
        className={`relative mt-0.5 grid size-4 shrink-0 place-items-center ${canCheck ? "cursor-pointer" : ""}`}
        title={state === "upcoming" ? "Can be checked on the day" : undefined}
      >
        <input
          type="checkbox"
          checked={isDone}
          disabled={!canCheck || busy}
          aria-label={isDone ? `Mark ${step.title} not done` : `Mark ${step.title} done`}
          onChange={toggle}
          className={`size-4 cursor-pointer appearance-none rounded-full border-2 outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:cursor-default ${
            isDone
              ? "border-(--area-border) bg-(--area-border)"
              : muted || state === "upcoming"
                ? "border-(--color-neutral-300)"
                : "border-(--area-solid)"
          }`}
        />
        {isDone && (
          <Check
            aria-hidden
            className="pointer-events-none absolute size-[9px] text-white"
            strokeWidth={3.5}
          />
        )}
        {state === "skipped" && (
          <Minus
            aria-hidden
            className="pointer-events-none absolute size-[9px] text-(--color-neutral-500)"
            strokeWidth={3.5}
          />
        )}
        {state === "missed" && (
          <X
            aria-hidden
            className="pointer-events-none absolute size-[9px] text-(--color-neutral-500)"
            strokeWidth={3.5}
          />
        )}
      </label>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`text-sm leading-5 ${
            isDone
              ? "text-(--text-tertiary) line-through"
              : muted
                ? "text-(--text-tertiary)"
                : "text-(--text-primary)"
          }`}
        >
          {step.title}
        </span>
        {(project || row.metric || (isToday && step.current_streak > 1)) && (
          <span className="flex flex-wrap gap-2.5 text-xs leading-4 text-(--text-tertiary)">
            {project && (
              <span className="inline-flex items-center gap-[3px]">
                <Folder aria-hidden className="size-[11px] text-(--area-solid)" />
                {project.title}
              </span>
            )}
            {row.metric && (
              <span className="inline-flex items-center gap-[3px]">
                <ChartLine aria-hidden className="size-[11px]" />
                {row.metric.title}
              </span>
            )}
            {isToday && step.current_streak > 1 && <span>Streak {step.current_streak}</span>}
          </span>
        )}
        {(set.isError || clear.isError) && (
          <span role="alert" className="type-meta text-(--text-danger)">
            Couldn't save
          </span>
        )}
      </div>
      {STATE_LABEL[state] && (
        <span className="text-xs leading-5 text-(--text-tertiary)">{STATE_LABEL[state]}</span>
      )}
      {canSkip && (
        <span className="hidden group-focus-within:block group-hover:block">
          <IconButton
            label={`Skip ${step.title}`}
            isDisabled={busy}
            onPress={() => set.mutate({ path, body: { status: "skipped" } })}
          >
            <CircleMinus />
          </IconButton>
        </span>
      )}
    </li>
  );
}
