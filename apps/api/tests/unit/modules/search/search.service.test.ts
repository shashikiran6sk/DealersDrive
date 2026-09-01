import { describe, expect, it } from 'vitest';

import type { VehicleQuery } from '@dealers-drive/contracts';

import { env } from '../../../../src/config/env.js';
import type { CatalogRepository } from '../../../../src/modules/catalog/catalog.facade.js';
import type { DealersRepository } from '../../../../src/modules/dealers/dealers.facade.js';
import { createSearchService, emptyQuery } from '../../../../src/modules/search/search.service.js';
import type {
  SearchRepository,
  SearchRow,
} from '../../../../src/modules/search/search.repository.js';
import type { VehiclesRepository } from '../../../../src/modules/vehicles/vehicles.facade.js';
import { NotFoundError } from '../../../../src/platform/errors.js';

/**
 * Unit tests for `src/modules/search/search.service.ts`.
 *
 * Two rules from the specs drive most of what is asserted here.
 *
 * **Every facet option is returned, including the zero counts** (§11.2,
 * DESIGN-SPEC §2.4) — hiding them makes a user think the filter is broken. The
 * integration suite checks the counts add up; it cannot easily check that an
 * option with no matches is still present, because a seeded catalogue tends to
 * have at least one of everything.
 *
 * **The removable chips are built server-side** so the chip and the filter panel
 * cannot disagree about what "remove" means. Each `removeHref` is the current URL
 * minus exactly one value, which is fiddly enough to deserve its own tests.
 */
function row(overrides: Partial<SearchRow> = {}): SearchRow {
  return {
    vehicle_id: '11111111-0000-4000-8000-000000000000',
    listing_id: '99999999-0000-4000-8000-000000000000',
    vehicle_slug: '2021-maruti-suzuki-alto-800-vxi-vellore-111111',
    year: 2021,
    title: 'Maruti Suzuki Alto 800 VXI',
    price_paise: 64_500_000n,
    km: 42_180,
    fuel: 'PETROL',
    transmission: 'MANUAL',
    body_type: 'HATCHBACK',
    city_slug: 'vellore',
    city_name: 'Vellore',
    make_slug: 'maruti-suzuki',
    make_name: 'Maruti Suzuki',
    model_slug: 'alto-800',
    model_name: 'Alto 800',
    variant_slug: 'vxi',
    variant_name: 'VXI',
    dealer_slug: 'sri-lakshmi-motors',
    dealer_name: 'Sri Lakshmi Motors',
    dealer_initials: 'SL',
    primary_media_id: '22222222-0000-4000-8000-000000000000',
    primary_blurhash: 'L6PZ',
    photo_count: 8,
    ...overrides,
  } as SearchRow;
}

function vehicleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-0000-4000-8000-000000000000',
    year: 2021,
    fuel: 'PETROL',
    transmission: 'MANUAL',
    ownerNumber: 1,
    rtoCode: null,
    insuranceType: null,
    insuranceValidTill: null,
    color: null,
    priceNegotiable: 'SLIGHTLY',
    features: ['Sunroof'],
    description: 'Single owner, service records available.',
    media: [],
    ...overrides,
  };
}

interface Options {
  rows?: SearchRow[];
  total?: number;
  /**
   * Available cars, which is what the result label counts. Defaults to `total`
   * because most cases have no sold rows; the two diverge only when they do.
   */
  available?: number;
  facetCounts?: Record<string, { value: string; count: number }[]>;
  priceRange?: { min: number; max: number };
  bodyTypeCounts?: { body_type: string; count: number }[];
  dealerStats?: { dealer_slug: string; count: number }[];
  activeDealers?: Record<string, unknown>[];
  colors?: { family: string }[];
  city?: Record<string, unknown> | null;
  byIds?: SearchRow[];
  bySlug?: SearchRow | null;
  byId?: SearchRow | null;
  similarRows?: SearchRow[];
  vehicle?: Record<string, unknown> | null;
  unavailableReason?: string;
  rto?: { name: string } | null;
}

