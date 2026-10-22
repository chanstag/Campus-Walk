import { useSyncExternalStore } from "react";

/**
 * Light / dark theme. The `dark` class on <html> drives the tokens in
 * index.css. Default follows the OS; a user choice is stored and wins.
 * Module-level store so every useTheme() call sees the same value and the
 * class is applied synchronously on change (before React re-renders), which
 * lets effects that read computed CSS variables see the new mode.
 */
export type Theme = "light" | "dark";

const KEY = "campus-walk:theme";
const listeners = new Set<() => void>();
let current: Theme = readInitial();

function readInitial(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable */
  }
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Call once before the first render so there is no flash of the wrong mode. */
export function initTheme() {
  apply(current);
}

export function setTheme(theme: Theme) {
  current = theme;
  apply(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => "light" as Theme);
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
