import { Button, Dropdown, Label } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FolderOpen } from "lucide-react";
import type { ReactNode } from "react";
import {
  getSettingsQueryKey,
  openFolderMutation,
  updateSettingsMutation,
} from "../../client/@tanstack/react-query.gen";
import type { SettingsUpdate } from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";

/** A bordered white button, as the mock-up's "btn". */
export const SECONDARY_BUTTON =
  "h-7 border border-(--button-secondary-border) bg-(--bg-surface) px-2.5 text-xs font-medium text-(--text-primary) hover:bg-(--bg-hover) [&_svg]:size-3.5";

/** A row: the label on the left with an optional data line under it, the control on the
 * right. The data line only shows data (a path, a time, a size); red when it reports a
 * problem. */
export function SettingRow({
  label,
  data,
  isError = false,
  children,
}: {
  label: string;
  data?: ReactNode;
  isError?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      aria-label={label}
      className="flex min-h-[52px] min-w-0 items-center gap-4 border-t border-(--border-default)/50 py-2.5 first:border-t-0"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-body font-medium text-(--text-primary)">{label}</span>
        {data ? (
          <span
            className={`truncate type-meta tabular-nums ${isError ? "text-(--text-danger)" : "text-(--text-tertiary)"}`}
          >
            {data}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </fieldset>
  );
}

/** The select for longer lists: a 28 px field with a chevron; the list marks the current
 * value with the accent check. */
export function SelectMenu<T extends string | number>({
  label,
  value,
  options,
  format,
  isDisabled = false,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  format: (value: T) => string;
  isDisabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Dropdown>
      <Button
        aria-label={label}
        isDisabled={isDisabled}
        className="h-7 min-w-32 justify-between gap-2 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) pr-2 pl-2.5 text-xs font-medium text-(--text-primary) tabular-nums hover:bg-(--bg-hover) data-[pressed=true]:border-(--color-brand-600) [&_svg]:size-3.5 [&_svg]:text-(--text-tertiary)"
      >
        {format(value)}
        <ChevronDown aria-hidden />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-32">
        <Dropdown.Menu
          aria-label={label}
          selectionMode="single"
          selectedKeys={[String(value)]}
          onAction={(key) => {
            const chosen = options.find((option) => String(option) === String(key));
            if (chosen !== undefined && chosen !== value) onChange(chosen);
          }}
        >
          {options.map((option) => (
            <Dropdown.Item key={String(option)} id={String(option)} textValue={format(option)}>
              <Label className="tabular-nums">{format(option)}</Label>
              <Dropdown.ItemIndicator className="ml-auto text-(--color-brand-600)" />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** Saves a settings change at once (no Save button, no toast). Day ends at shifts today
 * everywhere, so every query is refreshed. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const fail = useChangeToast((state) => state.fail);
  const mutation = useMutation({
    ...updateSettingsMutation(),
    onSuccess: (settings) => {
      queryClient.setQueryData(getSettingsQueryKey(), settings);
      void queryClient.invalidateQueries();
    },
  });
  return {
    ...mutation,
    save: (change: SettingsUpdate, onError?: (error: unknown) => void) =>
      mutation.mutate(
        { body: change },
        { onError: (error) => (onError ? onError(error) : fail("Couldn't save.", error)) },
      ),
  };
}

export function useOpenFolder() {
  const fail = useChangeToast((state) => state.fail);
  const mutation = useMutation({
    ...openFolderMutation(),
    onError: (error) => fail("Couldn't open the folder.", error),
  });
  return (folder: "backups" | "database") => mutation.mutate({ body: { folder } });
}

export function OpenFolderButton({
  folder,
  isDisabled = false,
}: {
  folder: "backups" | "database";
  isDisabled?: boolean;
}) {
  const open = useOpenFolder();
  return (
    <Button
      isIconOnly
      aria-label="Open folder"
      isDisabled={isDisabled}
      onPress={() => open(folder)}
      className="size-7 min-w-0 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) text-(--text-secondary) hover:bg-(--bg-hover) [&_svg]:size-3.5"
    >
      <FolderOpen aria-hidden />
    </Button>
  );
}
