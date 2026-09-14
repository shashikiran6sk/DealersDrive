import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { CachePort } from './cache.port.js';
import { createMemoryCache } from './memory.adapter.js';
import { createPostgresCache } from './postgres.adapter.js';

export function createCache(prisma: PrismaClient): CachePort {
  return env.CACHE_DRIVER === 'memory' ? createMemoryCache() : createPostgresCache(prisma);
}
