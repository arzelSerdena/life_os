import { Alert, Button, Input, Label, Modal, Switch, TextField } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock3, Folder, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  createEventMutation,
  listLifeAreasOptions,
  listProjectsOptions,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { today as localToday } from "../../period";
import { useNewEvent } from "../../stores/newEventStore";
import { useDiscardGuard } from "../confirming/useDiscardGuard";
import { areaDataAttribute } from "../life-areas/palette";
import { PickerRow, PopoverField } from "../pickers/chips";
import { DatePickerField } from "../pickers/DatePicker";
import { type Owner, OwnerPanel } from "../pickers/OwnerPicker";
import { RepeatField } from "../pickers/RepeatPicker";
import { formatTime, type TimeFormat, useTimeFormat } from "../tasks/format";
import {
  canCreate,
  createEventRequest,
  type EventSpot,
  endTimes,
  initialValues,
  moveStart,
  type NewEventValues,
  newEventProblem,
  startTimes,
} from "./newEvent";

const LABEL = "text-xs leading-4 font-semibold text-(--text-primary)";

/** New event, wherever it was opened from. Rendered once, by the app shell. */
export function NewEventHost() {
  const spot = useNewEvent((state) => state.spot);
  const today = useNewEvent((state) => state.today);
  const close = useNewEvent((state) => state.close);
  const lifeAreas = useQuery({ ...listLifeAreasOptions(), enabled: spot !== null });
  const projects = useQuery({ ...listProjectsOptions(), enabled: spot !== null });
  if (!spot || !lifeAreas.data || !projects.data) return null;
  return (
    <NewEventModal
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
 * The New event pop-up (480 px; Approved: Calendar): Name, Owner, All day beside its switch,
 * Starts → Ends (each with its time under its date), then Repeat and Location. Create stays
 * disabled until it has a name and an owner. Enter submits, Esc cancels.
 */
export function NewEventModal({
  spot,
  today,
  lifeAreas,
  projects,
  onClose,
}: {
  spot: EventSpot;
  today: string;
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const format = useTimeFormat();
  const [values, setValues] = useState<NewEventValues>(() => {
    const now = new Date();
    const project = projects.find((p) => p.id === spot.projectId);
    const areaId = project?.life_area_id ?? spot.lifeAreaId;
    return initialValues(
      {
        ...spot,
        lifeAreaId: lifeAreas.some((a) => a.id === areaId) ? areaId : null,
        projectId: project?.id ?? null,
      },
      today,
      { hours: now.getHours(), minutes: now.getMinutes() },
    );
  });
  const set = (changes: Partial<NewEventValues>) => setValues((old) => ({ ...old, ...changes }));
  const initialSnapshot = useRef(JSON.stringify(values));
  const guard = useDiscardGuard(JSON.stringify(values) !== initialSnapshot.current, onClose);
  const create = useMutation(createEventMutation());
  const problem = newEventProblem(values);
  const ready = canCreate(values) && !create.isPending;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready) return;
    await create.mutateAsync({ body: createEventRequest(values) });
    // An event shows on the Calendar, the Tasks boards' days, area and project pages and
    // Home, so everything shown is loaded again.
    await queryClient.invalidateQueries();
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
                New event
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
                  <Label className={LABEL}>Name</Label>
                  <Input
                    placeholder="Event name"
                    maxLength={200}
                    className="h-8 type-body text-(--text-primary)"
                  />
                </TextField>

                <Field label="Owner">
                  <OwnerField
                    value={{ lifeAreaId: values.lifeAreaId, projectId: values.projectId }}
                    lifeAreas={lifeAreas}
                    projects={projects}
                    onChange={(owner) => set(owner)}
                  />
                </Field>

                <Switch
                  size="sm"
                  isSelected={values.allDay}
                  onChange={(allDay) => set({ allDay })}
                  className="self-start"
                >
                  <Switch.Content className="flex-row items-center gap-2.5">
                    <Label className={LABEL}>All day</Label>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>

                <div className="flex items-end gap-2">
                  <Field label="Starts">
                    <DatePickerField
                      label="Start date"
                      value={values.startDate}
                      today={today}
                      onChange={(date) => setValues((old) => moveStart(old, { date }))}
                    />
                    {!values.allDay && (
                      <TimeField
                        label="Start time"
                        value={values.startTime}
                        format={format}
                        options={startTimes().map((time) => ({ time, duration: null }))}
                        onChange={(time) => setValues((old) => moveStart(old, { time }))}
                      />
                    )}
                  </Field>
                  <span
                    aria-hidden
                    className={`grid shrink-0 place-items-center text-(--text-tertiary) ${values.allDay ? "h-8" : "h-[70px]"}`}
                  >
                    <ArrowRight className="size-4" />
                  </span>
                  <Field label="Ends">
                    <DatePickerField
                      label="End date"
                      value={values.endDate}
                      today={today}
                      onChange={(endDate) => set({ endDate })}
                    />
                    {!values.allDay && (
                      <TimeField
                        label="End time"
                        value={values.endTime}
                        format={format}
                        options={endTimes(values)}
                        onChange={(endTime) => set({ endTime })}
                      />
                    )}
                  </Field>
                </div>

                <div className="flex gap-3">
                  <Field label="Repeat">
                    <RepeatField
                      value={values.repeat}
                      anchor={values.startDate}
                      onChange={(repeat) => set({ repeat })}
                    />
                  </Field>
                  <TextField
                    name="location"
                    value={values.location}
                    onChange={(location) => set({ location })}
                    className="min-w-0 flex-1 gap-1.5"
                  >
                    <Label className={LABEL}>Location</Label>
                    <Input
                      placeholder="Add a place"
                      maxLength={300}
                      className="h-8 type-body text-(--text-primary)"
                    />
                  </TextField>
                </div>

                {problem && <p className="-mt-2 type-meta text-(--text-danger)">{problem}</p>}
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
                <Button type="submit" isDisabled={!ready} isPending={create.isPending}>
                  Create event
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

/** A labelled column of fields. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {children}
    </div>
  );
}

/** Owner: an area tag or a project, or a prompt until one is picked. Events have no Inbox. */
function OwnerField({
  value,
  lifeAreas,
  projects,
  onChange,
}: {
  value: Owner;
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
  onChange: (owner: Owner) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const project = projects.find((p) => p.id === value.projectId);
  const area = lifeAreas.find((a) => a.id === (project?.life_area_id ?? value.lifeAreaId));
  return (
    <PopoverField
      label="Owner"
      width={280}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      isPlaceholder={!area}
      leading={
        project ? (
          <Folder
            aria-hidden
            data-area={areaDataAttribute(area?.color)}
            className="size-3.5 text-(--area-solid)"
            strokeWidth={2}
          />
        ) : undefined
      }
      value={
        project ? (
          project.title
        ) : area ? (
          <span
            data-area={areaDataAttribute(area.color)}
            className="-ml-1 inline-flex h-5 max-w-full items-center gap-1.5 rounded-(--radius-4) bg-(--area-tint-active) px-1.5 text-xs font-medium text-(--text-primary)"
          >
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--area-solid)" />
            <span className="truncate">{area.title}</span>
          </span>
        ) : (
          "Pick an area or project"
        )
      }
    >
      <OwnerPanel
        value={value}
        lifeAreas={lifeAreas}
        projects={projects}
        allowInbox={false}
        onPick={(owner) => {
          setIsOpen(false);
          onChange(owner);
        }}
      />
    </PopoverField>
  );
}

/**
 * A time field: the list drops in 15-minute steps, aligned to the field's right edge, and
 * opens at the chosen time. End times on the start's day show their duration ("3 PM · 1 h").
 */
function TimeField({
  label,
  value,
  format,
  options,
  onChange,
}: {
  label: string;
  value: string;
  format: TimeFormat;
  options: { time: string; duration: string | null }[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <PopoverField
      icon={Clock3}
      label={label}
      width={options.some((option) => option.duration) ? 200 : 160}
      placement="bottom end"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      value={formatTime(value, format)}
    >
      <TimeList
        value={value}
        format={format}
        options={options}
        onPick={(time) => {
          setIsOpen(false);
          if (time !== value) onChange(time);
        }}
      />
    </PopoverField>
  );
}

function TimeList({
  value,
  format,
  options,
  onPick,
}: {
  value: string;
  format: TimeFormat;
  options: { time: string; duration: string | null }[];
  onPick: (time: string) => void;
}) {
  const list = useRef<HTMLFieldSetElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the list opens
  useEffect(() => {
    // Open at the chosen time (or the nearest one after it), with keyboard focus on it.
    const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const index = options.findIndex((option) => option.time >= value);
    const row = rows[index === -1 ? rows.length - 1 : index];
    row?.scrollIntoView({ block: "center" });
    row?.focus({ preventScroll: true });
  }, []);
  return (
    <fieldset
      ref={list}
      aria-label="Times"
      className="m-0 flex min-w-0 border-0 p-0 max-h-[248px] flex-col overflow-y-auto"
      onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
        const at = rows.indexOf(document.activeElement as HTMLButtonElement);
        rows[
          Math.max(0, Math.min(rows.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))
        ]?.focus();
      }}
    >
      {options.map((option) => (
        <PickerRow
          key={option.time}
          note={option.duration ?? undefined}
          selected={option.time === value}
          onPress={() => onPick(option.time)}
        >
          {formatTime(option.time, format)}
        </PickerRow>
      ))}
    </fieldset>
  );
}
