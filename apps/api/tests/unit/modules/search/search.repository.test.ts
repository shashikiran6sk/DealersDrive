import { type VehicleQuery } from '@dealers-drive/contracts';
import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  createSearchRepository,
  type SearchRow,
} from '../../../../src/modules/search/search.repository.js';

/**
 * `listing_search` is the single visibility rule (ARCHITECTURE §11.1): only
 * APPROVED listings of ACTIVE dealers live here, and *every* public number in
 * the product — cars available, city counts, body-type tiles, facet counts,
 * "from ₹x" — is a `count(*)` over this table. So a row that should not be
 * public cannot leak into a number either, and the two things worth testing
 * hardest are:
 *
 *  · `index()` removes rather than writes for anything unpublishable, and
 *  · every filter reaches SQL as a **parameter**, never as interpolated text.
 *
 * The SQL is built with tagged templates, so the fake client below captures
 * the template pieces and re-runs `Prisma.sql` over them. That yields exactly
 * what Prisma would send: `.sql` with `?` placeholders and `.values`
 * alongside. Asserting on both is how the injection-safety claim is checked
 * rather than assumed.
 */

interface CapturedQuery {
  sql: string;
  values: unknown[];
}

function flatten(strings: TemplateStringsArray, values: unknown[]): CapturedQuery {
  const built = Prisma.sql(strings, ...values);
  return { sql: built.sql.replace(/\s+/g, ' ').trim(), values: built.values };
}

function fakePrisma(results: { queryRaw?: unknown[][]; listing?: unknown } = {}) {
  const queries: CapturedQuery[] = [];
  const executed: CapturedQuery[] = [];
  const pending = [...(results.queryRaw ?? [])];

  const prisma = {
    $queryRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push(flatten(strings, values));
      return Promise.resolve(pending.shift() ?? []);
    }),
    $executeRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      executed.push(flatten(strings, values));
      return Promise.resolve(1);
    }),
    listing: {
      findUnique: vi.fn(() => Promise.resolve(results.listing ?? null)),
      findMany: vi.fn(() => Promise.resolve([{ id: 'l1' }, { id: 'l2' }])),
    },
  } as unknown as PrismaClient & { $queryRaw: ReturnType<typeof vi.fn> };

  return { prisma, repo: createSearchRepository(prisma), queries, executed };
}

/**
 * Built directly rather than through `VehicleQuery.parse`, because the schema
 * takes CSV *strings* off the wire and this repository takes the parsed shape.
 * The defaults mirror the schema's own.
 */
function query(overrides: Partial<VehicleQuery> = {}): VehicleQuery {
  return { sort: 'relevance', page: 1, limit: 24, ...overrides };
}

/** Everything `index()` needs, publishable by default. */
function listingFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'listing-1',
    status: 'APPROVED',
    approvedAt: new Date('2026-03-01T00:00:00Z'),
    dealer: {
      id: 'dealer-1',
      status: 'ACTIVE',
      brandName: 'Sri Lakshmi Motors',
      slug: 'sri-lakshmi-motors',
      city: { slug: 'vellore', name: 'Vellore', lat: 12.9, lng: 79.1 },
    },
    vehicle: {
      id: 'vehicle-1',
      deletedAt: null,
      status: 'LIVE',
      slug: 'maruti-swift-vxi-2019-abc',
      pricePaise: 55_000_000n,
      kmDriven: 42_000,
      year: 2019,
      fuel: 'PETROL',
      transmission: 'MANUAL',
      bodyType: 'HATCHBACK',
      ownerNumber: 1,
      seats: 5,
      airbags: 2,
      features: ['abs', 'power-steering'],
      rtoCode: 'TN-23',
      primaryMediaId: 'media-2',
      make: { slug: 'maruti-suzuki', name: 'Maruti Suzuki' },
      model: { slug: 'swift', name: 'Swift' },
      variant: { slug: 'vxi', name: 'VXi' },
      color: { slug: 'pearl-white', family: 'white' },
      city: { slug: 'vellore', name: 'Vellore', lat: 12.9, lng: 79.1 },
      media: [
        { position: 0, media: { id: 'media-1', status: 'READY', blurhash: 'L1' } },
        { position: 1, media: { id: 'media-2', status: 'READY', blurhash: 'L2' } },
      ],
      ...(overrides.vehicle as Record<string, unknown> | undefined),
    },
    ...overrides,
  };
}

