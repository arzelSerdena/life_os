import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSettingsOptions } from "./client/@tanstack/react-query.gen";
import type { SettingsRead } from "./client/types.gen";

export type Theme = SettingsRead["theme"];

const STORAGE_KEY = "life-os-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Resolve "system" to "light" or "dark" using prefers-color-scheme. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "dark" || theme === "light") return theme;
  return typeof window !== "undefined" && window.matchMedia?.(DARK_QUERY).matches
    ? "dark"
    : "light";
}

/** Read the last-known theme from localStorage for flash-free initial paint. */
export function readCachedTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Ignore storage errors in restricted environments.
  }
  return "system";
}

/** Apply the resolved theme to <html> and persist the preference in localStorage. */
export function applyTheme(theme: Theme, persist = true): "light" | "dark" {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  if (resolved === "dark") {
    root.dataset.theme = "dark";
  } else {
    delete root.dataset.theme;
  }
  root.style.colorScheme = resolved;
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }
  return resolved;
}

/** Keep <html data-theme> in sync with Settings and OS color-scheme changes. */
export function useThemeSync(): void {
  const settings = useQuery(getSettingsOptions());
  const theme: Theme = settings.data?.theme ?? readCachedTheme();

  useEffect(() => {
    applyTheme(theme, settings.data !== undefined);
    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system", false);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, settings.data]);
}
