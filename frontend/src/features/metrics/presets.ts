import {
  Banknote,
  Bookmark,
  BookOpen,
  Clock,
  Hash,
  type LucideIcon,
  Percent,
  Route,
  Scale,
  Tally5,
} from "lucide-react";
import type { MetricFormat } from "./format";

/**
 * The New metric form's "Measure as" presets. They only fill in format and unit, and
 * aren't stored (docs/DOMAIN.md section 7).
 */
export type Preset = {
  id: string;
  label: string;
  icon: LucideIcon;
  format: MetricFormat;
  /** The unit it fills in; Number and Money let it be changed. */
  unit: string | null;
  /** Units to pick from instead of typing one. */
  units?: string[];
  /** A sample value, shown in the menu as it will display. */
  sample: number;
};

export const PRESETS: Preset[] = [
  { id: "number", label: "Number", icon: Hash, format: "number", unit: null, sample: 12.5 },
  { id: "money", label: "Money", icon: Banknote, format: "currency", unit: "PHP", sample: 1500 },
  { id: "percent", label: "Percentage", icon: Percent, format: "percent", unit: null, sample: 35 },
  { id: "time", label: "Time", icon: Clock, format: "duration", unit: null, sample: 90 },
  {
    id: "distance",
    label: "Distance",
    icon: Route,
    format: "number",
    unit: "km",
    units: ["km", "mi"],
    sample: 5,
  },
  {
    id: "weight",
    label: "Weight",
    icon: Scale,
    format: "number",
    unit: "kg",
    units: ["kg", "lb"],
    sample: 70,
  },
  { id: "pages", label: "Pages", icon: BookOpen, format: "number", unit: "pages", sample: 497 },
  {
    id: "chapters",
    label: "Chapters",
    icon: Bookmark,
    format: "number",
    unit: "chapters",
    sample: 10,
  },
  { id: "times", label: "Times", icon: Tally5, format: "number", unit: "times", sample: 12 },
];

/** Currencies offered in the Currency field; PHP is the default. */
export const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD"];