function searchRow(overrides: Partial<SearchRow> = {}): SearchRow {
  return {
    listing_id: 'l1',
    vehicle_id: 'v1',
    dealer_id: 'd1',
    dealer_name: 'Sri Lakshmi Motors',
    dealer_slug: 'sri-lakshmi-motors',
    dealer_initials: 'SL',
    make_slug: 'maruti-suzuki',
    model_slug: 'swift',
    variant_slug: 'vxi',
    make_name: 'Maruti Suzuki',
    model_name: 'Swift',
    variant_name: 'VXi',
    title: 'Maruti Suzuki Swift VXi',
    vehicle_slug: 'maruti-swift-vxi-2019-abc',
    year: 2019,
    price_paise: 55_000_000n,
    km: 42_000,
    fuel: 'PETROL',
    transmission: 'MANUAL',
    body_type: 'HATCHBACK',
    owner_number: 1,
    seats: 5,
    airbags: 2,
    color_slug: 'pearl-white',
    color_family: 'white',
    rto_code: 'TN-23',
    rto_state: 'TN',
    city_slug: 'vellore',
    city_name: 'Vellore',
    lat: 12.9,
    lng: 79.1,
    features: [],
    photo_count: 8,
    primary_media_id: 'media-1',
    primary_blurhash: 'L1',
    approved_at: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

describe('index', () => {
  it('writes a row for a publishable listing and reports true', async () => {
    const { repo, executed } = fakePrisma({ listing: listingFixture() });

    expect(await repo.index('listing-1')).toBe(true);
    expect(executed).toHaveLength(1);
    expect(executed[0]?.sql).toContain('INSERT INTO listing_search');
  });

  it('upserts, so re-indexing the same listing is idempotent', async () => {
    const { repo, executed } = fakePrisma({ listing: listingFixture() });

    await repo.index('listing-1');

    expect(executed[0]?.sql).toContain('ON CONFLICT (listing_id) DO UPDATE');
  });

  /**
   * The visibility rule, one condition at a time. Each of these is a way a
   * vehicle could become public that it must not: an unapproved listing, a
   * suspended dealership, a soft-deleted or sold car, or one still missing the
   * fields a card cannot render without.
   */
  it.each([
    ['the listing is not APPROVED', { status: 'PENDING_REVIEW' }],
    ['the listing was rejected', { status: 'REJECTED' }],
    [
      'the dealer is not ACTIVE',
      { dealer: { ...(listingFixture().dealer as object), status: 'SUSPENDED' } },
    ],
    ['the vehicle is soft-deleted', { vehicle: { deletedAt: new Date() } }],
    ['the vehicle is SOLD', { vehicle: { status: 'SOLD' } }],
    ['the vehicle has no slug', { vehicle: { slug: null } }],
    ['the vehicle has no price', { vehicle: { pricePaise: null } }],
    ['the vehicle has no odometer reading', { vehicle: { kmDriven: null } }],
  ])('removes rather than writes when %s', async (_reason, patch) => {
    const { repo, executed } = fakePrisma({ listing: listingFixture(patch) });

    expect(await repo.index('listing-1')).toBe(false);
    expect(executed).toHaveLength(1);
    expect(executed[0]?.sql).toContain('DELETE FROM listing_search');
  });

  it('removes when the listing no longer exists at all', async () => {
    const { repo, executed } = fakePrisma({ listing: null });

    expect(await repo.index('gone')).toBe(false);
    expect(executed[0]?.sql).toContain('DELETE FROM listing_search');
    expect(executed[0]?.values).toEqual(['gone']);
  });

  /** No city means no city facet, no city count and no "cars in Vellore" tile. */
  it('removes when neither the vehicle nor the dealer has a city', async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: {
        ...base,
        dealer: { ...(base.dealer as object), city: null },
        vehicle: { ...(base.vehicle as object), city: null },
      },
    });

    expect(await repo.index('listing-1')).toBe(false);
    expect(executed[0]?.sql).toContain('DELETE');
  });

  it("falls back to the dealer's city when the vehicle has none", async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: { ...base, vehicle: { ...(base.vehicle as object), city: null } },
    });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain('vellore');
    expect(executed[0]?.values).toContain('Vellore');
  });

  it('prefers the vehicle city over the dealer city', async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: {
        ...base,
        vehicle: {
          ...(base.vehicle as object),
          city: { slug: 'chennai', name: 'Chennai', lat: 13.08, lng: 80.27 },
        },
      },
    });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain('chennai');
    expect(executed[0]?.values).not.toContain('vellore');
  });

  it('counts only READY photos', async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: {
        ...base,
        vehicle: {
          ...(base.vehicle as object),
          primaryMediaId: null,
          media: [
            { position: 0, media: { id: 'm1', status: 'READY', blurhash: 'A' } },
            { position: 1, media: { id: 'm2', status: 'PROCESSING', blurhash: null } },
            { position: 2, media: { id: 'm3', status: 'FAILED', blurhash: null } },
          ],
        },
      },
    });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain(1);
  });

  it('uses the chosen primary photo when it is ready', async () => {
    const { repo, executed } = fakePrisma({ listing: listingFixture() });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain('media-2');
    expect(executed[0]?.values).toContain('L2');
  });

  /** A primary that failed processing must not leave the card with no image. */
  it('falls back to the first ready photo when the primary is not ready', async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: {
        ...base,
        vehicle: {
          ...(base.vehicle as object),
          primaryMediaId: 'media-9',
          media: [
            { position: 0, media: { id: 'media-1', status: 'READY', blurhash: 'L1' } },
            { position: 1, media: { id: 'media-9', status: 'FAILED', blurhash: null } },
          ],
        },
      },
    });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain('media-1');
  });

  it('writes nulls rather than failing when no photo is ready', async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: {
        ...base,
        vehicle: { ...(base.vehicle as object), primaryMediaId: null, media: [] },
      },
    });

    expect(await repo.index('listing-1')).toBe(true);
    expect(executed[0]?.values).toContain(0);
  });

  it('builds the title from make, model and variant', async () => {
    const { repo, executed } = fakePrisma({ listing: listingFixture() });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain('Maruti Suzuki Swift VXi');
  });

  it('omits a missing variant from the title rather than leaving a gap', async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: { ...base, vehicle: { ...(base.vehicle as object), variant: null } },
    });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain('Maruti Suzuki Swift');
  });

  it('derives the RTO state from the code', async () => {
    const { repo, executed } = fakePrisma({ listing: listingFixture() });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain('TN');
  });

  it('leaves the RTO state null when the vehicle has no code', async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: { ...base, vehicle: { ...(base.vehicle as object), rtoCode: null } },
    });

    await repo.index('listing-1');

    expect(executed[0]?.sql).toContain('INSERT');
  });

  it('defaults an unknown owner count to first-owner', async () => {
    const base = listingFixture();
    const { repo, executed } = fakePrisma({
      listing: { ...base, vehicle: { ...(base.vehicle as object), ownerNumber: null } },
    });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain(1);
  });

  it('stamps approvedAt with now when the listing carries none', async () => {
    const before = Date.now();
    const { repo, executed } = fakePrisma({ listing: listingFixture({ approvedAt: null }) });

    await repo.index('listing-1');

    const stamped = executed[0]?.values.find((value): value is Date => value instanceof Date);
    expect(stamped?.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('derives the dealer initials rather than storing a blank badge', async () => {
    const { repo, executed } = fakePrisma({ listing: listingFixture() });

    await repo.index('listing-1');

    expect(executed[0]?.values).toContain('SL');
  });

  it('runs inside the caller transaction when one is passed', async () => {
    const { repo } = fakePrisma({ listing: listingFixture() });
    const tx = {
      listing: { findUnique: vi.fn(() => Promise.resolve(listingFixture())) },
      $executeRaw: vi.fn(() => Promise.resolve(1)),
    };

    await repo.index('listing-1', tx as never);

    expect(tx.listing.findUnique).toHaveBeenCalledOnce();
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
  });

  it('never selects search_doc — the tsvector has no Prisma representation', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query());

    expect(queries[0]?.sql).not.toContain('search_doc,');
    expect(queries[0]?.sql).toContain('listing_id, vehicle_id, dealer_id');
  });
});

