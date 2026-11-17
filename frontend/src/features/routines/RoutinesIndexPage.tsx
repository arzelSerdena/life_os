import { Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Plus } from "lucide-react";
import { Link } from "react-router";
import { getRoutinesHistoryOptions } from "../../client/@tanstack/react-query.gen";
import { PageHeader } from "../../components/PageHeader";
import { QueryError } from "../../components/QueryError";
import { useAreasContext } from "../life-areas/AreasLayout";
import { ProgressRing } from "../tasks/RoutinesPage";
import { routineColumn } from "../tasks/routines";

/** Common routines offered when there are none yet; each opens New routine with its name. */
const QUICK_STARTS = ["Morning routine", "Evening routine", "Weekly reset", "Workout"];

/**
 * The page behind the ROUTINES heading. With no routines it shows "Set up your first
 * routine"; otherwise each routine with today's ring and schedule, until the Routines
 * overview replaces this list.
 */
export function RoutinesIndexPage() {
  const { openNewRoutine } = useAreasContext();
  const history = useQuery(getRoutinesHistoryOptions());
  const routines = history.data?.routines ?? [];

  return (
    <>
      <PageHeader
        title="Routines"
        actions={
          <Button onPress={() => openNewRoutine()}>
            <Plus aria-hidden />
            New routine
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
        {history.isError && <QueryError error={history.error} onRetry={history.refetch} />}
        {history.isSuccess && routines.length === 0 && (
          <FirstRoutineWelcome onCreate={openNewRoutine} />
        )}
        {routines.length > 0 && (
          <ul aria-label="Routines" className="flex max-w-[560px] flex-col gap-1">
            {routines.map((routine) => {
              const column = routineColumn(routine, history.data?.today ?? "");
              return (
                <li key={routine.id}>
                  <Link
                    to={`/areas/routines/${routine.id}`}
                    className="flex h-10 items-center gap-2.5 rounded-(--radius-8) border border-(--card-border) bg-(--bg-surface) px-3 outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
                  >
                    {routine.paused_since ? (
                      <Pause
                        aria-hidden
                        className="size-4 shrink-0 fill-(--color-neutral-500) stroke-none"
                      />
                    ) : (
                      <ProgressRing done={column.done} total={column.total} className="size-4" />
                    )}
                    <span className="truncate text-sm font-medium text-(--text-primary)">
                      {routine.title}
                    </span>
                    <span className="ml-auto shrink-0 type-meta text-(--text-tertiary)">
                      {column.subtitle}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function FirstRoutineWelcome({ onCreate }: { onCreate: (title?: string) => void }) {
  return (
    <div className="m-auto flex max-w-[420px] flex-col items-center gap-3 pb-20 text-center">
      <ProgressRing done={2} total={3} className="size-10" />
      <h2 className="mt-1.5 type-page-title text-(--text-primary)">Set up your first routine</h2>
      <p className="text-[13px] leading-5 text-(--text-secondary)">
        A routine is a list of steps you repeat on a schedule. Each step belongs to a life area or a
        project.
      </p>
      <Button onPress={() => onCreate()} className="h-9 px-4 text-[13px]">
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
