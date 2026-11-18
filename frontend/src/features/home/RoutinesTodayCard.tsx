import { useMutation } from "@tanstack/react-query";
import { ChevronDown, CircleMinus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { skipRoutineDayMutation } from "../../client/@tanstack/react-query.gen";
import type { HomeRead, HomeRoutineRead, ProjectRead } from "../../client/types.gen";
import { CardEmpty, SectionCard } from "../../components/SectionCard";
import { useChangeToast } from "../../stores/changeToastStore";
import { PanelMenu } from "../detail-panel/PanelParts";
import { StepRow } from "../routines/DayCard";
import { weekdayDate } from "../routines/routine";
import { ProgressRing } from "../tasks/RoutinesPage";
import { routineCount } from "./home";

/** One block per routine due today, made from the routine page's Day card. A routine whose
 * steps are all done starts collapsed to its header. */
export function RoutinesTodayCard({
  home,
  colorOf,
  projects,
}: {
  home: HomeRead;
  colorOf: (lifeAreaId: number | null) => string | null;
  projects: readonly ProjectRead[];
}) {
  const totals = home.routines.reduce(
    (sum, routine) => {
      const count = routineCount(routine.steps);
      return { done: sum.done + count.done, total: sum.total + count.total };
    },
    { done: 0, total: 0 },
  );
  return (
    <SectionCard
      title="Routines today"
      description={
        home.routines.length > 0 ? `${totals.done} of ${totals.total} steps done` : undefined
      }
    >
      {home.routines.length === 0 ? (
        <CardEmpty>No routines due today.</CardEmpty>
      ) : (
        <div className="-mx-2 flex flex-col">
          {home.routines.map((routine) => (
            <RoutineBlock
              key={routine.routine_id}
              routine={routine}
              today={home.today}
              colorOf={colorOf}
              projects={projects}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function RoutineBlock({
  routine,
  today,
  colorOf,
  projects,
}: {
  routine: HomeRoutineRead;
  today: string;
  colorOf: (lifeAreaId: number | null) => string | null;
  projects: readonly ProjectRead[];
}) {
  const { done, total } = routineCount(routine.steps);
  const allDone = done === total;
  // Collapsed while every step is done, until opened or closed by hand.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const isOpen = toggled ?? !allDone;
  const showToast = useChangeToast((state) => state.show);
  const skipDay = useMutation({
    ...skipRoutineDayMutation(),
    onSuccess: (change) => showToast(`Skipped day · ${weekdayDate(today)}`, change.batch_id),
  });
  const canSkipDay = routine.steps.some((step) => step.status === "todo");

  return (
    <section
      aria-label={routine.title}
      className="group/routine border-(--color-neutral-100) not-first:mt-1.5 not-first:border-t not-first:pt-1.5"
    >
      <div className="flex h-9 items-center gap-2 rounded-(--radius-6) px-2 hover:bg-(--color-neutral-50)">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={isOpen ? `Collapse ${routine.title}` : `Expand ${routine.title}`}
          onClick={() => setToggled(!isOpen)}
          className="-ml-1 grid size-6 place-items-center rounded-(--radius-4) text-(--text-tertiary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          <ChevronDown
            aria-hidden
            className={`size-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`}
          />
        </button>
        <ProgressRing done={done} total={total} className="size-4" />
        <Link
          to={`/areas/routines/${routine.routine_id}`}
          className="truncate rounded-(--radius-4) text-sm font-semibold text-(--text-primary) outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          {routine.title}
        </Link>
        <span className="ml-auto type-meta text-(--text-tertiary) tabular-nums">
          {done}/{total}
        </span>
        <span className="opacity-0 group-focus-within/routine:opacity-100 group-hover/routine:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <PanelMenu
            label={`More for ${routine.title}`}
            actions={[
              {
                id: "skip",
                label: "Skip day",
                icon: CircleMinus,
                isDisabled: !canSkipDay || skipDay.isPending,
                onAction: () =>
                  skipDay.mutate({ path: { routine_id: routine.routine_id, day: today } }),
              },
            ]}
          />
        </span>
      </div>
      {isOpen && (
        <ul aria-label={`Steps of ${routine.title}`} className="flex flex-col pl-5">
          {routine.steps.map((step) => (
            <StepRow
              key={step.step_id}
              step={{ id: step.step_id, title: step.title, streak: step.streak }}
              metric={step.metric}
              state={step.status}
              day={today}
              today={today}
              color={colorOf(step.life_area_id) ?? undefined}
              project={projects.find((project) => project.id === step.project_id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