describe('remove', () => {
  it('deletes by listing id, as a parameter', async () => {
    const { repo, executed } = fakePrisma();

    await repo.remove('listing-1');

    expect(executed[0]?.sql).toBe('DELETE FROM listing_search WHERE listing_id = ?::uuid');
    expect(executed[0]?.values).toEqual(['listing-1']);
  });

  it('uses the transaction client when given one', async () => {
    const { repo } = fakePrisma();
    const tx = { $executeRaw: vi.fn(() => Promise.resolve(1)) };

    await repo.remove('listing-1', tx as never);

    expect(tx.$executeRaw).toHaveBeenCalledOnce();
  });
});

describe('removeByDealer', () => {
  /** Suspending a dealership pulls every one of its cars out of the catalogue at once. */
  it('deletes every row for one dealer and reports how many', async () => {
    const { repo, executed } = fakePrisma();

    expect(await repo.removeByDealer('dealer-1')).toBe(1);
    expect(executed[0]?.sql).toBe('DELETE FROM listing_search WHERE dealer_id = ?::uuid');
    expect(executed[0]?.values).toEqual(['dealer-1']);
  });

  it('uses the transaction client when given one', async () => {
    const { repo } = fakePrisma();
    const tx = { $executeRaw: vi.fn(() => Promise.resolve(4)) };

    expect(await repo.removeByDealer('dealer-1', tx as never)).toBe(4);
  });
});

