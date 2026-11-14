import { Button, Dropdown, Label } from "@heroui/react";
import { Ellipsis } from "lucide-react";
import type { LifeAreaRead } from "../../client/types.gen";

type AreaMenuProps = {
  lifeArea: LifeAreaRead;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

/** The ⋯ menu for one area: edit, archive or restore, and delete. */
export function AreaMenu({ lifeArea, onEdit, onArchive, onRestore, onDelete }: AreaMenuProps) {
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
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={(key) => actions[String(key)]()}>
          <Dropdown.Item id="edit" textValue="Edit">
            <Label>Edit</Label>
          </Dropdown.Item>
          {isArchived ? (
            <Dropdown.Item id="restore" textValue="Restore">
              <Label>Restore</Label>
            </Dropdown.Item>
          ) : (
            <Dropdown.Item id="archive" textValue="Archive">
              <Label>Archive</Label>
            </Dropdown.Item>
          )}
          <Dropdown.Item id="delete" textValue="Delete" variant="danger">
            <Label>Delete</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
