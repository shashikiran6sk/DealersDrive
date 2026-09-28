import {
  KM_PRESETS,
  type CarSuggestQuery,
  type CarSuggestResponse,
  PRICE_PRESETS,
  type DealerVehicleQuery,
  type PublicVehicleDetail,
  type PublicVehicleQuery,
  type PublicVehiclesResponse,
  type RangePreset,
  type VehicleFacets,
} from '@dealers-drive/contracts';
import type { Prisma } from '@prisma/client';

import { NotFoundError } from '../../platform/errors.js';
import {
  bodyTypeFacet,
  cityFacet,
  colorFacet,
  dealerFacet,
  fuelFacet,
  locationScope,
  modelFacet,
  oneDealerScope,
  ownerFacet,
  rangeFacets,
  textFacet,
  transmissionFacet,
  yearFacet,
  type LocationScope,
} from './search.facets.js';
import {
  inventoryWhere,
  listingWhere,
  needsVocabulary,
  orderOf,
  resolveFilters,
  vehicleWhere,
  type FilterKey,
  type ResolvedFilters,
  type VehicleFilterQuery,
} from './search.filters.js';
import { toPublicVehicleDetail, toVehicleCard } from './search.mapper.js';
import { DEALER_NOT_FOUND, SUGGEST_COUNT, VEHICLE_NOT_FOUND } from './search.messages.js';
import type { SearchRepository } from './search.repository.js';
import { rankSuggestions, suggestWhere } from './search.suggest.js';

export interface SearchDeps {
  repo: SearchRepository;
}

type RangeColumn = 'pricePaise' | 'kilometersDriven';

function withinPreset(
  where: Prisma.VehicleWhereInput,
  column: RangeColumn,
  preset: RangePreset,
): Prisma.VehicleWhereInput {
  const bounds = {
    ...(preset.min === null ? {} : { gte: preset.min }),
    ...(preset.max === null ? {} : { lte: preset.max }),
  };
  return { AND: [where, { [column]: bounds }] };
}

export function createSearchService({ repo }: SearchDeps) {
  async function facetsOf(
    query: VehicleFilterQuery,
    filters: ResolvedFilters,
    scope: LocationScope,
    location: { district?: string | undefined; city?: string[] | undefined } | null,
  ): Promise<VehicleFacets> {
    const within = (omit: readonly FilterKey[]): Prisma.VehicleWhereInput =>
      inventoryWhere(filters, scope.resultIds, omit);
    const presetCounts = (column: RangeColumn, key: FilterKey, presets: readonly RangePreset[]) =>
      Promise.all(
        presets.map((preset) => repo.countVehicles(withinPreset(within([key]), column, preset))),
      );

    const [
      brands,
      models,
      colors,
      fuels,
      transmissions,
      bodies,
      owners,
      years,
      perDealer,
      price,
      km,
    ] = await Promise.all([
      repo.byMake(within(['brand', 'model'])),
      query.brand || query.model ? repo.groupModels(within(['model'])) : Promise.resolve([]),
      repo.byColor(within(['color'])),
      repo.byFuel(within(['fuel'])),
      repo.byTransmission(within(['transmission'])),
      repo.byBodyType(within(['bodyType'])),
      repo.byOwners(within(['owners'])),
      repo.byYear(within(['year'])),
      location?.district
        ? repo.byDealer(inventoryWhere(filters, scope.scopeIds))
        : Promise.resolve([]),
      presetCounts('pricePaise', 'price', PRICE_PRESETS),
      presetCounts('kilometersDriven', 'km', KM_PRESETS),
    ]);

    const byDealer = new Map(perDealer.map((row) => [row.value, row.count]));
    const inDistrict = location !== null && Boolean(location.district);

    return {
      cities: inDistrict ? cityFacet(byDealer, scope, location?.city) : [],
      brands: textFacet(brands, query.brand),
      models: modelFacet(models, query.model),
      fuelTypes: fuelFacet(fuels, query.fuel),
      transmissions: transmissionFacet(transmissions, query.transmission),
      bodyTypes: bodyTypeFacet(bodies, query.bodyType),
      colors: colorFacet(colors),
      ownerCounts: ownerFacet(owners, query.owners),
      dealers: inDistrict
        ? dealerFacet(byDealer, scope, 'dealer' in query ? query.dealer : undefined)
        : [],
      years: yearFacet(years),
      price: rangeFacets(PRICE_PRESETS, price),
      kilometers: rangeFacets(KM_PRESETS, km),
    };
  }

  async function search(
    query: VehicleFilterQuery,
    scope: LocationScope,
    location: { district?: string | undefined; city?: string[] | undefined } | null,
  ): Promise<PublicVehiclesResponse> {
    const vocabulary = needsVocabulary(query) ? await repo.vocabulary() : null;
    const filters = resolveFilters(query, vocabulary);
    const where: Prisma.ListingWhereInput = {
      ...listingWhere(scope.resultIds),
      vehicle: { is: vehicleWhere(filters) },
    };
    const skip = (query.page - 1) * query.limit;

    const [rows, total, facets] = await Promise.all([
      repo.cards(where, orderOf(query.sort), skip, query.limit),
      repo.count(where),
      facetsOf(query, filters, scope, location),
    ]);

    return {
      data: rows.map(toVehicleCard),
      page: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
      facets,
    };
  }

  return {
    async vehicle(slug: string): Promise<PublicVehicleDetail> {
      const row = await repo.detail(slug);
      if (!row) throw new NotFoundError(VEHICLE_NOT_FOUND, { code: 'VEHICLE_NOT_FOUND' });
      return toPublicVehicleDetail(row);
    },

    async vehicles(query: PublicVehicleQuery): Promise<PublicVehiclesResponse> {
      const dealers = await repo.publicDealers();
      return search(query, locationScope(dealers, query), {
        district: query.district,
        city: query.city,
      });
    },

    async dealerVehicles(slug: string, query: DealerVehicleQuery): Promise<PublicVehiclesResponse> {
      const dealer = await repo.publicDealer(slug);
      if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND, { code: 'DEALER_NOT_FOUND' });
      return search(query, oneDealerScope(dealer), null);
    },

    async suggestCars(query: CarSuggestQuery): Promise<CarSuggestResponse> {
      const scope = locationScope(await repo.publicDealers(), query);
      const rows = await repo.suggestRows(suggestWhere(query.search, scope.resultIds));
      const { data, total } = rankSuggestions(rows, query.search, query.limit);
      return { search: query.search, data, countLabel: SUGGEST_COUNT(total) };
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
