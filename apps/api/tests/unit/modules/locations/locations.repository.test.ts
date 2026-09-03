import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createLocationsRepository } from '../../../../src/modules/locations/locations.repository.js';

/**
 * Unit tests for `src/modules/locations/locations.repository.ts`.
 *
 * ── Adapted from `tests/unit/modules/catalog/catalog.repository.test.ts` ────
 * The two city methods, moved with the code. The query shapes are asserted
 * directly rather than inferred from a seeded row, because `isActive` is the
 * whole of the retire-a-city mechanism: a city dropped from the filter has to
 * disappear from the picker without its slug 404-ing for anyone holding a
 * bookmark, and only the `where` clause says which of those two happens.
 * ────────────────────────────────────────────────────────────────────────────
 */
interface Call {
  model: string;
  method: string;
  args: Record<string, unknown>;
}

function fakePrisma(results: Record<string, unknown> = {}) {
  const calls: Call[] = [];

  const client = new Proxy(
    {},
    {
      get: (_client, model: string) =>
        new Proxy(
          {},
          {
            get:
              (_model, method: string) =>
              (args: Record<string, unknown> = {}) => {
                calls.push({ model, method, args });
                return Promise.resolve(results[`${model}.${method}`] ?? null);
              },
          },
        ),
    },
  ) as unknown as PrismaClient;

  return { prisma: client, calls };
}

describe('cities', () => {
  it('lists only active cities, alphabetically', async () => {
    const { prisma, calls } = fakePrisma({ 'city.findMany': [] });

    await createLocationsRepository(prisma).cities();

    expect(calls[0]).toMatchObject({
      model: 'city',
      method: 'findMany',
      args: { where: { isActive: true }, orderBy: { name: 'asc' } },
    });
  });

  it('orders by name, not by insertion — the picker is read top to bottom', async () => {
    const { prisma, calls } = fakePrisma({ 'city.findMany': [] });

    await createLocationsRepository(prisma).cities();

    expect(calls[0]?.args.orderBy).toEqual({ name: 'asc' });
  });
});

describe('cityBySlug', () => {
  /**
   * Deliberately **not** filtered by `isActive`. Retiring a city must not break
   * a dealer profile or a bookmarked search that already names it; it removes
   * the city from the picker, which is `cities()` above.
   */
  it('resolves a slug whether or not the city is still listed', async () => {
    const { prisma, calls } = fakePrisma();

    await createLocationsRepository(prisma).cityBySlug('vellore');

    expect(calls[0]).toMatchObject({
      model: 'city',
      method: 'findUnique',
      args: { where: { slug: 'vellore' } },
    });
    expect(calls[0]?.args.where).not.toHaveProperty('isActive');
  });
});
