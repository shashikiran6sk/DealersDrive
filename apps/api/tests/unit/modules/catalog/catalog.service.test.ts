import { describe, expect, it } from 'vitest';

import {
  BODY_TYPE_LABELS,
  FUEL_LABELS,
  INSURANCE_LABELS,
  TRANSMISSION_LABELS,
} from '@dealers-drive/contracts';

import { env } from '../../../../src/config/env.js';
import { createCatalogService } from '../../../../src/modules/catalog/catalog.service.js';
import type { CatalogRepository } from '../../../../src/modules/catalog/catalog.repository.js';
import type { SearchRepository } from '../../../../src/modules/search/search.facade.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';

/**
 * Unit tests for `src/modules/catalog/catalog.service.ts`.
 *
 * Two things here are worth pinning independently of the database. The city
 * counts must be **live totals from `listing_search`** and never stored or
 * hard-coded (DESIGN-SPEC §4.11) — a stale count in the header is the most
 * visible kind of wrong. And the bundle has to carry every enum the wizard
 * renders, because a dealer cannot free-type any of them (§6.2): a missing fuel
 * type is a car that cannot be listed.
 */
function repo(overrides: Partial<CatalogRepository> = {}): CatalogRepository {
  return {
    bundle: () =>
      Promise.resolve({
        makes: [
          {
            id: 'make-1',
            slug: 'maruti-suzuki',
            name: 'Maruti Suzuki',
            popularity: 100,
            models: [
              {
                id: 'model-1',
                slug: 'alto-800',
                name: 'Alto 800',
                bodyType: 'HATCHBACK',
                yearFrom: 2012,
                yearTo: 2022,
                _count: { variants: 8 },
              },
            ],
          },
        ],
        cities: [{ id: 'city-1', slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu' }],
        rto: [{ code: 'TN-23', name: 'Vellore RTO', city: 'Vellore', state: 'Tamil Nadu' }],
        colors: [{ id: 'color-1', slug: 'white', name: 'White', hex: '#FFFFFF', family: 'WHITE' }],
      } as unknown as Awaited<ReturnType<CatalogRepository['bundle']>>),
    cities: () =>
      Promise.resolve([
        { id: 'city-1', slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu' },
        { id: 'city-2', slug: 'katpadi', name: 'Katpadi', state: 'Tamil Nadu' },
      ] as unknown as Awaited<ReturnType<CatalogRepository['cities']>>),
    knownFeatures: () => Promise.resolve(['Sunroof', 'ABS with EBD']),
    ...overrides,
  } as unknown as CatalogRepository;
}

function search(counts: { city_slug: string; count: number }[] = [], total = 0): SearchRepository {
  return {
    cityCounts: () => Promise.resolve(counts),
    totalCount: () => Promise.resolve(total),
  } as unknown as SearchRepository;
}

function config(values: Record<string, number | boolean> = {}): PlatformConfigService {
  return {
    number: (key: string) => Promise.resolve(Number(values[key] ?? 0)),
    boolean: (key: string) => Promise.resolve(Boolean(values[key])),
    stringList: () => Promise.resolve([]),
    all: () => Promise.resolve([]),
    set: () => Promise.reject(new Error('not used')),
    invalidate: () => undefined,
  };
}

describe('bundle', () => {
  it('nests models under makes, and counts variants rather than nesting them', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    const bundle = await service.bundle();

    expect(bundle.makes[0]?.name).toBe('Maruti Suzuki');
    expect(bundle.makes[0]?.models[0]?.name).toBe('Alto 800');
    // ~2,000 variants would be ~400KB of JSON on a page that needs a filter
    // panel quickly; `/v1/catalog/models/{id}/variants` fetches the one model
    // a dealer actually picks.
    expect(bundle.makes[0]?.models[0]?.variantCount).toBe(8);
    expect(bundle.makes[0]?.models[0]).not.toHaveProperty('variants');
  });

  it('carries the production years, so the year dropdown can be bounded', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    const bundle = await service.bundle();

    // A 2009 Alto 800 does not exist, and offering the year invites a listing
    // that no correct search will find.
    expect(bundle.makes[0]?.models[0]?.yearFrom).toBe(2012);
    expect(bundle.makes[0]?.models[0]?.yearTo).toBe(2022);
  });

  it('exposes only the fields the wizard needs, not the whole row', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    const bundle = await service.bundle();

    expect(Object.keys(bundle.makes[0] ?? {}).sort()).toEqual([
      'id',
      'models',
      'name',
      'popularity',
      'slug',
    ]);
  });

  it('carries every fuel, transmission, body type and insurance option', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    const bundle = await service.bundle();

    // A dealer picks from these lists and cannot type anything else, so a missing
    // entry is a car that cannot be listed at all.
    expect(bundle.fuels.map((option) => option.value)).toEqual(Object.keys(FUEL_LABELS));
    expect(bundle.transmissions.map((option) => option.value)).toEqual(
      Object.keys(TRANSMISSION_LABELS),
    );
    expect(bundle.bodyTypes.map((option) => option.value)).toEqual(Object.keys(BODY_TYPE_LABELS));
    expect(bundle.insuranceTypes.map((option) => option.value)).toEqual(
      Object.keys(INSURANCE_LABELS),
    );
  });

  it('labels every enum option for display', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    const bundle = await service.bundle();

    for (const group of [
      bundle.fuels,
      bundle.transmissions,
      bundle.bodyTypes,
      bundle.insuranceTypes,
    ]) {
      for (const option of group) {
        expect(option.label.length, option.value).toBeGreaterThan(0);
        // The label is what the dealer reads, so no underscores and no shouting —
        // except where the real name is an acronym (`CNG`, `LPG`).
        expect(option.label, option.value).not.toContain('_');
        if (option.label === option.label.toUpperCase()) {
          expect(option.label.length, `${option.value} label`).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('offers owner counts one through three, labelled', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    const bundle = await service.bundle();

    expect(bundle.owners.map((option) => option.value)).toEqual([1, 2, 3]);
    expect(bundle.owners[0]?.label).toMatch(/first|1st/i);
  });

  it('carries the feature taxonomy from the repository', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    expect((await service.bundle()).features).toEqual(['Sunroof', 'ABS with EBD']);
  });

  it('versions the bundle to the hour, so it is cacheable but not stale for long', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    const version = (await service.bundle()).version;

    expect(version).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
    expect((await service.bundle()).version).toBe(version);
  });

  it('survives a taxonomy with no models or variants yet', async () => {
    const empty = repo({
      bundle: () =>
        Promise.resolve({
          makes: [{ id: 'm', slug: 's', name: 'N', popularity: 0, models: [] }],
          cities: [],
          rto: [],
          colors: [],
        } as unknown as Awaited<ReturnType<CatalogRepository['bundle']>>),
    });
    const service = createCatalogService({ repo: empty, search: search(), config: config() });

    const bundle = await service.bundle();

    expect(bundle.makes[0]?.models).toEqual([]);
    expect(bundle.cities).toEqual([]);
  });
});

