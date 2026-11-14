import { Alert, Button, FieldError, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { createLifeAreaMutation } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import {
  initialFormValues,
  type LifeAreaFormValues,
  type LifeAreaPrefill,
  lifeAreaFormSchema,
  toApiBody,
} from "./form";
import { AREA_PALETTES, type AreaPaletteKey, areaDataAttribute } from "./palette";

type LifeAreaFormModalProps = {
  /** Active areas, to show which area already uses each color. */
  lifeAreas: readonly LifeAreaRead[];
  /** The color a new area starts with. */
  defaultColor: AreaPaletteKey;
  /** Values a new area starts with, such as a quick-start suggestion's. */
  prefill?: LifeAreaPrefill;
  onClose: () => void;
  /** Called with the saved area, after the modal closes. */
  onSaved?: (lifeArea: LifeAreaRead) => void;
};

/** The New area pop-up. Existing areas are edited in the detail panel. */
export function LifeAreaFormModal({
  lifeAreas,
  defaultColor,
  prefill,
  onClose,
  onSaved,
}: LifeAreaFormModalProps) {
  const { control, handleSubmit } = useForm<LifeAreaFormValues>({
    resolver: zodResolver(lifeAreaFormSchema),
    defaultValues: initialFormValues(defaultColor, prefill),
  });
  const [title, color] = useWatch({ control, name: ["title", "color"] });
  const create = useMutation(createLifeAreaMutation());

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      { body: toApiBody(values) },
      {
        onSuccess: (saved) => {
          onClose();
          onSaved?.(saved);
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
              New life area
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
                name="color"
                render={({ field }) => (
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className={`${FIELD_LABEL} mb-1.5`}>Color</legend>
                    <div className="grid grid-cols-6 gap-1.5">
                      {AREA_PALETTES.map((palette) => {
                        const usedBy = lifeAreas
                          .filter((area) => area.color === palette.key)
                          .map((area) => area.title)
                          .join(", ");
                        const isSelected = field.value === palette.key;
                        return (
                          <label
                            key={palette.key}
                            title={usedBy ? `${palette.name} · used by ${usedBy}` : palette.name}
                            className={`flex cursor-pointer flex-col items-center gap-1 rounded-(--radius-8) py-1.5 text-[11px] leading-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--focus-ring) hover:bg-(--bg-hover) ${
                              isSelected
                                ? "bg-(--bg-hover) font-semibold text-(--text-primary)"
                                : "text-(--text-secondary)"
                            }`}
                          >
                            <input
                              type="radio"
                              name={field.name}
                              value={palette.key}
                              checked={isSelected}
                              aria-label={
                                usedBy ? `${palette.name}, used by ${usedBy}` : palette.name
                              }
                              onChange={() => field.onChange(palette.key)}
                              className="sr-only"
                            />
                            <span
                              aria-hidden
                              style={{ backgroundColor: palette.swatch }}
                              className="grid size-6 place-items-center rounded-(--radius-6) text-white"
                            >
                              {isSelected && <Check className="size-3.5" strokeWidth={3} />}
                            </span>
                            <span aria-hidden>{palette.name}</span>
                            {usedBy && (
                              <span
                                aria-hidden
                                className="-mt-0.5 max-w-full truncate px-1 text-[10px] leading-3 font-normal text-(--text-tertiary)"
                              >
                                {usedBy}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              />

              <Controller
                control={control}
                name="vision"
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
                    <Label className={FIELD_LABEL}>
                      Vision
                      <span className="ml-1 font-normal text-(--text-tertiary)">optional</span>
                    </Label>
                    <TextArea
                      rows={2}
                      placeholder="What does doing well in this area look like?"
                      className="min-h-16 resize-none type-body text-(--text-primary)"
                    />
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </TextField>
                )}
              />

              <div className="flex items-center gap-3 border-t border-(--border-default) pt-3">
                <span className="type-meta text-(--text-tertiary)">Preview</span>
                <div
                  data-area={areaDataAttribute(color)}
                  className="flex h-(--sidebar-item-height) min-w-0 flex-1 items-center gap-2 rounded-(--radius-6) bg-(--bg-hover) px-2 type-sidebar-item text-(--text-primary)"
                >
                  <span
                    aria-hidden
                    className="mx-1 size-2 shrink-0 rounded-[2px] bg-(--area-solid)"
                  />
                  <span className="truncate">{title.trim() || "New area"}</span>
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
              <Button type="submit" isPending={create.isPending}>
                Create area
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const FIELD_LABEL = "text-xs leading-4 font-semibold text-(--text-primary)";
