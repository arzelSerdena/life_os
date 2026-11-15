import { deleteLifeArea } from "../../client/sdk.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { DeleteDialog } from "../deleting/DeleteDialog";

type DeleteLifeAreaDialogProps = {
  lifeArea: LifeAreaRead;
  onClose: () => void;
  onDeleted?: () => void;
};

/** Only an empty area can be deleted, so nothing goes with it; the API refuses the others. */
export function DeleteLifeAreaDialog({ lifeArea, onClose, onDeleted }: DeleteLifeAreaDialogProps) {
  return (
    <DeleteDialog
      name={lifeArea.title}
      action="Delete area"
      onConfirm={() => deleteLifeArea({ path: { life_area_id: lifeArea.id }, throwOnError: true })}
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}