describe('listListingIdsForDealer', () => {
  it('returns just the ids, scoped to that dealer', async () => {
    const { repo, prisma } = fakePrisma();

    expect(await repo.listListingIdsForDealer('dealer-1')).toEqual(['l1', 'l2']);
    expect(prisma.listing.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { dealerId: 'dealer-1' },
      select: { id: true },
    });
  });
});

describe('search', () => {
  it('runs one page query and one count query over the same WHERE', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[searchRow()], [{ count: 1n }]] });

    const result = await repo.search(query({ city: 'vellore' }));

    expect(result.total).toBe(1);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.sql).toContain('city_slug = ?');
    expect(queries[1]?.sql).toContain('city_slug = ?');
  });

  it('reports a total of zero when the count query returns nothing', async () => {
    const { repo } = fakePrisma({ queryRaw: [[], []] });

    expect((await repo.search(query())).total).toBe(0);
  });

  it('emits no WHERE at all for an unfiltered query', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query());

    expect(queries[0]?.sql).not.toContain('WHERE');
  });

  it('treats city=all as no city filter', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ city: 'all' }));

    expect(queries[0]?.sql).not.toContain('city_slug =');
  });

  it('paginates by page and limit', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ page: 3, limit: 24 }));

    expect(queries[0]?.values).toContain(24);
    expect(queries[0]?.values).toContain(48);
  });

  it('offsets to zero on the first page', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ page: 1, limit: 12 }));

    expect(queries[0]?.values.at(-1)).toBe(0);
  });

  /**
   * Free text is the one place a user's string reaches the database, so it is
   * the one place injection would land. It must arrive as a bound parameter.
   */
  it('binds free text as a parameter, never as SQL', async () => {
    const { repo, queries } = fakePrisma();
    const hostile = "'; DROP TABLE listing_search; --";

    await repo.search(query({ q: hostile }));

    expect(queries[0]?.values).toContain(hostile);
    expect(queries[0]?.sql).not.toContain('DROP TABLE');
  });

  it('pairs full-text search with a trigram fallback, so a typo still matches', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ q: 'fortunar' }));

    expect(queries[0]?.sql).toContain('websearch_to_tsquery');
    expect(queries[0]?.sql).toContain('similarity(');
  });

  it.each([
    ['make', { make: ['maruti-suzuki', 'hyundai'] }, 'make_slug = ANY'],
    ['model', { model: ['swift'] }, 'model_slug = ANY'],
    ['variant', { variant: ['vxi'] }, 'variant_slug = ANY'],
    ['owners', { owners: [1, 2] }, 'owner_number = ANY'],
    ['color', { color: ['white'] }, 'color_family = ANY'],
    ['dealer', { dealer: ['sri-lakshmi-motors'] }, 'dealer_slug = ANY'],
  ])('filters by %s with an array parameter', async (_name, patch, fragment) => {
    const { repo, queries } = fakePrisma();

    await repo.search(query(patch));

    expect(queries[0]?.sql).toContain(fragment);
  });

  it('ignores an empty multi-select rather than matching nothing', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ make: [], fuel: [], owners: [] }));

    expect(queries[0]?.sql).not.toContain('WHERE');
  });

  it.each([
    ['priceMin', { priceMin: 100 }, 'price_paise >='],
    ['priceMax', { priceMax: 900 }, 'price_paise <='],
    ['yearMin', { yearMin: 2015 }, 'year >='],
    ['yearMax', { yearMax: 2022 }, 'year <='],
    ['kmMax', { kmMax: 50_000 }, 'km <='],
    ['seats', { seats: 7 }, 'seats ='],
    ['airbagsMin', { airbagsMin: 4 }, 'airbags >='],
  ])('applies the %s range bound', async (_name, patch, fragment) => {
    const { repo, queries } = fakePrisma();

    await repo.search(query(patch));

    expect(queries[0]?.sql).toContain(fragment);
  });

  it('keeps a zero bound rather than treating it as absent', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ priceMin: 0, kmMax: 0 }));

    expect(queries[0]?.sql).toContain('price_paise >=');
    expect(queries[0]?.sql).toContain('km <=');
    expect(queries[0]?.values).toContain(0);
  });

  /** Stored values are enum-cased; a user's `?fuel=petrol` must still match. */
  it.each([
    ['fuel', { fuel: ['Petrol', 'DIESEL'] }, 'lower(fuel) = ANY'],
    ['transmission', { transmission: ['Automatic'] }, 'lower(transmission) = ANY'],
    ['bodyType', { bodyType: ['SUV'] }, 'lower(body_type) = ANY'],
  ])('lower-cases both sides of the %s filter', async (_name, patch, fragment) => {
    const { repo, queries } = fakePrisma();

    await repo.search(query(patch));

    expect(queries[0]?.sql).toContain(fragment);
    const arrays = queries[0]?.values.filter(Array.isArray) as string[][];
    expect(arrays.flat().every((value) => value === value.toLowerCase())).toBe(true);
  });

  it('upper-cases the RTO state and code, which are stored upper-case', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ rtoState: 'tn', rto: 'tn-23' }));

    expect(queries[0]?.values).toContain('TN');
    expect(queries[0]?.values).toContain('TN-23');
  });

  it('combines every clause with AND', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ city: 'vellore', yearMin: 2018, seats: 5 }));

    expect(queries[0]?.sql).toContain('AND');
    expect(queries[0]?.sql.match(/AND/g)).toHaveLength(2);
  });

  /**
   * A dealer portfolio page is scoped by the URL, not by a query parameter, so
   * a `?dealer=` on top of it must not widen the result back out to other
   * dealerships.
   */
  it('scopes to one dealer when the portfolio page asks', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query(), { dealerSlug: 'sri-lakshmi-motors' });

    expect(queries[0]?.sql).toContain('dealer_slug = ?');
    expect(queries[0]?.values[0]).toBe('sri-lakshmi-motors');
  });

  it('refuses to let a ?dealer= parameter widen a portfolio page', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ dealer: ['a-rival-dealer'] }), {
      dealerSlug: 'sri-lakshmi-motors',
    });

    expect(queries[0]?.sql).not.toContain('dealer_slug = ANY');
    expect(queries[0]?.values).not.toContain('a-rival-dealer');
  });

  it.each([
    ['price_asc', 'ORDER BY price_paise ASC, approved_at DESC'],
    ['price_desc', 'ORDER BY price_paise DESC, approved_at DESC'],
    ['year_desc', 'ORDER BY year DESC, approved_at DESC'],
    ['km_asc', 'ORDER BY km ASC, approved_at DESC'],
    ['newest', 'ORDER BY approved_at DESC'],
  ] as const)('sorts by %s', async (sort, fragment) => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ sort }));

    expect(queries[0]?.sql).toContain(fragment);
  });

  /** "Recommended": photographed first, then recent, then cheap. */
  it('ranks relevance by photo count, recency and price in that order', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query({ sort: 'relevance' }));

    expect(queries[0]?.sql).toContain(
      'ORDER BY (photo_count >= 6) DESC, approved_at DESC, price_paise ASC',
    );
  });

  it('defaults to relevance when no sort is given', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search(query());

    expect(queries[0]?.sql).toContain('photo_count >= 6');
  });

  it('falls back to newest for a sort outside the enum', async () => {
    const { repo, queries } = fakePrisma();

    await repo.search({ ...query(), sort: 'chaos' as VehicleQuery['sort'] });

    expect(queries[0]?.sql).toContain('ORDER BY approved_at DESC');
  });
});