function setup(options: Options = {}) {
  const searchCalls: { query: VehicleQuery; options: { dealerSlug?: string } }[] = [];
  const facetCalls: { column: string; options: { dealerSlug?: string } }[] = [];

  const repo = {
    search: (query: VehicleQuery, opts: { dealerSlug?: string }) => {
      searchCalls.push({ query, options: opts });
      return Promise.resolve({
        rows: options.rows ?? [],
        total: options.total ?? 0,
        available: options.available ?? options.total ?? 0,
      });
    },
    facetCounts: (_query: VehicleQuery, column: string, opts: { dealerSlug?: string }) => {
      facetCalls.push({ column, options: opts });
      return Promise.resolve(options.facetCounts?.[column] ?? []);
    },
    priceRange: () => Promise.resolve(options.priceRange ?? { min: 0, max: 0 }),
    totalCount: () => Promise.resolve(options.total ?? 0),
    bodyTypeCounts: () => Promise.resolve(options.bodyTypeCounts ?? []),
    dealerStats: () => Promise.resolve(options.dealerStats ?? []),
    cityCounts: () => Promise.resolve([]),
    byIds: () => Promise.resolve(options.byIds ?? []),
    byVehicleSlug: () => Promise.resolve(options.bySlug ?? null),
    byVehicleId: () => Promise.resolve(options.byId ?? null),
    similar: () => Promise.resolve(options.similarRows ?? []),
  } as unknown as SearchRepository;

  const catalog = {
    cityBySlug: () => Promise.resolve(options.city ?? null),
    bundle: () => Promise.resolve({ colors: options.colors ?? [], makes: [], cities: [], rto: [] }),
    rtoByCode: () => Promise.resolve(options.rto ?? null),
  } as unknown as CatalogRepository;

  const dealers = {
    listActive: () => Promise.resolve(options.activeDealers ?? []),
  } as unknown as DealersRepository;

  const vehicles = {
    findPublicById: () => Promise.resolve(options.vehicle ?? null),
    unavailableReason: () => Promise.resolve(options.unavailableReason ?? 'NOT_FOUND'),
  } as unknown as VehiclesRepository;

  return {
    service: createSearchService({ repo, catalog, dealers, vehicles }),
    searchCalls,
    facetCalls,
  };
}

const query = (overrides: Partial<VehicleQuery> = {}): VehicleQuery => ({
  ...emptyQuery(),
  ...overrides,
});

describe('emptyQuery', () => {
  it('is relevance-sorted, page one, 24 per page', () => {
    expect(emptyQuery()).toEqual({ sort: 'relevance', page: 1, limit: 24 });
  });
});

