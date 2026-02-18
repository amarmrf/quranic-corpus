"use client";

import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

const subscribersByKey = new Map<string, Set<() => void>>();

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function deserialize<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getStoredString(key: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem(key) ?? fallback;
}

function emitChange(key: string) {
  const subscribers = subscribersByKey.get(key);
  if (!subscribers) {
    return;
  }

  for (const subscriber of subscribers) {
    subscriber();
  }
}

function subscribeToKey(key: string, listener: () => void) {
  let subscribers = subscribersByKey.get(key);
  if (!subscribers) {
    subscribers = new Set();
    subscribersByKey.set(key, subscribers);
  }
  subscribers.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && event.key === key) {
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    const current = subscribersByKey.get(key);
    current?.delete(listener);

    if (current && current.size === 0) {
      subscribersByKey.delete(key);
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [initialSnapshot] = useState(() => ({
    value: initialValue,
    serialized: serialize(initialValue),
  }));
  const initialSerialized = initialSnapshot.serialized;

  const subscribe = useCallback((listener: () => void) => subscribeToKey(key, listener), [key]);

  const getSnapshot = useCallback(
    () => getStoredString(key, initialSerialized),
    [initialSerialized, key],
  );

  const serializedValue = useSyncExternalStore(subscribe, getSnapshot, () => initialSerialized);

  const storedValue = useMemo(
    () => deserialize(serializedValue, initialSnapshot.value),
    [initialSnapshot.value, serializedValue],
  );

  const setStoredValue = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      if (typeof window === "undefined") {
        return;
      }

      const currentSerialized = getStoredString(key, initialSerialized);
      const currentValue = deserialize(currentSerialized, initialSnapshot.value);

      const nextValue =
        typeof value === "function"
          ? (value as (previous: T) => T)(currentValue)
          : value;

      window.localStorage.setItem(key, serialize(nextValue));
      emitChange(key);
    },
    [initialSerialized, initialSnapshot.value, key],
  );

  return [storedValue, setStoredValue];
}