describe('byIds', () => {
  it('short-circuits on an empty list rather than querying for nothing', async () => {
    const { repo, prisma } = fakePrisma();

    expect(await repo.byIds([])).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('fetches every id in one query', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[searchRow()]] });

    await repo.byIds(['v1', 'v2']);

    expect(queries[0]?.sql).toContain('vehicle_id = ANY(?::uuid[])');
    expect(queries[0]?.values).toEqual([['v1', 'v2']]);
  });

  /** Saved cars ask for ids that may since have been unpublished — a gap, not an error. */
  it('returns only the rows still in the catalogue', async () => {
    const { repo } = fakePrisma({ queryRaw: [[searchRow({ vehicle_id: 'v1' })]] });

    expect(await repo.byIds(['v1', 'v2'])).toHaveLength(1);
  });
});

describe('byVehicleId / byVehicleSlug', () => {
  it('returns the row when the vehicle is public', async () => {
    const { repo } = fakePrisma({ queryRaw: [[searchRow()]] });

    expect(await repo.byVehicleId('v1')).toMatchObject({ vehicle_id: 'v1' });
  });

  it('returns null rather than undefined when it is not', async () => {
    const { repo } = fakePrisma({ queryRaw: [[]] });

    expect(await repo.byVehicleId('v1')).toBeNull();
  });

  it('looks a slug up as a parameter and takes one row', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[searchRow()]] });

    await repo.byVehicleSlug('maruti-swift-vxi-2019-abc');

    expect(queries[0]?.sql).toContain('vehicle_slug = ? LIMIT 1');
    expect(queries[0]?.values).toEqual(['maruti-swift-vxi-2019-abc']);
  });

  it('returns null for an unknown slug', async () => {
    const { repo } = fakePrisma({ queryRaw: [[]] });

    expect(await repo.byVehicleSlug('nope')).toBeNull();
  });
});

