import { describe, expect, it } from 'vitest';

import type { LocationsRepository } from '../../../../src/modules/locations/locations.repository.js';
import {
  createLocationsService,
  emptyIndex,
  type CityCountsPort,
} from '../../../../src/modules/locations/locations.service.js';

/**
 * Unit tests for `src/modules/locations/locations.service.ts`.
 *
 * ── Adapted from `tests/unit/modules/catalog/catalog.service.test.ts` ───────
 * The baseline's `describe('cities')` block, moved with the code it covers and
 * with the catalogue stubs dropped. The assertions are unchanged: what they
 * pin is that the counts are **live totals from `listing_search`** and never
 * stored or hard-coded (DESIGN-SPEC §4.11) — a stale count in the header is
 * the most visible kind of wrong.
 * ────────────────────────────────────────────────────────────────────────────
 */
function repo(overrides: Partial<LocationsRepository> = {}): LocationsRepository {
  return {
    cities: () =>
      Promise.resolve([
        {
          id: 'city-1',
          slug: 'vellore',
          name: 'Vellore',
          state: 'Tamil Nadu',
          lat: 12.9165,
          lng: 79.1325,
          isActive: true,
        },
        {
          id: 'city-2',
          slug: 'katpadi',
          name: 'Katpadi',
          state: 'Tamil Nadu',
          lat: 12.9698,
          lng: 79.1378,
          isActive: true,
        },
      ]),
    cityBySlug: () => Promise.resolve(null),
    ...overrides,
  };
}

function search(counts: { city_slug: string; count: number }[] = [], total = 0): CityCountsPort {
  return {
    cityCounts: () => Promise.resolve(counts),
    totalCount: () => Promise.resolve(total),
  };
}

describe('cities', () => {
  it('puts a live sitewide total first', async () => {
    const service = createLocationsService({
      repo: repo(),
      search: search([{ city_slug: 'vellore', count: 12 }], 18),
    });

    const response = await service.cities();

    expect(response.data[0]).toEqual({ slug: 'all', name: 'All of Tamil Nadu', count: 18 });
  });

  it('joins each city to its live count', async () => {
    const service = createLocationsService({
      repo: repo(),
      search: search(
        [
          { city_slug: 'vellore', count: 12 },
          { city_slug: 'katpadi', count: 6 },
        ],
        18,
      ),
    });

    const response = await service.cities();

    expect(response.data.slice(1)).toEqual([
      { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu', count: 12 },
      { slug: 'katpadi', name: 'Katpadi', state: 'Tamil Nadu', count: 6 },
    ]);
  });

  it('reports zero for a city with nothing live rather than dropping it', async () => {
    const service = createLocationsService({
      repo: repo(),
      search: search([{ city_slug: 'vellore', count: 12 }], 12),
    });

    const response = await service.cities();

    // §4.11: a zero-count option renders disabled rather than vanishing, so the
    // dealer network's coverage stays visible.
    expect(response.data.find((city) => city.slug === 'katpadi')?.count).toBe(0);
  });

  it('never invents a count for a city the index does not know', async () => {
    const service = createLocationsService({
      repo: repo(),
      search: search([{ city_slug: 'chennai', count: 99 }], 99),
    });

    const response = await service.cities();

    // The seed models the Vellore district only; a count for a city not in the
    // taxonomy must not leak into the dropdown.
    expect(response.data.map((city) => city.slug)).not.toContain('chennai');
  });

  it('defaults to Vellore', async () => {
    const service = createLocationsService({ repo: repo(), search: search() });

    expect((await service.cities()).default).toBe('vellore');
  });

  it('reports zeroes across the board on an empty catalogue', async () => {
    const service = createLocationsService({ repo: repo(), search: search([], 0) });

    const response = await service.cities();

    expect(response.data.every((city) => city.count === 0)).toBe(true);
  });
});

/**
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * `emptyIndex` is what the container passes until **F076** builds
 * `listing_search`. It is not a stub standing in for behaviour that exists
 * elsewhere: with no index there are no live listings, so zero is the true
 * answer. These two cases exist so that swapping it for the real
 * `SearchRepository` is a visible change rather than a silent one.
 * ────────────────────────────────────────────────────────────────────────────
 */
describe('the empty index, until F076', () => {
  it('answers zero for every count', async () => {
    expect(await emptyIndex.cityCounts()).toEqual([]);
    expect(await emptyIndex.totalCount()).toBe(0);
  });

  it('still lists every city, so the dropdown is complete before any listing exists', async () => {
    const response = await createLocationsService({ repo: repo(), search: emptyIndex }).cities();

    expect(response.data.map((city) => city.slug)).toEqual(['all', 'vellore', 'katpadi']);
    expect(response.data.every((city) => city.count === 0)).toBe(true);
  });
});
