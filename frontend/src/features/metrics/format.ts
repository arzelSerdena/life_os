/**
 * How a metric's raw numbers are shown. The API returns plain numbers with the metric's
 * format and unit: a duration is in minutes, a percent from 0 to 100, and a currency's
 * unit is its ISO 4217 code. See docs/DOMAIN.md section 7.
 */

export type MetricFormat = "number" | "currency" | "percent" | "duration";

/** Anything carrying a metric's format and unit (metrics, outcomes, deadlines, wins). */
export type Formatted = { format: MetricFormat | null; unit: string | null };

/** Tiles switch to compact notation (₱100K) from this size on. */
const COMPACT_FROM = 100_000;

const plain = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const compactPlain = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const currencies = new Map<string, Intl.NumberFormat | null>();

function currencyFormatter(code: string, compact: boolean): Intl.NumberFormat | null {
  const key = `${code}:${compact}`;
  if (!currencies.has(key)) {
    try {
      currencies.set(
        key,
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: code,
          currencyDisplay: "narrowSymbol",
          minimumFractionDigits: 0,
          maximumFractionDigits: compact ? 1 : 2,
          notation: compact ? "compact" : "standard",
        }),
      );
    } catch {
      currencies.set(key, null);
    }
  }
  return currencies.get(key) ?? null;
}

/** "₱" for PHP, "$" for USD; the code itself when the browser doesn't know it. */
export function currencySymbol(code: string): string {
  const formatter = currencyFormatter(code, false);
  return formatter?.formatToParts(0).find((part) => part.type === "currency")?.value ?? code;
}

/** "1 h 30 m", "10 h", "45 m" for a number of minutes. */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const total = Math.round(Math.abs(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${sign}${rest} m`;
  return rest ? `${sign}${plain.format(hours)} h ${rest} m` : `${sign}${plain.format(hours)} h`;
}

/**
 * The value as a number and a unit shown after it, for tiles that style them apart:
 * { number: "17", unit: "km" }, { number: "₱10,500", unit: "" }.
 */
export function valueParts(
  value: number,
  metric: Formatted,
  options: { compact?: boolean } = {},
): { number: string; unit: string } {
  const compact = Boolean(options.compact) && Math.abs(value) >= COMPACT_FROM;
  switch (metric.format) {
    case "currency": {
      const formatter = metric.unit ? currencyFormatter(metric.unit, compact) : null;
      if (formatter) return { number: formatter.format(value), unit: "" };
      return { number: (compact ? compactPlain : plain).format(value), unit: metric.unit ?? "" };
    }
    case "percent":
      return { number: `${plain.format(value)}%`, unit: "" };
    case "duration":
      return { number: formatDuration(value), unit: "" };
    default:
      return { number: (compact ? compactPlain : plain).format(value), unit: metric.unit ?? "" };
  }
}

/** "₱1,500", "35%", "1 h 30 m", "17 km", "3"; compact ("₱100K") from 100,000 on. */
export function formatValue(
  value: number,
  metric: Formatted,
  options: { compact?: boolean } = {},
): string {
  const { number, unit } = valueParts(value, metric, options);
  return unit ? `${number} ${unit}` : number;
}

/** What a value input shows before and after the number: "₱" … , … "km", … "%". */
export function inputAffixes(metric: Formatted): { prefix: string; suffix: string } {
  switch (metric.format) {
    case "currency":
      return { prefix: metric.unit ? currencySymbol(metric.unit) : "", suffix: "" };
    case "percent":
      return { prefix: "", suffix: "%" };
    case "duration":
      return { prefix: "", suffix: "h" };
    default:
      return { prefix: "", suffix: metric.unit ?? "" };
  }
}

/**
 * Reads a typed value into the stored unit, or null when it isn't a number. Separators
 * and symbols are ignored. A duration is typed in hours ("1.5"), as "1:30", or as
 * "1 h 30 m" / "90 m", and stored in minutes.
 */
export function parseValue(text: string, format: MetricFormat): number | null {
  const typed = text.trim().toLowerCase();
  if (!typed) return null;
  if (format === "duration") {
    const clock = /^(\d+):([0-5]?\d)$/.exec(typed);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
    const parts = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?$/.exec(typed);
    if (parts && (parts[1] || parts[2])) {
      return Math.round(Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0));
    }
  }
  const number = Number(typed.replace(/[,\s%]/g, "").replace(/^[^\d.-]+/, ""));
  if (!Number.isFinite(number) || typed.replace(/[^\d]/g, "") === "") return null;
  return format === "duration" ? Math.round(number * 60) : number;
}

/** Formats a stored value back into text for a value input ("1:30" for 90 minutes). */
export function formatForInput(value: number, format: MetricFormat): string {
  if (format === "duration") {
    const total = Math.round(Math.abs(value));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${value < 0 ? "-" : ""}${hours}:${String(minutes).padStart(2, "0")}`;
  }
  return String(value);
}