describe('facetCounts', () => {
  /**
   * Standard facet semantics: a group is counted as if *its own* filter were
   * not applied. Without this, ticking "Petrol" would drop every other fuel's
   * count to zero and the checkbox could never be unticked meaningfully.
   */
  it.each([
    ['fuel', { fuel: ['petrol'] }, 'lower(fuel)'],
    ['body_type', { bodyType: ['suv'] }, 'lower(body_type)'],
    ['transmission', { transmission: ['manual'] }, 'lower(transmission)'],
    ['dealer_slug', { dealer: ['sri-lakshmi-motors'] }, 'dealer_slug = ANY'],
    ['owner_number', { owners: [1] }, 'owner_number = ANY'],
    ['color_family', { color: ['white'] }, 'color_family = ANY'],
    ['rto_state', { rtoState: 'TN' }, 'rto_state ='],
  ] as const)('counts %s ignoring its own filter', async (column, patch, fragment) => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.facetCounts(query(patch as Partial<VehicleQuery>), column);

    expect(queries[0]?.sql).not.toContain(fragment);
  });

  it('still applies the other filters', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.facetCounts(query({ fuel: ['petrol'], city: 'vellore' }), 'fuel');

    expect(queries[0]?.sql).toContain('city_slug =');
    expect(queries[0]?.sql).not.toContain('lower(fuel)');
  });

  it('groups by the column and returns numbers, not bigints', async () => {
    const { repo } = fakePrisma({
      queryRaw: [
        [
          { value: 'PETROL', count: 12n },
          { value: 'DIESEL', count: 3n },
        ],
      ],
    });

    expect(await repo.facetCounts(query(), 'fuel')).toEqual([
      { value: 'PETROL', count: 12 },
      { value: 'DIESEL', count: 3 },
    ]);
  });

  /** A "(none)" bucket is not a facet anyone can tick, so it is dropped. */
  it('drops the null bucket', async () => {
    const { repo } = fakePrisma({
      queryRaw: [
        [
          { value: null, count: 5n },
          { value: 'white', count: 2n },
        ],
      ],
    });

    expect(await repo.facetCounts(query(), 'color_family')).toEqual([{ value: 'white', count: 2 }]);
  });

  it('stays scoped to a dealer portfolio', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.facetCounts(query(), 'fuel', { dealerSlug: 'sri-lakshmi-motors' });

    expect(queries[0]?.values).toContain('sri-lakshmi-motors');
  });
});

