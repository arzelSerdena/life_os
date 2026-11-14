import { Button, Dropdown, Label } from "@heroui/react";
import { Archive, ArchiveRestore, Ellipsis, Pencil, Trash2 } from "lucide-react";
import type { LifeAreaRead } from "../../client/types.gen";

type AreaMenuProps = {
  lifeArea: LifeAreaRead;
  /** Only empty areas can be deleted; the API refuses the others. */
  canDelete: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

const ICON = "size-4 shrink-0 text-(--text-tertiary)";

/** The ⋯ menu for one area: edit, archive or restore, and delete. */
export function AreaMenu({
  lifeArea,
  canDelete,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: AreaMenuProps) {
  const isArchived = lifeArea.archived_at !== null;
  const actions: Record<string, () => void> = {
    edit: onEdit,
    archive: onArchive,
    restore: onRestore,
    delete: onDelete,
  };
  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="secondary"
        size="sm"
        aria-label={`More actions for ${lifeArea.title}`}
        className="size-7 min-w-0 border border-(--button-secondary-border) bg-(--bg-surface) px-0 text-(--button-secondary-text) [&_svg]:size-4"
      >
        <Ellipsis aria-hidden />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[240px]">
        <Dropdown.Menu
          disabledKeys={canDelete ? [] : ["delete"]}
          onAction={(key) => actions[String(key)]()}
        >
          <Dropdown.Item id="edit" textValue="Edit area">
            <Pencil aria-hidden className={ICON} />
            <Label>Edit area</Label>
          </Dropdown.Item>
          {isArchived ? (
            <Dropdown.Item id="restore" textValue="Restore area">
              <ArchiveRestore aria-hidden className={ICON} />
              <Label>Restore area</Label>
            </Dropdown.Item>
          ) : (
            <Dropdown.Item id="archive" textValue="Archive area">
              <Archive aria-hidden className={ICON} />
              <Label>Archive area</Label>
            </Dropdown.Item>
          )}
          <Dropdown.Item
            id="delete"
            textValue="Delete area"
            variant="danger"
            className="items-start"
          >
            <Trash2 aria-hidden className="mt-1 size-4 shrink-0" />
            <span className="flex flex-col py-1">
              <Label>Delete area</Label>
              {!canDelete && (
                <span className="text-[11px] leading-[14px] text-(--text-tertiary)">
                  Only empty areas can be deleted. Archive it instead.
                </span>
              )}
            </span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
