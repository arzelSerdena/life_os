import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Alert, Button, Input, Label, Modal, TextField, Tooltip } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, GripVertical, Plus, X } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { createRoutineMutation } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead, RoutineRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { useDiscardGuard } from "../confirming/useDiscardGuard";
import { areaDataAttribute } from "../life-areas/palette";
import { DateChip } from "../pickers/DatePicker";
import { dayDate } from "../pickers/dates";
import { type Owner, OwnerChip } from "../pickers/OwnerPicker";
import { RepeatChip } from "../pickers/RepeatPicker";
import { type RepeatRule, simpleRule, toRRule } from "../pickers/repeat";
import { ProgressRing } from "../tasks/RoutinesPage";
import { newRoutineMissing, type StepDraft } from "./newRoutine";

/**
 * The New routine pop-up (480 px, Approved: routine, "New routine"): Name, the Repeat chip
 * (Every day to start) and Starts today, the steps (title and owner, dragged into order),
 * Add step, and the routine's row as the sidebar will show it.
 */
export function NewRoutineModal({
  today,
  title: initialTitle = "",
  lifeAreas,
  projects,
  onClose,
  onCreated,
}: {
  today: string;
  /** A quick-start name to begin with. */
  title?: string;
  /** Active areas and projects, for the owner pickers. */
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
  onClose: () => void;
  onCreated: (routine: RoutineRead) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [rule, setRule] = useState<RepeatRule>(() => simpleRule("daily", today));
  const [startsOn, setStartsOn] = useState(today);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const snapshot = JSON.stringify([title, rule, startsOn, steps]);
  const initialSnapshot = useRef(snapshot);
  const guard = useDiscardGuard(snapshot !== initialSnapshot.current, onClose);
  const create = useMutation(createRoutineMutation());
  const missing = newRoutineMissing(title, steps);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (missing || create.isPending) return;
    create.mutate(
      {
        body: {
          title: title.trim(),
          rrule: toRRule(rule, startsOn),
          starts_on: startsOn,
          steps: steps.map((step) => ({
            title: step.title,
            ...(step.owner.projectId !== null
              ? { project_id: step.owner.projectId }
              : { life_area_id: step.owner.lifeAreaId }),
          })),
        },
      },
      { onSuccess: onCreated },
    );
  };

  return (
    <>
      <Modal.Backdrop {...guard.backdropProps}>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[480px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
            <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
              <Modal.Heading className="type-panel-title text-(--text-primary)">
                New routine
              </Modal.Heading>
              <IconButton label="Close" size="md" onPress={onClose}>
                <X />
              </IconButton>
            </Modal.Header>
            <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
              <Modal.Body className="m-0 flex flex-col gap-4 px-5 py-4">
                <TextField
                  fullWidth
                  autoFocus
                  name="title"
                  value={title}
                  onChange={setTitle}
                  className="gap-1.5"
                >
                  <Label className="text-xs leading-4 font-semibold text-(--text-primary)">
                    Name
                  </Label>
                  <Input
                    placeholder="Routine name"
                    maxLength={200}
                    className="h-8 type-body text-(--text-primary)"
                  />
                </TextField>

                <div className="-mt-1 flex flex-wrap gap-1.5">
                  <RepeatChip
                    value={rule}
                    anchor={startsOn}
                    allowCompletion={false}
                    allowNone={false}
                    allowEnd={false}
                    onChange={(next) => next && setRule(next)}
                  />
                  <DateChip
                    icon={CalendarDays}
                    label="Starts"
                    value={startsOn}
                    today={today}
                    onChange={(day) => day && setStartsOn(day)}
                  >
                    {startsOn === today ? "Starts today" : `Starts ${dayDate(startsOn)}`}
                  </DateChip>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex h-6 items-center gap-1.5">
                    <span className="text-xs leading-4 font-semibold text-(--text-primary)">
                      Steps
                    </span>
                    {steps.length > 0 && (
                      <span className="rounded-full bg-(--color-neutral-100) px-1.5 text-[11px] leading-4 font-medium text-(--text-secondary)">
                        {steps.length}
                      </span>
                    )}
                  </div>
                  <StepDrafts
                    steps={steps}
                    lifeAreas={lifeAreas}
                    projects={projects}
                    onChange={setSteps}
                  />
                </div>

                <div className="flex flex-col border-t border-(--color-neutral-100) pt-3">
                  <div
                    aria-hidden
                    className="flex h-7 w-60 items-center gap-2 rounded-(--radius-6) bg-(--color-neutral-100) px-2 type-sidebar-item text-(--text-primary)"
                  >
                    <ProgressRing done={0} total={0} className="size-4" />
                    <span className={`truncate ${title.trim() ? "" : "text-(--text-disabled)"}`}>
                      {title.trim() || "Routine name"}
                    </span>
                  </div>
                </div>

                {create.error && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{errorMessage(create.error)}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}
              </Modal.Body>
              <Modal.Footer className="m-0 flex justify-end gap-2 border-t border-(--border-default) px-5 py-3">
                <Button
                  variant="secondary"
                  onPress={onClose}
                  className="border border-(--button-secondary-border) bg-(--bg-surface) text-(--button-secondary-text)"
                >
                  Cancel
                </Button>
                <Tooltip delay={0} isDisabled={!missing}>
                  {/* The wrapper only catches hover on the disabled button; screen readers
                    get the reason from aria-describedby. */}
                  <Tooltip.Trigger role="presentation" tabIndex={-1}>
                    <Button
                      type="submit"
                      isPending={create.isPending}
                      isDisabled={missing !== null}
                      aria-describedby={missing ? "new-routine-missing" : undefined}
                    >
                      Create routine
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{missing}</Tooltip.Content>
                </Tooltip>
                {missing && (
                  <span id="new-routine-missing" className="sr-only">
                    {missing}
                  </span>
                )}
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {guard.dialog}
    </>
  );
}

/** The steps typed so far, each with its owner and a grip to drag it, then Add step: Enter
 * adds one (owned like the step before it) and keeps typing. */
function StepDrafts({
  steps,
  lifeAreas,
  projects,
  onChange,
}: {
  steps: StepDraft[];
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
  onChange: (steps: StepDraft[]) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const nextKey = useRef(1);
  const input = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const add = () => {
    const title = (draft ?? "").trim();
    if (!title) return;
    const owner = steps.at(-1)?.owner ?? { lifeAreaId: null, projectId: null };
    onChange([...steps, { key: nextKey.current++, title, owner }]);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = steps.findIndex((step) => step.key === active.id);
    const to = steps.findIndex((step) => step.key === over.id);
    onChange(arrayMove(steps, from, to));
  };

  return (
    <div className="flex flex-col gap-0.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={steps.map((step) => step.key)}
          strategy={verticalListSortingStrategy}
        >
          <ul aria-label="Steps" className="flex flex-col gap-0.5">
            {steps.map((step) => (
              <SortableStep
                key={step.key}
                step={step}
                lifeAreas={lifeAreas}
                projects={projects}
                onOwner={(owner) =>
                  onChange(steps.map((s) => (s.key === step.key ? { ...s, owner } : s)))
                }
                onRemove={() => onChange(steps.filter((s) => s.key !== step.key))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft("")}
          className="flex h-8 w-full items-center gap-2 rounded-(--radius-6) px-1 text-[13px] text-(--text-tertiary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          <Plus aria-hidden className="size-3.5" strokeWidth={2} />
          Add step
        </button>
      ) : (
        <label className="flex h-8 items-center gap-2 rounded-(--radius-6) bg-(--color-neutral-100) px-1">
          <Plus aria-hidden className="size-3.5 shrink-0 text-(--text-tertiary)" strokeWidth={2} />
          <input
            ref={input}
            // biome-ignore lint/a11y/noAutofocus: shown when Add step is clicked, to type
            autoFocus
            aria-label="Add step"
            placeholder="Add step"
            maxLength={200}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter adds the step here instead of creating the routine.
              if (event.key === "Enter") {
                event.preventDefault();
                add();
                setDraft("");
                input.current?.focus();
              }
              if (event.key === "Escape" && draft) {
                event.stopPropagation();
                setDraft("");
              }
            }}
            onBlur={() => {
              add();
              setDraft(null);
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-(--text-primary) outline-none placeholder:text-(--text-tertiary)"
          />
        </label>
      )}
    </div>
  );
}

function SortableStep({
  step,
  lifeAreas,
  projects,
  onOwner,
  onRemove,
}: {
  step: StepDraft;
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
  onOwner: (owner: Owner) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.key,
  });
  const project = projects.find((p) => p.id === step.owner.projectId);
  const area = lifeAreas.find((a) => a.id === (project?.life_area_id ?? step.owner.lifeAreaId));
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex h-8 items-center gap-2 rounded-(--radius-6) px-1 hover:bg-(--color-neutral-50) ${
        isDragging ? "relative z-10 bg-(--bg-surface) shadow-(--effect-overlay)" : ""
      }`}
    >
      <button
        type="button"
        aria-label={`Move ${step.title}`}
        className="grid size-5 shrink-0 cursor-grab place-items-center rounded-(--radius-4) text-(--color-neutral-400) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden className="size-3" strokeWidth={2} />
      </button>
      <span
        aria-hidden
        data-area={areaDataAttribute(area?.color)}
        className={`size-3 shrink-0 rounded-full border-2 ${area ? "border-(--area-solid)" : "border-dashed border-(--color-neutral-400)"}`}
      />
      <span className="min-w-0 flex-1 truncate text-[13px] text-(--text-primary)">
        {step.title}
      </span>
      <OwnerChip
        value={step.owner}
        lifeAreas={lifeAreas}
        projects={projects}
        allowInbox={false}
        onChange={onOwner}
      />
      <button
        type="button"
        aria-label={`Remove ${step.title}`}
        onClick={onRemove}
        className="grid size-6 shrink-0 place-items-center rounded-(--radius-6) text-(--text-tertiary) opacity-0 outline-none group-hover:opacity-100 hover:bg-(--color-neutral-200) hover:text-(--text-primary) focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
}
