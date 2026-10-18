import type { PreferenceStorage } from './location-store';

const unavailable = new Error('Device preference storage is unavailable');
let native: PreferenceStorage | null | undefined;

function isPreferenceStorage(value: unknown): value is PreferenceStorage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getItem' in value &&
    typeof value.getItem === 'function' &&
    'setItem' in value &&
    typeof value.setItem === 'function'
  );
}

function storageExport(loaded: unknown): PreferenceStorage | null {
  if (typeof loaded !== 'object' || loaded === null) return null;
  const candidate = 'default' in loaded ? loaded.default : loaded;
  return isPreferenceStorage(candidate) ? candidate : null;
}

function nativeStorage(): Promise<PreferenceStorage> {
  if (native === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the native module throws while loading when the installed binary does not link it
      const loaded: unknown = require('@react-native-async-storage/async-storage');
      native = storageExport(loaded);
    } catch {
      native = null;
    }
  }
  return native ? Promise.resolve(native) : Promise.reject(unavailable);
}

export const deviceStorage: PreferenceStorage = {
  getItem: (key) => nativeStorage().then((storage) => storage.getItem(key)),
  setItem: (key, value) => nativeStorage().then((storage) => storage.setItem(key, value)),
};
