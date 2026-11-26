import type { LifeAreaRead } from "../../client/types.gen";

/**
 * The life area palettes. A life area's `color` stores the palette key, which the
 * tokens use as `data-area="<key>"` to set every area color role. `swatch` is the
 * palette's 500 step, for the color picker.
 */
export const AREA_PALETTES = [
  { key: "blue", name: "Blue", swatch: "var(--color-area-blue-500)" },
  { key: "teal", name: "Teal", swatch: "var(--color-area-teal-500)" },
  { key: "rose", name: "Rose", swatch: "var(--color-area-rose-500)" },
  { key: "plum", name: "Plum", swatch: "var(--color-area-plum-500)" },
  { key: "ochre", name: "Ochre", swatch: "var(--color-area-ochre-500)" },
  { key: "terracotta", name: "Terracotta", swatch: "var(--color-area-terracotta-500)" },
  { key: "indigo", name: "Indigo", swatch: "var(--color-area-indigo-500)" },
  { key: "sage", name: "Sage", swatch: "var(--color-area-sage-500)" },
  { key: "amber", name: "Amber", swatch: "var(--color-area-amber-500)" },
  { key: "slate", name: "Slate", swatch: "var(--color-area-slate-500)" },
] as const;

export type AreaPaletteKey = (typeof AREA_PALETTES)[number]["key"];

export function isPaletteKey(color: string | null | undefined): color is AreaPaletteKey {
  return AREA_PALETTES.some((palette) => palette.key === color);
}

/** The value for `data-area`: the area's palette, or neutral when it has none we know. */
export function areaDataAttribute(color: string | null | undefined): AreaPaletteKey | "none" {
  return isPaletteKey(color) ? color : "none";
}

/** The first palette no active area uses yet, so a new area stands out from the others. */
export function nextFreePalette(lifeAreas: readonly LifeAreaRead[]): AreaPaletteKey {
  const used = new Set(lifeAreas.map((area) => area.color));
  return (AREA_PALETTES.find((palette) => !used.has(palette.key)) ?? AREA_PALETTES[0]).key;
}
