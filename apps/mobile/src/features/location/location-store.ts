import { createStore } from 'zustand/vanilla';

export interface PreferenceStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
}
export const DISTRICT_PREFERENCE_KEY = 'dealersdrive.public-district.v1';
export const validDistrict = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9-]{1,120}$/.test(value);

export function createLocationStore(storage: PreferenceStorage) {
  let hydration: Promise<void> | undefined;
  let writes = Promise.resolve<unknown>(undefined);
  const store = createStore<{ district: string | undefined; revision: number; hydrated: boolean }>(
    () => ({ district: undefined, revision: 0, hydrated: false }),
  );
  return Object.assign(store, {
    choose(district: string | undefined) {
      if (district !== undefined && !validDistrict(district)) return;
      const previous = store.getState();
      store.setState({ district, revision: previous.revision + 1, hydrated: true });
      writes = writes
        .catch(() => undefined)
        .then(() => storage.setItem(DISTRICT_PREFERENCE_KEY, district ?? ''))
        .catch(() => undefined);
    },
    hydrate() {
      if (hydration) return hydration;
      const revision = store.getState().revision;
      hydration = storage
        .getItem(DISTRICT_PREFERENCE_KEY)
        .then((value) => {
          if (store.getState().revision === revision)
            store.setState({ district: validDistrict(value) ? value : undefined });
        })
        .catch(() => undefined)
        .finally(() => store.setState({ hydrated: true }));
      return hydration;
    },
  });
}
