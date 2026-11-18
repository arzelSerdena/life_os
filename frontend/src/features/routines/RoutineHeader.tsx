import { Button } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CircleMinus,
  Pause,
  Play,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  archiveRoutineMutation,
  changeRoutineScheduleMutation,
  listRoutineStepsForDayOptions,
  pauseRoutineMutation,
  resumeRoutineMutation,
  skipRoutineDayMutation,
  unarchiveRoutineMutation,
  updateRoutineMutation,
} from "../../client/@tanstack/react-query.gen";
import { changeRoutineSchedule } from "../../client/sdk.gen";
import type { LifeAreaRead, RoutinePageRead, RoutineRead } from "../../client/types.gen";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { useChangeToast } from "../../stores/changeToastStore";
import { ConfirmDialog } from "../confirming/ConfirmDialog";
import { DeleteRoutineDialog, metricNames } from "../deleting/deleteDialogs";
import { type PanelAction, PanelMenu } from "../detail-panel/PanelParts";
import { shortDate } from "../life-areas/overview/format";
import { areaDataAttribute } from "../life-areas/palette";
import { chipClass } from "../pickers/chips";
import { DateChip } from "../pickers/DatePicker";
import { addDays } from "../pickers/dates";
import { RepeatChip } from "../pickers/RepeatPicker";
import { describeRepeat, parseRRule, toRRule } from "../pickers/repeat";
import { ProgressRing } from "../tasks/RoutinesPage";
import { scheduleImpact, scheduleLabel, stepAreaIds, weekdayDate } from "./routine";

/**
 * The routine page's header: today's ring, the name (click to rename), Paused since, the
 * schedule chip (the Repeat picker, then Change schedule), the steps' areas, the period
 * switch, the ⋯ menu (Skip today, Pause or Resume, Archive or Restore, Delete) and Add step.
 */
