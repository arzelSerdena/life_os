import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Pause } from "lucide-react";
import { Link } from "react-router";
import {
  clearRoutineStepDayMutation,
  getRoutinesHistoryOptions,
  setRoutineStepDayMutation,
} from "../../client/@tanstack/react-query.gen";
import type { StepDayState } from "../../client/types.gen";
import { QueryError } from "../../components/QueryError";
import { areaDataAttribute } from "../life-areas/palette";
import {
  type DayState,
  type RoutineColumn,
  routineColumn,
  type StepView,
  squareLabel,
} from "./routines";
import { Counter } from "./TaskBoard";
import { useTasksContext } from "./TasksLayout";

/** Tasks › Routines: one column per routine, a card per step with its last seven days. */
export function RoutinesPage() {
  const { data, error: tasksError } = useTasksContext();
  const history = useQuery(getRoutinesHistoryOptions());
  const error = tasksError ?? history.error;
  const colorOf = (lifeAreaId: number) =>
    data?.lifeAreas.find((area) => area.id === lifeAreaId)?.color ?? null;

  return (
    <>
      <header className="box-content flex h-(--page-header-height) shrink-0 items-center gap-3 px-(--page-gutter) pt-(--page-gutter)">
        <h1 className="truncate type-page-title text-(--page-title)">Routines</h1>
      </header>
      {error ? (
        <div className="p-(--page-gutter)">
          <QueryError error={error} />
        </div>
      ) : !data || !history.data ? (
        <p className="p-(--page-gutter) type-meta text-(--text-tertiary)">Loading…</p>
      ) : history.data.routines.length === 0 ? (
        <p className="p-(--page-gutter) type-body text-(--text-tertiary)">No routines yet.</p>
      ) : (
        <div className="@container min-h-0 flex-1 overflow-x-auto px-(--page-gutter) pt-4">
          <div className="flex h-full min-w-min gap-4">
            {history.data.routines.map((routine) => (
              <RoutineColumnView
                key={routine.id}
                column={routineColumn(routine, history.data.today)}
                today={history.data.today}
                colorOf={colorOf}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RoutineColumnView({
  column,
  today,
  colorOf,
}: {
  column: RoutineColumn;
  today: string;
  colorOf: (lifeAreaId: number) => string | null;
}) {
  const { routine } = column;
  const headingId = `routine-${routine.id}`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 min-w-[260px] flex-[0_0_calc((100cqw_-_64px)/5)] flex-col"
    >
      <header className="shrink-0 px-0.5">
        <div className="flex h-7 items-center gap-2">
          {routine.paused_since ? (
            <Pause
              role="img"
              aria-label="Paused"
              className="size-4 shrink-0 text-(--text-tertiary)"
              strokeWidth={2}
            />
          ) : (
            <ProgressRing done={column.done} total={column.total} />
          )}
          <h2
            id={headingId}
            className="truncate text-base leading-6 font-semibold text-(--text-primary)"
          >
            <Link
              to={`/areas/routines/${routine.id}`}
              className="rounded-[4px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
            >
              {routine.title}
            </Link>
          </h2>
          {column.total > 0 && <Counter count={`${column.done}/${column.total}`} />}
        </div>
        <p className="-mt-0.5 pl-[26px] type-meta text-(--text-tertiary)">{column.subtitle}</p>
      </header>
      <ul
        aria-label={`${routine.title} steps`}
        className="mt-3.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-6"
      >
        {column.steps.map((view) => (
          <StepCard
            key={view.step.id}
            view={view}
            today={today}
            color={colorOf(view.step.life_area_id)}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * A step: round checkbox in the area colour, the title, then its next due day when it isn't
 * due today, the last seven days as squares and the done count. Routine steps never open
 * the detail panel.
 */
function StepCard({ view, today, color }: { view: StepView; today: string; color: string | null }) {
  const check = useMutation(setRoutineStepDayMutation());
  const clear = useMutation(clearRoutineStepDayMutation());
  const { step, done, dueToday } = view;
  const path = { step_id: step.id, day: today };
  const toggle = () => {
    if (done) clear.mutate({ path });
    else check.mutate({ path, body: { status: "done" } });
  };
  const active = dueToday && view.todayState !== "skipped";
  return (
    <li
      data-area={areaDataAttribute(color)}
      className="flex flex-col gap-0.5 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 py-2"
    >
      <div className="flex items-start gap-2">
        <label className="relative -mx-1 -mt-0.5 -mb-1 grid size-6 shrink-0 cursor-pointer place-items-center has-disabled:cursor-default">
          <input
            type="checkbox"
            checked={done}
            disabled={!dueToday || check.isPending || clear.isPending}
            aria-label={done ? `Mark ${step.title} not done` : `Mark ${step.title} done`}
            onChange={toggle}
            className={`size-3.5 cursor-pointer appearance-none rounded-full border-2 outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) disabled:cursor-default ${
              done
                ? "border-(--area-border) bg-(--area-border)"
                : active
                  ? "border-(--area-solid)"
                  : "border-(--color-neutral-300)"
            }`}
          />
          {done && (
            <Check
              aria-hidden
              className="pointer-events-none absolute size-2 text-white"
              strokeWidth={3.5}
            />
          )}
        </label>
        <span
          className={`line-clamp-2 flex-1 type-card-title ${
            done ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"
          }`}
        >
          {step.title}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 pl-6 type-meta text-(--text-tertiary)">
        {view.next && <span className="whitespace-nowrap">{view.next}</span>}
        {(check.isError || clear.isError) && (
          <span role="alert" className="text-(--text-danger)">
            Couldn't save
          </span>
        )}
        <span className="ml-auto inline-flex gap-0.5" aria-hidden>
          {step.days.map((item) => (
            <Square key={item.day} item={item} />
          ))}
        </span>
        <span className="min-w-[22px] text-right text-[11px] tabular-nums">
          <span aria-hidden>
            {view.doneCount}/{view.dueCount}
          </span>
          <span className="sr-only">
            {view.doneCount} of {view.dueCount} done in the last 7 days
          </span>
        </span>
      </div>
    </li>
  );
}

const SQUARE: Record<DayState, string> = {
  done: "bg-(--area-solid)",
  skipped: "bg-(--color-neutral-300)",
  missed: "bg-(--bg-surface) shadow-[inset_0_0_0_1.5px_var(--color-neutral-300)]",
  todo: "bg-(--bg-surface) shadow-[inset_0_0_0_1.5px_var(--color-brand-500)]",
  upcoming: "bg-(--color-neutral-200)",
  paused:
    "bg-[repeating-linear-gradient(135deg,var(--color-neutral-300)_0_1.5px,transparent_1.5px_3.5px)]",
  // A small dot in the middle.
  not_due:
    "bg-[radial-gradient(circle,var(--color-neutral-300)_1.5px,transparent_1.6px)] bg-center",
  none: "",
};

function Square({ item }: { item: StepDayState }) {
  return (
    <i
      title={squareLabel(item)}
      className={`block size-[9px] rounded-[2px] ${SQUARE[item.state]}`}
    />
  );
}

/** Today's progress: an accent arc on a grey ring; an empty grey ring when nothing is due. */
export function ProgressRing({
  done,
  total,
  className = "size-[18px]",
}: {
  done: number;
  total: number;
  /** Its size: 18 px by default, 16 px in the sidebar. */
  className?: string;
}) {
  const circumference = 2 * Math.PI * 7;
  const filled = total ? (done / total) * circumference : 0;
  return (
    <svg aria-hidden viewBox="0 0 18 18" className={`${className} shrink-0`}>
      <circle cx="9" cy="9" r="7" fill="none" strokeWidth="2.5" stroke="var(--color-neutral-200)" />
      {filled > 0 && (
        <circle
          cx="9"
          cy="9"
          r="7"
          fill="none"
          strokeWidth="2.5"
          stroke="var(--color-brand-600)"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform="rotate(-90 9 9)"
        />
      )}
    </svg>
  );
}
