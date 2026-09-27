import type {
  DealerVehicleQuery,
  PublicVehicleDetail,
  PublicVehicleQuery,
  PublicVehiclesResponse,
} from '@dealers-drive/contracts';

import { NotFoundError } from '../../platform/errors.js';
import { toPublicVehicleDetail, toVehicleCard } from './search.mapper.js';
import { DEALER_NOT_FOUND, VEHICLE_NOT_FOUND } from './search.messages.js';
import type { ListingScope, SearchRepository } from './search.repository.js';

export interface SearchDeps {
  repo: SearchRepository;
}

export function createSearchService({ repo }: SearchDeps) {
  async function page(
    query: { page: number; limit: number },
    scope: ListingScope,
  ): Promise<PublicVehiclesResponse> {
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      repo.cards(skip, query.limit, scope),
      repo.count(scope),
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

    async vehicles(query: PublicVehicleQuery): Promise<PublicVehiclesResponse> {
      const scope: ListingScope = query.district
        ? { districts: await repo.districtNames(query.district) }
        : {};
      return page(query, scope);
    },

    async dealerVehicles(slug: string, query: DealerVehicleQuery): Promise<PublicVehiclesResponse> {
      if (!(await repo.publicDealerExists(slug))) {
        throw new NotFoundError(DEALER_NOT_FOUND, { code: 'DEALER_NOT_FOUND' });
      }
      return page(query, { dealerSlug: slug });
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