describe('search', () => {
  it('maps rows to cards and reports the page', async () => {
    const h = setup({ rows: [row(), row({ vehicle_id: 'b' })], total: 30 });

    const response = await h.service.search(query({ page: 2, limit: 24 }));

    expect(response.data).toHaveLength(2);
    expect(response.page).toEqual({ page: 2, limit: 24, total: 30, totalPages: 2 });
  });

  it('rounds the page count up, so the last partial page is reachable', async () => {
    const h = setup({ total: 25 });

    expect((await h.service.search(query({ limit: 24 }))).page.totalPages).toBe(2);
  });

  it('reports zero pages on an empty result set', async () => {
    const h = setup({ total: 0 });

    expect((await h.service.search(query())).page.totalPages).toBe(0);
  });

  it('labels the result count', async () => {
    const one = setup({ total: 1 });
    const many = setup({ total: 18 });

    expect((await one.service.search(query())).resultLabel).toBe('1 car available');
    expect((await many.service.search(query())).resultLabel).toBe('18 cars available');
  });

  it('counts the label on available cars, but paginates over the sold ones too', async () => {
    // 18 rows come back, 15 of them buyable. Saying "18 cars available" would
    // advertise three cars nobody can buy; paginating over 15 would make the
    // sold ones — which sort last — unreachable. The two numbers are different
    // questions and the response answers both.
    const h = setup({ total: 18, available: 15 });

    const response = await h.service.search(query({ limit: 6 }));

    expect(response.resultLabel).toBe('15 cars available');
    expect(response.page.total).toBe(18);
    expect(response.page.totalPages).toBe(3);
  });

  it('clears back to the city, not to nothing, when a city is selected', async () => {
    const h = setup();

    // Clearing filters must not silently move the buyer to another city's results.
    expect((await h.service.search(query({ city: 'vellore' }))).clearAllHref).toBe(
      '/cars?city=vellore',
    );
    expect((await h.service.search(query())).clearAllHref).toBe('/cars');
  });

  it('takes a different base path for the dealer portfolio', async () => {
    const h = setup();

    const response = await h.service.search(query({ city: 'vellore' }), '/dealers/x');

    expect(response.clearAllHref).toBe('/dealers/x?city=vellore');
  });

  describe('the applied-filter chips', () => {
    it('has none when nothing is filtered', async () => {
      const h = setup();

      expect((await h.service.search(query())).appliedFilters).toEqual([]);
    });

    it('labels a fuel chip and removes just that value', async () => {
      const h = setup();

      const chips = (await h.service.search(query({ fuel: ['petrol', 'diesel'] }))).appliedFilters;

      expect(chips.map((chip) => chip.label)).toEqual(['Petrol', 'Diesel']);
      expect(chips[0]?.removeHref).toBe('/cars?fuel=diesel');
      expect(chips[1]?.removeHref).toBe('/cars?fuel=petrol');
    });

    it('drops the parameter entirely when the last value is removed', async () => {
      const h = setup();

      const chips = (await h.service.search(query({ fuel: ['petrol'] }))).appliedFilters;

      expect(chips[0]?.removeHref).toBe('/cars');
    });

    it('keeps the other filters in a removeHref', async () => {
      const h = setup();

      const chips = (
        await h.service.search(query({ city: 'vellore', fuel: ['petrol'], bodyType: ['suv'] }))
      ).appliedFilters;
      const fuelChip = chips.find((chip) => chip.key === 'fuel');

      // Removing "Petrol" must not also drop the city or the body type.
      expect(fuelChip?.removeHref).toContain('city=vellore');
      expect(fuelChip?.removeHref).toContain('bodyType=suv');
      expect(fuelChip?.removeHref).not.toContain('fuel=');
    });

    it('labels body type, transmission and dealer chips readably', async () => {
      const h = setup();

      const chips = (
        await h.service.search(
          query({
            bodyType: ['suv'],
            transmission: ['automatic'],
            dealer: ['sri-lakshmi-motors'],
          }),
        )
      ).appliedFilters;

      expect(chips.map((chip) => chip.label)).toEqual(['SUV', 'Automatic', 'Sri Lakshmi Motors']);
    });

    it('formats a price ceiling as a Lakh figure', async () => {
      const h = setup();

      const chips = (await h.service.search(query({ priceMax: 50_000_000 }))).appliedFilters;

      expect(chips[0]).toMatchObject({ key: 'priceMax', label: 'Up to ₹5.00 Lakh' });
      expect(chips[0]?.removeHref).toBe('/cars');
    });

    it('quotes a text search', async () => {
      const h = setup();

      const chips = (await h.service.search(query({ q: 'alto' }))).appliedFilters;

      expect(chips[0]).toMatchObject({ key: 'q', value: 'alto', label: '“alto”' });
    });

    it('keeps a non-default sort in the remove links', async () => {
      const h = setup();

      const chips = (await h.service.search(query({ sort: 'price_asc', fuel: ['petrol'] })))
        .appliedFilters;

      // Removing a filter must not also reset the sort order.
      expect(chips[0]?.removeHref).toContain('sort=price_asc');
    });

    it('leaves the default sort out of the URL', async () => {
      const h = setup();

      const chips = (await h.service.search(query({ fuel: ['petrol'] }))).appliedFilters;

      expect(chips[0]?.removeHref).not.toContain('sort=');
    });

    it('falls back to the raw value for an unrecognised fuel', async () => {
      const h = setup();

      const chips = (await h.service.search(query({ fuel: ['hydrogen'] }))).appliedFilters;

      expect(chips[0]?.label).toBe('hydrogen');
    });
  });
});

