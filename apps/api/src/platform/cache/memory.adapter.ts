import { retryAfterSeconds, type CachePort, type CounterResult } from './cache.port.js';

/**
 * `CachePort` in process memory.
 *
 * Correct for exactly one running process, which is what `pnpm dev` and the
 * test suite are. `env.ts` refuses this driver in production, because the
 * failure mode there is silent: nothing errors, every limit is simply N times
 * looser than the number written next to it.
 *
 * Single-threaded JavaScript makes `increment` atomic for free — there is no
 * await between the read and the write, so no other request can interleave.
 */
interface Window {
  count: number;
  resetAt: number;
}

export function createMemoryCache(): CachePort {
  const windows = new Map<string, Window>();
  const versions = new Map<string, number>();

  return {
    driver: 'memory',

    increment(key, windowSeconds): Promise<CounterResult> {
      const now = Date.now();
      const existing = windows.get(key);

      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowSeconds * 1000;
        windows.set(key, { count: 1, resetAt });
        return Promise.resolve({ count: 1, resetAt, retryAfterSeconds: windowSeconds });
      }

      existing.count += 1;
      return Promise.resolve({
        count: existing.count,
        resetAt: existing.resetAt,
        retryAfterSeconds: retryAfterSeconds(existing.resetAt, now, windowSeconds),
      });
    },

    peek(key): Promise<number> {
      const existing = windows.get(key);
      if (!existing || existing.resetAt <= Date.now()) return Promise.resolve(0);
      return Promise.resolve(existing.count);
    },

    bumpVersion(namespace): Promise<number> {
      const next = (versions.get(namespace) ?? 0) + 1;
      versions.set(namespace, next);
      return Promise.resolve(next);
    },

    readVersion(namespace): Promise<number> {
      return Promise.resolve(versions.get(namespace) ?? 0);
    },

    sweep(): Promise<number> {
      const now = Date.now();
      let removed = 0;
      for (const [key, window] of windows) {
        if (window.resetAt <= now) {
          windows.delete(key);
          removed += 1;
        }
      }
      return Promise.resolve(removed);
    },

    ping(): Promise<void> {
      return Promise.resolve();
    },

    reset(): Promise<void> {
      windows.clear();
      versions.clear();
      return Promise.resolve();
    },

    close(): Promise<void> {
      windows.clear();
      versions.clear();
      return Promise.resolve();
    },
  };
}
