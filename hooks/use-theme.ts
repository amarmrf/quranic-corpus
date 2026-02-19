"use client";

import { Dispatch, SetStateAction, useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "qc.theme";
const subscribers = new Set<() => void>();

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return null;
}

function resolveTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = getStoredTheme();
  if (stored) {
    return stored;
  }

  if (document.documentElement.classList.contains("dark")) {
    return "dark";
  }

  return "dark";
}

function notifySubscribers() {
  for (const subscriber of subscribers) {
    subscriber();
  }
}

function subscribe(listener: () => void) {
  subscribers.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && event.key === THEME_STORAGE_KEY) {
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    subscribers.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  notifySubscribers();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, resolveTheme, () => "dark");

  const setTheme = useCallback<Dispatch<SetStateAction<Theme>>>((value) => {
    const current = resolveTheme();
    const nextTheme =
      typeof value === "function"
        ? (value as (previous: Theme) => Theme)(current)
        : value;

    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
