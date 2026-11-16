import { useQuery } from "@tanstack/react-query";
import { previewLifeAreaArchiveOptions } from "../../client/@tanstack/react-query.gen";
import { archiveLifeArea } from "../../client/sdk.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { ConfirmDialog } from "../confirming/ConfirmDialog";

type ArchiveAreaDialogProps = {
  lifeArea: LifeAreaRead;
  onClose: () => void;
  onArchived: () => void;
};

/**
 * Confirms archiving an area: each project as one row with what it holds, then the items
 * the area owns directly. An empty area is archived at once. The archive is one batch,
 * which the toast's Undo restores.
 */
export function ArchiveAreaDialog({ lifeArea, onClose, onArchived }: ArchiveAreaDialogProps) {
  const path = { life_area_id: lifeArea.id };
  const preview = useQuery(previewLifeAreaArchiveOptions({ path }));
  const showChange = useChangeToast((state) => state.show);
  return (
    <ConfirmDialog
      title={`Archive “${lifeArea.title}”?`}
      action="Archive area"
      tone="archive"
      groups={preview.data?.groups}
      previewError={preview.error}
      appliesAtOnceWhenEmpty
      onConfirm={async () => {
        const { data } = await archiveLifeArea({ path, throwOnError: true });
        if (data.batch_id) showChange(`Archived “${lifeArea.title}”`, data.batch_id);
      }}
      onClose={onClose}
      onDone={onArchived}
    />
  );
}
