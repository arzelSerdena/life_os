import { Alert, AlertDialog, Button, Skeleton } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import {
  Calendar,
  CalendarPlus,
  ChartLine,
  Check,
  Folder,
  History,
  type LucideIcon,
  Pause,
  Repeat,
  Target,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { PreviewGroup, PreviewRow } from "../../client/types.gen";
import { errorMessage } from "../../errors";
import { areaDataAttribute } from "../life-areas/palette";
import { GROUP_LABELS, rowMeta, rowName } from "./previewText";

/** What the footer says: archives can be restored, status changes undone, deletes can't. */
export type ConfirmTone = "archive" | "undo" | "delete";

const FOOTER_LINES: Record<ConfirmTone, string> = {
  archive: "You can restore it from Finished & archived",
  undo: "You can undo this",
  delete: "Can’t be undone",
};

/** A group shows this many rows, then "+n more", but only when 2 or more would be hidden. */
const FOLD_AFTER = 3;

/** How long an archive or status change waits for its preview before showing the dialog,
 * so one with nothing to list can apply without the dialog flashing up. */
const SHOW_LOADING_AFTER_MS = 200;

type ConfirmDialogProps = {
  /** The question, with the name in quotes: Complete “Resume & portfolio”? */
  title: string;
  /** The button, naming the action: Complete project. */
  action: string;
  tone: ConfirmTone;
  /** What goes with it; undefined while the preview loads. */
  groups: PreviewGroup[] | undefined;
  previewError?: unknown;
  /** Shown above the list, such as a repeating event's This event / All events choice. */
  choice?: ReactNode;
  /** Why it can't be done; the button stays disabled while this is set. */
  blocked?: ReactNode;
  /** An archive or status change with nothing going with it applies at once, without the
   * dialog. Deletes always ask. */
  appliesAtOnceWhenEmpty?: boolean;
  /** Applies the change, and shows its toast. */
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  onDone?: () => void;
};

/**
 * The one confirmation for every cascade and every delete with contents: what goes with
 * the action, grouped by effect, then Go back and the named action.
 */
export function ConfirmDialog({
  title,
  action,
  tone,
  groups,
  previewError,
  choice,
  blocked,
  appliesAtOnceWhenEmpty = false,
  onConfirm,
  onClose,
  onDone,
}: ConfirmDialogProps) {
  const apply = useMutation({
    mutationFn: onConfirm,
    onSuccess: () => {
      onClose();
      onDone?.();
    },
  });
  const [waited, setWaited] = useState(!appliesAtOnceWhenEmpty);
  useEffect(() => {
    if (waited) return;
    const timer = setTimeout(() => setWaited(true), SHOW_LOADING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waited]);

  const appliesAtOnce = appliesAtOnceWhenEmpty && groups?.length === 0 && !blocked;
  const { mutate, isIdle } = apply;
  useEffect(() => {
    if (appliesAtOnce && isIdle) mutate();
  }, [appliesAtOnce, isIdle, mutate]);

  const error = apply.error ?? previewError;
  if (!error && (appliesAtOnce || (!groups && !waited))) return null;

  const isDelete = tone === "delete";
  const isLoading = !groups && !previewError;
  return (
    <AlertDialog.Backdrop
      isOpen
      isDismissable
      isKeyboardDismissDisabled={false}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="flex max-h-[calc(100vh-96px)] w-[480px] max-w-[calc(100vw-32px)] flex-col gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay) sm:max-w-[480px]">
          <AlertDialog.Header className="flex h-[52px] shrink-0 flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <AlertDialog.Heading className="truncate type-panel-title text-(--text-primary)">
              {title}
            </AlertDialog.Heading>
            <AlertDialog.CloseTrigger className="static" />
          </AlertDialog.Header>
          <AlertDialog.Body className="m-0 flex min-h-0 flex-1 flex-col gap-3 px-5 pt-3 pb-4">
            {choice}
            {blocked ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{blocked}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : isLoading ? (
              <LoadingRows />
            ) : (
              groups &&
              groups.length > 0 && (
                <ShadowedList>
                  {groups.map((group) => (
                    <Group key={group.effect} group={group} />
                  ))}
                </ShadowedList>
              )
            )}
            {error ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{errorMessage(error)}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </AlertDialog.Body>
          <AlertDialog.Footer className="m-0 flex shrink-0 items-center gap-2 border-t border-(--border-default) px-5 py-3">
            <span
              className={`mr-auto type-meta ${isDelete ? "text-(--text-danger)" : "text-(--text-tertiary)"}`}
            >
              {FOOTER_LINES[tone]}
            </span>
            <Button
              slot="close"
              variant="secondary"
              className="border border-(--button-secondary-border) bg-(--bg-surface) text-(--button-secondary-text)"
            >
              Go back
            </Button>
            <Button
              variant={isDelete ? "danger" : "primary"}
              isDisabled={Boolean(blocked) || isLoading || Boolean(previewError)}
              isPending={apply.isPending}
              onPress={() => apply.mutate()}
            >
              {action}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

/** Scrolls inside the dialog (max 360 px) with shadows at the edges and no scrollbar. */
function ShadowedList({ children }: { children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const measure = useCallback(() => {
    const element = list.current;
    if (!element) return;
    const top = element.scrollTop > 0;
    const bottom = element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    setEdges((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  }, []);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);

  const shadow = "pointer-events-none absolute -inset-x-5 z-[1] h-3 transition-opacity";
  return (
    <div className="relative flex min-h-0 flex-col">
      <div
        aria-hidden
        className={`${shadow} top-0 bg-linear-to-b from-[rgb(17_24_39/0.08)] to-transparent ${edges.top ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={list}
        onScroll={measure}
        className="flex max-h-[360px] flex-col gap-3 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div
        aria-hidden
        className={`${shadow} bottom-0 bg-linear-to-t from-[rgb(17_24_39/0.08)] to-transparent ${edges.bottom ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function Group({ group }: { group: PreviewGroup }) {
  const [isOpen, setIsOpen] = useState(false);
  const { rows } = group;
  const folds = !isOpen && rows.length > FOLD_AFTER + 1;
  const shown = folds ? rows.slice(0, FOLD_AFTER) : rows;
  const label = GROUP_LABELS[group.effect];
  return (
    <section aria-label={label} className="flex flex-col">
      <div className="flex h-6 items-center gap-1.5">
        <h3
          className={`type-label ${group.effect === "deleted" ? "text-(--text-danger)" : "text-(--text-tertiary)"}`}
        >
          {label}
        </h3>
        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-neutral-100 px-1.5 text-[11px] font-medium text-(--text-secondary)">
          {rows.length}
        </span>
      </div>
      <ul className="flex flex-col">
        {shown.map((row, index) => (
          <Row key={`${row.kind}-${row.id ?? index}`} row={row} />
        ))}
      </ul>
      {folds && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-0.5 -ml-1.5 h-6 self-start rounded-[4px] px-1.5 text-xs font-medium text-(--text-secondary) outline-none hover:bg-(--bg-hover) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          +{rows.length - FOLD_AFTER} more
        </button>
      )}
    </section>
  );
}

const KIND_ICONS: Partial<Record<PreviewRow["kind"], LucideIcon>> = {
  project: Folder,
  event: Calendar,
  task_template: Repeat,
  metric: ChartLine,
  history: History,
  entries: History,
  targets: Target,
  pauses: Pause,
  schedules: CalendarPlus,
  moved_occurrence: CalendarPlus,
  skipped_occurrence: CalendarPlus,
  changed_occurrence: CalendarPlus,
};

/** Items in their owner's colour; history, schedules and changed occurrences in grey. */
const COLOURED = new Set<PreviewRow["kind"]>(["project", "event", "task_template", "metric"]);

function RowMark({ row }: { row: PreviewRow }) {
  if (row.kind === "task") {
    return row.finished ? (
      <span className="mx-px grid size-3.5 shrink-0 place-items-center rounded-[4px] bg-neutral-300 text-white">
        <Check aria-hidden className="size-2.5" strokeWidth={3} />
      </span>
    ) : (
      <span className="mx-px size-3.5 shrink-0 rounded-[4px] border-[1.5px] border-(--area-solid)" />
    );
  }
  if (row.kind === "subtask") {
    return (
      <span className="mx-0.5 size-3 shrink-0 rounded-[3px] border-[1.5px] border-neutral-400" />
    );
  }
  if (row.kind === "routine_step") {
    return (
      <span className="mx-px size-3.5 shrink-0 rounded-full border-[1.5px] border-(--area-solid)" />
    );
  }
  const Icon = KIND_ICONS[row.kind] ?? History;
  return (
    <span
      className={`grid size-4 shrink-0 place-items-center ${COLOURED.has(row.kind) ? "text-(--area-solid)" : "text-(--text-tertiary)"}`}
    >
      <Icon aria-hidden className="size-3.5" />
    </span>
  );
}

function Row({ row }: { row: PreviewRow }) {
  const meta = rowMeta(row);
  return (
    <li
      data-area={areaDataAttribute(row.color)}
      className="-mx-2 flex h-7 items-center gap-2 rounded-(--radius-6) px-2 hover:bg-neutral-50"
    >
      <RowMark row={row} />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] leading-5 ${row.finished ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"}`}
      >
        {rowName(row)}
      </span>
      {meta && (
        <span
          className={`text-xs whitespace-nowrap tabular-nums ${row.overdue ? "text-(--text-danger)" : "text-(--text-secondary)"}`}
        >
          {meta}
        </span>
      )}
    </li>
  );
}

function LoadingRows() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col">
      <div className="flex h-6 items-center">
        <Skeleton className="h-2.5 w-[72px] rounded-full" />
      </div>
      {[180, 220, 150].map((width) => (
        <div key={width} className="flex h-7 items-center gap-2">
          <Skeleton className="size-3.5 rounded-[4px]" />
          <Skeleton className="h-2.5 rounded-full" style={{ width }} />
        </div>
      ))}
    </div>
  );
}
