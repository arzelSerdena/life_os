import { z } from "zod";
import type { LifeAreaCreate, LifeAreaRead } from "../../client/types.gen";
import { type AreaPaletteKey, isPaletteKey } from "./palette";

// These limits mirror the API's, so mistakes show up beside the field.
export const lifeAreaFormSchema = z.object({
  title: z.string().trim().min(1, "Enter a name.").max(200, "Use 200 characters or fewer."),
  vision: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  notes: z.string().trim().max(50_000, "Use 50,000 characters or fewer."),
  color: z.string(),
});

export type LifeAreaFormValues = z.infer<typeof lifeAreaFormSchema>;

/** Values a new area starts with, such as a quick-start suggestion's name and color. */
export type LifeAreaPrefill = { title?: string; color?: AreaPaletteKey };

/**
 * @param defaultColor used for a new area, and for an area whose color isn't a known
 *   palette (colors saved before the palettes existed).
 */
export function initialFormValues(
  lifeArea: LifeAreaRead | null,
  defaultColor: AreaPaletteKey,
  prefill: LifeAreaPrefill = {},
): LifeAreaFormValues {
  return {
    title: lifeArea?.title ?? prefill.title ?? "",
    vision: lifeArea?.vision ?? "",
    notes: lifeArea?.notes ?? "",
    color: isPaletteKey(lifeArea?.color) ? lifeArea.color : (prefill.color ?? defaultColor),
  };
}

/** Notes are only edited on an existing area (the New area pop-up has no notes field). */
export function toApiBody(values: LifeAreaFormValues, isEdit: boolean): LifeAreaCreate {
  return {
    title: values.title,
    vision: values.vision || null,
    color: values.color,
    ...(isEdit ? { notes: values.notes || null } : {}),
  };
}
