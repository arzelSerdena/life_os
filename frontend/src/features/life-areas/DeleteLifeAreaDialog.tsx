import { deleteLifeArea } from "../../client/sdk.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { ConfirmDialog } from "../confirming/ConfirmDialog";
import { useDeletedToast } from "../deleting/deleteDialogs";

type DeleteLifeAreaDialogProps = {
  lifeArea: LifeAreaRead;
  onClose: () => void;
  onDeleted?: () => void;
};

/** Only an empty area can be deleted, so nothing goes with it; the API refuses the others. */
export function DeleteLifeAreaDialog({ lifeArea, onClose, onDeleted }: DeleteLifeAreaDialogProps) {
  const toast = useDeletedToast();
  return (
    <ConfirmDialog
      title={`Delete “${lifeArea.title}”?`}
      action="Delete area"
      tone="delete"
      groups={[]}
      onConfirm={async () => {
        await deleteLifeArea({ path: { life_area_id: lifeArea.id }, throwOnError: true });
        toast(`Deleted “${lifeArea.title}”`);
      }}
      onClose={onClose}
      onDone={onDeleted}
    />
  );
}
