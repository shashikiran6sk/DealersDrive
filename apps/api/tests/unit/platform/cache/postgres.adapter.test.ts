import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createPostgresCache } from '../../../../src/platform/cache/postgres.adapter.js';

/**
 * Unit tests for the Postgres `CachePort`.
 *
 * These cannot prove the SQL is *correct* — only a real database can do that,
 * and the integration suite is where that happens. What they pin down is
 * everything around it, which is where the bugs that survive a migration live:
 * the result mapping, the BigInt conversion, the empty-result fallback, and the
 * fact that the statements are tagged templates rather than concatenated
 * strings.
 *
 * The last one matters most. `$queryRaw` with a tagged template parameterises;
 * `$queryRawUnsafe` with a built string does not, and the difference between
 * them is a SQL injection. ARCHITECTURE §21.2 requires every `$queryRaw` in this
 * repository to be a tagged template, so the key is asserted to arrive as a
 * bound parameter and never inside the statement text.
 */
interface Captured {
  strings: readonly string[];
  values: unknown[];
}

function fakePrisma(rows: unknown[] = [], captured: Captured[] = []) {
  const record = (strings: TemplateStringsArray, ...values: unknown[]) => {
    captured.push({ strings: [...strings], values });
    return Promise.resolve(rows);
  };

  return {
    prisma: {
      $queryRaw: record,
      $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
        captured.push({ strings: [...strings], values });
        return Promise.resolve(7);
      },
    } as unknown as PrismaClient,
    captured,
  };
}

describe('increment', () => {
  it('maps the returned row onto the port’s shape', async () => {
    const resetAt = new Date(Date.now() + 42_000);
    const { prisma } = fakePrisma([{ count: 3, reset_at: resetAt }]);

    const result = await createPostgresCache(prisma).increment('enquiries:1.2.3.4', 60);

    expect(result.count).toBe(3);
    expect(result.resetAt).toBe(resetAt.getTime());
    // Derived from reset_at, not from the window length — a request arriving
    // late in a window must be told how long is actually left.
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(42);
    expect(result.retryAfterSeconds).toBeGreaterThan(40);
  });

  it('binds the key as a parameter rather than interpolating it', async () => {
    const { prisma, captured } = fakePrisma([{ count: 1, reset_at: new Date() }]);

    // A key containing SQL is the whole point: it is built from `req.ip`.
    await createPostgresCache(prisma).increment("reveal:'; DROP TABLE dealers; --", 60);

    const statement = captured[0]?.strings.join('?') ?? '';
    expect(captured[0]?.values[0]).toBe("reveal:'; DROP TABLE dealers; --");
    expect(statement).not.toContain('DROP TABLE dealers');
    expect(statement).toContain('cache_counter');
  });

  it('binds the window length too', async () => {
    const { prisma, captured } = fakePrisma([{ count: 1, reset_at: new Date() }]);

    await createPostgresCache(prisma).increment('k', 3600);

    expect(captured[0]?.values).toContain(3600);
  });

  /**
   * `RETURNING` on an upsert always yields a row. If it somehow does not, the
   * honest reading is "we could not count this" — and a limiter that cannot
   * count must not be the thing that denies a legitimate request.
   */
  it('falls back to a permissive first-request result when nothing is returned', async () => {
    const { prisma } = fakePrisma([]);

    const result = await createPostgresCache(prisma).increment('k', 60);

    expect(result.count).toBe(1);
    expect(result.retryAfterSeconds).toBe(60);
  });
});

describe('peek', () => {
  it('returns the stored count', async () => {
    const { prisma } = fakePrisma([{ count: 4, reset_at: new Date() }]);

    await expect(createPostgresCache(prisma).peek('k')).resolves.toBe(4);
  });

  it('is zero when the row is absent or expired', async () => {
    const { prisma } = fakePrisma([]);

    await expect(createPostgresCache(prisma).peek('k')).resolves.toBe(0);
  });

  it('lets the query exclude expired rows rather than filtering in JS', async () => {
    const { prisma, captured } = fakePrisma([]);

    await createPostgresCache(prisma).peek('k');

    expect(captured[0]?.strings.join('')).toContain('reset_at > now()');
  });
});

describe('versions', () => {
  /** The column is `bigint`, so the driver hands back a BigInt. */
  it('converts BigInt to a number', async () => {
    const { prisma } = fakePrisma([{ version: 12n }]);

    await expect(createPostgresCache(prisma).bumpVersion('platform-config')).resolves.toBe(12);
  });

  it('reads a version', async () => {
    const { prisma } = fakePrisma([{ version: 5n }]);

    await expect(createPostgresCache(prisma).readVersion('platform-config')).resolves.toBe(5);
  });

  it('is zero for a namespace never bumped', async () => {
    const { prisma } = fakePrisma([]);

    await expect(createPostgresCache(prisma).readVersion('platform-config')).resolves.toBe(0);
  });
});

describe('sweep', () => {
  it('reports the number of rows deleted', async () => {
    const { prisma } = fakePrisma();

    await expect(createPostgresCache(prisma).sweep()).resolves.toBe(7);
  });

  it('deletes only expired windows', async () => {
    const { prisma, captured } = fakePrisma();

    await createPostgresCache(prisma).sweep();

    expect(captured[0]?.strings.join('')).toContain('reset_at <= now()');
  });
});

describe('the port contract', () => {
  it('names itself', () => {
    const { prisma } = fakePrisma();

    expect(createPostgresCache(prisma).driver).toBe('postgres');
  });

  it('pings without reading any rows', async () => {
    const { prisma, captured } = fakePrisma([]);

    await createPostgresCache(prisma).ping();

    expect(captured[0]?.strings.join('')).toContain('LIMIT 0');
  });

  /** The Prisma client belongs to the container, which disconnects it. */
  it('closing does not disconnect the shared client', async () => {
    const { prisma, captured } = fakePrisma();

    await createPostgresCache(prisma).close();

    expect(captured).toHaveLength(0);
  });
});
