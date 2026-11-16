import { useQuery } from "@tanstack/react-query";
import { getSettingsOptions } from "../../client/@tanstack/react-query.gen";

export type TimeFormat = "12h" | "24h";

/**
 * A time of day ("18:30:00") in the user's format: "6:30 PM" or "18:30". 12-hour times on
 * the hour drop ":00" ("6 PM").
 */
export function formatTime(value: string, format: TimeFormat): string {
  const [hours, minutes] = value.split(":").map(Number);
  const mm = String(minutes).padStart(2, "0");
  if (format === "24h") return `${String(hours).padStart(2, "0")}:${mm}`;
  const suffix = hours < 12 ? "AM" : "PM";
  const hour = ((hours + 11) % 12) + 1;
  return minutes === 0 ? `${hour} ${suffix}` : `${hour}:${mm} ${suffix}`;
}

/** The time format from Settings (12-hour until the settings have loaded). */
export function useTimeFormat(): TimeFormat {
  const settings = useQuery(getSettingsOptions());
  return settings.data?.time_format ?? "12h";
}
