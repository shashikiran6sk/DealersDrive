import type { EventBus } from '../events/bus.js';
import { isRecord } from '../errors.js';
import type { StoragePort } from './storage.port.js';

export function deleteStorageObjects(storage: StoragePort, keys: string[]) {
  return Promise.allSettled(keys.map((key) => storage.delete(key)));
}

export function subscribeStorageCleanup(bus: EventBus, storage: StoragePort): void {
  bus.on(
    'StorageObjectsDelete',
    async (event) => {
      if (!isRecord(event.payload) || !Array.isArray(event.payload.keys)) {
        throw new Error('Invalid storage cleanup payload');
      }
      const keys = event.payload.keys;
      if (!keys.every((key): key is string => typeof key === 'string' && key.length > 0)) {
        throw new Error('Invalid storage cleanup keys');
      }
      const results = await deleteStorageObjects(storage, keys);
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length > 0) {
        throw new AggregateError(
          failures.map((failure) => failure.reason),
          'Storage cleanup failed',
        );
      }
    },
    { required: true },
  );
}
