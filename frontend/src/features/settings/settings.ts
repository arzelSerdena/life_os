import type { BackupsRead, SettingsRead } from "../../client/types.gen";
import { addDays } from "../../period";
import { shortDate } from "../life-areas/overview/format";
import { formatTime, type TimeFormat } from "../tasks/format";

export const SECTIONS = [
  { id: "general", label: "General" },
  { id: "data", label: "Data" },
  { id: "about", label: "About" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

export const OPEN_ON_START: { key: SettingsRead["open_on_start"]; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "tasks", label: "Tasks" },
  { key: "calendar", label: "Calendar" },
];

export const TIME_FORMATS: { key: TimeFormat; label: string }[] = [
  { key: "12h", label: "12-hour" },
  { key: "24h", label: "24-hour" },
];

export const THEMES: { key: SettingsRead["theme"]; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

export const DAY_ENDS_AT = [0, 1, 2, 3, 4] as const;
export const KEEP_BACKUPS = [7, 14, 30] as const;

/** Where Open on start goes. */
export const START_PATHS: Record<SettingsRead["open_on_start"], string> = {
  home: "/home",
  tasks: "/tasks",
  calendar: "/calendar",
};

/** An hour of the day in the user's format: "3 AM" or "03:00". */
export function hourLabel(hour: number, format: TimeFormat): string {
  return formatTime(`${hour}:00`, format);
}

/** A local date-time ("2026-11-16T14:05:00") as "Today, 2:05 PM", "Yesterday, 3 AM" or
 * "Nov 14, 3 AM". */
export function whenLabel(localDateTime: string, today: string, format: TimeFormat): string {
  const [date, time] = localDateTime.split("T");
  const day =
    date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : shortDate(date);
  return `${day}, ${formatTime(time, format)}`;
}

/** A file size: "2.4 MB", "820 KB". */
export function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The Last backup row's data line, and whether it reports a problem. A failure since the
 * newest backup wins. */
export function lastBackupLine(
  status: BackupsRead,
  today: string,
  format: TimeFormat,
): { text: string; failed: boolean } {
  const failure = status.last_failure;
  if (failure) {
    const when = whenLabel(failure.at, today, format);
    // "Failed today, 2:12 PM": the day reads as part of the sentence.
    const day =
      when.startsWith("Today") || when.startsWith("Yesterday")
        ? when[0].toLowerCase() + when.slice(1)
        : when;
    return { text: `Failed ${day} · ${failure.message}`, failed: true };
  }
  const [latest] = status.backups;
  if (!latest) return { text: "No backups yet", failed: false };
  return {
    text: `${whenLabel(latest.created_at, today, format)} · ${sizeLabel(latest.size)}`,
    failed: false,
  };
}

export type LayoutState = { sidebarWidth: number; sidebarHidden: boolean; panelWidth: number };

/** What differs from the default layout, as the Reset layout data line ("Sidebar 280 px ·
 * Panel 480 px"); empty when nothing does. */
export function layoutChanges(layout: LayoutState, defaults: LayoutState): string {
  const parts: string[] = [];
  if (layout.sidebarHidden) parts.push("Sidebar hidden");
  else if (layout.sidebarWidth !== defaults.sidebarWidth)
    parts.push(`Sidebar ${layout.sidebarWidth} px`);
  if (layout.panelWidth !== defaults.panelWidth) parts.push(`Panel ${layout.panelWidth} px`);
  return parts.join(" · ");
}

/** The file name from a Content-Disposition header, or a fallback. */
export function attachmentName(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/);
  return match ? match[1] : fallback;
}
