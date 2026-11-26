import { Button, Modal } from "@heroui/react";
import { X } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../../components/IconButton";

export type EventEditScope = "this" | "following" | "all";

const OPTIONS: { value: EventEditScope; label: string }[] = [
  { value: "this", label: "This event" },
  { value: "following", label: "This and following events" },
  { value: "all", label: "All events" },
];

/**
 * Popup shown when dragging or resizing a repeating event, letting the user choose whether
 * to update only this occurrence, this and following, or all.
 */
export function EventScopeDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: (scope: EventEditScope) => void;
}) {
  const [scope, setScope] = useState<EventEditScope>("this");

  return (
    <Modal isOpen onOpenChange={(open) => !open && onCancel()}>
      <Modal.Backdrop className="z-50 bg-[rgb(17_24_39/0.32)]">
        <Modal.Container>
          <Modal.Dialog className="w-[400px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay) sm:max-w-[400px]">
            <Modal.Header className="flex h-[52px] shrink-0 flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
              <Modal.Heading className="truncate type-panel-title text-(--text-primary)">
                Edit recurring event
              </Modal.Heading>
              <IconButton label="Close" size="md" onPress={onCancel}>
                <X />
              </IconButton>
            </Modal.Header>
            <Modal.Body className="m-0 flex flex-col gap-3 px-5 py-4">
              <p className="truncate type-meta text-(--text-tertiary)">{title}</p>
              <fieldset aria-label="Which events to change" className="flex flex-col gap-2">
                <legend className="sr-only">Which events to change</legend>
                {OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2.5 type-body text-(--text-primary)"
                  >
                    <input
                      type="radio"
                      name="event-scope"
                      value={option.value}
                      checked={scope === option.value}
                      onChange={() => setScope(option.value)}
                      className="size-4 accent-(--color-brand-600)"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
            </Modal.Body>
            <Modal.Footer className="m-0 flex shrink-0 items-center justify-end gap-2 border-t border-(--border-default) px-5 py-3">
              <Button
                variant="secondary"
                onPress={onCancel}
                className="border border-(--button-secondary-border) bg-(--bg-surface) text-(--button-secondary-text)"
              >
                Cancel
              </Button>
              <Button onPress={() => onConfirm(scope)}>OK</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
