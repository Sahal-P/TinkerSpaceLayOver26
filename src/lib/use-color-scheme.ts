"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

import { THEME_STORAGE_KEY } from "@/lib/theme";

const schemeSchema = z.enum(["light", "dark"]);
type ColorScheme = z.infer<typeof schemeSchema>;
const DARK = "(prefers-color-scheme: dark)";
const CHANGE = "color-scheme-change";

function readScheme(): ColorScheme {
  const explicit = schemeSchema.safeParse(document.documentElement.dataset.theme);
  if (explicit.success) return explicit.data;
  return typeof window.matchMedia === "function" && window.matchMedia(DARK).matches ? "dark" : "light";
}

function subscribeScheme(onChange: () => void) {
  const query = typeof window.matchMedia === "function" ? window.matchMedia(DARK) : undefined;
  function syncStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    const saved = schemeSchema.safeParse(event.newValue);
    if (saved.success) document.documentElement.dataset.theme = saved.data;
    else delete document.documentElement.dataset.theme;
    onChange();
  }
  query?.addEventListener("change", onChange);
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", syncStorage);
  return () => {
    query?.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", syncStorage);
  };
}

export function setColorScheme(scheme: ColorScheme) {
  document.documentElement.dataset.theme = scheme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, scheme);
  } catch {
    // The control still works for this page when storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeScheme, readScheme, () => "light");
}
