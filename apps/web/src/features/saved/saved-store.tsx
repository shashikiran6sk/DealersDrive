'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Saved cars live in `localStorage`, ids only, device-scoped.
 *
 * There are no buyer accounts and there will not be in this phase
 * (ARCHITECTURE §1.1) — so this holds ids, and `POST /v1/vehicles/batch`
 * turns them into cards. A car that has left the catalogue comes back in the
 * `unavailable` array and is pruned here rather than 404-ing the page.
 */
const STORAGE_KEY = 'dd.saved-cars';

interface SavedCarsValue {
  ids: string[];
  count: number;
  /** False during the first paint, so the header badge never mismatches the DOM. */
  hydrated: boolean;
  // Declared as properties rather than methods: consumers destructure these off
  // the context value, and a method signature would make that an unbound-`this`
  // hazard as far as the type system is concerned.
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  prune: (ids: string[]) => void;
}

const SavedCarsContext = createContext<SavedCarsValue | null>(null);

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function SavedCarsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIds(read());
    setHydrated(true);

    // A second tab is still the same device; keep the badge honest.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setIds(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persist = useCallback((next: string[]) => {
    setIds(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing with storage disabled: the session still works,
      // saving simply does not persist. Nothing here is worth failing over.
    }
  }, []);

  const value = useMemo<SavedCarsValue>(
    () => ({
      ids,
      count: ids.length,
      hydrated,
      isSaved: (id) => ids.includes(id),
      toggle: (id) => persist(ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]),
      clear: () => persist([]),
      prune: (gone) => {
        if (gone.length === 0) return;
        const remaining = ids.filter((id) => !gone.includes(id));
        if (remaining.length !== ids.length) persist(remaining);
      },
    }),
    [ids, hydrated, persist],
  );

  return <SavedCarsContext.Provider value={value}>{children}</SavedCarsContext.Provider>;
}

export function useSavedCars(): SavedCarsValue {
  const value = useContext(SavedCarsContext);
  if (!value) throw new Error('useSavedCars() outside SavedCarsProvider');
  return value;
}
