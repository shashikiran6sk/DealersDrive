import {
  BODY_TYPE_LABELS,
  FUEL_LABELS,
  INSURANCE_LABELS,
  ownerLabel,
  TRANSMISSION_LABELS,
  type BodyType,
  type CatalogBundle,
  type CitiesResponse,
  type FuelType,
  type InsuranceType,
  type PublicConfig,
  type Transmission,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import type { SearchRepository } from '../search/search.facade.js';
import type { CatalogRepository } from './catalog.repository.js';

export interface CatalogDeps {
  repo: CatalogRepository;
  search: SearchRepository;
  config: PlatformConfigService;
}

export function createCatalogService({ repo, search, config }: CatalogDeps) {
  return {
    async bundle(): Promise<CatalogBundle> {
      const { makes, cities, rto, colors } = await repo.bundle();

      return {
        version: new Date().toISOString().slice(0, 13) + ':00:00.000Z',
        makes: makes.map((make) => ({
          id: make.id,
          slug: make.slug,
          name: make.name,
          popularity: make.popularity,
          models: make.models.map((model) => ({
            id: model.id,
            slug: model.slug,
            name: model.name,
            bodyType: model.bodyType,
            yearFrom: model.yearFrom,
            yearTo: model.yearTo,
            variants: model.variants.map((variant) => ({
              id: variant.id,
              slug: variant.slug,
              name: variant.name,
              fuel: variant.fuel,
              transmission: variant.transmission,
              engineCc: variant.engineCc,
              seats: variant.seats,
            })),
          })),
        })),
        cities: cities.map((city) => ({
          id: city.id,
          slug: city.slug,
          name: city.name,
          state: city.state,
        })),
        rto: rto.map((row) => ({
          code: row.code,
          name: row.name,
          city: row.city,
          state: row.state,
        })),
        colors: colors.map((color) => ({
          id: color.id,
          slug: color.slug,
          name: color.name,
          hex: color.hex,
          family: color.family,
        })),
        fuels: (Object.keys(FUEL_LABELS) as FuelType[]).map((value) => ({
          value,
          label: FUEL_LABELS[value],
        })),
        transmissions: (Object.keys(TRANSMISSION_LABELS) as Transmission[]).map((value) => ({
          value,
          label: TRANSMISSION_LABELS[value],
        })),
        bodyTypes: (Object.keys(BODY_TYPE_LABELS) as BodyType[]).map((value) => ({
          value,
          label: BODY_TYPE_LABELS[value],
        })),
        insuranceTypes: (Object.keys(INSURANCE_LABELS) as InsuranceType[]).map((value) => ({
          value,
          label: INSURANCE_LABELS[value],
        })),
        owners: [1, 2, 3].map((value) => ({ value, label: ownerLabel(value) })),
        features: await repo.knownFeatures(),
      };
    },

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

    async publicConfig(): Promise<PublicConfig> {
      const [minPhotos, durationDays, enquiryRate, photoRequests] = await Promise.all([
        config.number('listing.minPhotos'),
        config.number('listing.durationDays'),
        config.number('enquiry.rateLimitPerHour'),
        config.boolean('photoRequests.enabled'),
      ]);

      return {
        mediaBaseUrl: env.MEDIA_BASE_URL,
        captchaSiteKey: null,
        supportEmail: env.SUPPORT_EMAIL,
        supportPhone: env.SUPPORT_PHONE,
        minPhotosPerListing: minPhotos,
        listingDurationDays: durationDays,
        enquiryRateLimitPerHour: enquiryRate,
        photoRequestsEnabled: photoRequests,
      };
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
