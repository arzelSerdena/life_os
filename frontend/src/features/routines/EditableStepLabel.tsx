import { useMutation } from "@tanstack/react-query";
import { ChartLine, Folder } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  moveRoutineStepMutation,
  updateRoutineStepMutation,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead, RoutinePageStepRead } from "../../client/types.gen";
import { errorMessage } from "../../errors";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { PanelMenu } from "../detail-panel/PanelParts";
import { useStepActions } from "../item-menu/routineActions";
import { NewMetricModal } from "../life-areas/area/NewMetricModal";
import { Chip } from "../pickers/chips";
import { OwnerChip } from "../pickers/OwnerPicker";

/** Clicks inside these are part of editing the row: its pickers, menus and dialogs. */
const OVERLAYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/**
 * A step's label in the Steps heatmap, edited in place (Approved: routine page, "Editing a
 * step"): click the title to rename it; ⋯ holds Pause, Archive and Delete. While the row is
 * being edited, its owner and Feeds metric chips show under the title. Enter or a click
 * elsewhere finishes, Esc puts the title back.
 */
export function EditableStepLabel({
  row,
  areas,
  projects,
}: {
  row: RoutinePageStepRead;
  /** Every area and project; the owner picker offers the active ones. */
  areas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
}) {
  const { step } = row;
  const path = { step_id: step.id };
  const [draft, setDraft] = useState<string | null>(null);
  const [focusTitle, setFocusTitle] = useState(false);
  const [isAddingMetric, setIsAddingMetric] = useState(false);
  const cancelled = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const showToast = useChangeToast((state) => state.show);
  const openPanel = useDetailPanel((state) => state.open);

  const rename = useMutation(updateRoutineStepMutation());
  const move = useMutation({
    ...moveRoutineStepMutation(),
    onSuccess: (change, { body }) => {
      const target =
        projects.find((project) => project.id === body.project_id)?.title ??
        areas.find((area) => area.id === body.life_area_id)?.title;
      showToast(`Moved “${step.title}” · ${target ?? ""}`, change.batch_id);
    },
  });
  const menu = useStepActions(row);
  const error = rename.error ?? move.error ?? menu.error;

  const project = projects.find((item) => item.id === step.project_id);
  const area = areas.find((item) => item.id === step.life_area_id);
  const shown = rename.isPending ? (rename.variables.body.title ?? step.title) : step.title;
  const isEditing = draft !== null;

  // Both start from the title as shown: a rename still saving is the newest one.
  const startEditing = (withTitle: boolean) => {
    cancelled.current = false;
    setFocusTitle(withTitle);
    setDraft((current) => current ?? shown);
  };
  const saveTitle = () => {
    const next = draft?.trim();
    if (cancelled.current || !next || next === shown) return;
    rename.mutate({ path, body: { title: next } });
  };
  const finish = () => {
    saveTitle();
    setDraft(null);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // A click outside the row (and outside its pickers and dialogs) finishes editing.
  useEffect(() => {
    if (!isEditing || isAddingMetric || menu.dialogs) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || container.current?.contains(target) || target.closest(OVERLAYS)) return;
      finishRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isEditing, isAddingMetric, menu.dialogs]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish();
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      cancelled.current = true;
      setDraft(null);
    }
  };

  return (
    <div ref={container} className="group/step flex min-w-0 flex-col pr-2">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-(--area-solid)" />
        {isEditing ? (
          <input
            aria-label="Step name"
            // biome-ignore lint/a11y/noAutofocus: the user just asked to rename it
            autoFocus={focusTitle}
            maxLength={200}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={onKeyDown}
            className="-my-[3px] h-6 min-w-0 flex-1 rounded-(--radius-6) bg-(--bg-surface) px-1.5 type-body font-medium text-(--text-primary) shadow-[inset_0_0_0_1px_var(--color-brand-600),0_0_0_2px_var(--color-brand-200)] outline-none"
          />
        ) : (
          <button
            type="button"
            title="Rename"
            onClick={() => startEditing(true)}
            className="-mx-1 min-w-0 truncate rounded-(--radius-4) px-1 text-left type-body font-medium text-(--text-primary) outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          >
            {shown}
          </button>
        )}
        <span
          className={`-my-[5px] shrink-0 ${
            isEditing
              ? ""
              : "opacity-0 group-focus-within/step:opacity-100 group-hover/step:opacity-100"
          }`}
        >
          <PanelMenu
            actions={menu.actions}
            label={`Actions for ${step.title}`}
            placement="bottom start"
            onOpenChange={(isOpen) => isOpen && startEditing(false)}
          />
        </span>
      </span>

      {isEditing ? (
        <span className="mt-1.5 flex min-w-0 flex-wrap gap-1 pl-5">
          <OwnerChip
            value={{ lifeAreaId: step.life_area_id, projectId: step.project_id }}
            lifeAreas={areas.filter((item) => item.archived_at === null)}
            projects={projects.filter(
              (item) => item.status === "active" && item.archived_at === null,
            )}
            allowInbox={false}
            onChange={(owner) =>
              move.mutate({
                path,
                body:
                  owner.projectId !== null
                    ? { project_id: owner.projectId }
                    : { life_area_id: owner.lifeAreaId },
              })
            }
          />
          {row.metric ? (
            <Chip
              icon={ChartLine}
              label={`Open ${row.metric.title}`}
              onPress={() => row.metric && openPanel({ kind: "metric", id: row.metric.id })}
            >
              <span className="truncate">Feeds {row.metric.title}</span>
            </Chip>
          ) : (
            area && (
              <Chip icon={ChartLine} tone="ghost" onPress={() => setIsAddingMetric(true)}>
                Feeds metric
              </Chip>
            )
          )}
        </span>
      ) : (
        (project || row.metric) && (
          <span className="flex min-w-0 gap-2.5 overflow-hidden pl-5 type-tag whitespace-nowrap text-(--text-tertiary)">
            {project && (
              <span className="inline-flex min-w-0 items-center gap-[3px]">
                <Folder aria-hidden className="size-[11px] shrink-0 text-(--area-solid)" />
                <span className="truncate">{project.title}</span>
              </span>
            )}
            {row.metric && (
              <span
                className="inline-flex min-w-0 items-center gap-[3px]"
                title={`Feeds ${row.metric.title}`}
              >
                <ChartLine aria-hidden className="size-[11px] shrink-0" />
                <span className="truncate">{row.metric.title}</span>
              </span>
            )}
          </span>
        )
      )}
      {error ? (
        <span role="alert" className="pl-5 type-meta text-(--text-danger)">
          {errorMessage(error)}
        </span>
      ) : null}

      {menu.dialogs}
      {isAddingMetric && area && (
        <NewMetricModal lifeArea={area} stepId={step.id} onClose={() => setIsAddingMetric(false)} />
      )}
    </div>
  );
}
