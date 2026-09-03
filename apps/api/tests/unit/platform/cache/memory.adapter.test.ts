import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retryAfterSeconds } from '../../../../src/platform/cache/cache.port.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';

/**
 * Unit tests for the in-process `CachePort`.
 *
 * This adapter is what `pnpm dev` and the whole test suite run on, so its
 * window arithmetic is the arithmetic every other rate-limit test is really
 * asserting against. The Postgres adapter has to agree with it exactly —
 * that contract is the point of the port.
 */
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('retryAfterSeconds', () => {
  it('rounds up, so a caller never returns early', () => {
    expect(retryAfterSeconds(Date.now() + 1_500)).toBe(2);
  });

  it('never reports below one second', () => {
    expect(retryAfterSeconds(Date.now() + 10)).toBe(1);
  });

  it('never reports zero or negative for a window already past', () => {
    expect(retryAfterSeconds(Date.now() - 5_000)).toBe(1);
  });

  it('never reports longer than the window it belongs to', () => {
    // The Postgres adapter reads `reset_at` off the database's clock and
    // compares it to the application's. A node a millisecond behind its
    // database would otherwise turn a 60-second window into a 61-second
    // `Retry-After` — a header that outlives the window it describes.
    expect(retryAfterSeconds(Date.now() + 60_001, Date.now(), 60)).toBe(60);
  });

  it('leaves an honest remainder alone', () => {
    expect(retryAfterSeconds(Date.now() + 20_000, Date.now(), 60)).toBe(20);
  });
});

describe('increment', () => {
  it('opens a window at one', async () => {
    const cache = createMemoryCache();

    await expect(cache.increment('k', 60)).resolves.toEqual({
      count: 1,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });
  });

  it('counts up within the window without moving the reset', async () => {
    const cache = createMemoryCache();
    const first = await cache.increment('k', 60);
    vi.advanceTimersByTime(30_000);
    const second = await cache.increment('k', 60);

    expect(second.count).toBe(2);
    // A sliding reset would let a steady stream of requests hold a window open
    // forever, which is the opposite of a fixed window.
    expect(second.resetAt).toBe(first.resetAt);
  });

  it('rolls the window over once it expires', async () => {
    const cache = createMemoryCache();
    await cache.increment('k', 60);
    await cache.increment('k', 60);
    vi.advanceTimersByTime(60_001);

    await expect(cache.increment('k', 60)).resolves.toMatchObject({ count: 1 });
  });

  it('treats the exact reset moment as expired', async () => {
    const cache = createMemoryCache();
    await cache.increment('k', 60);
    vi.advanceTimersByTime(60_000);

    await expect(cache.increment('k', 60)).resolves.toMatchObject({ count: 1 });
  });

  it('keeps keys independent', async () => {
    const cache = createMemoryCache();
    await cache.increment('a', 60);
    await cache.increment('a', 60);

    await expect(cache.increment('b', 60)).resolves.toMatchObject({ count: 1 });
  });
});

describe('peek', () => {
  it('reads without consuming', async () => {
    const cache = createMemoryCache();
    await cache.increment('k', 60);

    await expect(cache.peek('k')).resolves.toBe(1);
    await expect(cache.peek('k')).resolves.toBe(1);
    await expect(cache.increment('k', 60)).resolves.toMatchObject({ count: 2 });
  });

  it('is zero for an unknown key', async () => {
    await expect(createMemoryCache().peek('nope')).resolves.toBe(0);
  });

  it('is zero once the window has expired', async () => {
    const cache = createMemoryCache();
    await cache.increment('k', 30);
    vi.advanceTimersByTime(30_001);

    await expect(cache.peek('k')).resolves.toBe(0);
  });
});

describe('versions', () => {
  it('starts at zero for a namespace never bumped', async () => {
    await expect(createMemoryCache().readVersion('platform-config')).resolves.toBe(0);
  });

  it('increases monotonically', async () => {
    const cache = createMemoryCache();

    await expect(cache.bumpVersion('platform-config')).resolves.toBe(1);
    await expect(cache.bumpVersion('platform-config')).resolves.toBe(2);
    await expect(cache.readVersion('platform-config')).resolves.toBe(2);
  });

  it('keeps namespaces independent', async () => {
    const cache = createMemoryCache();
    await cache.bumpVersion('a');

    await expect(cache.readVersion('b')).resolves.toBe(0);
  });
});

describe('sweep', () => {
  it('removes expired windows and reports how many', async () => {
    const cache = createMemoryCache();
    await cache.increment('short', 10);
    await cache.increment('long', 600);
    vi.advanceTimersByTime(11_000);

    await expect(cache.sweep()).resolves.toBe(1);
    await expect(cache.peek('long')).resolves.toBe(1);
  });

  it('leaves live windows alone', async () => {
    const cache = createMemoryCache();
    await cache.increment('k', 600);

    await expect(cache.sweep()).resolves.toBe(0);
    await expect(cache.peek('k')).resolves.toBe(1);
  });
});

describe('reset', () => {
  it('drops counters and versions together', async () => {
    const cache = createMemoryCache();
    await cache.increment('k', 60);
    await cache.bumpVersion('platform-config');
    await cache.reset();

    await expect(cache.peek('k')).resolves.toBe(0);
    await expect(cache.readVersion('platform-config')).resolves.toBe(0);
  });
});

describe('the port contract', () => {
  it('names itself, so /health/ready can report which adapter is live', () => {
    expect(createMemoryCache().driver).toBe('memory');
  });

  it('pings without touching anything', async () => {
    await expect(createMemoryCache().ping()).resolves.toBeUndefined();
  });
});
