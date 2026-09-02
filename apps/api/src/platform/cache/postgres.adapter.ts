import type { PrismaClient } from '@prisma/client';

import { retryAfterSeconds, type CachePort, type CounterResult } from './cache.port.js';

/**
 * `CachePort` on the database the API already has.
 *
 * Chosen over Redis deliberately (§18). Redis would be a second datastore to
 * provision, secure, monitor and pay for, in a VPC that currently contains one
 * — and the thing being stored is a counter that may be lost without
 * consequence beyond a window resetting early. Postgres is already there,
 * already backed up, already on the readiness check, and already the thing the
 * request cannot proceed without.
 *
 * The cost is one small write per rate-limited request. At the current public
 * limit (120/min/IP) that is nothing next to the query the request is about to
 * run anyway. When it stops being nothing, `createRedisCache()` implements the
 * same port and `factory.ts` gains a branch.
 */
interface CounterRow {
  count: number;
  reset_at: Date;
}

interface VersionRow {
  version: bigint;
}

export function createPostgresCache(prisma: PrismaClient): CachePort {
  return {
    driver: 'postgres',

    /**
     * One statement, so it is atomic without a transaction or a row lock.
     *
     * The two CASE expressions are what make the window roll over correctly
     * under concurrency: whichever request wins the conflict evaluates
     * `reset_at <= now()` against the row as it exists at that instant, so a
     * stale window is reset to 1 exactly once and every other concurrent
     * request increments the fresh one. A read-then-write in application code
     * cannot make that promise.
     */
    async increment(key, windowSeconds): Promise<CounterResult> {
      const rows = await prisma.$queryRaw<CounterRow[]>`
        INSERT INTO cache_counter (key, count, reset_at)
        VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}::int))
        ON CONFLICT (key) DO UPDATE
          SET count = CASE
                        WHEN cache_counter.reset_at <= now() THEN 1
                        ELSE cache_counter.count + 1
                      END,
              reset_at = CASE
                        WHEN cache_counter.reset_at <= now() THEN EXCLUDED.reset_at
                        ELSE cache_counter.reset_at
                      END
        RETURNING count, reset_at
      `;

      const row = rows[0];
      if (!row) {
        // RETURNING on an upsert always yields a row; if it ever does not, the
        // safe reading is "we could not count this", and a limiter that cannot
        // count must not be the thing that denies a legitimate request.
        const resetAt = Date.now() + windowSeconds * 1000;
        return { count: 1, resetAt, retryAfterSeconds: windowSeconds };
      }

      const resetAt = row.reset_at.getTime();
      return {
        count: Number(row.count),
        resetAt,
        retryAfterSeconds: retryAfterSeconds(resetAt, Date.now(), windowSeconds),
      };
    },

    async peek(key): Promise<number> {
      const rows = await prisma.$queryRaw<CounterRow[]>`
        SELECT count, reset_at FROM cache_counter
        WHERE key = ${key} AND reset_at > now()
      `;
      const row = rows[0];
      return row ? Number(row.count) : 0;
    },

    async bumpVersion(namespace): Promise<number> {
      const rows = await prisma.$queryRaw<VersionRow[]>`
        INSERT INTO cache_version (namespace, version, updated_at)
        VALUES (${namespace}, 1, now())
        ON CONFLICT (namespace) DO UPDATE
          SET version = cache_version.version + 1, updated_at = now()
        RETURNING version
      `;
      return rows[0] ? Number(rows[0].version) : 0;
    },

    async readVersion(namespace): Promise<number> {
      const rows = await prisma.$queryRaw<VersionRow[]>`
        SELECT version FROM cache_version WHERE namespace = ${namespace}
      `;
      return rows[0] ? Number(rows[0].version) : 0;
    },

    async sweep(): Promise<number> {
      return prisma.$executeRaw`DELETE FROM cache_counter WHERE reset_at <= now()`;
    },

    async ping(): Promise<void> {
      await prisma.$queryRaw`SELECT 1 FROM cache_counter LIMIT 0`;
    },

    async reset(): Promise<void> {
      await prisma.$executeRaw`DELETE FROM cache_counter`;
      await prisma.$executeRaw`DELETE FROM cache_version`;
    },

    close(): Promise<void> {
      // The Prisma client is owned by the container, which disconnects it.
      return Promise.resolve();
    },
  };
}
