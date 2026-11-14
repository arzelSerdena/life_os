import { Alert, AlertDialog, Button } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { deleteLifeAreaMutation } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { errorMessage } from "../../errors";

type DeleteLifeAreaDialogProps = {
  lifeArea: LifeAreaRead;
  onClose: () => void;
  onDeleted?: () => void;
};

export function DeleteLifeAreaDialog({ lifeArea, onClose, onDeleted }: DeleteLifeAreaDialogProps) {
  const remove = useMutation(deleteLifeAreaMutation());

  return (
    <AlertDialog.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Delete {lifeArea.title}?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <p>This permanently deletes the life area and can't be undone.</p>
            {remove.isError && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{errorMessage(remove.error)}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button
              variant="danger"
              isPending={remove.isPending}
              onPress={() =>
                remove.mutate(
                  { path: { life_area_id: lifeArea.id } },
                  {
                    onSuccess: () => {
                      onClose();
                      onDeleted?.();
                    },
                  },
                )
              }
            >
              Delete
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
