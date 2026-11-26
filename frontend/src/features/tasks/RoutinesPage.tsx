import { useMutation, useQuery } from "@tanstack/react-query";
import { Pause } from "lucide-react";
import {
  clearRoutineStepDayMutation,
  getRoutinesHistoryOptions,
  setRoutineStepDayMutation,
} from "../../client/@tanstack/react-query.gen";
import type { StepDayState } from "../../client/types.gen";
import { EntityCheckbox } from "../../components/EntityCheckbox";
import { QueryError } from "../../components/QueryError";
import { Scroll } from "../../components/Scroll";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { itemMenuProps } from "../item-menu/target";
import { areaDataAttribute } from "../life-areas/palette";
import { useRoutineDragGuard } from "../routines/useRoutineDragGuard";
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
  const panelOpen = useDetailPanel((state) => state.target !== null);

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
        <Scroll
          direction="horizontal"
          fade={!panelOpen}
          className="@container min-h-0 flex-1 px-(--page-gutter) pt-4"
        >
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
        </Scroll>
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
  const { shakeClass, onPointerDown } = useRoutineDragGuard();
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 min-w-[260px] flex-[0_0_calc((100cqw_-_64px)/5)] flex-col"
    >
      <header
        className={`shrink-0 px-0.5 ${shakeClass}`}
        onPointerDown={onPointerDown}
        {...itemMenuProps({ kind: "routine", id: routine.id })}
      >
        <div className="flex h-7 items-center gap-2">
          {routine.paused_since ? (
            <Pause
              role="img"
              aria-label="Paused"
              className="size-4 shrink-0 text-(--text-tertiary)"
              strokeWidth={2}
            />
          ) : (
            <ProgressRing
              done={column.done}
              total={column.total}
              segments={column.steps
                .filter((s) => s.dueToday)
                .map((s) => ({
                  done: s.done,
                  color: colorOf(s.step.life_area_id),
                }))}
            />
          )}
          <h2
            id={headingId}
            className="truncate text-base leading-6 font-semibold text-(--text-primary)"
          >
            <PanelLink
              target={{ kind: "routine", id: routine.id }}
              className="text-base leading-6 font-semibold text-(--text-primary)"
            >
              {routine.title}
            </PanelLink>
          </h2>
          {column.total > 0 && <Counter count={`${column.done}/${column.total}`} />}
        </div>
        <p className="-mt-0.5 pl-[26px] type-meta text-(--text-tertiary)">{column.subtitle}</p>
      </header>
      <Scroll
        as="ul"
        aria-label={`${routine.title} steps`}
        className="mt-3.5 flex min-h-0 flex-1 flex-col gap-1.5 pb-6"
      >
        {column.steps.map((view) => (
          <StepCard
            key={view.step.id}
            view={view}
            today={today}
            routineId={routine.id}
            color={colorOf(view.step.life_area_id)}
          />
        ))}
      </Scroll>
    </section>
  );
}

/**
 * A step: round checkbox in the area colour, the title, then its next due day when it isn't
 * due today, the last seven days as squares and the done count. Routine steps never open
 * the detail panel.
 */
function StepCard({
  view,
  today,
  routineId,
  color,
}: {
  view: StepView;
  today: string;
  routineId: number;
  color: string | null;
}) {
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
      {...itemMenuProps({ kind: "step", id: step.id, routineId })}
      data-area={areaDataAttribute(color)}
      className="flex flex-col gap-0.5 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 py-2"
    >
      <div className="flex items-start gap-2">
        <EntityCheckbox
          shape="round"
          checked={done}
          disabled={!dueToday || check.isPending || clear.isPending}
          cancelled={!active}
          label={done ? `Mark ${step.title} not done` : `Mark ${step.title} done`}
          onChange={toggle}
          className="-mx-1 -mt-0.5 -mb-1 has-disabled:cursor-default"
        />
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
        <span className="min-w-[22px] text-right type-tag tabular-nums">
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
  skipped: "bg-(--border-strong)",
  missed: "bg-(--bg-surface) shadow-[inset_0_0_0_1.5px_var(--border-strong)]",
  todo: "bg-(--bg-surface) shadow-[inset_0_0_0_1.5px_var(--color-brand-500)]",
  upcoming: "bg-(--border-default)",
  paused:
    "bg-[repeating-linear-gradient(135deg,var(--border-strong)_0_1.5px,transparent_1.5px_3.5px)]",
  // A small dot in the middle.
  not_due: "bg-[radial-gradient(circle,var(--border-strong)_1.5px,transparent_1.6px)] bg-center",
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

export type ProgressRingSegment = {
  done: boolean;
  color: string | null;
};

/** Today's progress: divided into routine step arcs colored by each step's life area when
 * `segments` are provided, or a single accent arc on a grey ring. */
export function ProgressRing({
  done,
  total,
  segments,
  className = "size-[18px]",
}: {
  done: number;
  total: number;
  segments?: ProgressRingSegment[];
  /** Its size: 18 px by default, 16 px in the sidebar. */
  className?: string;
}) {
  const circumference = 2 * Math.PI * 7;
  if (segments && segments.length > 0) {
    const count = segments.length;
    const gap = count > 1 ? 2.2 : 0;
    const segLen = Math.max(circumference / count - gap, 1);
    const stepAngle = 360 / count;
    return (
      <svg aria-hidden viewBox="0 0 18 18" className={`${className} shrink-0`}>
        {segments.map((seg, index) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: segment order is step order
            key={index}
            cx="9"
            cy="9"
            r="7"
            fill="none"
            strokeWidth="2.5"
            data-area={seg.done ? areaDataAttribute(seg.color) : undefined}
            stroke={seg.done ? "var(--area-solid)" : "var(--color-neutral-200)"}
            strokeLinecap={count === 1 ? "round" : "butt"}
            strokeDasharray={`${segLen} ${circumference}`}
            transform={`rotate(${-90 + index * stepAngle} 9 9)`}
          />
        ))}
      </svg>
    );
  }
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
