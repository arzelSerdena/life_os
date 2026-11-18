import { Alert, AlertDialog, Button } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { useState } from "react";
import { restoreBackupMutation } from "../../client/@tanstack/react-query.gen";
import type { BackupRead } from "../../client/types.gen";
import { errorMessage } from "../../errors";
import { today } from "../../period";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import type { TimeFormat } from "../tasks/format";
import { SECONDARY_BUTTON } from "./controls";
import { sizeLabel, whenLabel } from "./settings";

/**
 * Restore from backup: pick a backup (newest first, the newest picked), then confirm with
 * its date and size. The app backs up the current data first; settings stay as they are.
 */
export function RestoreDialog({
  backups,
  format,
  onClose,
}: {
  backups: BackupRead[];
  format: TimeFormat;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const show = useChangeToast((state) => state.show);
  const closePanel = useDetailPanel((state) => state.close);
  const [picked, setPicked] = useState(backups[0]?.name ?? null);
  const [isConfirming, setIsConfirming] = useState(false);
  const backup = backups.find((item) => item.name === picked) ?? null;
  const day = today();
  const when = (item: BackupRead) => whenLabel(item.created_at, day, format);

  const restore = useMutation({
    ...restoreBackupMutation(),
    onSuccess: async () => {
      // Everything may have changed, and the open item may no longer exist.
      closePanel();
      onClose();
      if (backup) show(`Restored the backup from ${when(backup)} · current data backed up`, null);
      await queryClient.invalidateQueries();
    },
  });

  return (
    <AlertDialog.Backdrop
      isOpen
      isDismissable={!restore.isPending}
      isKeyboardDismissDisabled={restore.isPending}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="flex max-h-[calc(100vh-96px)] w-[480px] max-w-[calc(100vw-32px)] flex-col gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay) sm:max-w-[480px]">
          <AlertDialog.Header className="flex h-[52px] shrink-0 flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <AlertDialog.Heading className="truncate type-panel-title text-(--text-primary)">
              {isConfirming && backup
                ? `Restore the backup from ${when(backup)}?`
                : "Restore from backup"}
            </AlertDialog.Heading>
            <AlertDialog.CloseTrigger className="static" />
          </AlertDialog.Header>
          <AlertDialog.Body className="m-0 flex min-h-0 flex-1 flex-col gap-3 px-5 pt-3 pb-4">
            {isConfirming && backup ? (
              <>
                <p className="type-body text-(--text-secondary)">
                  All your data is replaced with this backup. Settings stay as they are.
                </p>
                <div className="flex h-9 items-center gap-2 rounded-(--radius-8) border border-(--border-default) px-3">
                  <Database aria-hidden className="size-3.5 text-(--text-tertiary)" />
                  <span className="flex-1 text-[13px] text-(--text-primary) tabular-nums">
                    {when(backup)}
                  </span>
                  <span className="text-xs text-(--text-secondary) tabular-nums">
                    {sizeLabel(backup.size)}
                  </span>
                </div>
              </>
            ) : (
              <fieldset className="flex max-h-[360px] flex-col overflow-auto [scrollbar-width:none]">
                <legend className="sr-only">Backups</legend>
                {backups.map((item) => (
                  <label
                    key={item.name}
                    className="-mx-2 flex h-8 cursor-pointer items-center gap-2.5 rounded-(--radius-6) px-2 hover:bg-(--bg-hover) has-checked:bg-(--color-brand-50)"
                  >
                    <input
                      type="radio"
                      name="backup"
                      value={item.name}
                      checked={item.name === picked}
                      onChange={() => setPicked(item.name)}
                      className="size-3.5 accent-(--color-brand-600)"
                    />
                    <span className="flex-1 text-[13px] text-(--text-primary) tabular-nums">
                      {when(item)}
                    </span>
                    <span className="text-xs text-(--text-secondary) tabular-nums">
                      {sizeLabel(item.size)}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {restore.error ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{errorMessage(restore.error)}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </AlertDialog.Body>
          <AlertDialog.Footer className="m-0 flex shrink-0 items-center gap-2 border-t border-(--border-default) px-5 py-3">
            <span className="mr-auto type-meta text-(--text-tertiary)">
              Your current data is backed up first
            </span>
            {isConfirming ? (
              <>
                <Button
                  className={SECONDARY_BUTTON}
                  isDisabled={restore.isPending}
                  onPress={() => {
                    restore.reset();
                    setIsConfirming(false);
                  }}
                >
                  Go back
                </Button>
                <Button
                  isPending={restore.isPending}
                  onPress={() => backup && restore.mutate({ body: { name: backup.name } })}
                >
                  Restore backup
                </Button>
              </>
            ) : (
              <>
                <Button slot="close" className={SECONDARY_BUTTON}>
                  Go back
                </Button>
                <Button isDisabled={!backup} onPress={() => setIsConfirming(true)}>
                  Restore…
                </Button>
              </>
            )}
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
