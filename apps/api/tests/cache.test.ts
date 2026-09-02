import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createPostgresCache } from '../src/platform/cache/postgres.adapter.js';

/**
 * The Postgres `CachePort`, against a real database.
 *
 * This file exists because the unit tests cannot prove the thing that matters.
 * They pin the result mapping and the parameter binding; only Postgres can
 * confirm that `INSERT … ON CONFLICT DO UPDATE … CASE` actually rolls a window
 * over exactly once under concurrency — and that is the entire reason the
 * adapter is written as one statement rather than as a read and a write.
 *
 * The rest of the suite runs on the memory adapter (see `harness.ts`), so
 * without this file the SQL that production uses would never execute in CI.
 */
const prisma = new PrismaClient();
const cache = createPostgresCache(prisma);

beforeEach(async () => {
  await cache.reset();
});

afterAll(async () => {
  await cache.reset();
  await prisma.$disconnect();
});

describe('the migration landed', () => {
  it('created both tables', async () => {
    await expect(cache.ping()).resolves.toBeUndefined();
    await expect(cache.readVersion('probe')).resolves.toBe(0);
  });
});

describe('counting a window', () => {
  it('opens at one and counts up', async () => {
    const first = await cache.increment('k', 60);
    const second = await cache.increment('k', 60);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
  });

  it('holds the reset moment steady while the window is open', async () => {
    const first = await cache.increment('k', 60);
    const second = await cache.increment('k', 60);

    // A sliding reset would let a steady stream of requests hold one window
    // open forever, which is not a fixed window.
    expect(second.resetAt).toBe(first.resetAt);
  });

  it('reports a usable retry-after', async () => {
    const result = await cache.increment('k', 60);

    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('keeps keys independent', async () => {
    await cache.increment('a', 60);
    await cache.increment('a', 60);

    await expect(cache.increment('b', 60)).resolves.toMatchObject({ count: 1 });
  });

  /** A window of zero seconds is already expired, so every call opens a new one. */
  it('rolls over once the window has passed', async () => {
    await cache.increment('k', 0);
    await cache.increment('k', 0);

    await expect(cache.increment('k', 0)).resolves.toMatchObject({ count: 1 });
  });
});

describe('concurrency — the reason this is one statement', () => {
  /**
   * Ten simultaneous requests must produce the counts 1..10 with no repeats.
   *
   * A read-then-write in application code cannot promise this: two callers read
   * 5, both decide "allowed", and both write 6 — so the sixth request of a
   * five-per-hour window is permitted and the counter is wrong afterwards.
   */
  it('never issues the same count twice', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => cache.increment('concurrent', 3600)),
    );

    const counts = results.map((result) => result.count).sort((a, b) => a - b);

    expect(counts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('agrees on one reset moment across all of them', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => cache.increment('concurrent', 3600)),
    );

    expect(new Set(results.map((result) => result.resetAt)).size).toBe(1);
  });
});

describe('peek', () => {
  it('reads without consuming', async () => {
    await cache.increment('k', 60);

    await expect(cache.peek('k')).resolves.toBe(1);
    await expect(cache.peek('k')).resolves.toBe(1);
    await expect(cache.increment('k', 60)).resolves.toMatchObject({ count: 2 });
  });

  it('is zero for a key never seen', async () => {
    await expect(cache.peek('never-seen')).resolves.toBe(0);
  });

  it('is zero for a window that has expired', async () => {
    await cache.increment('k', 0);

    await expect(cache.peek('k')).resolves.toBe(0);
  });
});

describe('versions', () => {
  it('increases monotonically', async () => {
    await expect(cache.bumpVersion('platform-config')).resolves.toBe(1);
    await expect(cache.bumpVersion('platform-config')).resolves.toBe(2);
    await expect(cache.readVersion('platform-config')).resolves.toBe(2);
  });

  it('keeps namespaces independent', async () => {
    await cache.bumpVersion('a');

    await expect(cache.readVersion('b')).resolves.toBe(0);
  });

  /** Concurrent bumps must not collide on the primary key or lose an increment. */
  it('survives concurrent bumps', async () => {
    await Promise.all(Array.from({ length: 5 }, () => cache.bumpVersion('busy')));

    await expect(cache.readVersion('busy')).resolves.toBe(5);
  });
});

describe('sweep', () => {
  it('deletes expired windows and leaves live ones', async () => {
    await cache.increment('expired', 0);
    await cache.increment('live', 3600);

    await expect(cache.sweep()).resolves.toBeGreaterThanOrEqual(1);
    await expect(cache.peek('live')).resolves.toBe(1);
  });
});
