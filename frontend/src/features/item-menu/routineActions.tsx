import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, CircleMinus, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  archiveRoutineMutation,
  archiveRoutineStepMutation,
  listRoutineStepsForDayOptions,
  pauseRoutineMutation,
  pauseRoutineStepMutation,
  resumeRoutineMutation,
  resumeRoutineStepMutation,
  skipRoutineDayMutation,
  unarchiveRoutineMutation,
} from "../../client/@tanstack/react-query.gen";
import type { RoutinePageRead, RoutinePageStepRead } from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { DeleteRoutineDialog, DeleteStepDialog, metricNames } from "../deleting/deleteDialogs";
import type { PanelAction } from "../detail-panel/PanelParts";
import { weekdayDate } from "../routines/routine";
import type { ItemActions } from "./entityActions";

/** A routine's ⋯: Skip today, Pause or Resume, Archive or Restore, then Delete. Delete is
 * disabled while a step feeds a metric. */
export function useRoutineActions(
  page: RoutinePageRead | undefined,
  { onDeleted }: { onDeleted?: () => void } = {},
): ItemActions {
  const [isDeleting, setIsDeleting] = useState(false);
  const showToast = useChangeToast((state) => state.show);
  const today = page?.today ?? "";
  const due = useQuery({
    ...listRoutineStepsForDayOptions({ query: { day: today } }),
    enabled: page !== undefined,
  });
  const skip = useMutation({
    ...skipRoutineDayMutation(),
    onSuccess: (change) => showToast(`Skipped day · ${weekdayDate(today)}`, change.batch_id),
  });
  const pause = useMutation(pauseRoutineMutation());
  const resume = useMutation(resumeRoutineMutation());
  const archive = useMutation({
    ...archiveRoutineMutation(),
    onSuccess: (change) => showToast(`Archived “${change.routine.title}”`, change.batch_id),
  });
  const restore = useMutation({
    ...unarchiveRoutineMutation(),
    onSuccess: (change) => showToast(`Restored “${change.routine.title}”`, change.batch_id),
  });
  const error = skip.error ?? pause.error ?? resume.error ?? archive.error ?? restore.error;
  if (!page) return { actions: [], dialogs: null, error: null };

  const { routine } = page;
  const path = { routine_id: routine.id };
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

  const dialogs = isDeleting && (
    <DeleteRoutineDialog
      routine={routine}
      onClose={() => setIsDeleting(false)}
      onDeleted={() => onDeleted?.()}
    />
  );
  return { actions, dialogs, error };
}

/** A routine step's ⋯: Pause or Resume, Archive, then Delete, which is disabled while the step
 * feeds a metric. */
export function useStepActions(row: RoutinePageStepRead | undefined): ItemActions {
  const [isDeleting, setIsDeleting] = useState(false);
  const showToast = useChangeToast((state) => state.show);
  const pause = useMutation(pauseRoutineStepMutation());
  const resume = useMutation(resumeRoutineStepMutation());
  const archive = useMutation({
    ...archiveRoutineStepMutation(),
    onSuccess: (change) => showToast(`Archived “${change.step.title}”`, change.batch_id),
  });
  const error = pause.error ?? resume.error ?? archive.error;
  if (!row) return { actions: [], dialogs: null, error: null };

  const { step } = row;
  const path = { step_id: step.id };
  const actions: PanelAction[] = [
    step.is_paused
      ? {
          id: "resume",
          label: "Resume step",
          icon: Play,
          onAction: () => resume.mutate({ path }),
        }
      : {
          id: "pause",
          label: "Pause step",
          icon: Pause,
          onAction: () => pause.mutate({ path }),
        },
    {
      id: "archive",
      label: "Archive step",
      icon: Archive,
      onAction: () => archive.mutate({ path }),
    },
    {
      id: "delete",
      label: "Delete step",
      icon: Trash2,
      isDanger: true,
      isDisabled: row.metric !== null,
      hint: row.metric ? `Feeds ${row.metric.title}. Archive it instead.` : undefined,
      onAction: () => setIsDeleting(true),
    },
  ];
  const dialogs = isDeleting && (
    <DeleteStepDialog step={step} onClose={() => setIsDeleting(false)} />
  );
  return { actions, dialogs, error };
}