describe('priceRange', () => {
  /** The slider's own bounds must not shrink as it is dragged. */
  it('ignores the price filter so the slider keeps its full range', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[{ min: 1n, max: 2n }]] });

    await repo.priceRange(query({ priceMin: 500, priceMax: 900, city: 'vellore' }));

    expect(queries[0]?.sql).not.toContain('price_paise >=');
    expect(queries[0]?.sql).not.toContain('price_paise <=');
    expect(queries[0]?.sql).toContain('city_slug =');
  });

  it('converts the bigint bounds to numbers', async () => {
    const { repo } = fakePrisma({
      queryRaw: [[{ min: 22_500_000n, max: 155_000_000n }]],
    });

    expect(await repo.priceRange(query())).toEqual({ min: 22_500_000, max: 155_000_000 });
  });

  it('reports zeroes rather than nulls for an empty catalogue', async () => {
    const { repo } = fakePrisma({ queryRaw: [[{ min: null, max: null }]] });

    expect(await repo.priceRange(query())).toEqual({ min: 0, max: 0 });
  });

  it('reports zeroes when the query returns no row at all', async () => {
    const { repo } = fakePrisma({ queryRaw: [[]] });

    expect(await repo.priceRange(query())).toEqual({ min: 0, max: 0 });
  });
});

