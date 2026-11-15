import { Alert, AlertDialog, Button } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "../../errors";

/** A count with its singular and plural wording: [9, "entry", "entries"]. */
export type CountLine = [count: number, one: string, many: string];

type DeleteDialogProps = {
  /** The item's name, for the heading: Delete Networking chats? */
  name: string;
  /** The red button, naming the action: Delete metric. */
  action: string;
  /** What is deleted with it. Zero counts are left out. */
  deleted?: CountLine[];
  /** What stays, with the sentence that introduces it. */
  kept?: { intro: string; lines: CountLine[] };
  /** Why it can't be deleted; the button stays disabled while this is set. */
  blocked?: ReactNode;
  /** The counts are still loading. */
  isLoading?: boolean;
  /** Shown above the counts, such as a repeating event's This event / All choice. */
  children?: ReactNode;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  onDeleted?: () => void;
};

function CountList({ lines }: { lines: CountLine[] }) {
  return (
    <ul className="ml-[18px] list-disc text-[13px] leading-[22px]">
      {lines.map(([count, one, many]) => (
        <li key={one}>
          <strong className="font-semibold text-(--text-primary)">{count}</strong>{" "}
          {count === 1 ? one : many}
        </li>
      ))}
    </ul>
  );
}

/** The red delete confirmation: what goes with the item, and that it can't be undone. */
export function DeleteDialog({
  name,
  action,
  deleted = [],
  kept,
  blocked,
  isLoading = false,
  children,
  onConfirm,
  onClose,
  onDeleted,
}: DeleteDialogProps) {
  const remove = useMutation({ mutationFn: onConfirm });
  const deletedLines = deleted.filter(([count]) => count > 0);
  const keptLines = kept?.lines.filter(([count]) => count > 0) ?? [];

  return (
    <AlertDialog.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[420px]">
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Heading>Delete {name}?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3 type-body text-(--text-secondary)">
            {children}
            {blocked ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{blocked}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : (
              <>
                {deletedLines.length > 0 && (
                  <div>
                    <p>Deleted with it:</p>
                    <CountList lines={deletedLines} />
                  </div>
                )}
                {kept && keptLines.length > 0 && (
                  <div>
                    <p>{kept.intro}</p>
                    <CountList lines={keptLines} />
                  </div>
                )}
                <p className="flex gap-1.5 rounded-(--radius-6) bg-neutral-50 px-2.5 py-2 text-xs leading-4 text-(--text-secondary)">
                  <Info aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
                  This can't be undone.
                </p>
              </>
            )}
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
            <Button
              slot="close"
              variant="secondary"
              className="border border-(--button-secondary-border) bg-(--bg-surface) text-(--button-secondary-text)"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isDisabled={Boolean(blocked) || isLoading}
              isPending={remove.isPending}
              onPress={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    onClose();
                    onDeleted?.();
                  },
                })
              }
            >
              {action}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
