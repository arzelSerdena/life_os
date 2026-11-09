import { Button, Card, Chip } from "@heroui/react";
import type { LifeAreaRead } from "../../client/types.gen";

type LifeAreaCardProps = {
  lifeArea: LifeAreaRead;
  isBusy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

export function LifeAreaCard({
  lifeArea,
  isBusy,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: LifeAreaCardProps) {
  const { title, vision, color, archived_at: archivedAt } = lifeArea;

  return (
    <Card className={archivedAt ? "opacity-70" : undefined}>
      <Card.Header>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-full bg-default"
            style={color ? { backgroundColor: color } : undefined}
          />
          <Card.Title className="min-w-0 break-words">{title}</Card.Title>
          {archivedAt && <Chip size="sm">Archived</Chip>}
        </div>
        {vision && <Card.Description>{vision}</Card.Description>}
      </Card.Header>
      <Card.Footer className="mt-auto flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" aria-label={`Edit ${title}`} onPress={onEdit}>
          Edit
        </Button>
        {archivedAt ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Restore ${title}`}
            isDisabled={isBusy}
            onPress={onRestore}
          >
            Restore
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Archive ${title}`}
            isDisabled={isBusy}
            onPress={onArchive}
          >
            Archive
          </Button>
        )}
        <Button size="sm" variant="ghost" aria-label={`Delete ${title}`} onPress={onDelete}>
          Delete
        </Button>
      </Card.Footer>
    </Card>
  );
}
