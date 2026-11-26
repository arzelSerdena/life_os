import { useMutation } from "@tanstack/react-query";
import { CheckCheck, ChevronDown, CircleMinus } from "lucide-react";
import { useState } from "react";
import {
  setRoutineStepDayMutation,
  skipRoutineDayMutation,
} from "../../client/@tanstack/react-query.gen";
import type { HomeRead, HomeRoutineRead, ProjectRead } from "../../client/types.gen";
import { CardEmpty, SectionCard } from "../../components/SectionCard";
import { useChangeToast } from "../../stores/changeToastStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { type PanelAction, PanelMenu } from "../detail-panel/PanelParts";
import { useRowContextMenu } from "../item-menu/PointMenu";
import { StepRow } from "../routines/DayCard";
import { weekdayDate } from "../routines/routine";
import { useRoutineDragGuard } from "../routines/useRoutineDragGuard";
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
  const failToast = useChangeToast((state) => state.fail);
  const skipDay = useMutation({
    ...skipRoutineDayMutation(),
    onSuccess: (change) => showToast(`Skipped day · ${weekdayDate(today)}`, change.batch_id),
  });
  const completeStep = useMutation(setRoutineStepDayMutation());
  const remainingSteps = routine.steps.filter((step) => step.status === "todo");
  const canSkipDay = remainingSteps.length > 0;
  const completeRemaining = async () => {
    const results = await Promise.allSettled(
      remainingSteps.map((step) =>
        completeStep.mutateAsync({
          path: { step_id: step.step_id, day: today },
          body: { status: "done" },
        }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      failToast(`Couldn't complete ${failed} ${failed === 1 ? "step" : "steps"}`, null);
    } else {
      showToast(`Completed ${routine.title}`, null);
    }
  };
  const actions: PanelAction[] = [
    {
      id: "complete-remaining",
      label: "Complete remaining",
      icon: CheckCheck,
      isDisabled: !canSkipDay || completeStep.isPending,
      onAction: completeRemaining,
    },
    {
      id: "skip",
      label: "Skip day",
      icon: CircleMinus,
      isDisabled: !canSkipDay || skipDay.isPending,
      onAction: () => skipDay.mutate({ path: { routine_id: routine.routine_id, day: today } }),
    },
  ];
  const menuLabel = `More for ${routine.title}`;
  const rowMenu = useRowContextMenu(actions, menuLabel);
  const { shakeClass, onPointerDown } = useRoutineDragGuard();

  return (
    <section
      aria-label={routine.title}
      className={`group/routine border-(--color-neutral-100) not-first:mt-1.5 not-first:border-t not-first:pt-1.5 ${shakeClass}`}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: right-click opens the ⋯ menu, which the keyboard reaches by its button */}
      <div
        onContextMenu={rowMenu.onContextMenu}
        onPointerDown={onPointerDown}
        className="flex h-9 items-center gap-2 rounded-(--radius-6) px-2 hover:bg-(--color-neutral-50)"
      >
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
        <ProgressRing
          done={done}
          total={total}
          segments={routine.steps.map((s) => ({
            done: s.status === "done",
            color: colorOf(s.life_area_id),
          }))}
          className="size-4"
        />
        <PanelLink
          target={{ kind: "routine", id: routine.routine_id }}
          className="truncate text-sm font-semibold text-(--text-primary)"
        >
          {routine.title}
        </PanelLink>
        <span className="ml-auto type-meta text-(--text-tertiary) tabular-nums">
          {done}/{total}
        </span>
        <span className="opacity-0 group-focus-within/routine:opacity-100 group-hover/routine:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <PanelMenu label={menuLabel} actions={actions} />
        </span>
      </div>
      {rowMenu.menu}
      {isOpen && (
        <ul aria-label={`Steps of ${routine.title}`} className="flex flex-col pl-6">
          {routine.steps.map((step) => (
            <StepRow
              key={step.step_id}
              step={{ id: step.step_id, title: step.title, streak: step.streak }}
              metric={step.metric}
              state={step.status}
              day={today}
              today={today}
              routineId={routine.routine_id}
              color={colorOf(step.life_area_id) ?? undefined}
              project={projects.find((project) => project.id === step.project_id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
