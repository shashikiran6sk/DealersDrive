import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  FEATURE_TAXONOMY,
  createCatalogRepository,
} from '../../../../src/modules/catalog/catalog.repository.js';

/**
 * Unit tests for `src/modules/catalog/catalog.repository.ts`.
 *
 * §6.2: dealers never free-type make, model, variant, colour or RTO, because if
 * they did, search, filters and SEO would all die at once. What that means for
 * this file is that the *query shapes* are load-bearing — the ordering decides
 * what a dealer sees first in a dropdown, and the `isActive` filter decides
 * whether a retired city can still be chosen. Those are asserted here by
 * capturing the arguments; the data itself is the seed's job.
 */
interface Call {
  model: string;
  method: string;
  args: Record<string, unknown> | undefined;
}

function fakePrisma(results: Record<string, unknown> = {}) {
  const calls: Call[] = [];

  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => (args: Record<string, unknown> | undefined) => {
          calls.push({ model: name, method, args });
          return Promise.resolve(results[`${name}.${method}`] ?? []);
        },
      },
    );

  const prisma = new Proxy(
    {},
    { get: (_target, name: string) => model(name) },
  ) as unknown as PrismaClient;

  return { prisma, calls };
}

describe('bundle', () => {
  it('orders makes by popularity, then alphabetically', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).bundle();
    const makes = calls.find((call) => call.model === 'make');

    // Popularity first is what puts Maruti Suzuki and Hyundai at the top of the
    // dropdown; the alphabetical tiebreak keeps the rest stable between requests.
    expect(makes?.args?.orderBy).toEqual([{ popularity: 'desc' }, { name: 'asc' }]);
  });

  it('includes models alphabetically, and counts variants rather than joining them', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).bundle();
    const makes = calls.find((call) => call.model === 'make');

    // Joining ~2,000 variants here would be ~400KB of JSON on the response
    // whose other job is to render a filter panel fast. The count is what the
    // bundle carries; `variantsForModel` fetches the rows for one model.
    expect(makes?.args?.include).toEqual({
      models: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { variants: true } } },
      },
    });
  });

  it('offers only active cities', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).bundle();
    const cities = calls.find((call) => call.model === 'city');

    // A retired city must stop being selectable without deleting the rows that
    // existing listings point at.
    expect(cities?.args?.where).toEqual({ isActive: true });
    expect(cities?.args?.orderBy).toEqual({ name: 'asc' });
  });

  it('orders RTO codes by code and colours by their curated sort order', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).bundle();

    expect(calls.find((call) => call.model === 'rto')?.args?.orderBy).toEqual({ code: 'asc' });
    // Colours are ordered by hand — white and silver first, because that is what
    // most cars are.
    expect(calls.find((call) => call.model === 'color')?.args?.orderBy).toEqual({
      sortOrder: 'asc',
    });
  });

  it('fetches the four taxonomies concurrently', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).bundle();

    // One round trip's latency rather than four: this is the request every page
    // of the wizard waits on.
    expect(calls.map((call) => call.model)).toEqual(['make', 'city', 'rto', 'color']);
  });

  it('returns the four collections under stable keys', async () => {
    const { prisma } = fakePrisma({
      'make.findMany': [{ id: 'make-1' }],
      'city.findMany': [{ id: 'city-1' }],
      'rto.findMany': [{ code: 'TN-23' }],
      'color.findMany': [{ id: 'color-1' }],
    });

    const bundle = await createCatalogRepository(prisma).bundle();

    expect(Object.keys(bundle).sort()).toEqual(['cities', 'colors', 'makes', 'rto']);
  });
});

describe('cities', () => {
  it('lists active cities alphabetically', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).cities();

    expect(calls[0]).toMatchObject({
      model: 'city',
      method: 'findMany',
      args: { where: { isActive: true }, orderBy: { name: 'asc' } },
    });
  });
});

describe('the single-row lookups', () => {
  it('finds a city by its slug, because that is what the URL carries', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).cityBySlug('vellore');

    expect(calls[0]).toMatchObject({
      model: 'city',
      method: 'findUnique',
      args: { where: { slug: 'vellore' } },
    });
  });

  it('finds a make, variant and colour by id', async () => {
    const { prisma, calls } = fakePrisma();
    const repo = createCatalogRepository(prisma);

    await repo.makeById('make-1');
    await repo.variantById('variant-1');
    await repo.colorById('color-1');

    expect(calls.map((call) => [call.model, call.args])).toEqual([
      ['make', { where: { id: 'make-1' } }],
      ['variant', { where: { id: 'variant-1' } }],
      ['color', { where: { id: 'color-1' } }],
    ]);
  });

  it('includes the make when looking up a model', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).modelById('model-1');

    // The make travels with the model because a model on its own cannot be
    // validated — a real model id filed under the wrong make is the failure
    // §6.2 is about.
    expect(calls[0]?.args).toEqual({ where: { id: 'model-1' }, include: { make: true } });
  });

  it('finds an RTO by its code', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).rtoByCode('TN-23');

    expect(calls[0]).toMatchObject({ model: 'rto', args: { where: { code: 'TN-23' } } });
  });
});

describe('knownFeatures', () => {
  it('returns the taxonomy', async () => {
    const { prisma } = fakePrisma();

    expect(await createCatalogRepository(prisma).knownFeatures()).toEqual(FEATURE_TAXONOMY);
  });

  it('does not query the database for it', async () => {
    const { prisma, calls } = fakePrisma();

    await createCatalogRepository(prisma).knownFeatures();

    expect(calls).toEqual([]);
  });
});

describe('FEATURE_TAXONOMY', () => {
  it('has no duplicates', () => {
    expect(new Set(FEATURE_TAXONOMY).size).toBe(FEATURE_TAXONOMY.length);
  });

  it('is written the way it is displayed', () => {
    for (const feature of FEATURE_TAXONOMY) {
      // These strings are rendered verbatim on the vehicle page, so they are
      // sentence case and never enum-shaped.
      expect(feature).not.toContain('_');
      expect(feature.trim()).toBe(feature);
      expect(feature.length).toBeGreaterThan(2);
    }
  });

  it('covers the features buyers filter and sort on', () => {
    for (const expected of ['Sunroof', 'Reverse camera', 'Alloy wheels']) {
      expect(FEATURE_TAXONOMY).toContain(expected);
    }
  });
});
