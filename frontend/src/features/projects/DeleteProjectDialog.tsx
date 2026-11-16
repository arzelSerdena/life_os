import { deleteProject } from "../../client/sdk.gen";
import type { PreviewGroup, ProjectRead } from "../../client/types.gen";
import { ConfirmDialog } from "../confirming/ConfirmDialog";
import { useDeletedToast } from "../deleting/deleteDialogs";

type DeleteProjectDialogProps = {
  project: ProjectRead;
  onClose: () => void;
  onDeleted?: () => void;
};

/** Only an empty project can be deleted; its sections go with it. */
export function DeleteProjectDialog({ project, onClose, onDeleted }: DeleteProjectDialogProps) {
  const toast = useDeletedToast();
  const groups: PreviewGroup[] =
    project.sections.length > 0
      ? [
          {
            effect: "deleted",
            rows: project.sections.map((section) => ({
              kind: "section",
              id: section.id,
              title: section.title,
            })),
          },
        ]
      : [];
  return (
    <ConfirmDialog
      title={`Delete “${project.title}”?`}
      action="Delete project"
      tone="delete"
      groups={groups}
      onConfirm={async () => {
        await deleteProject({ path: { project_id: project.id }, throwOnError: true });
        toast(`Deleted “${project.title}”`);
      }}
      onClose={onClose}
      onDone={onDeleted}
    />
  );
}