describe('cities', () => {
  it('puts a live sitewide total first', async () => {
    const service = createCatalogService({
      repo: repo(),
      search: search([{ city_slug: 'vellore', count: 12 }], 18),
      config: config(),
    });

    const response = await service.cities();

    expect(response.data[0]).toEqual({ slug: 'all', name: 'All of Tamil Nadu', count: 18 });
  });

  it('joins each city to its live count', async () => {
    const service = createCatalogService({
      repo: repo(),
      search: search(
        [
          { city_slug: 'vellore', count: 12 },
          { city_slug: 'katpadi', count: 6 },
        ],
        18,
      ),
      config: config(),
    });

    const response = await service.cities();

    expect(response.data.slice(1)).toEqual([
      { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu', count: 12 },
      { slug: 'katpadi', name: 'Katpadi', state: 'Tamil Nadu', count: 6 },
    ]);
  });

  it('reports zero for a city with nothing live rather than dropping it', async () => {
    const service = createCatalogService({
      repo: repo(),
      search: search([{ city_slug: 'vellore', count: 12 }], 12),
      config: config(),
    });

    const response = await service.cities();

    // §4.11: a zero-count option renders disabled rather than vanishing, so the
    // dealer network's coverage stays visible.
    expect(response.data.find((city) => city.slug === 'katpadi')?.count).toBe(0);
  });

  it('never invents a count for a city the index does not know', async () => {
    const service = createCatalogService({
      repo: repo(),
      search: search([{ city_slug: 'chennai', count: 99 }], 99),
      config: config(),
    });

    const response = await service.cities();

    // The seed models the Vellore district only; a count for a city not in the
    // taxonomy must not leak into the dropdown.
    expect(response.data.map((city) => city.slug)).not.toContain('chennai');
  });

  it('defaults to Vellore', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    expect((await service.cities()).default).toBe('vellore');
  });

  it('reports zeroes across the board on an empty catalogue', async () => {
    const service = createCatalogService({ repo: repo(), search: search([], 0), config: config() });

    const response = await service.cities();

    expect(response.data.every((city) => city.count === 0)).toBe(true);
  });
});

describe('publicConfig', () => {
  it('exposes the operational numbers the web app needs', async () => {
    const service = createCatalogService({
      repo: repo(),
      search: search(),
      config: config({
        'listing.minPhotos': 6,
        'listing.durationDays': 90,
        'enquiry.rateLimitPerHour': 5,
        'photoRequests.enabled': true,
      }),
    });

    const publicConfig = await service.publicConfig();

    expect(publicConfig).toMatchObject({
      minPhotosPerListing: 6,
      listingDurationDays: 90,
      enquiryRateLimitPerHour: 5,
      photoRequestsEnabled: true,
    });
  });

  it('reads the photo minimum from config, so the wizard and the guard agree', async () => {
    const service = createCatalogService({
      repo: repo(),
      search: search(),
      config: config({ 'listing.minPhotos': 8 }),
    });

    // The whole reason platform config exists: "6 in three places and 5 in the
    // fourth" is a submit button that fails with no visible reason.
    expect((await service.publicConfig()).minPhotosPerListing).toBe(8);
  });

  it('carries the support contacts and media origin from the environment', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    const publicConfig = await service.publicConfig();

    expect(publicConfig.mediaBaseUrl).toBe(env.MEDIA_BASE_URL);
    expect(publicConfig.supportEmail).toBe(env.SUPPORT_EMAIL);
    expect(publicConfig.supportPhone).toBe(env.SUPPORT_PHONE);
  });

  it('reports no captcha site key, because there is no captcha in this build', async () => {
    const service = createCatalogService({ repo: repo(), search: search(), config: config() });

    // Null rather than an empty string: the client branches on it to decide
    // whether to render the widget at all.
    expect((await service.publicConfig()).captchaSiteKey).toBeNull();
  });

  it('reports photo requests off when the flag is off', async () => {
    const service = createCatalogService({
      repo: repo(),
      search: search(),
      config: config({ 'photoRequests.enabled': false }),
    });

    expect((await service.publicConfig()).photoRequestsEnabled).toBe(false);
  });
});
