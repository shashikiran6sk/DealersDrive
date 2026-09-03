import type { CitiesResponse } from '@dealers-drive/contracts';

import type { LocationsRepository } from './locations.repository.js';

/**
 * The slice of `SearchRepository` this service needs.
 *
 * Named as a port rather than imported from `modules/search` on purpose: the
 * counts come from `listing_search`, which is **F076**, and stating the two
 * methods here is what lets this feature land ahead of it. `SearchRepository`
 * satisfies this shape structurally, so F076 swaps the implementation in the
 * container and changes nothing else.
 */
export interface CityCountsPort {
  cityCounts(): Promise<{ city_slug: string; count: number }[]>;
  totalCount(): Promise<number>;
}

/**
 * An index that does not exist yet answers zero — which is the true answer, not
 * a placeholder: with no `listing_search` table there are no live listings to
 * count. Replaced by the real `SearchRepository` at **F076**.
 */
export const emptyIndex: CityCountsPort = {
  cityCounts: () => Promise.resolve([]),
  totalCount: () => Promise.resolve(0),
};

export interface LocationsDeps {
  repo: LocationsRepository;
  search: CityCountsPort;
}

export function createLocationsService({ repo, search }: LocationsDeps) {
  return {
    /**
     * The header's city dropdown. Counts are live `APPROVED` totals from
     * `listing_search` — never stored, never hard-coded (DESIGN-SPEC §4.11).
     */
    async cities(): Promise<CitiesResponse> {
      const [cities, counts, total] = await Promise.all([
        repo.cities(),
        search.cityCounts(),
        search.totalCount(),
      ]);

      const byCity = new Map(counts.map((row) => [row.city_slug, row.count]));

      return {
        data: [
          { slug: 'all', name: 'All of Tamil Nadu', count: total },
          ...cities.map((city) => ({
            slug: city.slug,
            name: city.name,
            state: city.state,
            count: byCity.get(city.slug) ?? 0,
          })),
        ],
        default: 'vellore',
      };
    },
  };
}

export type LocationsService = ReturnType<typeof createLocationsService>;
