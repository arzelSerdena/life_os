import { z } from "zod";
import type { LifeAreaCreate, LifeAreaRead } from "../../client/types.gen";
import { type AreaPaletteKey, isPaletteKey } from "./palette";

// These limits mirror the API's, so mistakes show up beside the field.
export const lifeAreaFormSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200, "Use 200 characters or fewer."),
  vision: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  notes: z.string().trim().max(50_000, "Use 50,000 characters or fewer."),
  color: z.string(),
});

export type LifeAreaFormValues = z.infer<typeof lifeAreaFormSchema>;

/**
 * @param defaultColor used for a new area, and for an area whose color isn't a known
 *   palette (colors saved before the palettes existed).
 */
export function initialFormValues(
  lifeArea: LifeAreaRead | null,
  defaultColor: AreaPaletteKey,
): LifeAreaFormValues {
  return {
    title: lifeArea?.title ?? "",
    vision: lifeArea?.vision ?? "",
    notes: lifeArea?.notes ?? "",
    color: isPaletteKey(lifeArea?.color) ? lifeArea.color : defaultColor,
  };
}

export function toApiBody(values: LifeAreaFormValues): LifeAreaCreate {
  return {
    title: values.title,
    vision: values.vision || null,
    notes: values.notes || null,
    color: values.color,
  };
}
