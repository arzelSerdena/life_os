import { Button, Input, Switch } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  backUpNowMutation,
  listBackupsOptions,
  listBackupsQueryKey,
} from "../../client/@tanstack/react-query.gen";
import { exportData } from "../../client/sdk.gen";
import type { SettingsRead } from "../../client/types.gen";
import { errorMessage } from "../../errors";
import { today } from "../../period";
import { useChangeToast } from "../../stores/changeToastStore";
import {
  OpenFolderButton,
  SECONDARY_BUTTON,
  SelectMenu,
  SettingRow,
  useUpdateSettings,
} from "./controls";
import { RestoreDialog } from "./RestoreDialog";
import { attachmentName, hourLabel, KEEP_BACKUPS, lastBackupLine, sizeLabel } from "./settings";

/** Settings › Data: automatic backups, the folder, Back up now, Restore from backup and
 * Export all data. */
export function DataSection({ settings }: { settings: SettingsRead }) {
  const { save } = useUpdateSettings();
  const status = useQuery(listBackupsOptions());
  const [isRestoring, setIsRestoring] = useState(false);
  const format = settings.time_format;
  const data = status.data;
  const folderMissing = data ? !data.folder_found : false;

  return (
    <>
      <SettingRow
        label="Automatic backups"
        data={
          settings.auto_backup && data ? `Daily, ${hourLabel(data.auto_backup_hour, format)}` : null
        }
      >
        <Switch
          size="sm"
          aria-label="Automatic backups"
          isSelected={settings.auto_backup}
          onChange={(auto_backup) => save({ auto_backup })}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </SettingRow>
      <SettingRow label="Keep last">
        <SelectMenu
          label="Keep last"
          value={settings.keep_backups}
          options={KEEP_BACKUPS}
          format={(count) => `${count} backups`}
          isDisabled={!settings.auto_backup}
          onChange={(keep_backups) => save({ keep_backups })}
        />
      </SettingRow>
      <FolderRow settings={settings} folder={data?.folder} folderMissing={folderMissing} />
      <BackUpRow
        line={data ? lastBackupLine(data, today(), format) : null}
        isDisabled={!data || folderMissing}
      />
      <SettingRow label="Restore from backup">
        <Button
          className={SECONDARY_BUTTON}
          isDisabled={!data || folderMissing || data.backups.length === 0}
          onPress={() => setIsRestoring(true)}
        >
          Restore…
        </Button>
      </SettingRow>
      <ExportRow />
      {isRestoring && data && (
        <RestoreDialog
          backups={data.backups}
          format={format}
          onClose={() => setIsRestoring(false)}
        />
      )}
    </>
  );
}

/** The folder as the data line, Open folder and Change. Change edits the path in place:
 * Enter or Save keeps it, Esc or Cancel drops it, and an empty path means the default
 * folder next to the database. */
function FolderRow({
  settings,
  folder,
  folderMissing,
}: {
  settings: SettingsRead;
  folder: string | undefined;
  folderMissing: boolean;
}) {
  const { save, isPending } = useUpdateSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setDraft(null);
    setError(null);
  };
  const submit = () => {
    if (draft === null) return;
    const path = draft.trim();
    save({ backup_folder: path || null }, (failure) => setError(errorMessage(failure)));
    setDraft(null);
    setError(null);
  };

  if (draft !== null) {
    return (
      <form
        aria-label="Backup folder"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex min-h-[52px] items-center gap-2 border-t border-(--color-neutral-100) py-2.5"
      >
        <span className="w-[120px] shrink-0 text-[13px] leading-[18px] font-medium text-(--text-primary)">
          Backup folder
        </span>
        <Input
          aria-label="Backup folder path"
          value={draft}
          autoFocus
          placeholder="Default: next to the database"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          className="h-7 min-w-0 flex-1 text-xs"
        />
        <Button type="button" className={SECONDARY_BUTTON} onPress={cancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="h-7" isPending={isPending}>
          Save
        </Button>
      </form>
    );
  }

  const line = error ?? (folderMissing ? `Folder not found: ${folder}` : folder);
  return (
    <SettingRow label="Backup folder" data={line} isError={Boolean(error) || folderMissing}>
      <OpenFolderButton folder="backups" isDisabled={!folder || folderMissing} />
      <Button
        className={SECONDARY_BUTTON}
        onPress={() => setDraft(settings.backup_folder ?? folder ?? "")}
      >
        Change
      </Button>
    </SettingRow>
  );
}

function BackUpRow({
  line,
  isDisabled,
}: {
  line: { text: string; failed: boolean } | null;
  isDisabled: boolean;
}) {
  const queryClient = useQueryClient();
  const backUp = useMutation({
    ...backUpNowMutation(),
    // A failure is reported by the folder's status, as the red data line.
    onSettled: () => queryClient.invalidateQueries({ queryKey: listBackupsQueryKey() }),
  });
  return (
    <SettingRow label="Last backup" data={line?.text} isError={line?.failed}>
      <Button
        className={SECONDARY_BUTTON}
        isDisabled={isDisabled}
        isPending={backUp.isPending}
        onPress={() => backUp.mutate({})}
      >
        {backUp.isPending ? "Backing up" : line?.failed ? "Retry" : "Back up now"}
      </Button>
    </SettingRow>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A zip of CSVs, one per table; the toast names the file and its size. */
function ExportRow() {
  const show = useChangeToast((state) => state.show);
  const fail = useChangeToast((state) => state.fail);
  const exporting = useMutation({
    mutationFn: async () => {
      const { data, response } = await exportData({ throwOnError: true });
      const name = attachmentName(response.headers.get("Content-Disposition"), "life-os.zip");
      download(data, name);
      return { name, size: data.size };
    },
    onSuccess: ({ name, size }) => show(`Exported ${name} · ${sizeLabel(size)}`, null),
    onError: (error) => fail("Couldn't export.", error),
  });
  return (
    <SettingRow label="Export all data">
      <Button
        className={SECONDARY_BUTTON}
        isPending={exporting.isPending}
        onPress={() => exporting.mutate()}
      >
        Export
      </Button>
    </SettingRow>
  );
}
