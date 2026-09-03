import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { CachePort } from './cache.port.js';
import { createMemoryCache } from './memory.adapter.js';
import { createPostgresCache } from './postgres.adapter.js';

/**
 * The shared-state provider, chosen by one variable.
 *
 *   memory    — this process only. `pnpm dev`, the test suite, one task.
 *               Refused in production by `env.ts` (§29), because a limit that
 *               is N times looser than it says fails silently.
 *   postgres  — the database the API already has. The production default.
 *
 * It takes the Prisma client rather than creating one: the counter write must
 * share the API's connection pool, not open a second one.
 */
export function createCache(prisma: PrismaClient): CachePort {
  return env.CACHE_DRIVER === 'memory' ? createMemoryCache() : createPostgresCache(prisma);
}