describe('facets', () => {
  it('returns every fuel, body type and transmission option, zeroes included', async () => {
    const h = setup({ facetCounts: { fuel: [{ value: 'PETROL', count: 12 }] } });

    const facets = await h.service.facets(query());

    // §11.2: hiding a zero-count option makes the filter look broken. It renders
    // disabled instead.
    expect(facets.fuel.map((option) => option.value)).toEqual(['petrol', 'diesel', 'cng']);
    expect(facets.fuel.map((option) => option.count)).toEqual([12, 0, 0]);
    expect(facets.bodyType).toHaveLength(5);
    expect(facets.transmission.map((option) => option.value)).toEqual(['manual', 'automatic']);
  });

  it('lowercases the option values, because that is what the query string carries', async () => {
    const h = setup();

    const facets = await h.service.facets(query());

    for (const option of [...facets.fuel, ...facets.bodyType, ...facets.transmission]) {
      expect(option.value).toBe(option.value.toLowerCase());
    }
  });

  it('labels the price range at both ends and steps in half-Lakh', async () => {
    const h = setup({ priceRange: { min: 22_500_000, max: 159_000_000 } });

    const facets = await h.service.facets(query());

    expect(facets.priceRange).toEqual({
      min: 22_500_000,
      max: 159_000_000,
      step: 5_000_000,
      minLabel: '₹2.25 Lakh',
      maxLabel: '₹15.90 Lakh',
    });
  });

  it('lists every active dealer with its count', async () => {
    const h = setup({
      activeDealers: [
        { slug: 'sri-lakshmi-motors', brandName: 'Sri Lakshmi Motors' },
        { slug: 'velavan-cars', brandName: 'Velavan Cars' },
      ],
      facetCounts: { dealer_slug: [{ value: 'sri-lakshmi-motors', count: 4 }] },
    });

    const facets = await h.service.facets(query());

    expect(facets.dealer).toEqual([
      { value: 'sri-lakshmi-motors', label: 'Sri Lakshmi Motors', count: 4 },
      { value: 'velavan-cars', label: 'Velavan Cars', count: 0 },
    ]);
  });

  it('offers owner counts one to three', async () => {
    const h = setup({ facetCounts: { owner_number: [{ value: '1', count: 9 }] } });

    const facets = await h.service.facets(query());

    expect(facets.owners.map((option) => option.value)).toEqual(['1', '2', '3']);
    expect(facets.owners[0]?.count).toBe(9);
  });

  it('derives colour families from the catalogue, deduplicated', async () => {
    const h = setup({
      colors: [{ family: 'white' }, { family: 'silver' }, { family: 'white' }],
      facetCounts: { color_family: [{ value: 'white', count: 5 }] },
    });

    const facets = await h.service.facets(query());

    expect(facets.color.map((option) => option.value)).toEqual(['white', 'silver']);
    expect(facets.color[0]).toEqual({ value: 'white', label: 'White', count: 5 });
  });

  it('reports Tamil Nadu as the only registration state', async () => {
    const h = setup({ facetCounts: { rto_state: [{ value: 'TN', count: 18 }] } });

    const facets = await h.service.facets(query());

    expect(facets.rtoState).toEqual([{ value: 'TN', label: 'Tamil Nadu', count: 18 }]);
  });

  it('scopes every count to the dealer when one is given', async () => {
    const h = setup();

    await h.service.dealerFacets('sri-lakshmi-motors', query());

    // Otherwise a dealer's own portfolio filters would show the whole
    // marketplace's counts.
    expect(h.facetCalls.every((call) => call.options.dealerSlug === 'sri-lakshmi-motors')).toBe(
      true,
    );
    expect(h.facetCalls.map((call) => call.column)).toEqual([
      'fuel',
      'body_type',
      'transmission',
      'dealer_slug',
      'owner_number',
      'color_family',
      'rto_state',
    ]);
  });

  it('leaves the dealer scope off for a marketplace-wide request', async () => {
    const h = setup();

    await h.service.facets(query());

    expect(h.facetCalls.every((call) => call.options.dealerSlug === undefined)).toBe(true);
  });
});

