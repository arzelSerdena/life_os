import { z } from "zod";
import type { LifeAreaCreate } from "../../client/types.gen";
import type { AreaPaletteKey } from "./palette";

// These limits mirror the API's, so mistakes show up beside the field.
export const lifeAreaFormSchema = z.object({
  title: z.string().trim().min(1, "Enter a name.").max(200, "Use 200 characters or fewer."),
  vision: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  color: z.string(),
});

export type LifeAreaFormValues = z.infer<typeof lifeAreaFormSchema>;

/** Values a new area starts with, such as a quick-start suggestion's name and color. */
export type LifeAreaPrefill = { title?: string; color?: AreaPaletteKey };

/** A new area's starting values: a quick-start suggestion's, or an empty name. */
export function initialFormValues(
  defaultColor: AreaPaletteKey,
  prefill: LifeAreaPrefill = {},
): LifeAreaFormValues {
  return { title: prefill.title ?? "", vision: "", color: prefill.color ?? defaultColor };
}

export function toApiBody(values: LifeAreaFormValues): LifeAreaCreate {
  return { title: values.title, vision: values.vision || null, color: values.color };
}
