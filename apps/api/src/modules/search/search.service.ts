import type { PublicVehicleQuery, PublicVehiclesResponse } from '@dealers-drive/contracts';

import { toVehicleCard } from './search.mapper.js';
import type { SearchRepository } from './search.repository.js';

export interface SearchDeps {
  repo: SearchRepository;
}

export function createSearchService({ repo }: SearchDeps) {
  return {
    async vehicles(query: PublicVehicleQuery): Promise<PublicVehiclesResponse> {
      const skip = (query.page - 1) * query.limit;
      const [rows, total] = await Promise.all([repo.cards(skip, query.limit), repo.count()]);

      return {
        data: rows.map(toVehicleCard),
        page: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
