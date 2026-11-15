import { Alert, Button, FieldError, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Folder, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { createProjectMutation } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { today } from "../../period";
import { areaDataAttribute } from "../life-areas/palette";

// These limits mirror the API's, so mistakes show up beside the field.
const schema = z
  .object({
    title: z.string().trim().min(1, "Enter a name.").max(200, "Use 200 characters or fewer."),
    lifeAreaId: z.number().nullable(),
    startDate: z.string(),
    dueDate: z.string(),
    notes: z.string().max(50000, "Use 50,000 characters or fewer."),
  })
  .refine((values) => !values.startDate || !values.dueDate || values.dueDate >= values.startDate, {
    path: ["dueDate"],
    message: "Due can't be before the start.",
  });

type Values = z.infer<typeof schema>;

type NewProjectModalProps = {
  /** Active areas to choose from, in their order. */
  lifeAreas: readonly LifeAreaRead[];
  /** The area chosen to begin with, such as the page's. */
  lifeAreaId?: number;
  onClose: () => void;
  /** Called with the new project, after the modal closes. */
  onCreated?: (project: ProjectRead) => void;
};

/** The New project pop-up: name, life area, start (today), due and notes. */
export function NewProjectModal({
  lifeAreas,
  lifeAreaId,
  onClose,
  onCreated,
}: NewProjectModalProps) {
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      lifeAreaId: lifeAreaId ?? null,
      startDate: today(),
      dueDate: "",
      notes: "",
    },
  });
  const [title, chosenAreaId] = useWatch({ control, name: ["title", "lifeAreaId"] });
  const chosenArea = lifeAreas.find((area) => area.id === chosenAreaId);
  const create = useMutation(createProjectMutation());

  // Create stays disabled until the required fields are filled, and says what's missing.
  const missing = !title.trim() ? "Enter a name" : !chosenArea ? "Choose a life area" : null;

  const onSubmit = handleSubmit((values) => {
    if (values.lifeAreaId === null) return;
    create.mutate(
      {
        body: {
          life_area_id: values.lifeAreaId,
          title: values.title,
          start_date: values.startDate || null,
          due_date: values.dueDate || null,
          notes: values.notes.trim() ? values.notes : null,
        },
      },
      {
        onSuccess: (project) => {
          onClose();
          onCreated?.(project);
        },
      },
    );
  });

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <Modal.Container>
        <Modal.Dialog className="w-[460px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
          <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <Modal.Heading className="type-panel-title text-(--text-primary)">
              New project
            </Modal.Heading>
            <IconButton label="Close" size="md" onPress={onClose}>
              <X />
            </IconButton>
          </Modal.Header>
          <form noValidate onSubmit={onSubmit}>
            <Modal.Body className="m-0 flex flex-col gap-4 px-5 py-4">
              <Controller
                control={control}
                name="title"
                render={({ field, fieldState }) => (
                  <TextField
                    fullWidth
                    autoFocus
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    isInvalid={fieldState.invalid}
                    className="gap-1.5"
                  >
                    <Label className={FIELD_LABEL}>Name</Label>
                    <Input className="h-8 type-body text-(--text-primary)" />
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </TextField>
                )}
              />

              <Controller
                control={control}
                name="lifeAreaId"
                render={({ field }) => (
                  <fieldset className="flex flex-col">
                    <legend className={`${FIELD_LABEL} mb-1.5`}>Life area</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {lifeAreas.map((area) => {
                        const isSelected = field.value === area.id;
                        return (
                          <label
                            key={area.id}
                            data-area={areaDataAttribute(area.color)}
                            className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--focus-ring) ${
                              isSelected
                                ? "border-(--area-solid) bg-(--area-tint-active) text-(--area-ink)"
                                : "border-(--border-default) text-(--text-primary) hover:bg-(--bg-hover)"
                            }`}
                          >
                            <input
                              type="radio"
                              name={field.name}
                              value={area.id}
                              checked={isSelected}
                              onChange={() => field.onChange(area.id)}
                              className="sr-only"
                            />
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-[2px] bg-(--area-solid)"
                            />
                            {area.title}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <DateField control={control} name="startDate" label="Start" />
                <DateField control={control} name="dueDate" label="Due" />
              </div>

              <Controller
                control={control}
                name="notes"
                render={({ field, fieldState }) => (
                  <TextField
                    fullWidth
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    isInvalid={fieldState.invalid}
                    className="gap-1.5"
                  >
                    <Label className={FIELD_LABEL}>Notes</Label>
                    <TextArea
                      rows={3}
                      className="min-h-20 resize-none type-body text-(--text-primary)"
                    />
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </TextField>
                )}
              />

              <div className="flex items-center gap-3 border-t border-(--border-default) pt-3">
                <span className="type-meta text-(--text-tertiary)">Preview</span>
                <div
                  data-area={areaDataAttribute(chosenArea?.color)}
                  className="flex h-(--sidebar-item-height) min-w-0 flex-1 items-center gap-2 rounded-(--radius-6) bg-(--bg-hover) px-2 type-sidebar-item text-(--text-primary)"
                >
                  <Folder
                    aria-hidden
                    className="size-4 shrink-0 text-(--area-solid)"
                    strokeWidth={2}
                  />
                  <span className="truncate">{title.trim() || "New project"}</span>
                </div>
              </div>

              {create.isError && (
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
              {/* A disabled button gets no hover, so the wrapper carries the hint. */}
              <span title={missing ?? undefined}>
                <Button type="submit" isDisabled={missing !== null} isPending={create.isPending}>
                  Create project
                </Button>
              </span>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const FIELD_LABEL = "text-xs leading-4 font-semibold text-(--text-primary)";

function DateField({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useForm<Values>>["control"];
  name: "startDate" | "dueDate";
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>{label}</span>
          <div
            className={`flex h-8 items-center gap-1.5 rounded-(--radius-6) border px-2 focus-within:ring-2 focus-within:ring-(--focus-ring) ${
              fieldState.invalid ? "border-(--text-danger)" : "border-(--border-default)"
            }`}
          >
            <CalendarDays
              aria-hidden
              className="size-3.5 shrink-0 text-(--text-tertiary)"
              strokeWidth={2}
            />
            <input
              type="date"
              aria-label={label}
              aria-invalid={fieldState.invalid || undefined}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-(--text-primary) outline-none"
            />
          </div>
          {fieldState.error && (
            <span className="type-meta text-(--text-danger)">{fieldState.error.message}</span>
          )}
        </div>
      )}
    />
  );
}
