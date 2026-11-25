import { AlertDialog, Button } from "@heroui/react";
import { useState } from "react";

/**
 * Guards a form modal against accidental dismissal (clicking outside or pressing Esc)
 * while the user has unsaved edits. Clean modals close at once; dirty modals ask first.
 */
export function useDiscardGuard(isDirty: boolean, onClose: () => void) {
  const [confirming, setConfirming] = useState(false);

  const keepEditing = () => {
    setConfirming(false);
    // If the user triggered the prompt by clicking the backdrop, focus left the modal;
    // return focus to the dialog so Esc and keyboard navigation keep working.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[role="dialog"]')?.focus();
    });
  };

  const onOpenChange = (isOpen: boolean) => {
    if (isOpen || confirming) return;
    if (isDirty) setConfirming(true);
    else onClose();
  };

  const dialog = confirming ? (
    <AlertDialog.Backdrop
      isOpen
      isDismissable
      isKeyboardDismissDisabled={false}
      onOpenChange={(isOpen) => !isOpen && keepEditing()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="flex w-[400px] max-w-[calc(100vw-32px)] flex-col gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay) sm:max-w-[400px]">
          <AlertDialog.Header className="flex h-[52px] shrink-0 flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <AlertDialog.Heading className="type-panel-title text-(--text-primary)">
              Discard changes?
            </AlertDialog.Heading>
            <AlertDialog.CloseTrigger className="static" />
          </AlertDialog.Header>
          <AlertDialog.Body className="m-0 px-5 py-4 type-body text-(--text-secondary)">
            Your unsaved edits will be lost.
          </AlertDialog.Body>
          <AlertDialog.Footer className="m-0 flex justify-end gap-2 border-t border-(--border-default) px-5 py-3">
            <Button
              slot="close"
              variant="secondary"
              className="border border-(--button-secondary-border) bg-(--bg-surface) text-(--button-secondary-text)"
            >
              Keep editing
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                setConfirming(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  ) : null;

  return {
    backdropProps: {
      isOpen: true,
      isDismissable: !confirming,
      isKeyboardDismissDisabled: confirming,
      onOpenChange,
      className: "bg-[rgb(17_24_39/0.32)]",
    },
    dialog,
  };
}
