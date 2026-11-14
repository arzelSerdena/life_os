import type { LifeAreaRead } from "../../client/types.gen";

/**
 * The life area palettes. A life area's `color` stores the palette key, which the
 * tokens use as `data-area="<key>"` to set every area color role. `swatch` is the
 * palette's 500 step, for the color picker.
 */
export const AREA_PALETTES = [
  { key: "blue", name: "Blue", swatch: "#3579c2" },
  { key: "teal", name: "Teal", swatch: "#11bbb3" },
  { key: "rose", name: "Rose", swatch: "#ca6a93" },
  { key: "plum", name: "Plum", swatch: "#b181b4" },
  { key: "ochre", name: "Ochre", swatch: "#cba927" },
  { key: "terracotta", name: "Terracotta", swatch: "#cc6b43" },
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
