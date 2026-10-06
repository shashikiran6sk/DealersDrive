import { describe, expect, it, vi } from 'vitest';
import { createEventBus, type DomainEvent } from '../../../../src/platform/events/bus.js';
import {
  deleteStorageObjects,
  subscribeStorageCleanup,
} from '../../../../src/platform/storage/cleanup.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

function event(payload: unknown): DomainEvent {
  return {
    id: 'event',
    type: 'StorageObjectsDelete',
    version: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: 'Dealer',
    aggregateId: 'dealer',
    actor: { type: 'SYSTEM' },
    traceId: 'cleanup',
    payload,
  };
}
function storage(remove: (key: string) => Promise<void>) {
  return { delete: remove } as unknown as StoragePort;
}

describe('durable storage cleanup', () => {
  it('attempts every key and reports partial results', async () => {
    const remove = vi.fn(async (key: string) => {
      if (key === 'failed') throw new Error('Unavailable');
    });
    const results = await deleteStorageObjects(storage(remove), ['first', 'failed', 'last']);
    expect(remove.mock.calls.map(([key]) => key)).toEqual(['first', 'failed', 'last']);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });
  it('leaves delivery failed until every deletion succeeds and allows idempotent replay', async () => {
    let unavailable = true;
    const remove = vi.fn(async () => {
      if (unavailable) throw new Error('Unavailable');
    });
    const bus = createEventBus();
    subscribeStorageCleanup(bus, storage(remove));
    await expect(bus.publish(event({ keys: ['object'] }))).rejects.toThrow(
      'Storage cleanup failed',
    );
    unavailable = false;
    await expect(bus.publish(event({ keys: ['object'] }))).resolves.toBeUndefined();
    await expect(bus.publish(event({ keys: ['object'] }))).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledTimes(3);
  });
  it.each([null, {}, { keys: null }, { keys: 'object' }, { keys: [1] }, { keys: [''] }])(
    'rejects malformed persisted payload %j without deleting any objects',
    async (payload) => {
      const remove = vi.fn();
      const bus = createEventBus();
      subscribeStorageCleanup(bus, storage(remove));
      await expect(bus.publish(event(payload))).rejects.toThrow(/Invalid storage cleanup/);
      expect(remove).not.toHaveBeenCalled();
    },
  );
  it('completes an empty cleanup without issuing a provider request', async () => {
    const remove = vi.fn();
    const bus = createEventBus();
    subscribeStorageCleanup(bus, storage(remove));
    await expect(bus.publish(event({ keys: [] }))).resolves.toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
  });
});
