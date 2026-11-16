import { useQuery } from "@tanstack/react-query";
import { previewProjectChangeOptions } from "../../client/@tanstack/react-query.gen";
import { archiveProject, cancelProject, completeProject } from "../../client/sdk.gen";
import type { ProjectRead } from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { ConfirmDialog } from "../confirming/ConfirmDialog";
import { cancelledTasks } from "../confirming/previewText";
import { plural } from "../life-areas/overview/format";

export type ProjectChange = "complete" | "cancel" | "archive";

const CHANGES = {
  complete: { verb: "Complete", done: "Completed", request: completeProject },
  cancel: { verb: "Cancel", done: "Cancelled", request: cancelProject },
  archive: { verb: "Archive", done: "Archived", request: archiveProject },
} as const;

type ProjectChangeDialogProps = {
  project: ProjectRead;
  change: ProjectChange;
  onClose: () => void;
};

/**
 * Confirms completing, cancelling or archiving a project, listing what it does to the
 * project's items; with nothing to list it applies at once. The change is one batch,
 * which the toast's Undo restores.
 */
export function ProjectChangeDialog({ project, change, onClose }: ProjectChangeDialogProps) {
  const { verb, done, request } = CHANGES[change];
  const path = { project_id: project.id };
  const preview = useQuery(previewProjectChangeOptions({ path, query: { action: change } }));
  const showChange = useChangeToast((state) => state.show);
  const groups = preview.data?.groups;

  return (
    <ConfirmDialog
      title={`${verb} “${project.title}”?`}
      action={`${verb} project`}
      tone={change === "archive" ? "archive" : "undo"}
      groups={groups}
      previewError={preview.error}
      appliesAtOnceWhenEmpty
      onConfirm={async () => {
        const { data } = await request({ path, throwOnError: true });
        const cancelled = groups ? cancelledTasks(groups) : 0;
        const effect = cancelled > 0 ? ` · ${plural(cancelled, "task")} cancelled` : "";
        if (data.batch_id) showChange(`${done} “${project.title}”${effect}`, data.batch_id);
      }}
      onClose={onClose}
    />
  );
}
