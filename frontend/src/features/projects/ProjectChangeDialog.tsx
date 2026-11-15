import { Alert, AlertDialog, Button } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { previewProjectChangeOptions } from "../../client/@tanstack/react-query.gen";
import { archiveProject, cancelProject, completeProject } from "../../client/sdk.gen";
import type { CascadeItemRead, ProjectRead } from "../../client/types.gen";
import { errorMessage } from "../../errors";
import { useChangeToast } from "../../stores/changeToastStore";

export type ProjectChange = "complete" | "cancel" | "archive";

const CHANGES = {
  complete: {
    verb: "Complete",
    gerund: "Completing",
    done: "Completed",
    request: completeProject,
  },
  cancel: { verb: "Cancel", gerund: "Cancelling", done: "Cancelled", request: cancelProject },
  archive: { verb: "Archive", gerund: "Archiving", done: "Archived", request: archiveProject },
} as const;

/** "1 open task", "2 open tasks", with the count in bold. */
function Count({ count, one, many }: { count: number; one: string; many: string }) {
  return (
    <>
      <strong className="font-semibold text-(--text-primary)">{count}</strong>{" "}
      {count === 1 ? one : many}
    </>
  );
}

type Line = { count: number; one: string; many: string };

/** "1 recurring task, 1 routine step and 2 metrics" */
function joinCounts(lines: Line[]): ReactNode {
  return lines.map((line, index) => (
    <span key={line.one}>
      {index > 0 && (index === lines.length - 1 ? " and " : ", ")}
      <Count {...line} />
    </span>
  ));
}

function count(items: CascadeItemRead[], kind: CascadeItemRead["kind"], effect?: string) {
  return items.filter((item) => item.kind === kind && (!effect || item.effect === effect)).length;
}

/** Complete or cancel: what is cancelled, ended and archived with the project. */
function FinishSummary({ items, gerund }: { items: CascadeItemRead[]; gerund: string }) {
  const openTasks = count(items, "task");
  const cancelledEvents = count(items, "event", "cancel");
  const endedSeries = count(items, "event", "end_series");
  const metrics = count(items, "metric");
  const archived: Line[] = [
    { count: count(items, "task_template"), one: "recurring task", many: "recurring tasks" },
    { count: count(items, "routine_step"), one: "routine step", many: "routine steps" },
    { count: metrics, one: "metric", many: "metrics" },
  ].filter((line) => line.count > 0);

  const lines: { key: string; content: ReactNode }[] = [];
  if (openTasks > 0)
    lines.push({
      key: "tasks",
      content: (
        <>
          cancels <Count count={openTasks} one="open task" many="open tasks" />
        </>
      ),
    });
  if (cancelledEvents > 0)
    lines.push({
      key: "events",
      content: (
        <>
          cancels <Count count={cancelledEvents} one="upcoming event" many="upcoming events" />
        </>
      ),
    });
  if (endedSeries > 0)
    lines.push({
      key: "series",
      content: (
        <>
          ends <Count count={endedSeries} one="repeating event" many="repeating events" /> from
          today
        </>
      ),
    });
  if (archived.length > 0)
    lines.push({
      key: "archived",
      content: (
        <>
          archives {joinCounts(archived)}
          {metrics > 0 &&
            (metrics === 1
              ? ", with its entries and targets kept"
              : ", with their entries and targets kept")}
        </>
      ),
    });

  if (lines.length === 0) return <p>Nothing else in the project changes.</p>;
  return (
    <div>
      <p>
        {openTasks > 0 &&
          `${openTasks === 1 ? "1 task is" : `${openTasks} tasks are`} still open. `}
        {gerund} the project also:
      </p>
      <ul className="ml-[18px] list-disc text-[13px] leading-[22px]">
        {lines.map((line) => (
          <li key={line.key}>{line.content}</li>
        ))}
      </ul>
    </div>
  );
}

/** Archive: everything in the project is archived with it. */
function ArchiveSummary({ items, project }: { items: CascadeItemRead[]; project: ProjectRead }) {
  const tasks = count(items, "task");
  const sections = project.sections.length;
  const lines: (Line & { suffix?: string })[] = [
    {
      count: tasks,
      one: "task",
      many: "tasks",
      suffix: sections > 0 ? ` in ${sections === 1 ? "1 section" : `${sections} sections`}` : "",
    },
    { count: count(items, "event"), one: "event", many: "events" },
    { count: count(items, "task_template"), one: "recurring task", many: "recurring tasks" },
    {
      count: count(items, "metric"),
      one: "metric, with its entries and targets kept",
      many: "metrics, with their entries and targets kept",
    },
    { count: count(items, "routine_step"), one: "routine step", many: "routine steps" },
  ].filter((line) => line.count > 0);

  if (lines.length === 0) return <p>{project.title} is hidden from the rest of the app.</p>;
  return (
    <div>
      <p>Everything in the project is archived with it:</p>
      <ul className="ml-[18px] list-disc text-[13px] leading-[22px]">
        {lines.map(({ suffix, ...line }) => (
          <li key={line.one}>
            <Count {...line} />
            {suffix}
          </li>
        ))}
      </ul>
    </div>
  );
}

type ProjectChangeDialogProps = {
  project: ProjectRead;
  change: ProjectChange;
  onClose: () => void;
};

/**
 * Confirms completing, cancelling or archiving a project, listing what it does to the
 * project's items. The change is one batch, which the toast's Undo restores.
 */
export function ProjectChangeDialog({ project, change, onClose }: ProjectChangeDialogProps) {
  const { verb, gerund, done, request } = CHANGES[change];
  const path = { project_id: project.id };
  const preview = useQuery(previewProjectChangeOptions({ path, query: { action: change } }));
  const showChange = useChangeToast((state) => state.show);
  const apply = useMutation({
    mutationFn: () => request({ path, throwOnError: true }),
    onSuccess: ({ data }) => {
      onClose();
      if (data.batch_id) showChange(`${done} “${project.title}”`, data.batch_id);
    },
  });
  const items = preview.data?.items;
  const error = apply.error ?? preview.error;

  return (
    <AlertDialog.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[420px]">
          <AlertDialog.Header>
            <AlertDialog.Heading>
              {verb} {project.title}?
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3 type-body text-(--text-secondary)">
            {items &&
              (change === "archive" ? (
                <ArchiveSummary items={items} project={project} />
              ) : (
                <FinishSummary items={items} gerund={gerund} />
              ))}
            <p className="flex gap-1.5 rounded-(--radius-6) bg-neutral-50 px-2.5 py-2 text-xs leading-4 text-(--text-secondary)">
              <Info aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
              {change === "archive"
                ? "Nothing is deleted. You can restore the project any time from Archived."
                : "You can reopen the project later. Cancelled tasks stay cancelled."}
            </p>
            {error && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{errorMessage(error)}</Alert.Description>
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
              {change === "cancel" ? "Go back" : "Cancel"}
            </Button>
            <Button isDisabled={!items} isPending={apply.isPending} onPress={() => apply.mutate()}>
              {verb} project
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