describe('cityCounts', () => {
  it('returns one entry per city with a numeric count', async () => {
    const { repo } = fakePrisma({
      queryRaw: [
        [
          { city_slug: 'vellore', count: 18n },
          { city_slug: 'chennai', count: 4n },
        ],
      ],
    });

    expect(await repo.cityCounts()).toEqual([
      { city_slug: 'vellore', count: 18 },
      { city_slug: 'chennai', count: 4 },
    ]);
  });

  it('is empty for an empty catalogue', async () => {
    const { repo } = fakePrisma({ queryRaw: [[]] });

    expect(await repo.cityCounts()).toEqual([]);
  });
});

describe('bodyTypeCounts', () => {
  it('counts every city when none is given', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.bodyTypeCounts();

    expect(queries[0]?.sql).not.toContain('WHERE');
  });

  it('scopes to one city when given', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.bodyTypeCounts('vellore');

    expect(queries[0]?.sql).toContain('WHERE city_slug = ?');
    expect(queries[0]?.values).toEqual(['vellore']);
  });

  it('converts counts to numbers', async () => {
    const { repo } = fakePrisma({ queryRaw: [[{ body_type: 'SUV', count: 7n }]] });

    expect(await repo.bodyTypeCounts()).toEqual([{ body_type: 'SUV', count: 7 }]);
  });
});

describe('dealerStats', () => {
  it('reports a count and a "from" price per dealer', async () => {
    const { repo } = fakePrisma({
      queryRaw: [[{ dealer_slug: 'sri-lakshmi-motors', count: 18n, from_price: 22_500_000n }]],
    });

    expect(await repo.dealerStats()).toEqual([
      { dealer_slug: 'sri-lakshmi-motors', count: 18, from_price: 22_500_000n },
    ]);
  });

  /** Paise stay bigint here — the caller formats them, and precision matters. */
  it('leaves the from-price as a bigint', async () => {
    const { repo } = fakePrisma({
      queryRaw: [[{ dealer_slug: 'd', count: 1n, from_price: 22_500_000n }]],
    });

    expect(typeof (await repo.dealerStats())[0]?.from_price).toBe('bigint');
  });

  it('passes a null from-price through for a dealer with no live cars', async () => {
    const { repo } = fakePrisma({
      queryRaw: [[{ dealer_slug: 'd', count: 0n, from_price: null }]],
    });

    expect((await repo.dealerStats())[0]?.from_price).toBeNull();
  });
});

describe('totalCount', () => {
  it('counts the whole catalogue', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[{ count: 18n }]] });

    expect(await repo.totalCount()).toBe(18);
    expect(queries[0]?.sql).not.toContain('WHERE');
  });

  it('counts one city when given', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[{ count: 12n }]] });

    expect(await repo.totalCount('vellore')).toBe(12);
    expect(queries[0]?.values).toEqual(['vellore']);
  });

  it('is zero when the query returns no row', async () => {
    const { repo } = fakePrisma({ queryRaw: [[]] });

    expect(await repo.totalCount()).toBe(0);
  });
});

describe('similar', () => {
  it('scores body type, city and a ±25% price band', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.similar(searchRow({ price_paise: 100_000_000n }), 6);

    expect(queries[0]?.values).toContain(75_000_000);
    expect(queries[0]?.values).toContain(125_000_000);
    expect(queries[0]?.sql).toContain('ORDER BY score DESC');
  });

  it('excludes the vehicle being viewed', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.similar(searchRow({ vehicle_id: 'v1' }), 6);

    expect(queries[0]?.sql).toContain('WHERE vehicle_id <> ?');
    expect(queries[0]?.values).toContain('v1');
  });

  it('honours the limit', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.similar(searchRow(), 4);

    expect(queries[0]?.values.at(-1)).toBe(4);
  });

  it('rounds the price band to whole paise', async () => {
    const { repo, queries } = fakePrisma({ queryRaw: [[]] });

    await repo.similar(searchRow({ price_paise: 33_333_333n }), 6);

    const numbers = queries[0]?.values.filter(
      (value): value is number => typeof value === 'number',
    );
    expect(numbers?.every(Number.isInteger)).toBe(true);
  });
});
