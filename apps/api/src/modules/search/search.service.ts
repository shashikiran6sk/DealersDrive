import type {
  PublicVehicleDetail,
  PublicVehicleQuery,
  PublicVehiclesResponse,
} from '@dealers-drive/contracts';

import { NotFoundError } from '../../platform/errors.js';
import { toPublicVehicleDetail, toVehicleCard } from './search.mapper.js';
import { DEALER_NOT_FOUND, VEHICLE_NOT_FOUND } from './search.messages.js';
import type { SearchRepository } from './search.repository.js';

export interface SearchDeps {
  repo: SearchRepository;
}

export function createSearchService({ repo }: SearchDeps) {
  async function page(
    query: PublicVehicleQuery,
    dealerSlug?: string,
  ): Promise<PublicVehiclesResponse> {
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      repo.cards(skip, query.limit, dealerSlug),
      repo.count(dealerSlug),
    ]);

    return {
      data: rows.map(toVehicleCard),
      page: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  return {
    async vehicle(slug: string): Promise<PublicVehicleDetail> {
      const row = await repo.detail(slug);
      if (!row) throw new NotFoundError(VEHICLE_NOT_FOUND, { code: 'VEHICLE_NOT_FOUND' });
      return toPublicVehicleDetail(row);
    },

    vehicles(query: PublicVehicleQuery): Promise<PublicVehiclesResponse> {
      return page(query);
    },

    async dealerVehicles(slug: string, query: PublicVehicleQuery): Promise<PublicVehiclesResponse> {
      if (!(await repo.publicDealerExists(slug))) {
        throw new NotFoundError(DEALER_NOT_FOUND, { code: 'DEALER_NOT_FOUND' });
      }
      return page(query, slug);
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
