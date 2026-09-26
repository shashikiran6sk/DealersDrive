import type {
  PublicVehicleDetail,
  PublicVehicleQuery,
  PublicVehiclesResponse,
} from '@dealers-drive/contracts';

import { NotFoundError } from '../../platform/errors.js';
import { toPublicVehicleDetail, toVehicleCard } from './search.mapper.js';
import { VEHICLE_NOT_FOUND } from './search.messages.js';
import type { SearchRepository } from './search.repository.js';

export interface SearchDeps {
  repo: SearchRepository;
}

export function createSearchService({ repo }: SearchDeps) {
  return {
    async vehicle(slug: string): Promise<PublicVehicleDetail> {
      const row = await repo.detail(slug);
      if (!row) throw new NotFoundError(VEHICLE_NOT_FOUND, { code: 'VEHICLE_NOT_FOUND' });
      return toPublicVehicleDetail(row);
    },

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
