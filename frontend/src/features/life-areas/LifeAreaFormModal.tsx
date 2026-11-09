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
import {
  COLORS,
  initialFormValues,
  type LifeAreaFormValues,
  lifeAreaFormSchema,
  toApiBody,
} from "./form";

type LifeAreaFormModalProps = {
  /** The life area to edit, or null to create a new one. */
  lifeArea: LifeAreaRead | null;
  onClose: () => void;
};

export function LifeAreaFormModal({ lifeArea, onClose }: LifeAreaFormModalProps) {
  const { control, handleSubmit } = useForm<LifeAreaFormValues>({
    resolver: zodResolver(lifeAreaFormSchema),
    defaultValues: initialFormValues(lifeArea),
  });
  const create = useMutation(createLifeAreaMutation());
  const update = useMutation(updateLifeAreaMutation());
  const activeMutation = lifeArea ? update : create;

  const onSubmit = handleSubmit((values) => {
    const body = toApiBody(values);
    if (lifeArea) {
      update.mutate({ path: { life_area_id: lifeArea.id }, body }, { onSuccess: onClose });
    } else {
      create.mutate({ body }, { onSuccess: onClose });
    }
  });

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{lifeArea ? "Edit life area" : "New life area"}</Modal.Heading>
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
                      value={field.value}
                      onChange={(color) => field.onChange(color.toString("hex"))}
                    >
                      {COLORS.map((color) => (
                        <ColorSwatchPicker.Item key={color} color={color}>
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
                {lifeArea ? "Save changes" : "Create life area"}
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