describe('home', () => {
  it('reports the selected city and its live count', async () => {
    const h = setup({
      city: { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu' },
      total: 12,
    });

    const home = await h.service.home('vellore');

    expect(home.city).toEqual({ slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu' });
    expect(home.activeCount).toBe(12);
    expect(home.activeCountLabel).toBe('12 cars available');
  });

  it('treats "all" as the whole state without looking up a city', async () => {
    const h = setup({ total: 18 });

    const home = await h.service.home('all');

    expect(home.city).toEqual({ slug: 'all', name: 'All of Tamil Nadu', state: 'Tamil Nadu' });
  });

  it('treats no city the same way', async () => {
    const h = setup({ total: 18 });

    expect((await h.service.home()).city.slug).toBe('all');
  });

  it('falls back to the whole state for a city that does not exist', async () => {
    const h = setup({ city: null, total: 18 });

    // The seed models the Vellore district only, so `?city=chennai` is a real
    // request that must render a page rather than 404.
    const home = await h.service.home('chennai');

    expect(home.city.slug).toBe('all');
  });

  it('asks for exactly four featured cars', async () => {
    const h = setup({ city: { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu' } });

    await h.service.home('vellore');

    expect(h.searchCalls[0]?.query).toMatchObject({ limit: 4, sort: 'relevance', city: 'vellore' });
  });

  it('carries the popular searches', async () => {
    const h = setup();

    const home = await h.service.home();

    expect(home.popularSearches.length).toBeGreaterThan(3);
    for (const entry of home.popularSearches) {
      expect(entry.href.startsWith('/cars')).toBe(true);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('gives every body-type tile a live count', async () => {
    const h = setup({ bodyTypeCounts: [{ body_type: 'SUV', count: 5 }] });

    const home = await h.service.home();

    expect(home.bodyTypes.map((tile) => tile.slug)).toEqual([
      'hatchback',
      'sedan',
      'suv',
      'muv',
      'luxury',
    ]);
    expect(home.bodyTypes.find((tile) => tile.slug === 'suv')?.count).toBe(5);
    expect(home.bodyTypes.find((tile) => tile.slug === 'muv')?.count).toBe(0);
  });

  it('shows at most four dealers, with their live car counts', async () => {
    const h = setup({
      activeDealers: Array.from({ length: 6 }, (_, index) => ({
        slug: `dealer-${index}`,
        brandName: `Dealer ${index}`,
        initials: `D${index}`,
        cityName: 'Vellore',
        yearsOperating: 5,
      })),
      dealerStats: [{ dealer_slug: 'dealer-0', count: 7 }],
    });

    const home = await h.service.home();

    expect(home.dealers).toHaveLength(4);
    expect(home.dealers[0]).toMatchObject({ slug: 'dealer-0', carCount: 7, isVerified: true });
    expect(home.dealers[1]?.carCount).toBe(0);
  });

  it('renders a dealer with no city as an empty string rather than "null"', async () => {
    const h = setup({
      activeDealers: [
        { slug: 'd', brandName: 'D', initials: 'D', cityName: null, yearsOperating: 1 },
      ],
    });

    expect((await h.service.home()).dealers[0]?.city).toBe('');
  });
});

describe('batch', () => {
  it('hydrates the ids it found, in the order they were asked for', async () => {
    const h = setup({
      byIds: [row({ vehicle_id: 'b' }), row({ vehicle_id: 'a' })],
    });

    const response = await h.service.batch(['a', 'b']);

    // The buyer's saved list has an order; the index does not preserve it.
    expect(response.data.map((card) => card.id)).toEqual(['a', 'b']);
  });

  it('explains each id that has left the catalogue', async () => {
    const h = setup({ byIds: [row({ vehicle_id: 'a' })], unavailableReason: 'SOLD' });

    const response = await h.service.batch(['a', 'gone']);

    // A4: a car that has left must never 404 the whole batch.
    expect(response.data).toHaveLength(1);
    expect(response.unavailable).toEqual([{ id: 'gone', reason: 'SOLD' }]);
  });

  it('labels the saved count, singular and plural', async () => {
    const one = setup({ byIds: [row({ vehicle_id: 'a' })] });
    const none = setup({ byIds: [] });

    expect((await one.service.batch(['a'])).savedCountLabel).toBe('1 car saved');
    expect((await none.service.batch([])).savedCountLabel).toBe('0 cars saved');
  });

  it('handles an empty request', async () => {
    const h = setup();

    expect(await h.service.batch([])).toEqual({
      data: [],
      unavailable: [],
      savedCountLabel: '0 cars saved',
    });
  });
});

describe('detail', () => {
  const detailRow = row();

  it('resolves by slug', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow() });

    const detail = await h.service.detail(detailRow.vehicle_slug);

    expect(detail.slug).toBe(detailRow.vehicle_slug);
    expect(detail.listingId).toBe('99999999-0000-4000-8000-000000000000');
  });

  it('falls back to a uuid lookup', async () => {
    const h = setup({ bySlug: null, byId: detailRow, vehicle: vehicleRow() });

    await expect(h.service.detail('11111111-0000-4000-8000-000000000000')).resolves.toMatchObject({
      id: '11111111-0000-4000-8000-000000000000',
    });
  });

  it('does not try a uuid lookup for something that is not a uuid', async () => {
    const h = setup({ bySlug: null, byId: detailRow, vehicle: vehicleRow() });

    // A stale slug must 404 rather than accidentally matching by id.
    await expect(h.service.detail('an-old-slug')).rejects.toThrow(NotFoundError);
  });

  it('404s a car that is not in the index', async () => {
    const h = setup({ bySlug: null, byId: null });

    // A5: `listing_search` membership is the visibility check, so there is one
    // rule rather than one per endpoint.
    await expect(h.service.detail('anything')).rejects.toThrow(/no longer listed/);
  });

  it('404s when the index has a row but the vehicle has gone', async () => {
    const h = setup({ bySlug: detailRow, vehicle: null });

    await expect(h.service.detail('x')).rejects.toThrow(NotFoundError);
  });

  it('builds the specification table in a fixed order', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow() });

    const detail = await h.service.detail('x');

    expect(detail.specs.map((spec) => spec.key)).toEqual([
      'year',
      'km',
      'fuel',
      'transmission',
      'owners',
      'bodyType',
    ]);
  });

  it('adds registration when the car has an RTO code, naming the office', async () => {
    const h = setup({
      bySlug: detailRow,
      vehicle: vehicleRow({ rtoCode: 'TN-23' }),
      rto: { name: 'Vellore RTO' },
    });

    const detail = await h.service.detail('x');
    const registration = detail.specs.find((spec) => spec.key === 'registration');

    expect(registration?.value).toBe('TN 23 · Vellore RTO');
  });

  it('still shows the code when the RTO is unknown', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow({ rtoCode: 'TN-99' }), rto: null });

    expect(
      (await h.service.detail('x')).specs.find((spec) => spec.key === 'registration')?.value,
    ).toBe('TN 99');
  });

  it('adds insurance with its validity when there is one', async () => {
    const h = setup({
      bySlug: detailRow,
      vehicle: vehicleRow({
        insuranceType: 'COMPREHENSIVE',
        insuranceValidTill: new Date('2027-03-01T00:00:00.000Z'),
      }),
    });

    const insurance = (await h.service.detail('x')).specs.find((spec) => spec.key === 'insurance');

    expect(insurance?.value).toContain('Comprehensive');
    expect(insurance?.value).toContain('valid to Mar 2027');
  });

  it('omits the validity when the expiry is unknown', async () => {
    const h = setup({
      bySlug: detailRow,
      vehicle: vehicleRow({ insuranceType: 'THIRD_PARTY', insuranceValidTill: null }),
    });

    const insurance = (await h.service.detail('x')).specs.find((spec) => spec.key === 'insurance');

    expect(insurance?.value).not.toContain('valid to');
  });

  it('adds the colour when the car has one', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow({ color: { name: 'Pearl White' } }) });

    expect((await h.service.detail('x')).specs.find((spec) => spec.key === 'colour')?.value).toBe(
      'Pearl White',
    );
  });

  it('shows only processed photos', async () => {
    const h = setup({
      bySlug: detailRow,
      vehicle: vehicleRow({
        media: [
          {
            position: 0,
            media: {
              id: 'm1',
              status: 'READY',
              fileName: 'front-left.jpg',
              blurhash: 'L6',
              width: 1600,
              height: 1200,
            },
          },
          { position: 1, media: { id: 'm2', status: 'PENDING', fileName: null } },
        ],
      }),
    });

    const detail = await h.service.detail('x');

    // A pending upload would render as a broken image in the gallery.
    expect(detail.photos).toHaveLength(1);
    expect(detail.photoCount).toBe(1);
    expect(detail.photoCountLabel).toBe('1 photos · view all');
  });

  it('turns a file name into a readable photo label', async () => {
    const h = setup({
      bySlug: detailRow,
      vehicle: vehicleRow({
        media: [
          { position: 0, media: { id: 'm1', status: 'READY', fileName: 'front-left-corner.jpg' } },
        ],
      }),
    });

    expect((await h.service.detail('x')).photos[0]?.label).toBe('front left corner');
  });

  it('numbers a photo that has no file name', async () => {
    const h = setup({
      bySlug: detailRow,
      vehicle: vehicleRow({
        media: [{ position: 0, media: { id: 'm1', status: 'READY', fileName: null } }],
      }),
    });

    expect((await h.service.detail('x')).photos[0]?.label).toBe('Photo 1');
  });

  it('prices the car with a label and an EMI line', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow() });

    const detail = await h.service.detail('x');

    expect(detail.price.pricePaise).toBe(64_500_000);
    expect(detail.price.priceLabel).toBe('₹6.45 Lakh');
    expect(detail.price.emiLabel).toMatch(/^EMI from ₹[\d,]+\/month$/);
    expect(detail.price.negotiable).toBe('SLIGHTLY');
    expect(detail.price.negotiableLabel).toBe('Slightly negotiable');
  });

  it('labels a fixed price with the reassurance the spec asks for', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow({ priceNegotiable: 'FIXED' }) });

    // "Fixed price" alone reads as a refusal to talk; the spec's wording answers
    // the question the buyer is actually asking.
    expect((await h.service.detail('x')).price.negotiableLabel).toBe(
      'Fixed price, no hidden charges',
    );
  });

  it('summarises ownership, city and registration in one line', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow({ rtoCode: 'TN-23' }) });

    expect((await h.service.detail('x')).summary).toBe(
      'First owner · Vellore, Tamil Nadu · TN 23 registration',
    );
  });

  it('leaves registration out of the summary when there is none', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow() });

    const summary = (await h.service.detail('x')).summary;

    expect(summary).toBe('First owner · Vellore, Tamil Nadu');
    expect(summary).not.toContain('· ·');
  });

  it('reports a null variant rather than a half-populated object', async () => {
    const h = setup({
      bySlug: row({ variant_slug: null, variant_name: null }),
      vehicle: vehicleRow(),
    });

    expect((await h.service.detail('x')).variant).toBeNull();
  });

  it('never includes the dealer’s phone number', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow() });

    const detail = await h.service.detail('x');

    // §14.1 and rule 7: the number appears in no public response body. Scanning
    // the whole payload catches a leak in a field nobody thought to assert on.
    expect(JSON.stringify(detail)).not.toMatch(/\b[6-9]\d{9}\b/);
    expect(detail.dealer).not.toHaveProperty('contactPhone');
  });

  it('counts the dealer’s other cars', async () => {
    const h = setup({
      bySlug: detailRow,
      vehicle: vehicleRow(),
      dealerStats: [{ dealer_slug: 'sri-lakshmi-motors', count: 7 }],
    });

    const detail = await h.service.detail('x');

    expect(detail.dealer.carCount).toBe(7);
    expect(detail.dealer.carCountLabel).toBe('Vellore · 7 cars listed');
  });

  it('pluralises a single-car dealer correctly', async () => {
    const h = setup({
      bySlug: detailRow,
      vehicle: vehicleRow(),
      dealerStats: [{ dealer_slug: 'sri-lakshmi-motors', count: 1 }],
    });

    expect((await h.service.detail('x')).dealer.carCountLabel).toBe('Vellore · 1 car listed');
  });

  it('builds a canonical URL and an indexable SEO block', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow() });

    const detail = await h.service.detail('x');

    expect(detail.seo.canonical).toBe(`${env.WEB_BASE_URL}/car/${detailRow.vehicle_slug}`);
    expect(detail.seo.title).toContain('2021 Maruti Suzuki Alto 800 VXI in Vellore');
    expect(detail.seo.title).toContain('₹6.45 Lakh');
    expect(detail.seo.description).toContain('verified dealer in Vellore');
    expect(detail.seo.isIndexable).toBe(true);
  });

  it('treats a missing owner number as first owner', async () => {
    const h = setup({ bySlug: detailRow, vehicle: vehicleRow({ ownerNumber: null }) });

    expect((await h.service.detail('x')).specs.find((spec) => spec.key === 'owners')?.value).toBe(
      'First owner',
    );
  });
});

