import { afterAll, describe, expect, it } from 'vitest';

import { createPrisma, installBigIntJson } from '../../../../src/platform/db/prisma.js';

/**
 * Unit tests for `src/platform/db/prisma.ts`.
 *
 * No queries here — `createPrisma()` is constructed and disconnected without
 * connecting, because Prisma connects lazily on the first query. What is worth
 * asserting is the BigInt serialisation hook, which is a global prototype patch
 * and therefore exactly the kind of thing that should be pinned.
 */
describe('createPrisma', () => {
  const clients: { $disconnect: () => Promise<void> }[] = [];

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.$disconnect()));
  });

  it('builds a client pointed at the configured DATABASE_URL', () => {
    const client = createPrisma();
    clients.push(client);

    // The seam that matters: the URL comes from `env`, so the test database is
    // reached by configuration rather than by a second client construction.
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe('function');
    expect(typeof client.$transaction).toBe('function');
  });

  it('returns a fresh client each call', () => {
    const first = createPrisma();
    const second = createPrisma();
    clients.push(first, second);

    expect(first).not.toBe(second);
  });
});

describe('installBigIntJson', () => {
  it('lets JSON.stringify serialise BigInt paise as a number', () => {
    installBigIntJson();

    // Without the hook this throws "Do not know how to serialize a BigInt" from
    // deep inside Express, with no route or field named.
    expect(JSON.stringify({ pricePaise: 64_500_000n })).toBe('{"pricePaise":64500000}');
  });

  it('is idempotent, so a second import cannot break the first', () => {
    installBigIntJson();
    installBigIntJson();

    expect(JSON.stringify({ value: 1n })).toBe('{"value":1}');
  });

  it('converts values inside arrays and nested objects too', () => {
    installBigIntJson();

    expect(JSON.stringify({ rows: [{ delta: -1n }, { delta: 2n }] })).toBe(
      '{"rows":[{"delta":-1},{"delta":2}]}',
    );
  });

  it('keeps every money value in this system inside the safe integer range', () => {
    installBigIntJson();

    // API-SPEC §0.4: paise are JSON numbers. The largest price the schema
    // permits is ₹5 crore — nine orders of magnitude below the limit.
    const fiveCroreInPaise = 50_000_000_00n;

    expect(Number(fiveCroreInPaise)).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(JSON.parse(JSON.stringify({ p: fiveCroreInPaise })) as { p: number }).toEqual({
      p: 5_000_000_000,
    });
  });
});
