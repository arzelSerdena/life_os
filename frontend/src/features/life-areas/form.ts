import { z } from "zod";
import type { LifeAreaCreate, LifeAreaRead } from "../../client/types.gen";

export const COLORS = [
  "#F43F5E",
  "#F97316",
  "#EAB308",
  "#10B981",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#D946EF",
];

// These limits mirror the API's, so mistakes show up beside the field.
export const lifeAreaFormSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200, "Use 200 characters or fewer."),
  vision: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  notes: z.string().trim().max(50_000, "Use 50,000 characters or fewer."),
  color: z.string(),
});

export type LifeAreaFormValues = z.infer<typeof lifeAreaFormSchema>;

export function initialFormValues(lifeArea: LifeAreaRead | null): LifeAreaFormValues {
  return {
    title: lifeArea?.title ?? "",
    vision: lifeArea?.vision ?? "",
    notes: lifeArea?.notes ?? "",
    color: knownColor(lifeArea?.color),
  };
}

/** The swatch picker can only show colors from its palette. */
function knownColor(color: string | null | undefined): string {
  const upperCaseColor = color?.toUpperCase();
  return COLORS.find((known) => known === upperCaseColor) ?? COLORS[0];
}

export function toApiBody(values: LifeAreaFormValues): LifeAreaCreate {
  return {
    title: values.title,
    vision: values.vision || null,
    notes: values.notes || null,
    color: values.color,
  };
}
