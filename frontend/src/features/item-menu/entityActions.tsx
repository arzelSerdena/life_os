import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CircleCheck,
  CircleX,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  archiveMetricMutation,
  archiveTaskMutation,
  cancelEventMutation,
  cancelTaskMutation,
  completeTaskMutation,
  getArchiveOptions,
  getAreaPageOptions,
  reopenProjectMutation,
  reopenTaskMutation,
  unarchiveLifeAreaMutation,
  unarchiveMetricMutation,
  unarchiveProjectMutation,
  uncancelEventMutation,
} from "../../client/@tanstack/react-query.gen";
import { deleteTask } from "../../client/sdk.gen";
import type {
  EventRead,
  LifeAreaRead,
  MetricRead,
  ProjectRead,
  TaskRead,
  TaskTemplateRead,
} from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { usePeriodStore } from "../../stores/periodStore";
import { restoredAreaMessage } from "../archive/archive";
import {
  DeleteEventDialog,
  DeleteMetricDialog,
  DeleteTemplateDialog,
} from "../deleting/deleteDialogs";
import { useDeleteWithUndo } from "../deleting/UndoToast";
import type { PanelAction } from "../detail-panel/PanelParts";
import { ArchiveAreaDialog } from "../life-areas/ArchiveAreaDialog";
import { DeleteLifeAreaDialog } from "../life-areas/DeleteLifeAreaDialog";
import { EditMetricModal } from "../metrics/EditMetricModal";
import { LogMetricModal } from "../metrics/LogMetricModal";
import { DeleteProjectDialog } from "../projects/DeleteProjectDialog";
import { type ProjectChange, ProjectChangeDialog } from "../projects/ProjectChangeDialog";

/**
 * One item's ⋯ menu: its actions, the dialogs they open (render them next to the menu, they
 * outlive it) and the last error. The detail panel, the routine page and the right-click menu
 * all build their menus from these, so the same item always offers the same actions.
 */
export type ItemActions = { actions: PanelAction[]; dialogs: ReactNode; error: unknown };

/** Delete, last in the ⋯ menu and in red. A hint disables it and says why. */
export function deleteAction(
  label: string,
  onAction: () => void,
  blockedHint?: string | false,
): PanelAction {
  return {
    id: "delete",
    label,
    icon: Trash2,
    isDanger: true,
    onAction,
    isDisabled: Boolean(blockedHint),
    hint: blockedHint || undefined,
  };
}

/** Called once the item is gone from where it was shown (archived, deleted or restored). */
type Gone = () => void;

// ---------- Life area ----------

/** Edit area (outside the panel), Archive or Restore, then Delete, which only an empty area
 * allows. */
export function useAreaActions(
  area: LifeAreaRead | undefined,
  {
    withEdit = false,
    onArchived,
    onDeleted,
    onRestored,
  }: { withEdit?: boolean; onArchived?: Gone; onDeleted?: Gone; onRestored?: Gone },
): ItemActions {
  const id = area?.id ?? 0;
  const openPanel = useDetailPanel((state) => state.open);
  const { period, date } = usePeriodStore();
  const contents = useQuery({
    ...getAreaPageOptions({ path: { life_area_id: id }, query: { period, date } }),
    enabled: area !== undefined,
  }).data?.contents;
  const isArchived = area ? area.archived_at !== null : false;
  // An archived area's restore message says what comes back, as in Finished & archived.
  const archived = useQuery({ ...getArchiveOptions(), enabled: isArchived }).data?.areas.find(
    (row) => row.id === id,
  );
  const restore = useMutation(unarchiveLifeAreaMutation());
  const showToast = useChangeToast((state) => state.show);
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);
  if (!area) return { actions: [], dialogs: null, error: null };

  const actions: PanelAction[] = [
    ...(withEdit
      ? [
          {
            id: "edit",
            label: "Edit area",
            icon: Pencil,
            onAction: () => openPanel({ kind: "area", id }),
          },
        ]
      : []),
    isArchived
      ? {
          id: "restore",
          label: "Restore area",
          icon: ArchiveRestore,
          onAction: () =>
            restore.mutate(
              { path: { life_area_id: id } },
              {
                onSuccess: (change) => {
                  showToast(
                    archived ? restoredAreaMessage(archived) : `Restored “${area.title}”`,
                    change.batch_id,
                  );
                  onRestored?.();
                },
              },
            ),
        }
      : {
          id: "archive",
          label: "Archive area",
          icon: Archive,
          onAction: () => setDialog("archive"),
          isDisabled: !contents,
        },
    {
      ...deleteAction(
        "Delete area",
        () => setDialog("delete"),
        contents?.has_items &&
          (isArchived
            ? "Only empty areas can be deleted."
            : "Only empty areas can be deleted. Archive it instead."),
      ),
      // Until the contents load it isn't known whether the area is empty.
      isDisabled: !contents || contents.has_items,
    },
  ];

  const dialogs = (
    <>
      {dialog === "archive" && (
        <ArchiveAreaDialog
          lifeArea={area}
          onClose={() => setDialog(null)}
          onArchived={() => onArchived?.()}
        />
      )}
      {dialog === "delete" && (
        <DeleteLifeAreaDialog
          lifeArea={area}
          onClose={() => setDialog(null)}
          onDeleted={() => onDeleted?.()}
        />
      )}
    </>
  );
  return { actions, dialogs, error: restore.error };
}

