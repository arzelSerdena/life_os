import { Alert, Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Repeat, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { createRoutineStepMutation } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead, RoutineRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { chipClass } from "../pickers/chips";
import { DateChip } from "../pickers/DatePicker";
import { dayDate } from "../pickers/dates";
import { type Owner, OwnerChip } from "../pickers/OwnerPicker";

/**
 * The New step pop-up (440 px, Approved: routine page, "Add step"): Title, then the routine,
 * the owner (an area or a project; steps are never in the Inbox) and the day it starts.
 */
export function NewStepModal({
  routine,
  today,
  owner: initialOwner,
  lifeAreas,
  projects,
  onClose,
}: {
  routine: RoutineRead;
  today: string;
  /** The owner it starts with, such as the last step's. */
  owner: Owner;
  /** Active areas and projects, for the owner picker. */
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>(initialOwner);
  const [startsOn, setStartsOn] = useState(today);
  const create = useMutation(createRoutineStepMutation());
  const hasOwner = owner.projectId !== null || owner.lifeAreaId !== null;
  const canCreate = title.trim() !== "" && hasOwner && !create.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    create.mutate(
      {
        path: { routine_id: routine.id },
        body: {
          title: title.trim(),
          ...(owner.projectId !== null
            ? { project_id: owner.projectId }
            : { life_area_id: owner.lifeAreaId }),
          starts_on: startsOn,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className="w-[440px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
          <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <Modal.Heading className="type-panel-title text-(--text-primary)">
              New step
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
                  Title
                </Label>
                <Input
                  placeholder="Step title"
                  maxLength={200}
                  className="h-8 type-body text-(--text-primary)"
                />
              </TextField>

              <div className="-mt-1 flex flex-wrap gap-1.5">
                <span className={chipClass("default", false)}>
                  <Repeat aria-hidden strokeWidth={2} />
                  {routine.title}
                </span>
                <OwnerChip
                  value={owner}
                  lifeAreas={lifeAreas}
                  projects={projects}
                  allowInbox={false}
                  onChange={setOwner}
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
              <Button type="submit" isDisabled={!canCreate} isPending={create.isPending}>
                Add step
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