describe('similar', () => {
  it('returns cards for cars like this one', async () => {
    const h = setup({ byId: row(), similarRows: [row({ vehicle_id: 'other' })] });

    const response = await h.service.similar('11111111-0000-4000-8000-000000000000', { limit: 4 });

    expect(response.data.map((card) => card.id)).toEqual(['other']);
  });

  it('returns nothing, rather than throwing, for a car that has left', async () => {
    const h = setup({ byId: null });

    // The similar strip is decoration on a page that already rendered; a 404 here
    // would take the whole page down.
    expect(await h.service.similar('gone', { limit: 4 })).toEqual({ data: [] });
  });
});

describe('the dealer-scoped variants', () => {
  it('passes the dealer slug through to the query', async () => {
    const h = setup({ rows: [row()], total: 1 });

    await h.service.dealerVehicles('sri-lakshmi-motors', query());

    expect(h.searchCalls[0]?.options).toEqual({ dealerSlug: 'sri-lakshmi-motors' });
  });

  it('returns the same card shape as the public search', async () => {
    const h = setup({ rows: [row()], total: 1 });

    const response = await h.service.dealerVehicles('sri-lakshmi-motors', query());

    expect(response.total).toBe(1);
    expect(response.data[0]?.id).toBe('11111111-0000-4000-8000-000000000000');
  });
});