// ---------- Project ----------

/** Edit project (outside the panel), Complete, Cancel or Reopen, Archive or Restore, then
 * Delete, which only an empty project allows. Complete, Cancel and Archive ask first. */
export function useProjectActions(
  project: ProjectRead | undefined,
  { withEdit = false, onDeleted }: { withEdit?: boolean; onDeleted?: Gone },
): ItemActions {
  const openPanel = useDetailPanel((state) => state.open);
  const showToast = useChangeToast((state) => state.show);
  const reopen = useMutation({
    ...reopenProjectMutation(),
    onSuccess: (change) => showToast(`Reopened “${change.project.title}”`, change.batch_id),
  });
  const restore = useMutation({
    ...unarchiveProjectMutation(),
    onSuccess: (change) => showToast(`Restored “${change.project.title}”`, change.batch_id),
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [change, setChange] = useState<ProjectChange | null>(null);
  if (!project) return { actions: [], dialogs: null, error: null };

  const path = { project_id: project.id };
  const isArchived = project.archived_at !== null;
  const statusActions: PanelAction[] = isArchived
    ? [
        {
          id: "restore",
          label: "Restore project",
          icon: ArchiveRestore,
          onAction: () => restore.mutate({ path }),
        },
      ]
    : [
        ...(project.status === "active"
          ? [
              {
                id: "complete",
                label: "Complete project",
                icon: CircleCheck,
                onAction: () => setChange("complete"),
              },
              {
                id: "cancel",
                label: "Cancel project",
                icon: CircleX,
                onAction: () => setChange("cancel"),
              },
            ]
          : [
              {
                id: "reopen",
                label: "Reopen project",
                icon: RotateCcw,
                onAction: () => reopen.mutate({ path }),
              },
            ]),
        {
          id: "archive",
          label: "Archive project",
          icon: Archive,
          onAction: () => setChange("archive"),
        },
      ];

  const actions: PanelAction[] = [
    ...(withEdit
      ? [
          {
            id: "edit",
            label: "Edit project",
            icon: Pencil,
            onAction: () => openPanel({ kind: "project", id: project.id }),
          },
        ]
      : []),
    ...statusActions,
    deleteAction(
      "Delete project",
      () => setIsDeleting(true),
      project.has_items && "Only empty projects can be deleted. Archive it instead.",
    ),
  ];

  const dialogs = (
    <>
      {change && (
        <ProjectChangeDialog project={project} change={change} onClose={() => setChange(null)} />
      )}
      {isDeleting && (
        <DeleteProjectDialog
          project={project}
          onClose={() => setIsDeleting(false)}
          onDeleted={() => onDeleted?.()}
        />
      )}
    </>
  );
  return { actions, dialogs, error: reopen.error ?? restore.error };
}

// ---------- Task ----------

/** Complete or Mark not done, Archive, then Delete; a recurring occurrence is cancelled
 * instead, because a deleted one would be generated again. Each change offers Undo. */
export function useTaskActions(
  task: TaskRead | undefined,
  { onDeleted }: { onDeleted?: Gone } = {},
): ItemActions {
  const showToast = useChangeToast((state) => state.show);
  const complete = useMutation({
    ...completeTaskMutation(),
    onSuccess: (change) => showToast(`Completed “${change.task.title}”`, change.batch_id),
  });
  const reopen = useMutation(reopenTaskMutation());
  const archive = useMutation({
    ...archiveTaskMutation(),
    onSuccess: (change) => showToast(`Archived “${change.task.title}”`, change.batch_id),
  });
  const cancel = useMutation({
    ...cancelTaskMutation(),
    onSuccess: (change) => showToast(`Cancelled “${change.task.title}”`, change.batch_id),
  });
  const deleteWithUndo = useDeleteWithUndo();
  if (!task) return { actions: [], dialogs: null, error: null };

  const path = { task_id: task.id };
  const isDone = task.status === "done";
  const actions: PanelAction[] = [
    isDone
      ? {
          id: "reopen",
          label: "Mark not done",
          icon: RotateCcw,
          onAction: () => reopen.mutate({ path }),
        }
      : {
          id: "complete",
          label: "Complete task",
          icon: CircleCheck,
          onAction: () => complete.mutate({ path }),
          isDisabled: task.status === "cancelled",
        },
    {
      id: "archive",
      label: "Archive task",
      icon: Archive,
      onAction: () => archive.mutate({ path }),
      isDisabled: task.archived_at !== null,
    },
    task.occurrence_date !== null
      ? {
          id: "cancel",
          label: "Cancel task",
          icon: X,
          onAction: () => cancel.mutate({ path }),
          isDisabled: task.status !== "todo",
        }
      : deleteAction("Delete task", () => {
          onDeleted?.();
          deleteWithUndo({ kind: "task", id: task.id, label: task.title }, () =>
            deleteTask({ path, throwOnError: true, keepalive: true }),
          );
        }),
  ];
  return {
    actions,
    dialogs: null,
    error: complete.error ?? reopen.error ?? archive.error ?? cancel.error,
  };
}

// ---------- Template, event, metric: Delete only ----------

export function useTemplateActions(
  template: TaskTemplateRead | undefined,
  { onDeleted }: { onDeleted?: Gone } = {},
): ItemActions {
  const [isDeleting, setIsDeleting] = useState(false);
  if (!template) return { actions: [], dialogs: null, error: null };
  return {
    actions: [
      deleteAction(template.rrule ? "Delete recurring task" : "Delete template", () =>
        setIsDeleting(true),
      ),
    ],
    dialogs: isDeleting && (
      <DeleteTemplateDialog
        template={template}
        onClose={() => setIsDeleting(false)}
        onDeleted={() => onDeleted?.()}
      />
    ),
    error: null,
  };
}

/** A repeating event's Delete asks which occurrences, starting from `day`. */
export function useEventActions(
  event: EventRead | undefined,
  day: string | null,
  { onDeleted }: { onDeleted?: Gone } = {},
): ItemActions {
  const showToast = useChangeToast((state) => state.show);
  const cancel = useMutation({
    ...cancelEventMutation(),
    onSuccess: (change) => showToast(`Cancelled “${change.event.title}”`, change.batch_id),
  });
  const uncancel = useMutation({
    ...uncancelEventMutation(),
    onSuccess: (change) => showToast(`Restored “${change.event.title}”`, change.batch_id),
  });
  const [isDeleting, setIsDeleting] = useState(false);
  if (!event) return { actions: [], dialogs: null, error: null };
  const isCancelled = event.cancelled_at !== null;
  const path = { event_id: event.id };
  const actions: PanelAction[] = [
    isCancelled
      ? {
          id: "uncancel",
          label: "Uncancel event",
          icon: RotateCcw,
          isDisabled: uncancel.isPending,
          onAction: () => uncancel.mutate({ path }),
        }
      : {
          id: "cancel",
          label: "Cancel event",
          icon: CircleX,
          isDisabled: cancel.isPending,
          onAction: () => cancel.mutate({ path }),
        },
    deleteAction("Delete event", () => setIsDeleting(true)),
  ];
  return {
    actions,
    dialogs: isDeleting && (
      <DeleteEventDialog
        event={event}
        day={day}
        onClose={() => setIsDeleting(false)}
        onDeleted={() => onDeleted?.()}
      />
    ),
    error: cancel.error ?? uncancel.error,
  };
}

export function useMetricActions(
  metric: MetricRead | undefined,
  { onArchived, onDeleted }: { onArchived?: Gone; onDeleted?: Gone } = {},
): ItemActions {
  const showToast = useChangeToast((state) => state.show);
  const archive = useMutation({
    ...archiveMetricMutation(),
    onSuccess: (change) => {
      showToast(`Archived “${change.metric.title}”`, change.batch_id);
      onArchived?.();
    },
  });
  const restore = useMutation({
    ...unarchiveMetricMutation(),
    onSuccess: (change) => showToast(`Restored “${change.metric.title}”`, change.batch_id),
  });
  const [dialog, setDialog] = useState<"log" | "edit" | "delete" | null>(null);
  if (!metric) return { actions: [], dialogs: null, error: null };

  const path = { metric_id: metric.id };
  const isArchived = metric.archived_at !== null;
  const actions: PanelAction[] = [
    ...(!isArchived && metric.source === "manual"
      ? [
          {
            id: "log",
            label: "Log entry",
            icon: Plus,
            onAction: () => setDialog("log"),
          },
        ]
      : []),
    ...(!isArchived
      ? [
          {
            id: "edit",
            label: "Edit metric",
            icon: Pencil,
            onAction: () => setDialog("edit"),
          },
        ]
      : []),
    isArchived
      ? {
          id: "restore",
          label: "Restore metric",
          icon: ArchiveRestore,
          onAction: () => restore.mutate({ path }),
        }
      : {
          id: "archive",
          label: "Archive metric",
          icon: Archive,
          onAction: () => archive.mutate({ path }),
        },
    deleteAction("Delete metric", () => setDialog("delete")),
  ];

  const dialogs = (
    <>
      {dialog === "log" && <LogMetricModal metric={metric} onClose={() => setDialog(null)} />}
      {dialog === "edit" && <EditMetricModal metric={metric} onClose={() => setDialog(null)} />}
      {dialog === "delete" && (
        <DeleteMetricDialog
          metric={metric}
          onClose={() => setDialog(null)}
          onDeleted={() => onDeleted?.()}
        />
      )}
    </>
  );
  return { actions, dialogs, error: archive.error ?? restore.error };
}
