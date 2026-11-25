import { Alert, Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { createSectionMutation } from "../../client/@tanstack/react-query.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { useDiscardGuard } from "../confirming/useDiscardGuard";

const FIELD_LABEL = "text-xs leading-4 font-semibold text-(--text-primary)";

/** The New section pop-up: just its name. A section belongs to one project and never moves. */
export function NewSectionModal({
  project,
  onClose,
}: {
  project: { id: number };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const guard = useDiscardGuard(title.trim() !== "", onClose);
  const create = useMutation(createSectionMutation());
  const name = title.trim();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || create.isPending) return;
    try {
      await create.mutateAsync({ path: { project_id: project.id }, body: { title: name } });
    } catch {
      return; // shown in the pop-up
    }
    await queryClient.invalidateQueries();
    onClose();
  };

  return (
    <>
      <Modal.Backdrop {...guard.backdropProps}>
        <Modal.Container scroll="inside">
          <Modal.Dialog
            aria-label="New section"
            className="w-[400px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)"
          >
            <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
              <Modal.Heading className="type-panel-title text-(--text-primary)">
                New section
              </Modal.Heading>
              <IconButton label="Close" size="md" onPress={onClose}>
                <X />
              </IconButton>
            </Modal.Header>
            <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
              <Modal.Body className="m-0 flex flex-col gap-4 px-5 py-4">
                <TextField
                  fullWidth
                  autoFocus
                  value={title}
                  onChange={setTitle}
                  maxLength={200}
                  className="gap-1.5"
                >
                  <Label className={FIELD_LABEL}>Name</Label>
                  <Input className="h-8 type-body text-(--text-primary)" />
                </TextField>
                {create.isError && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{errorMessage(create.error)}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}
              </Modal.Body>
              <Modal.Footer className="m-0 flex justify-end gap-2 border-t border-(--border-default) px-5 py-3">
                <Button
                  variant="secondary"
                  onPress={onClose}
                  className="border border-(--button-secondary-border) bg-(--bg-surface) text-(--button-secondary-text)"
                >
                  Cancel
                </Button>
                <Button type="submit" isDisabled={!name} isPending={create.isPending}>
                  Create section
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {guard.dialog}
    </>
  );
}
