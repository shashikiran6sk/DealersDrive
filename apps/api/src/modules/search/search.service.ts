import {
  emiPaise,
  formatDate,
  formatKm,
  formatLakh,
  formatMonthYear,
  FUEL_LABELS,
  INSURANCE_LABELS,
  NEGOTIABILITY_LABELS,
  ownerLabel,
  TRANSMISSION_LABELS,
  type FacetOption,
  type FacetsResponse,
  type FuelType,
  type HomeResponse,
  type SimilarQuery,
  type Transmission,
  type VehicleBatchResponse,
  type VehicleCard,
  type VehicleDetail,
  type VehicleListResponse,
  type VehicleQuery,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import { NotFoundError } from '../../platform/errors.js';
import type { CatalogRepository } from '../catalog/catalog.facade.js';
import type { DealersRepository } from '../dealers/dealers.facade.js';
import type { VehiclesRepository } from '../vehicles/vehicles.facade.js';
import { mediaUrl, srcsetFor } from '../../platform/media/urls.js';
import { bodyTypeLabel, carCountLabel, toVehicleCard } from './search.mapper.js';
import type { FacetColumn, SearchRepository } from './search.repository.js';

export interface SearchDeps {
  repo: SearchRepository;
  catalog: CatalogRepository;
  dealers: DealersRepository;
  vehicles: VehiclesRepository;
}

const POPULAR_SEARCHES = [
  { label: 'Cars under ₹5L', href: '/cars?priceMax=500000' },
  { label: 'Cars under ₹10L', href: '/cars?priceMax=1000000' },
  { label: 'Automatic', href: '/cars?transmission=automatic' },
  { label: 'First owner', href: '/cars?owners=1' },
  { label: 'SUVs', href: '/cars?bodyType=suv' },
  { label: 'Hatchbacks', href: '/cars?bodyType=hatchback' },
];

export function createSearchService({ repo, catalog, dealers, vehicles }: SearchDeps) {
  async function list(
    query: VehicleQuery,
    options: { dealerSlug?: string } = {},
  ): Promise<{ data: VehicleCard[]; total: number; available: number }> {
    const { rows, total, available } = await repo.search(query, options);
    return { data: rows.map(toVehicleCard), total, available };
  }

  async function facets(
    query: VehicleQuery,
    options: { dealerSlug?: string } = {},
  ): Promise<FacetsResponse> {
    const [
      priceRange,
      fuelCounts,
      bodyCounts,
      transmissionCounts,
      dealerCounts,
      ownerCounts,
      colorCounts,
      rtoCounts,
      dealerRows,
      colorRows,
    ] = await Promise.all([
      repo.priceRange(query, options),
      count(repo, query, 'fuel', options),
      count(repo, query, 'body_type', options),
      count(repo, query, 'transmission', options),
      count(repo, query, 'dealer_slug', options),
      count(repo, query, 'owner_number', options),
      count(repo, query, 'color_family', options),
      count(repo, query, 'rto_state', options),
      dealers.listActive(),
      catalog.bundle().then((bundle) => bundle.colors),
    ]);

    // Every option is returned, including the zero counts. Hiding them makes
    // users think the filter is broken (§11.2, DESIGN-SPEC §2.4).
    const fuelOptions: FacetOption[] = (['PETROL', 'DIESEL', 'CNG'] as FuelType[]).map((value) => ({
      value: value.toLowerCase(),
      label: FUEL_LABELS[value],
      count: fuelCounts.get(value) ?? 0,
    }));

    const bodyOptions: FacetOption[] = ['HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'LUXURY'].map(
      (value) => ({
        value: value.toLowerCase(),
        label: bodyTypeLabel(value),
        count: bodyCounts.get(value) ?? 0,
      }),
    );

    const transmissionOptions: FacetOption[] = (['MANUAL', 'AUTOMATIC'] as Transmission[]).map(
      (value) => ({
        value: value.toLowerCase(),
        label: TRANSMISSION_LABELS[value],
        count: transmissionCounts.get(value) ?? 0,
      }),
    );

    const colorFamilies = [...new Set(colorRows.map((color) => color.family))];

    return {
      priceRange: {
        min: priceRange.min,
        max: priceRange.max,
        step: 50_000_00,
        minLabel: formatLakh(priceRange.min),
        maxLabel: formatLakh(priceRange.max),
      },
      fuel: fuelOptions,
      bodyType: bodyOptions,
      transmission: transmissionOptions,
      dealer: dealerRows.map((dealer) => ({
        value: dealer.slug,
        label: dealer.brandName,
        count: dealerCounts.get(dealer.slug) ?? 0,
      })),
      owners: [1, 2, 3].map((value) => ({
        value: String(value),
        label: ownerLabel(value),
        count: ownerCounts.get(String(value)) ?? 0,
      })),
      color: colorFamilies.map((family) => ({
        value: family,
        label: family.charAt(0).toUpperCase() + family.slice(1),
        count: colorCounts.get(family) ?? 0,
      })),
      rtoState: [{ value: 'TN', label: 'Tamil Nadu', count: rtoCounts.get('TN') ?? 0 }],
    };
  }

  return {
    list,
    facets,

    async home(citySlug?: string): Promise<HomeResponse> {
      const wanted = citySlug && citySlug !== 'all' ? citySlug : undefined;
      const city = wanted ? await catalog.cityBySlug(wanted) : null;
      const effectiveCity = city?.slug;

      const [total, featuredRows, bodyCounts, dealerRows, dealerStats] = await Promise.all([
        repo.totalCount(effectiveCity),
        repo.search(
          {
            ...emptyQuery(),
            ...(effectiveCity ? { city: effectiveCity } : {}),
            sort: 'relevance',
            limit: 4,
          },
          {},
        ),
        repo.bodyTypeCounts(effectiveCity),
        dealers.listActive(),
        repo.dealerStats(),
      ]);

      const byBody = new Map(bodyCounts.map((row) => [row.body_type, row.count]));
      const byDealer = new Map(dealerStats.map((row) => [row.dealer_slug, row]));

      return {
        city: city
          ? { slug: city.slug, name: city.name, state: city.state }
          : { slug: 'all', name: 'All of Tamil Nadu', state: 'Tamil Nadu' },
        activeCount: total,
        activeCountLabel: carCountLabel(total),
        popularSearches: POPULAR_SEARCHES,
        featured: featuredRows.rows.map(toVehicleCard),
        bodyTypes: ['HATCHBACK', 'SEDAN', 'SUV', 'MUV', 'LUXURY'].map((value) => ({
          slug: value.toLowerCase(),
          label: bodyTypeLabel(value),
          count: byBody.get(value) ?? 0,
        })),
        dealers: dealerRows.slice(0, 4).map((dealer) => ({
          slug: dealer.slug,
          brandName: dealer.brandName,
          initials: dealer.initials,
          city: dealer.cityName ?? '',
          yearsOperating: dealer.yearsOperating,
          carCount: byDealer.get(dealer.slug)?.count ?? 0,
          isVerified: true,
          logoUrl: null,
        })),
      };
    },

    async search(query: VehicleQuery, basePath = '/cars'): Promise<VehicleListResponse> {
      // `total` paginates (sold cars are on the last pages and must be
      // reachable); `available` is what the label counts. Using one number for
      // both would either hide sold cars or claim they are for sale.
      const { data, total, available } = await list(query);
      const totalPages = Math.ceil(total / query.limit);

      return {
        data,
        page: { page: query.page, limit: query.limit, total, totalPages },
        resultLabel: carCountLabel(available),
        appliedFilters: describeFilters(query, basePath),
        clearAllHref: query.city ? `${basePath}?city=${query.city}` : basePath,
      };
    },

    /** Hydrates saved-car ids held in the buyer's localStorage (A4). */
    async batch(ids: string[]): Promise<VehicleBatchResponse> {
      const rows = await repo.byIds(ids);
      const found = new Map(rows.map((row) => [row.vehicle_id, row]));

      const unavailable: VehicleBatchResponse['unavailable'] = [];
      for (const id of ids) {
        if (found.has(id)) continue;
        unavailable.push({ id, reason: await vehicles.unavailableReason(id) });
      }

      const data = ids
        .map((id) => found.get(id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map(toVehicleCard);

      return {
        data,
        unavailable,
        savedCountLabel: `${data.length} ${data.length === 1 ? 'car' : 'cars'} saved`,
      };
    },

    /**
     * A5. Returns 404 unless the listing is APPROVED and its dealer ACTIVE —
     * `listing_search` membership is the check, so there is one visibility rule
     * rather than one per endpoint.
     */
    async detail(idOrSlug: string): Promise<VehicleDetail> {
      const row =
        (await repo.byVehicleSlug(idOrSlug)) ??
        (isUuid(idOrSlug) ? await repo.byVehicleId(idOrSlug) : null);

      if (!row) throw new NotFoundError('That car is no longer listed.');

      const vehicle = await vehicles.findPublicById(row.vehicle_id);
      if (!vehicle) throw new NotFoundError('That car is no longer listed.');

      const dealerStats = await repo.dealerStats();
      const carCount = dealerStats.find((s) => s.dealer_slug === row.dealer_slug)?.count ?? 0;
      const price = Number(row.price_paise);

      const specs: VehicleDetail['specs'] = [
        { key: 'year', label: 'Year', value: String(vehicle.year) },
        { key: 'km', label: 'KM driven', value: formatKm(row.km) },
        { key: 'fuel', label: 'Fuel', value: FUEL_LABELS[vehicle.fuel] },
        {
          key: 'transmission',
          label: 'Transmission',
          value: TRANSMISSION_LABELS[vehicle.transmission],
        },
        { key: 'owners', label: 'Ownership', value: ownerLabel(vehicle.ownerNumber ?? 1) },
      ];

      if (vehicle.rtoCode) {
        const rto = await catalog.rtoByCode(vehicle.rtoCode);
        specs.push({
          key: 'registration',
          label: 'Registration',
          value: `${vehicle.rtoCode.replace('-', ' ')}${rto ? ` · ${rto.name}` : ''}`,
        });
      }
      if (vehicle.insuranceType) {
        const validity = vehicle.insuranceValidTill
          ? `, valid to ${formatMonthYear(vehicle.insuranceValidTill)}`
          : '';
        specs.push({
          key: 'insurance',
          label: 'Insurance',
          value: `${INSURANCE_LABELS[vehicle.insuranceType]}${validity}`,
        });
      }
      specs.push({ key: 'bodyType', label: 'Body type', value: bodyTypeLabel(row.body_type) });
      if (vehicle.color) {
        specs.push({ key: 'colour', label: 'Colour', value: vehicle.color.name });
      }

      const photos = vehicle.media
        .filter((entry) => entry.media.status === 'READY')
        .map((entry, index) => ({
          id: entry.media.id,
          position: entry.position,
          label:
            entry.media.fileName?.replace(/\.[a-z]+$/, '').replace(/-/g, ' ') ??
            `Photo ${index + 1}`,
          url: mediaUrl(entry.media.id, 1600),
          srcset: srcsetFor(entry.media.id),
          blurhash: entry.media.blurhash,
          width: entry.media.width,
          height: entry.media.height,
        }));

      const title = row.title;
      const summary = [
        ownerLabel(vehicle.ownerNumber ?? 1),
        `${row.city_name}, Tamil Nadu`,
        vehicle.rtoCode ? `${vehicle.rtoCode.replace('-', ' ')} registration` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      return {
        id: vehicle.id,
        slug: row.vehicle_slug,
        listingId: row.listing_id,
        year: vehicle.year,
        title,
        make: { slug: row.make_slug, name: row.make_name },
        model: { slug: row.model_slug, name: row.model_name },
        variant:
          row.variant_slug && row.variant_name
            ? { slug: row.variant_slug, name: row.variant_name }
            : null,
        summary,
        price: {
          pricePaise: price,
          priceLabel: formatLakh(price),
          emiLabel: `EMI from ₹${Math.round(emiPaise(price) / 100).toLocaleString('en-IN')}/month`,
          negotiable: vehicle.priceNegotiable,
          negotiableLabel: NEGOTIABILITY_LABELS[vehicle.priceNegotiable],
        },
        specs,
        features: vehicle.features,
        description: vehicle.description,
        photos,
        photoCount: photos.length,
        photoCountLabel: `${photos.length} photos · view all`,
        // No phone number. It appears in no public response body (§14.1).
        dealer: {
          slug: row.dealer_slug,
          brandName: row.dealer_name,
          initials: row.dealer_initials,
          city: row.city_name,
          carCount,
          carCountLabel: `${row.city_name} · ${carCount} ${carCount === 1 ? 'car' : 'cars'} listed`,
          isVerified: true,
          logoUrl: null,
        },
        seo: {
          canonical: `${env.WEB_BASE_URL}/car/${row.vehicle_slug}`,
          title: `${vehicle.year} ${title} in ${row.city_name} — ${formatLakh(price)} | Dealers-Drive`,
          description: `${ownerLabel(vehicle.ownerNumber ?? 1)}, ${formatKm(row.km)}, ${
            FUEL_LABELS[vehicle.fuel]
          }, ${TRANSMISSION_LABELS[vehicle.transmission]}. Listed by ${row.dealer_name}, a verified dealer in ${
            row.city_name
          }.`,
          isIndexable: true,
        },
      };
    },

    async similar(vehicleId: string, query: SimilarQuery): Promise<{ data: VehicleCard[] }> {
      const row = await repo.byVehicleId(vehicleId);
      if (!row) return { data: [] };
      const rows = await repo.similar(row, query.limit);
      return { data: rows.map(toVehicleCard) };
    },

    async dealerFacets(dealerSlug: string, query: VehicleQuery): Promise<FacetsResponse> {
      return facets(query, { dealerSlug });
    },

    async dealerVehicles(dealerSlug: string, query: VehicleQuery) {
      return list(query, { dealerSlug });
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;

async function count(
  repo: SearchRepository,
  query: VehicleQuery,
  column: FacetColumn,
  options: { dealerSlug?: string },
): Promise<Map<string, number>> {
  const rows = await repo.facetCounts(query, column, options);
  return new Map(rows.map((row) => [row.value, row.count]));
}

export function emptyQuery(): VehicleQuery {
  return { sort: 'relevance', page: 1, limit: 24 };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * The removable chips above the results grid. Each `removeHref` is the current
 * URL minus that one value, built server-side so the chip and the filter panel
 * cannot disagree about what "remove" means.
 */
function describeFilters(
  query: VehicleQuery,
  basePath: string,
): VehicleListResponse['appliedFilters'] {
  const chips: VehicleListResponse['appliedFilters'] = [];

  const params = new URLSearchParams();
  if (query.city) params.set('city', query.city);
  if (query.q) params.set('q', query.q);
  if (query.sort !== 'relevance') params.set('sort', query.sort);
  if (query.fuel?.length) params.set('fuel', query.fuel.join(','));
  if (query.bodyType?.length) params.set('bodyType', query.bodyType.join(','));
  if (query.transmission?.length) params.set('transmission', query.transmission.join(','));
  if (query.dealer?.length) params.set('dealer', query.dealer.join(','));
  if (query.priceMax !== undefined) params.set('priceMax', String(query.priceMax));

  const withoutValue = (key: string, value: string): string => {
    const next = new URLSearchParams(params);
    const current = (next.get(key) ?? '').split(',').filter((entry) => entry && entry !== value);
    if (current.length > 0) next.set(key, current.join(','));
    else next.delete(key);
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const withoutKey = (key: string): string => {
    const next = new URLSearchParams(params);
    next.delete(key);
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  for (const value of query.fuel ?? []) {
    chips.push({
      key: 'fuel',
      value,
      label: FUEL_LABELS[value.toUpperCase() as FuelType] ?? value,
      removeHref: withoutValue('fuel', value),
    });
  }
  for (const value of query.bodyType ?? []) {
    chips.push({
      key: 'bodyType',
      value,
      label: bodyTypeLabel(value.toUpperCase()),
      removeHref: withoutValue('bodyType', value),
    });
  }
  for (const value of query.transmission ?? []) {
    chips.push({
      key: 'transmission',
      value,
      label: TRANSMISSION_LABELS[value.toUpperCase() as Transmission] ?? value,
      removeHref: withoutValue('transmission', value),
    });
  }
  for (const value of query.dealer ?? []) {
    chips.push({
      key: 'dealer',
      value,
      label: value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      removeHref: withoutValue('dealer', value),
    });
  }
  if (query.priceMax !== undefined) {
    chips.push({
      key: 'priceMax',
      value: String(query.priceMax),
      label: `Up to ${formatLakh(query.priceMax)}`,
      removeHref: withoutKey('priceMax'),
    });
  }
  if (query.q) {
    chips.push({ key: 'q', value: query.q, label: `“${query.q}”`, removeHref: withoutKey('q') });
  }

  return chips;
}

export { formatDate };
