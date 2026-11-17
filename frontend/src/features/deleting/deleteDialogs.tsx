import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  previewEventDeleteOptions,
  previewMetricDeleteOptions,
  previewRoutineDeleteOptions,
  previewRoutineStepDeleteOptions,
  previewTaskTemplateDeleteOptions,
} from "../../client/@tanstack/react-query.gen";
import {
  deleteEvent,
  deleteEventOccurrence,
  deleteMetric,
  deleteRoutine,
  deleteRoutineStep,
  deleteTaskTemplate,
} from "../../client/sdk.gen";
import type {
  EventRead,
  MetricRead,
  MetricRef,
  RoutineRead,
  RoutineStepRead,
  TaskTemplateRead,
} from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { ConfirmDialog } from "../confirming/ConfirmDialog";
import { weekdayDate } from "../confirming/previewText";
import { shortDate } from "../life-areas/overview/format";

type Callbacks = { onClose: () => void; onDeleted?: () => void };

/** Deletes can't be undone, so their toast only reports them. */
export function useDeletedToast() {
  const show = useChangeToast((state) => state.show);
  return (message: string) => show(`${message} · Can’t be undone`, null);
}

/** "Reading days", or "Reading days and Stretch days". */
export function metricNames(metrics: Pick<MetricRef, "title">[]): string {
  const names = metrics.map((metric) => metric.title);
  return names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function DeleteMetricDialog({
  metric,
  onClose,
  onDeleted,
}: { metric: MetricRead } & Callbacks) {
  const path = { metric_id: metric.id };
  const preview = useQuery(previewMetricDeleteOptions({ path }));
  const toast = useDeletedToast();
  return (
    <ConfirmDialog
      title={`Delete “${metric.title}”?`}
      action="Delete metric"
      tone="delete"
      groups={preview.data?.groups}
      previewError={preview.error}
      onConfirm={async () => {
        await deleteMetric({ path, throwOnError: true });
        toast(`Deleted “${metric.title}”`);
      }}
      onClose={onClose}
      onDone={onDeleted}
    />
  );
}

export function DeleteTemplateDialog({
  template,
  onClose,
  onDeleted,
}: { template: TaskTemplateRead } & Callbacks) {
  const path = { template_id: template.id };
  const preview = useQuery(previewTaskTemplateDeleteOptions({ path }));
  const toast = useDeletedToast();
  return (
    <ConfirmDialog
      title={`Delete “${template.title}”?`}
      action={template.rrule ? "Delete recurring task" : "Delete template"}
      tone="delete"
      groups={preview.data?.groups}
      previewError={preview.error}
      onConfirm={async () => {
        await deleteTaskTemplate({ path, throwOnError: true });
        toast(`Deleted “${template.title}”`);
      }}
      onClose={onClose}
      onDone={onDeleted}
    />
  );
}

export function DeleteRoutineDialog({
  routine,
  onClose,
  onDeleted,
}: { routine: RoutineRead } & Callbacks) {
  const path = { routine_id: routine.id };
  const preview = useQuery(previewRoutineDeleteOptions({ path }));
  const toast = useDeletedToast();
  const blockers = preview.data?.metrics ?? [];
  return (
    <ConfirmDialog
      title={`Delete “${routine.title}”?`}
      action="Delete routine"
      tone="delete"
      groups={preview.data?.groups}
      previewError={preview.error}
      blocked={
        blockers.length > 0 &&
        `${blockers.length === 1 ? "A step feeds" : "Steps feed"} ${metricNames(blockers)}. Archive it instead.`
      }
      onConfirm={async () => {
        await deleteRoutine({ path, throwOnError: true });
        toast(`Deleted “${routine.title}”`);
      }}
      onClose={onClose}
      onDone={onDeleted}
    />
  );
}

export function DeleteStepDialog({
  step,
  onClose,
  onDeleted,
}: { step: RoutineStepRead } & Callbacks) {
  const path = { step_id: step.id };
  const preview = useQuery(previewRoutineStepDeleteOptions({ path }));
  const toast = useDeletedToast();
  const blockers = preview.data?.metrics ?? [];
  return (
    <ConfirmDialog
      title={`Delete “${step.title}”?`}
      action="Delete step"
      tone="delete"
      groups={preview.data?.groups}
      previewError={preview.error}
      blocked={blockers.length > 0 && `It feeds ${metricNames(blockers)}. Archive it instead.`}
      onConfirm={async () => {
        await deleteRoutineStep({ path, throwOnError: true });
        toast(`Deleted “${step.title}”`);
      }}
      onClose={onClose}
      onDone={onDeleted}
    />
  );
}

type Scope = "this" | "following" | "all";

/** The choice rows: 36 px, the selected one in the accent, each with its date on the right. */
function ScopeChoice({
  value,
  onChange,
  options,
}: {
  value: Scope;
  onChange: (scope: Scope) => void;
  options: { id: Scope; label: string; meta: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="sr-only">Delete which events</legend>
      {options.map((option) => (
        <label
          key={option.id}
          className={`flex h-9 cursor-pointer items-center gap-2.5 rounded-(--radius-8) border px-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--focus-ring) ${
            value === option.id
              ? "border-brand-600 bg-(--accent-subtle)"
              : "border-(--border-default) hover:bg-neutral-50"
          }`}
        >
          <input
            type="radio"
            name="delete-scope"
            className="sr-only"
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          <span
            aria-hidden
            className={`grid size-3.5 shrink-0 place-items-center rounded-full border-[1.5px] ${
              value === option.id ? "border-brand-700" : "border-neutral-400"
            }`}
          >
            {value === option.id && <span className="size-1.5 rounded-full bg-brand-700" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-(--text-primary)">
            {option.label}
          </span>
          <span className="text-xs whitespace-nowrap text-(--text-secondary)">{option.meta}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Deletes an event. A repeating one opened on an occurrence asks which: this one (cancels
 * the occurrence), this and following (ends the series), or all of them.
 */
export function DeleteEventDialog({
  event,
  day,
  onClose,
  onDeleted,
}: { event: EventRead; day: string | null } & Callbacks) {
  const [scope, setScope] = useState<Scope>("this");
  const asksScope = event.rrule !== null && day !== null;
  const path = { event_id: event.id };
  const toast = useDeletedToast();
  const preview = useQuery(
    previewEventDeleteOptions({
      path,
      query: asksScope ? { day, scope } : {},
    }),
  );
  // The All events row's data comes from the whole series, whatever is chosen.
  const series = preview.data;
  const past = series ? `${series.past_occurrences} past` : "";
  const allMeta = [past, series?.has_upcoming ? "upcoming" : ""].filter(Boolean).join(" · ");

  const message =
    asksScope && scope === "this"
      ? `Deleted “${event.title}” on ${shortDate(day)}`
      : asksScope && scope === "following" && day !== event.start_date
        ? `Deleted “${event.title}” from ${shortDate(day)}`
        : `Deleted “${event.title}”`;

  return (
    <ConfirmDialog
      title={`Delete “${event.title}”?`}
      action="Delete event"
      tone="delete"
      groups={asksScope && scope === "this" ? [] : preview.data?.groups}
      previewError={preview.error}
      choice={
        asksScope && (
          <ScopeChoice
            value={scope}
            onChange={setScope}
            options={[
              { id: "this", label: "This event", meta: weekdayDate(day) },
              { id: "following", label: "This and following", meta: `From ${weekdayDate(day)}` },
              { id: "all", label: "All events", meta: allMeta },
            ]}
          />
        )
      }
      onConfirm={async () => {
        if (asksScope) {
          await deleteEventOccurrence({
            path: { ...path, day },
            body: { scope },
            throwOnError: true,
          });
        } else {
          await deleteEvent({ path, throwOnError: true });
        }
        toast(message);
      }}
      onClose={onClose}
      onDone={onDeleted}
    />
  );
}
