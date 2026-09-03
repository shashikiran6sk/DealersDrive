import type { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the cache provider seam.
 *
 * One variable decides where every rate-limit window lives, and getting it
 * wrong in production is silent — the site works, the limits simply mean N
 * times what they say. So this pins both branches, and `env.ts`'s own test
 * covers the production refusal.
 *
 * `env` is read once at import time, so the driver has to be set before the
 * module graph loads — hence the dynamic imports.
 */
const prisma = { $queryRaw: () => Promise.resolve([]) } as unknown as PrismaClient;

async function loadWith(driver: 'memory' | 'postgres') {
  vi.stubEnv('CACHE_DRIVER', driver);
  vi.resetModules();
  const { createCache } = await import('../../../../src/platform/cache/factory.js');
  vi.unstubAllEnvs();
  return createCache;
}

afterAll(() => {
  vi.resetModules();
});

describe('createCache', () => {
  it('builds the in-process adapter for CACHE_DRIVER=memory', async () => {
    const createCache = await loadWith('memory');

    expect(createCache(prisma).driver).toBe('memory');
  });

  it('builds the database adapter for CACHE_DRIVER=postgres', async () => {
    const createCache = await loadWith('postgres');

    expect(createCache(prisma).driver).toBe('postgres');
  });

  /**
   * It takes the container's client rather than creating one. A second pool
   * for counter writes would compete with the request path for the database's
   * connection budget, which is the scarcest thing in this system.
   */
  it('uses the client it is given', async () => {
    const createCache = await loadWith('postgres');
    const queried = { count: 0 };
    const spy = {
      $queryRaw: () => {
        queried.count += 1;
        return Promise.resolve([{ count: 1, reset_at: new Date() }]);
      },
    } as unknown as PrismaClient;

    await createCache(spy).increment('k', 60);

    expect(queried.count).toBe(1);
  });
});
