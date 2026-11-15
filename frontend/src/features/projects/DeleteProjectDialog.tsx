import { deleteProject } from "../../client/sdk.gen";
import type { ProjectRead } from "../../client/types.gen";
import { DeleteDialog } from "../deleting/DeleteDialog";

type DeleteProjectDialogProps = {
  project: ProjectRead;
  onClose: () => void;
  onDeleted?: () => void;
};

/** Only an empty project can be deleted; its sections go with it. */
export function DeleteProjectDialog({ project, onClose, onDeleted }: DeleteProjectDialogProps) {
  return (
    <DeleteDialog
      name={project.title}
      action="Delete project"
      deleted={[[project.sections.length, "section", "sections"]]}
      onConfirm={() => deleteProject({ path: { project_id: project.id }, throwOnError: true })}
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}
