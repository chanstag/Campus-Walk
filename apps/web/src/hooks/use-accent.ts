import { useSyncExternalStore } from "react";

/**
 * Accent experiment switch. Sets data-accent on <html>; each non-default id
 * has a [data-accent] override block in index.css. Persisted so the choice
 * made on /design also applies to the app. Same store pattern as use-theme.
 */
export const ACCENTS = [
  { id: "default", label: "Dark coffee" },
  { id: "raw-umber", label: "Raw umber" },
  { id: "dark-walnut", label: "Dark walnut" },
  { id: "cool-steel", label: "Cool steel (2nd color)" },
  { id: "sage", label: "Sage (2nd color)" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

const KEY = "campus-walk:accent";
const listeners = new Set<() => void>();
let current: AccentId = readInitial();

function readInitial(): AccentId {
  try {
    const v = localStorage.getItem(KEY);
    if (ACCENTS.some((a) => a.id === v)) return v as AccentId;
  } catch {
    /* storage unavailable */
  }
  return "default";
}

function apply(accent: AccentId) {
  if (accent === "default") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
}

/** Call once before the first render. */
export function initAccent() {
  apply(current);
}

export function setAccent(accent: AccentId) {
  current = accent;
  apply(accent);
  try {
    localStorage.setItem(KEY, accent);
  } catch {
    /* storage unavailable */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAccent() {
  const accent = useSyncExternalStore(subscribe, () => current, () => "default" as AccentId);
  return [accent, setAccent] as const;
}
