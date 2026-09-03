import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DomainEvent, EventBus } from '../../../../src/platform/events/bus.js';
import { createOutboxPublisher } from '../../../../src/platform/events/outbox-publisher.js';

/**
 * Unit tests for `src/platform/events/outbox-publisher.ts`.
 *
 * The integration suite drives this through `h.drain()` against a real table.
 * What it cannot easily reach is the failure path — a subscriber that throws must
 * increment `attempts` and leave `publishedAt` null, so the row is retried and
 * eventually parked rather than replayed forever. That is what the fakes here
 * are for.
 */
interface Row {
  id: bigint;
  payload: unknown;
}

interface Update {
  where: { id: bigint };
  data: Record<string, unknown>;
}

function event(id: string): DomainEvent {
  return {
    id,
    type: 'ListingApproved',
    version: 1,
    occurredAt: '2026-08-17T10:00:00.000Z',
    aggregateType: 'Listing',
    aggregateId: 'bbbbbbbb-0000-4000-8000-000000000000',
    actor: { type: 'ADMIN' },
    traceId: 'trace-1',
    payload: {},
  };
}

function harness(rows: Row[]) {
  const updates: Update[] = [];
  const queries: string[] = [];

  const prisma = {
    $queryRaw: (strings: TemplateStringsArray) => {
      queries.push(strings.join('?'));
      return Promise.resolve(rows);
    },
    outboxEvent: {
      update: (args: Update) => {
        updates.push(args);
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaClient;

  const published: DomainEvent[] = [];
  const bus: EventBus = {
    on: () => undefined,
    publish: (candidate) => {
      published.push(candidate);
      return Promise.resolve();
    },
  };

  return { prisma, bus, updates, queries, published };
}

describe('createOutboxPublisher', () => {
  describe('drain', () => {
    it('publishes each row and marks it published', async () => {
      const h = harness([
        { id: 1n, payload: event('one') },
        { id: 2n, payload: event('two') },
      ]);
      const publisher = createOutboxPublisher(h.prisma, h.bus);

      const count = await publisher.drain();

      expect(count).toBe(2);
      expect(h.published.map((candidate) => candidate.id)).toEqual(['one', 'two']);
      expect(h.updates).toHaveLength(2);
      expect(h.updates[0]?.data.publishedAt).toBeInstanceOf(Date);
    });

    it('returns 0 on an empty outbox and touches nothing', async () => {
      const h = harness([]);
      const publisher = createOutboxPublisher(h.prisma, h.bus);

      expect(await publisher.drain()).toBe(0);
      expect(h.updates).toEqual([]);
    });

    it('claims rows with FOR UPDATE SKIP LOCKED, so two workers never collide', async () => {
      const h = harness([]);
      const publisher = createOutboxPublisher(h.prisma, h.bus);

      await publisher.drain();

      const sql = h.queries.join(' ');
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');
      expect(sql).toContain('"publishedAt" IS NULL');
      expect(sql).toContain('ORDER BY id');
    });

    it('increments attempts instead of publishing when the bus throws', async () => {
      const h = harness([{ id: 7n, payload: event('boom') }]);
      const failing: EventBus = {
        on: () => undefined,
        publish: () => Promise.reject(new Error('handler exploded')),
      };
      const publisher = createOutboxPublisher(h.prisma, failing);

      // Not a rejection: a poisoned row must not stop the poller.
      await expect(publisher.drain()).resolves.toBe(1);

      expect(h.updates).toHaveLength(1);
      expect(h.updates[0]?.data).toEqual({ attempts: { increment: 1 } });
      expect(h.updates[0]?.data.publishedAt).toBeUndefined();
    });

    it('increments attempts when the publish succeeded but the mark failed', async () => {
      const updates: Update[] = [];
      let first = true;
      const prisma = {
        $queryRaw: () => Promise.resolve([{ id: 9n, payload: event('half') }]),
        outboxEvent: {
          update: (args: Update) => {
            updates.push(args);
            if (first) {
              first = false;
              return Promise.reject(new Error('deadlock'));
            }
            return Promise.resolve({});
          },
        },
      } as unknown as PrismaClient;

      const publisher = createOutboxPublisher(prisma, {
        on: () => undefined,
        publish: () => Promise.resolve(),
      });

      await expect(publisher.drain()).resolves.toBe(1);

      // The row will be redelivered, which is why handlers must be idempotent.
      expect(updates).toHaveLength(2);
      expect(updates[1]?.data).toEqual({ attempts: { increment: 1 } });
    });

    it('keeps going after one row fails', async () => {
      const h = harness([
        { id: 1n, payload: event('bad') },
        { id: 2n, payload: event('good') },
      ]);
      let calls = 0;
      const bus: EventBus = {
        on: () => undefined,
        publish: (candidate) => {
          calls += 1;
          return calls === 1 ? Promise.reject(new Error('nope')) : Promise.resolve(void candidate);
        },
      };

      await createOutboxPublisher(h.prisma, bus).drain();

      expect(calls).toBe(2);
      expect(h.updates[0]?.data).toEqual({ attempts: { increment: 1 } });
      expect(h.updates[1]?.data.publishedAt).toBeInstanceOf(Date);
    });

    it('caps retries in the query rather than in code', async () => {
      const h = harness([]);

      await createOutboxPublisher(h.prisma, h.bus).drain();

      // A permanently poisoned row is parked by the WHERE clause, so it stops
      // consuming a slot in every batch forever.
      expect(h.queries.join(' ')).toContain('attempts <');
    });
  });

  describe('start / stop', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('polls on an interval once started', async () => {
      const h = harness([]);
      const publisher = createOutboxPublisher(h.prisma, h.bus);

      publisher.start();
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(2_000);
      publisher.stop();

      expect(h.queries).toHaveLength(2);
    });

    it('is idempotent — a second start does not double the poll rate', async () => {
      const h = harness([]);
      const publisher = createOutboxPublisher(h.prisma, h.bus);

      publisher.start();
      publisher.start();
      await vi.advanceTimersByTimeAsync(2_000);
      publisher.stop();

      expect(h.queries).toHaveLength(1);
    });

    it('stops polling after stop, and stop is safe when never started', async () => {
      const h = harness([]);
      const publisher = createOutboxPublisher(h.prisma, h.bus);

      publisher.stop();
      publisher.start();
      publisher.stop();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(h.queries).toEqual([]);
    });

    it('can be restarted after being stopped', async () => {
      const h = harness([]);
      const publisher = createOutboxPublisher(h.prisma, h.bus);

      publisher.start();
      publisher.stop();
      publisher.start();
      await vi.advanceTimersByTimeAsync(2_000);
      publisher.stop();

      expect(h.queries).toHaveLength(1);
    });

    it('never overlaps two drains', async () => {
      let release: (() => void) | undefined;
      let started = 0;
      const prisma = {
        $queryRaw: () => {
          started += 1;
          return new Promise((resolve) => {
            release = () => resolve([]);
          });
        },
        outboxEvent: { update: () => Promise.resolve({}) },
      } as unknown as PrismaClient;

      const publisher = createOutboxPublisher(prisma, {
        on: () => undefined,
        publish: () => Promise.resolve(),
      });

      publisher.start();
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(2_000);

      // A slow drain must not stack up behind the timer: two concurrent drains
      // would publish the same rows twice, since neither has marked them yet.
      expect(started).toBe(1);

      release?.();
      publisher.stop();
    });

    it('survives a drain that rejects, and keeps polling', async () => {
      let calls = 0;
      const prisma = {
        $queryRaw: () => {
          calls += 1;
          return calls === 1 ? Promise.reject(new Error('connection lost')) : Promise.resolve([]);
        },
        outboxEvent: { update: () => Promise.resolve({}) },
      } as unknown as PrismaClient;

      const publisher = createOutboxPublisher(prisma, {
        on: () => undefined,
        publish: () => Promise.resolve(),
      });

      publisher.start();
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(2_000);
      publisher.stop();

      // A dropped connection must not kill the poller for the life of the process.
      expect(calls).toBe(2);
    });

    it('unrefs its timer so it cannot hold the process open', () => {
      const h = harness([]);
      const publisher = createOutboxPublisher(h.prisma, h.bus);
      const unref = vi.fn();
      const spy = vi.spyOn(globalThis, 'setInterval').mockReturnValue({
        unref,
      } as unknown as NodeJS.Timeout);

      publisher.start();

      expect(unref).toHaveBeenCalledTimes(1);
      spy.mockRestore();
      publisher.stop();
    });
  });
});
