import { describe, expect, it, vi } from 'vitest';

import type { Tx } from '../../../../src/platform/db/prisma.js';
import {
  createEventBus,
  enqueueOutbox,
  type DomainEvent,
  type OutboxWrite,
} from '../../../../src/platform/events/bus.js';

/**
 * Unit tests for `src/platform/events/bus.ts`.
 *
 * Two rules live in this file and both are load-bearing:
 *
 *   1. **A failing subscriber never rolls the publisher back.** An approval must
 *      not fail because a search index write threw.
 *   2. **The outbox row is written inside the caller's transaction**, which is
 *      what makes the side effect exactly as durable as the state change that
 *      caused it.
 */
function event(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'aaaaaaaa-0000-4000-8000-000000000000',
    type: 'ListingApproved',
    version: 1,
    occurredAt: '2026-08-17T10:00:00.000Z',
    aggregateType: 'Listing',
    aggregateId: 'bbbbbbbb-0000-4000-8000-000000000000',
    actor: { type: 'ADMIN', id: 'cccccccc-0000-4000-8000-000000000000' },
    traceId: 'trace-1234',
    payload: {},
    ...overrides,
  };
}

describe('createEventBus', () => {
  it('delivers an event to the handler subscribed to its type', async () => {
    const bus = createEventBus();
    const handler = vi.fn().mockResolvedValue(undefined);

    bus.on('ListingApproved', handler);
    await bus.publish(event());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ type: 'ListingApproved' });
  });

  it('delivers to every subscriber of a type, in subscription order', async () => {
    const bus = createEventBus();
    const order: string[] = [];

    bus.on('ListingApproved', () => Promise.resolve(void order.push('index')));
    bus.on('ListingApproved', () => Promise.resolve(void order.push('notify')));
    bus.on('ListingApproved', () => Promise.resolve(void order.push('revalidate')));

    await bus.publish(event());

    expect(order).toEqual(['index', 'notify', 'revalidate']);
  });

  it('does not deliver to subscribers of a different type', async () => {
    const bus = createEventBus();
    const other = vi.fn();

    bus.on('ListingRejected', other);
    await bus.publish(event({ type: 'ListingApproved' }));

    expect(other).not.toHaveBeenCalled();
  });

  it('publishing a type nobody subscribed to is a no-op, not an error', async () => {
    const bus = createEventBus();

    await expect(bus.publish(event({ type: 'PhotoRequestCompleted' }))).resolves.toBeUndefined();
  });

  it('swallows a subscriber failure so the publisher is never rolled back', async () => {
    const bus = createEventBus();
    const afterTheFailure = vi.fn().mockResolvedValue(undefined);

    bus.on('ListingApproved', () => Promise.reject(new Error('search index down')));
    bus.on('ListingApproved', afterTheFailure);

    // Rule 1: this must not reject, and it must not stop the remaining
    // subscribers. An approval that rolls back because indexing failed would
    // leave the credit consumed and the listing unpublished.
    await expect(bus.publish(event())).resolves.toBeUndefined();
    expect(afterTheFailure).toHaveBeenCalledTimes(1);
  });

  it('awaits each subscriber rather than firing them all off unawaited', async () => {
    const bus = createEventBus();
    let finished = false;

    bus.on('ListingApproved', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      finished = true;
    });

    await bus.publish(event());

    expect(finished).toBe(true);
  });

  it('keeps subscriptions separate per bus instance', async () => {
    const first = createEventBus();
    const second = createEventBus();
    const handler = vi.fn();

    first.on('ListingApproved', handler);
    await second.publish(event());

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('enqueueOutbox', () => {
  function fakeTx(): { tx: Tx; created: { data: Record<string, unknown> }[] } {
    const created: { data: Record<string, unknown> }[] = [];
    const tx = {
      outboxEvent: {
        create: (args: { data: Record<string, unknown> }) => {
          created.push(args);
          return Promise.resolve({});
        },
      },
    } as unknown as Tx;

    return { tx, created };
  }

  function write(overrides: Partial<OutboxWrite> = {}): OutboxWrite {
    return {
      type: 'ListingSubmitted',
      aggregateType: 'Listing',
      aggregateId: 'bbbbbbbb-0000-4000-8000-000000000000',
      actor: { type: 'DEALER', id: 'dddddddd-0000-4000-8000-000000000000' },
      traceId: 'trace-9999',
      payload: { listingId: 'bbbbbbbb-0000-4000-8000-000000000000' },
      ...overrides,
    };
  }

  it('writes one row through the transaction handle it was given', async () => {
    const { tx, created } = fakeTx();

    await enqueueOutbox(tx, write());

    // Rule 2: the row goes through `tx`, not through a fresh client — that is
    // the difference between an atomic side effect and a lost one.
    expect(created).toHaveLength(1);
    expect(created[0]?.data).toMatchObject({
      aggregateType: 'Listing',
      eventType: 'ListingSubmitted',
    });
  });

  it('stores the full envelope as the payload', async () => {
    const { tx, created } = fakeTx();

    await enqueueOutbox(tx, write());
    const stored = created[0]?.data.payload as DomainEvent<Record<string, unknown>>;

    expect(stored.version).toBe(1);
    expect(stored.type).toBe('ListingSubmitted');
    expect(stored.actor).toEqual({
      type: 'DEALER',
      id: 'dddddddd-0000-4000-8000-000000000000',
    });
    expect(stored.traceId).toBe('trace-9999');
    expect(stored.payload).toEqual({ listingId: 'bbbbbbbb-0000-4000-8000-000000000000' });
  });

  it('mints a fresh uuid and timestamp per event', async () => {
    const { tx, created } = fakeTx();

    await enqueueOutbox(tx, write());
    await enqueueOutbox(tx, write());

    const [first, second] = created.map(
      (row) => row.data.payload as DomainEvent<Record<string, unknown>>,
    );

    expect(first?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first?.id).not.toBe(second?.id);
    expect(new Date(first?.occurredAt ?? '').toString()).not.toBe('Invalid Date');
  });

  it('includes dealerId when there is one', async () => {
    const { tx, created } = fakeTx();

    await enqueueOutbox(tx, write({ dealerId: 'eeeeeeee-0000-4000-8000-000000000000' }));
    const stored = created[0]?.data.payload as DomainEvent<Record<string, unknown>>;

    expect(stored.dealerId).toBe('eeeeeeee-0000-4000-8000-000000000000');
  });

  it('omits dealerId entirely for a platform-wide event', async () => {
    const { tx, created } = fakeTx();

    await enqueueOutbox(tx, write({ type: 'ListingExpired', dealerId: undefined }));
    const stored = created[0]?.data.payload as Record<string, unknown>;

    // Omitted, not null: `dealerId: null` in a payload reads as "no dealer",
    // which is a different claim from "this event is not dealer-scoped".
    expect('dealerId' in stored).toBe(false);
  });

  it('produces a payload that survives a JSON round trip', async () => {
    const { tx, created } = fakeTx();

    await enqueueOutbox(tx, write());
    const stored = created[0]?.data.payload;

    // It is stored in a jsonb column, so anything that cannot serialise is a
    // runtime failure at the worst possible moment — inside someone's write.
    expect(() => JSON.parse(JSON.stringify(stored)) as unknown).not.toThrow();
  });

  it('carries ids in the payload, never PII', async () => {
    const { tx, created } = fakeTx();

    await enqueueOutbox(
      tx,
      write({
        type: 'EnquiryCreated',
        payload: { enquiryId: 'ffffffff-0000-4000-8000-000000000000' },
      }),
    );
    const stored = created[0]?.data.payload as DomainEvent<Record<string, unknown>>;

    // Handlers re-fetch. A phone number in an outbox row is a phone number in a
    // table with a long retention and no access control of its own — so the
    // payload carries reference keys only.
    for (const key of Object.keys(stored.payload)) {
      expect(key, `payload.${key} does not look like a reference`).toMatch(/Id$/);
    }
    expect(Object.values(stored.payload).every((value) => typeof value === 'string')).toBe(true);
  });
});