export function RoutineHeader({
  page,
  areas,
  hasSteps,
  onAddStep,
}: {
  page: RoutinePageRead;
  areas: LifeAreaRead[];
  hasSteps: boolean;
  onAddStep: () => void;
}) {
  const { routine } = page;
  const isArchived = routine.archived_at !== null;
  return (
    <header className="flex shrink-0 items-start gap-4 px-(--page-gutter) pt-(--page-gutter)">
      <div className="min-w-0">
        <div className="flex h-(--page-header-height) items-center gap-2.5">
          <TodayRing page={page} />
          <RoutineTitle routine={routine} />
        </div>
        <div className="mt-0.5 flex min-h-6 flex-wrap items-center gap-2 pl-7">
          {page.paused_since && (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-(--color-neutral-100) px-2 text-[11px] font-medium text-(--text-secondary)">
              <Pause aria-hidden className="size-[11px] fill-current stroke-none" />
              Paused since {shortDate(page.paused_since)}
            </span>
          )}
          {isArchived ? (
            <>
              <span className={chipClass("default", false)}>
                <Archive aria-hidden strokeWidth={2} />
                Archived {page.archived_on ? shortDate(page.archived_on) : ""}
              </span>
              <span className={chipClass("default", false)}>
                <Repeat aria-hidden strokeWidth={2} />
                {scheduleLabel(page)}
              </span>
            </>
          ) : (
            <ScheduleChip page={page} />
          )}
          {stepAreaIds(page).map((id) => {
            const area = areas.find((item) => item.id === id);
            if (!area) return null;
            return (
              <span
                key={id}
                data-area={areaDataAttribute(area.color)}
                className="inline-flex h-5 items-center gap-1 rounded-full bg-(--area-tint-active) px-2 text-[11px] font-medium text-(--text-primary)"
              >
                <span aria-hidden className="size-1.5 rounded-[2px] bg-(--area-solid)" />
                {area.title}
              </span>
            );
          })}
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <PeriodSwitch isDisabled={!hasSteps} />
        {isArchived ? (
          <RestoreButton routine={routine} steps={page.steps.length} />
        ) : (
          <>
            <RoutineMenu page={page} />
            <Button onPress={onAddStep} className="ml-2">
              <Plus aria-hidden strokeWidth={2} />
              Add step
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

/** An archived routine's page is read-only: Restore (brand 700) takes Add step's place and
 * there is no ⋯ menu. Restoring brings back its steps. */
function RestoreButton({ routine, steps }: { routine: RoutineRead; steps: number }) {
  const showToast = useChangeToast((state) => state.show);
  const restore = useMutation({
    ...unarchiveRoutineMutation(),
    onSuccess: (change) =>
      showToast(
        `Restored “${routine.title}”${steps > 0 ? ` · ${steps} ${steps === 1 ? "step" : "steps"} back` : ""}`,
        change.batch_id,
      ),
  });
  return (
    <span className="ml-2 flex items-center gap-2">
      {restore.isError && <QueryError error={restore.error} />}
      <Button
        isDisabled={restore.isPending}
        onPress={() => restore.mutate({ path: { routine_id: routine.id } })}
      >
        <ArchiveRestore aria-hidden strokeWidth={2} />
        Restore
      </Button>
    </span>
  );
}

/** Today's ring: done out of today's due steps; a pause icon while paused. */
function TodayRing({ page }: { page: RoutinePageRead }) {
  const due = useQuery(listRoutineStepsForDayOptions({ query: { day: page.today } }));
  if (page.paused_since) {
    return (
      <Pause
        role="img"
        aria-label="Paused"
        className="size-[18px] shrink-0 fill-(--color-neutral-500) stroke-none"
      />
    );
  }
  const mine = (due.data ?? []).filter(
    (item) => item.routine_id === page.routine.id && item.status !== "skipped",
  );
  return (
    <ProgressRing done={mine.filter((item) => item.status === "done").length} total={mine.length} />
  );
}

/** The name; clicking it edits it in place. Enter or leaving saves, Esc puts it back. */
function RoutineTitle({ routine }: { routine: RoutineRead }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const update = useMutation(updateRoutineMutation());
  const shown = update.isPending ? (update.variables.body.title ?? routine.title) : routine.title;

  const save = () => {
    const next = draft?.trim();
    setDraft(null);
    if (cancelled.current || !next || next === shown) return;
    update.mutate({ path: { routine_id: routine.id }, body: { title: next } });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      event.stopPropagation();
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  if (draft !== null) {
    return (
      <input
        aria-label="Routine name"
        // biome-ignore lint/a11y/noAutofocus: the user just asked to rename it
        autoFocus
        maxLength={200}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        className="-mx-1 field-sizing-content max-w-full min-w-40 rounded-(--radius-6) px-1 type-page-title text-(--page-title) shadow-[inset_0_0_0_1px_var(--color-brand-300)] outline-none"
      />
    );
  }
  return (
    <h1 className="min-w-0 truncate type-page-title text-(--page-title)">
      {routine.archived_at ? (
        shown
      ) : (
        <button
          type="button"
          title="Rename"
          onClick={() => {
            cancelled.current = false;
            // The name as shown: a rename still saving is the newest one.
            setDraft(shown);
          }}
          className="-mx-1 max-w-[calc(100%+8px)] truncate rounded-(--radius-6) px-1 text-left outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          {shown}
        </button>
      )}
      {update.isError && (
        <span role="alert" className="ml-2 type-meta text-(--text-danger)">
          Couldn't rename
        </span>
      )}
    </h1>
  );
}

/** The schedule in effect today (or the first one, before the routine starts). */
function currentSchedule(page: RoutinePageRead) {
  const rows = page.routine.schedules;
  return [...rows].reverse().find((row) => row.starts_on <= page.today) ?? rows[0];
}

/** The schedule chip: the Repeat picker without "Does not repeat" or an end. A new rule
 * asks which days it applies to, unless the routine has no past yet. */
function ScheduleChip({ page }: { page: RoutinePageRead }) {
  const [pending, setPending] = useState<string | null>(null);
  const change = useMutation(changeRoutineScheduleMutation());
  const current = currentSchedule(page);
  const path = { routine_id: page.routine.id };

  const pick = (rrule: string) => {
    if (rrule === current.rrule) return;
    if (scheduleImpact(page, rrule, page.today).pastDays === 0) {
      change.mutate({ path, body: { scope: "all", rrule } });
    } else {
      setPending(rrule);
    }
  };

  return (
    <>
      <RepeatChip
        value={parseRRule(current.rrule)}
        anchor={page.today}
        allowCompletion={false}
        allowNone={false}
        allowEnd={false}
        label="Change schedule"
        chip={scheduleLabel(page)}
        onChange={(rule) => rule && pick(toRRule(rule, page.today))}
      />
      {change.isError && <QueryError error={change.error} />}
      {pending && (
        <ChangeScheduleDialog page={page} rrule={pending} onClose={() => setPending(null)} />
      )}
    </>
  );
}

/** Change schedule?: from a date (the past before it kept), or for all days. */
function ChangeScheduleDialog({
  page,
  rrule,
  onClose,
}: {
  page: RoutinePageRead;
  rrule: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"following" | "all">("following");
  const [from, setFrom] = useState(addDays(page.today, 1));
  const impact = scheduleImpact(page, rrule, from);
  const current = currentSchedule(page);
  const option = (on: boolean) =>
    `flex cursor-pointer items-start gap-2.5 rounded-(--radius-8) border px-3 py-2.5 ${
      on ? "border-(--color-brand-600) bg-(--color-brand-50)" : "border-(--border-default)"
    }`;
  const chip = (text: string) => (
    <span className={chipClass("default")}>
      <Repeat aria-hidden strokeWidth={2} />
      {text}
    </span>
  );

  return (
    <ConfirmDialog
      title="Change schedule?"
      action="Change schedule"
      tone="plain"
      groups={[]}
      choice={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {chip(describeRepeat(parseRRule(current.rrule), current.starts_on))}
            <span aria-hidden className="text-(--text-tertiary)">
              →
            </span>
            {chip(describeRepeat(parseRRule(rrule), page.today))}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Which days</legend>
            <label className={option(scope === "following")}>
              <input
                type="radio"
                name="schedule-scope"
                checked={scope === "following"}
                onChange={() => setScope("following")}
                className="mt-1 accent-(--color-brand-600)"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2 text-[13px] font-medium text-(--text-primary)">
                  From
                  <DateChip
                    icon={CalendarDays}
                    label="Change from"
                    value={from}
                    today={page.today}
                    onChange={(day) => {
                      if (!day) return;
                      setFrom(day);
                      setScope("following");
                    }}
                  >
                    {weekdayDate(from)}
                  </DateChip>
                </span>
                <span className="type-meta text-(--text-tertiary)">{impact.keeps}</span>
              </span>
            </label>
            <label className={option(scope === "all")}>
              <input
                type="radio"
                name="schedule-scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="mt-1 accent-(--color-brand-600)"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[13px] font-medium text-(--text-primary)">All days</span>
                <span className="type-meta text-(--text-tertiary)">{impact.changes}</span>
              </span>
            </label>
          </fieldset>
        </div>
      }
      onConfirm={() =>
        changeRoutineSchedule({
          path: { routine_id: page.routine.id },
          body: scope === "all" ? { scope, rrule } : { scope, rrule, starts_on: from },
          throwOnError: true,
        })
      }
      onClose={onClose}
    />
  );
}

/** ⋯: Skip today, Pause or Resume, Archive or Restore, then Delete. Delete is disabled
 * while a step feeds a metric. */
function RoutineMenu({ page }: { page: RoutinePageRead }) {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const showToast = useChangeToast((state) => state.show);
  const { routine, today } = page;
  const path = { routine_id: routine.id };
  const due = useQuery(listRoutineStepsForDayOptions({ query: { day: today } }));
  const skip = useMutation({
    ...skipRoutineDayMutation(),
    onSuccess: (change) => showToast(`Skipped day · ${weekdayDate(today)}`, change.batch_id),
  });
  const pause = useMutation(pauseRoutineMutation());
  const resume = useMutation(resumeRoutineMutation());
  const archive = useMutation({
    ...archiveRoutineMutation(),
    onSuccess: (change) => showToast(`Archived “${routine.title}”`, change.batch_id),
  });
  const restore = useMutation({
    ...unarchiveRoutineMutation(),
    onSuccess: (change) => showToast(`Restored “${routine.title}”`, change.batch_id),
  });
  const error = skip.error ?? pause.error ?? resume.error ?? archive.error ?? restore.error;

  const leftToday = (due.data ?? []).some(
    (item) => item.routine_id === routine.id && item.status === "todo",
  );
  const metrics = page.steps.flatMap((row) => (row.metric ? [row.metric] : []));
  const isArchived = routine.archived_at !== null;

  const actions: PanelAction[] = isArchived
    ? [
        {
          id: "restore",
          label: "Restore routine",
          icon: ArchiveRestore,
          onAction: () => restore.mutate({ path }),
        },
      ]
    : [
        {
          id: "skip",
          label: "Skip today",
          icon: CircleMinus,
          isDisabled: !leftToday,
          onAction: () => skip.mutate({ path: { ...path, day: today } }),
        },
        page.paused_since
          ? {
              id: "resume",
              label: "Resume routine",
              icon: Play,
              onAction: () => resume.mutate({ path }),
            }
          : {
              id: "pause",
              label: "Pause routine",
              icon: Pause,
              onAction: () => pause.mutate({ path }),
            },
        {
          id: "archive",
          label: "Archive routine",
          icon: Archive,
          onAction: () => archive.mutate({ path }),
        },
      ];
  actions.push({
    id: "delete",
    label: "Delete routine",
    icon: Trash2,
    isDanger: true,
    isDisabled: metrics.length > 0,
    hint:
      metrics.length > 0
        ? `${metrics.length === 1 ? "A step feeds" : "Steps feed"} ${metricNames(metrics)}. Archive it instead.`
        : undefined,
    onAction: () => setIsDeleting(true),
  });

  return (
    <>
      <PanelMenu actions={actions} />
      {error && <QueryError error={error} />}
      {isDeleting && (
        <DeleteRoutineDialog
          routine={routine}
          onClose={() => setIsDeleting(false)}
          onDeleted={() => navigate("/areas")}
        />
      )}
    </>
  );
}
