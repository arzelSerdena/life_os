import { Alert, AlertDialog, Button } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { archiveLifeAreaMutation } from "../../client/@tanstack/react-query.gen";
import type { ContentsRead, LifeAreaRead } from "../../client/types.gen";
import { errorMessage } from "../../errors";

type ArchiveAreaDialogProps = {
  lifeArea: LifeAreaRead;
  contents: ContentsRead;
  onClose: () => void;
  onArchived: () => void;
};

/** Confirms archiving an area and lists what is archived with it. */
export function ArchiveAreaDialog({
  lifeArea,
  contents,
  onClose,
  onArchived,
}: ArchiveAreaDialogProps) {
  const archive = useMutation(archiveLifeAreaMutation());
  const lines = [
    [contents.active_projects, "active project", "active projects"],
    [contents.open_tasks, "open task", "open tasks"],
    [contents.upcoming_events, "upcoming event", "upcoming events"],
    [
      contents.metrics,
      "metric, with its entries and targets kept",
      "metrics, with their entries and targets kept",
    ],
    [contents.routine_steps, "routine step", "routine steps"],
  ].filter(([count]) => (count as number) > 0) as [number, string, string][];

  return (
    <AlertDialog.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Heading>Archive {lifeArea.title}?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3 type-body text-(--text-secondary)">
            {lines.length > 0 ? (
              <>
                <p>Everything in {lifeArea.title} is archived with it:</p>
                <ul className="list-disc pl-5">
                  {lines.map(([count, one, many]) => (
                    <li key={one}>
                      <strong className="font-semibold text-(--text-primary)">{count}</strong>{" "}
                      {count === 1 ? one : many}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>{lifeArea.title} is hidden from the rest of the app.</p>
            )}
            <p className="flex gap-2 rounded-(--radius-8) bg-neutral-50 p-3 type-meta text-(--text-secondary)">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2} />
              Nothing is deleted. You can restore {lifeArea.title} any time from Archived areas.
            </p>
            {archive.isError && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{errorMessage(archive.error)}</Alert.Description>
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
              isPending={archive.isPending}
              onPress={() =>
                archive.mutate(
                  { path: { life_area_id: lifeArea.id } },
                  {
                    onSuccess: () => {
                      onClose();
                      onArchived();
                    },
                  },
                )
              }
            >
              Archive area
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
