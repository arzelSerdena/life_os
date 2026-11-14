import {
  Alert,
  Button,
  ColorSwatchPicker,
  FieldError,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { type Control, Controller, useForm } from "react-hook-form";
import {
  createLifeAreaMutation,
  updateLifeAreaMutation,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { errorMessage } from "../../errors";
import { initialFormValues, type LifeAreaFormValues, lifeAreaFormSchema, toApiBody } from "./form";
import { AREA_PALETTES, type AreaPaletteKey } from "./palette";

type LifeAreaFormModalProps = {
  /** The life area to edit, or null to create a new one. */
  lifeArea: LifeAreaRead | null;
  /** The color a new area starts with. */
  defaultColor: AreaPaletteKey;
  onClose: () => void;
  /** Called with the saved area, after the modal closes. */
  onSaved?: (lifeArea: LifeAreaRead) => void;
};

export function LifeAreaFormModal({
  lifeArea,
  defaultColor,
  onClose,
  onSaved,
}: LifeAreaFormModalProps) {
  const { control, handleSubmit } = useForm<LifeAreaFormValues>({
    resolver: zodResolver(lifeAreaFormSchema),
    defaultValues: initialFormValues(lifeArea, defaultColor),
  });
  const create = useMutation(createLifeAreaMutation());
  const update = useMutation(updateLifeAreaMutation());
  const activeMutation = lifeArea ? update : create;

  const onSubmit = handleSubmit((values) => {
    const body = toApiBody(values);
    const onSuccess = (saved: LifeAreaRead) => {
      onClose();
      onSaved?.(saved);
    };
    if (lifeArea) {
      update.mutate({ path: { life_area_id: lifeArea.id }, body }, { onSuccess });
    } else {
      create.mutate({ body }, { onSuccess });
    }
  });

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{lifeArea ? "Edit area" : "New area"}</Modal.Heading>
          </Modal.Header>
          <form noValidate onSubmit={onSubmit}>
            <Modal.Body className="mt-2 flex flex-col gap-4 p-1">
              <FormTextField autoFocus control={control} name="title" label="Title" />
              <FormTextField control={control} name="vision" label="Vision" multiline />
              <FormTextField control={control} name="notes" label="Notes" multiline />
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">Color</span>
                    <ColorSwatchPicker
                      aria-label="Color"
                      value={swatchFor(field.value)}
                      onChange={(color) => field.onChange(paletteFor(color.toString("hex")))}
                    >
                      {AREA_PALETTES.map((palette) => (
                        <ColorSwatchPicker.Item
                          key={palette.key}
                          color={palette.swatch}
                          aria-label={palette.name}
                        >
                          <ColorSwatchPicker.Swatch />
                          <ColorSwatchPicker.Indicator />
                        </ColorSwatchPicker.Item>
                      ))}
                    </ColorSwatchPicker>
                  </div>
                )}
              />
              {activeMutation.isError && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{errorMessage(activeMutation.error)}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button type="submit" isPending={activeMutation.isPending}>
                {lifeArea ? "Save changes" : "Create area"}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

type FormTextFieldProps = {
  control: Control<LifeAreaFormValues>;
  name: "title" | "vision" | "notes";
  label: string;
  multiline?: boolean;
  autoFocus?: boolean;
};

function FormTextField({ control, name, label, multiline, autoFocus }: FormTextFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          fullWidth
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isInvalid={fieldState.invalid}
        >
          <Label>{label}</Label>
          {multiline ? (
            <TextArea rows={3} variant="secondary" />
          ) : (
            <Input autoFocus={autoFocus} variant="secondary" />
          )}
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  );
}

function swatchFor(key: string): string {
  return AREA_PALETTES.find((palette) => palette.key === key)?.swatch ?? AREA_PALETTES[0].swatch;
}

function paletteFor(hex: string): AreaPaletteKey {
  const swatch = hex.toLowerCase();
  return (AREA_PALETTES.find((palette) => palette.swatch === swatch) ?? AREA_PALETTES[0]).key;
}
