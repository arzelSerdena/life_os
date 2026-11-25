import { Alert, Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlignLeft, Clock3, Flag, Plus, Sun, X } from "lucide-react";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import {
  createTaskMutation,
  createTaskTemplateMutation,
  listLifeAreasOptions,
  listProjectsOptions,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { today as localToday } from "../../period";
import { useNewTask } from "../../stores/newTaskStore";
import { useDiscardGuard } from "../confirming/useDiscardGuard";
import { MenuChip } from "../pickers/chips";
import { DateChip } from "../pickers/DatePicker";
import { dayDate } from "../pickers/dates";
import { OwnerChip } from "../pickers/OwnerPicker";
import { RepeatChip } from "../pickers/RepeatPicker";
import type { Priority } from "./board";
import {
  createRequest,
  type NewTaskValues,
  newTaskProblem,
  repeatAnchor,
  type TaskSpot,
} from "./newTask";

/** The priority picker: flags in their colours and the Eisenhower names at the right. */
const PRIORITY_OPTIONS: { id: Priority; label: string; note: string; leading: ReactNode }[] = [
  { id: "high", label: "High", note: "Do", leading: <PriorityFlag priority="high" /> },
  { id: "medium", label: "Medium", note: "Schedule", leading: <PriorityFlag priority="medium" /> },
  { id: "low", label: "Low", note: "Delegate", leading: <PriorityFlag priority="low" /> },
  { id: "none", label: "None", note: "Eliminate", leading: <span className="size-[15px]" /> },
];

function PriorityFlag({ priority }: { priority: Priority }) {
  const color = {
    high: "text-(--color-negative-600)",
    medium: "text-(--color-warning-600)",
    low: "text-(--color-neutral-400)",
    none: "",
  }[priority];
  return <Flag aria-hidden className={`size-[15px] shrink-0 ${color}`} strokeWidth={2} />;
}

/** The header's New task (brand 700), opening New task with the view's spot. */
export function NewTaskButton({ spot, today }: { spot?: TaskSpot; today?: string }) {
  const open = useNewTask((state) => state.open);
  return (
    <Button onPress={() => open(spot, today)}>
      <Plus aria-hidden strokeWidth={2} />
      New task
    </Button>
  );
}

/** New task, wherever it was opened from. Rendered once, by the app shell. */
export function NewTaskHost() {
  const spot = useNewTask((state) => state.spot);
  const today = useNewTask((state) => state.today);
  const close = useNewTask((state) => state.close);
  const lifeAreas = useQuery({ ...listLifeAreasOptions(), enabled: spot !== null });
  const projects = useQuery({ ...listProjectsOptions(), enabled: spot !== null });
  if (!spot || !lifeAreas.data || !projects.data) return null;
  return (
    <NewTaskModal
      spot={spot}
      today={today ?? localToday()}
      lifeAreas={lifeAreas.data.filter((area) => area.archived_at === null)}
      projects={projects.data.filter(
        (project) => project.status === "active" && project.archived_at === null,
      )}
      onClose={close}
    />
  );
}

/**
 * The New task pop-up (480 px): Title, then the chips (Owner, Section when the project has
 * sections, Priority, Scheduled, Due, Repeat; unset chips dashed), Add subtask rows, then
 * Cancel and Create task. Enter submits, Esc cancels. No notes.
 */
export function NewTaskModal({
  spot,
  today,
  lifeAreas,
  projects,
  onClose,
}: {
  spot: TaskSpot;
  today: string;
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<NewTaskValues>(() => {
    const project = projects.find((p) => p.id === spot.projectId);
    const area = lifeAreas.find((a) => a.id === (project?.life_area_id ?? spot.lifeAreaId));
    return {
      title: "",
      lifeAreaId: area?.id ?? null,
      projectId: project?.id ?? null,
      sectionId: project?.sections.some((s) => s.id === spot.sectionId)
        ? (spot.sectionId ?? null)
        : null,
      priority: spot.priority ?? "none",
      scheduledDate: spot.scheduledDate ?? null,
      dueDate: null,
      repeat: null,
      subtasks: [],
    };
  });
  const set = (changes: Partial<NewTaskValues>) => setValues((old) => ({ ...old, ...changes }));
  const initialSnapshot = useRef(JSON.stringify(values));
  const guard = useDiscardGuard(JSON.stringify(values) !== initialSnapshot.current, onClose);
  const createTask = useMutation(createTaskMutation());
  const createTemplate = useMutation(createTaskTemplateMutation());
  const isPending = createTask.isPending || createTemplate.isPending;
  const error = createTask.error ?? createTemplate.error;

  const project = projects.find((p) => p.id === values.projectId);
  const sections = [...(project?.sections ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  );
  const section = sections.find((s) => s.id === values.sectionId);
  const anchor = repeatAnchor(values, today);
  const problem = newTaskProblem(values, today);
  const canCreate = values.title.trim() !== "" && problem === null && !isPending;
  const overdue = values.dueDate !== null && values.dueDate < today;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canCreate) return;
    const request = createRequest(values, today);
    if (request.kind === "task") {
      await createTask.mutateAsync({ body: request.body });
    } else {
      await createTemplate.mutateAsync({ body: request.body });
      // Occurrences are made when days are loaded, so load the days before the tasks.
      await queryClient.refetchQueries({
        predicate: (query) => (query.queryKey[0] as { _id?: string })?._id === "getDays",
      });
      await queryClient.invalidateQueries({
        predicate: (query) => (query.queryKey[0] as { _id?: string })?._id === "listTasks",
      });
    }
    onClose();
  };

  return (
    <>
      <Modal.Backdrop {...guard.backdropProps}>
        {/* Long content scrolls in the body, so the footer stays on screen. */}
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[480px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
            <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
              <Modal.Heading className="type-panel-title text-(--text-primary)">
                New task
              </Modal.Heading>
              <IconButton label="Close" size="md" onPress={onClose}>
                <X />
              </IconButton>
            </Modal.Header>
            <form
              noValidate
              onSubmit={(event) => void submit(event).catch(() => {})}
              className="flex min-h-0 flex-col"
            >
              <Modal.Body className="m-0 flex flex-col gap-4 px-5 py-4">
                <TextField
                  fullWidth
                  autoFocus
                  name="title"
                  value={values.title}
                  onChange={(title) => set({ title })}
                  className="gap-1.5"
                >
                  <Label className="text-xs leading-4 font-semibold text-(--text-primary)">
                    Title
                  </Label>
                  <Input
                    placeholder="Task title"
                    maxLength={200}
                    className="h-8 type-body text-(--text-primary)"
                  />
                </TextField>

                <div className="-mt-1 flex flex-wrap gap-1.5">
                  <OwnerChip
                    value={{ lifeAreaId: values.lifeAreaId, projectId: values.projectId }}
                    lifeAreas={lifeAreas}
                    projects={projects}
                    onChange={(owner) => set({ ...owner, sectionId: null })}
                  />
                  {sections.length > 0 && (
                    <MenuChip
                      icon={AlignLeft}
                      tone={section ? "default" : "ghost"}
                      label="Section"
                      value={section ? String(section.id) : "none"}
                      options={[
                        { id: "none", label: "No section" },
                        ...sections.map((s) => ({ id: String(s.id), label: s.title })),
                      ]}
                      onChange={(id) => set({ sectionId: id === "none" ? null : Number(id) })}
                    >
                      {section?.title ?? "Section"}
                    </MenuChip>
                  )}
                  <MenuChip<Priority>
                    leading={<PriorityFlag priority={values.priority} />}
                    tone={
                      values.priority === "high"
                        ? "danger"
                        : values.priority === "none"
                          ? "ghost"
                          : "default"
                    }
                    label="Priority"
                    value={values.priority}
                    options={PRIORITY_OPTIONS}
                    onChange={(priority) => set({ priority })}
                  >
                    {values.priority === "none"
                      ? "Priority"
                      : PRIORITY_OPTIONS.find((p) => p.id === values.priority)?.label}
                  </MenuChip>
                  <DateChip
                    icon={Sun}
                    tone={values.scheduledDate ? "default" : "ghost"}
                    label="Scheduled"
                    value={values.scheduledDate}
                    today={today}
                    clearLabel="Unscheduled"
                    onChange={(scheduledDate) => set({ scheduledDate })}
                  >
                    {values.scheduledDate ? dayDate(values.scheduledDate) : "Scheduled"}
                  </DateChip>
                  <DateChip
                    icon={Clock3}
                    tone={overdue ? "danger" : values.dueDate ? "default" : "ghost"}
                    label="Due"
                    value={values.dueDate}
                    today={today}
                    clearLabel="No due date"
                    onChange={(dueDate) => set({ dueDate })}
                  >
                    {values.dueDate ? `Due ${dayDate(values.dueDate)}` : "Due"}
                  </DateChip>
                  <RepeatChip
                    value={values.repeat}
                    anchor={anchor}
                    onChange={(repeat) => set({ repeat })}
                  />
                </div>

                <SubtaskDrafts
                  subtasks={values.subtasks}
                  onChange={(subtasks) => set({ subtasks })}
                />

                {problem && <p className="-mt-2 type-meta text-(--text-danger)">{problem}</p>}
                {error && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{errorMessage(error)}</Alert.Description>
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
                <Button type="submit" isDisabled={!canCreate} isPending={isPending}>
                  Create task
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {guard.dialog}
    </>
  );
}

/** The subtasks typed so far, then Add subtask: Enter adds one and keeps typing. */
function SubtaskDrafts({
  subtasks,
  onChange,
}: {
  subtasks: string[];
  onChange: (subtasks: string[]) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const add = () => {
    const title = (draft ?? "").trim();
    if (title) onChange([...subtasks, title]);
  };
  return (
    <ul aria-label="Subtasks" className="-mt-1 flex flex-col gap-0.5">
      {subtasks.map((title, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: drafts have no ids and can repeat
          key={index}
          className="group flex h-[30px] items-center gap-2 rounded-(--radius-6) px-2 text-[13px] text-(--text-primary) hover:bg-(--color-neutral-100)"
        >
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-[4px] border-2 border-(--color-neutral-400)"
          />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <button
            type="button"
            aria-label={`Remove ${title}`}
            onClick={() => onChange(subtasks.filter((_, i) => i !== index))}
            className="grid size-6 place-items-center rounded-(--radius-6) text-(--text-tertiary) opacity-0 outline-none group-hover:opacity-100 hover:bg-(--color-neutral-200) hover:text-(--text-primary) focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </li>
      ))}
      <li>
        {draft === null ? (
          <button
            type="button"
            onClick={() => setDraft("")}
            className="flex h-[30px] w-full items-center gap-2 rounded-(--radius-6) px-2 text-[13px] text-(--text-tertiary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          >
            <Plus aria-hidden className="size-3.5" strokeWidth={2} />
            Add subtask
          </button>
        ) : (
          <label className="flex h-[30px] items-center gap-2 rounded-(--radius-6) bg-(--color-neutral-100) px-2">
            <Plus
              aria-hidden
              className="size-3.5 shrink-0 text-(--text-tertiary)"
              strokeWidth={2}
            />
            <input
              ref={input}
              // biome-ignore lint/a11y/noAutofocus: shown when Add subtask is clicked, to type
              autoFocus
              aria-label="Add subtask"
              placeholder="Add subtask"
              maxLength={200}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter adds the subtask here instead of creating the task.
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
      </li>
    </ul>
  );
}
