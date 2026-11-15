import { Label, Radio, RadioGroup } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
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
import { DeleteDialog } from "./DeleteDialog";

type Callbacks = { onClose: () => void; onDeleted?: () => void };

function metricNames(metrics: MetricRef[]): string {
  const names = metrics.map((metric) => metric.title);
  return names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function DeleteMetricDialog({ metric, ...callbacks }: { metric: MetricRead } & Callbacks) {
  const path = { metric_id: metric.id };
  const preview = useQuery(previewMetricDeleteOptions({ path })).data;
  return (
    <DeleteDialog
      {...callbacks}
      name={metric.title}
      action="Delete metric"
      isLoading={!preview}
      deleted={[
        [preview?.entries ?? 0, "entry", "entries"],
        [preview?.targets ?? 0, "target", "targets"],
      ]}
      onConfirm={() => deleteMetric({ path, throwOnError: true })}
    />
  );
}

export function DeleteTemplateDialog({
  template,
  ...callbacks
}: { template: TaskTemplateRead } & Callbacks) {
  const path = { template_id: template.id };
  const preview = useQuery(previewTaskTemplateDeleteOptions({ path })).data;
  return (
    <DeleteDialog
      {...callbacks}
      name={template.title}
      action={template.rrule ? "Delete recurring task" : "Delete template"}
      isLoading={!preview}
      deleted={[
        [preview?.subtasks ?? 0, "subtask", "subtasks"],
        [preview?.open_occurrences ?? 0, "open task from it", "open tasks from it"],
      ]}
      kept={{
        intro: "Kept as plain tasks:",
        lines: [
          [preview?.finished_occurrences ?? 0, "done or cancelled task", "done or cancelled tasks"],
          [preview?.tasks_made_by_hand ?? 0, "task made from it", "tasks made from it"],
        ],
      }}
      onConfirm={() => deleteTaskTemplate({ path, throwOnError: true })}
    />
  );
}

export function DeleteRoutineDialog({
  routine,
  ...callbacks
}: { routine: RoutineRead } & Callbacks) {
  const path = { routine_id: routine.id };
  const preview = useQuery(previewRoutineDeleteOptions({ path })).data;
  const blockers = preview?.metrics ?? [];
  return (
    <DeleteDialog
      {...callbacks}
      name={routine.title}
      action="Delete routine"
      isLoading={!preview}
      blocked={
        blockers.length > 0 &&
        `Its steps feed ${blockers.length === 1 ? "a metric" : "metrics"}: ${metricNames(blockers)}. Delete ${
          blockers.length === 1 ? "that metric" : "those metrics"
        } first, or archive the routine instead.`
      }
      deleted={[
        [preview?.steps ?? 0, "step", "steps"],
        [preview?.logs ?? 0, "logged day", "logged days"],
        [preview?.pauses ?? 0, "pause", "pauses"],
      ]}
      onConfirm={() => deleteRoutine({ path, throwOnError: true })}
    />
  );
}

export function DeleteStepDialog({ step, ...callbacks }: { step: RoutineStepRead } & Callbacks) {
  const path = { step_id: step.id };
  const preview = useQuery(previewRoutineStepDeleteOptions({ path })).data;
  const blockers = preview?.metrics ?? [];
  return (
    <DeleteDialog
      {...callbacks}
      name={step.title}
      action="Delete step"
      isLoading={!preview}
      blocked={
        blockers.length > 0 &&
        `It feeds ${blockers.length === 1 ? "a metric" : "metrics"}: ${metricNames(blockers)}. Delete ${
          blockers.length === 1 ? "that metric" : "those metrics"
        } first, or archive the step instead.`
      }
      deleted={[
        [preview?.logs ?? 0, "logged day", "logged days"],
        [preview?.pauses ?? 0, "pause", "pauses"],
      ]}
      onConfirm={() => deleteRoutineStep({ path, throwOnError: true })}
    />
  );
}

type Scope = "this" | "following" | "all";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "this", label: "This event" },
  { id: "following", label: "This and following" },
  { id: "all", label: "All events" },
];

/**
 * Deletes an event. A repeating one opened on an occurrence asks which: this one (cancels
 * the occurrence), this and following (ends the series), or all of them.
 */
export function DeleteEventDialog({
  event,
  day,
  ...callbacks
}: { event: EventRead; day: string | null } & Callbacks) {
  const [scope, setScope] = useState<Scope>("this");
  const asksScope = event.rrule !== null && day !== null;
  return (
    <DeleteDialog
      {...callbacks}
      name={event.title}
      action="Delete event"
      onConfirm={() =>
        asksScope
          ? deleteEventOccurrence({
              path: { event_id: event.id, day },
              body: { scope },
              throwOnError: true,
            })
          : deleteEvent({ path: { event_id: event.id }, throwOnError: true })
      }
    >
      {asksScope && (
        <RadioGroup value={scope} onChange={(value) => setScope(value as Scope)}>
          <Label className="sr-only">Delete which events</Label>
          {SCOPES.map((option) => (
            <Radio key={option.id} value={option.id}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {option.label}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
      )}
    </DeleteDialog>
  );
}
