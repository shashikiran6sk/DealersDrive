import { describe, expect, it, vi } from 'vitest';

import {
  specsOf,
  toPublicVehicleDetail,
  toSitemapDealer,
  toSitemapListing,
  toVehicleCard,
} from '../../../../src/modules/search/search.mapper.js';
import type {
  CardRow,
  DetailRow,
  SearchRepository,
} from '../../../../src/modules/search/search.repository.js';
import {
  PUBLIC_AVAILABLE_LISTING_WHERE,
  PUBLIC_VISIBLE_LISTING_WHERE,
} from '../../../../src/modules/search/search.repository.js';
import { createSearchRouter } from '../../../../src/modules/search/search.routes.js';
import { createSearchService } from '../../../../src/modules/search/search.service.js';
import { rankSuggestions } from '../../../../src/modules/search/search.suggest.js';
import { permissionsOn, routesOf, signaturesOf, validatedSources } from '../../../router-probe.js';

function row(overrides: Partial<CardRow['vehicle']> = {}): CardRow {
  return {
    id: 'listing-1',
    slug: '2023-hyundai-creta-sx-o-vellore-0a1b2c3d',
    status: 'ACTIVE',
    vehicle: {
      id: 'vehicle-1',
      registrationNumber: 'KA01AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      manufacturingYear: 2023,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      kilometersDriven: 22_400,
      pricePaise: 145_000_000n,
      images: [{ mediaId: 'media-1' }],
      _count: { images: 8 },
      ...overrides,
    },
    dealer: { brandName: 'Sri Lakshmi Motors', slug: 'sri-lakshmi-motors', city: 'Vellore' },
  } as unknown as CardRow;
}

describe('toVehicleCard', () => {
  it('draws the card from the vehicle and the dealership', () => {
    expect(toVehicleCard(row())).toEqual({
      slug: '2023-hyundai-creta-sx-o-vellore-0a1b2c3d',
      availability: 'AVAILABLE',
      title: '2023 Hyundai Creta SX(O)',
      year: 2023,
      priceLabel: '₹14,50,000',
      metaLabel: '22,400 km · Petrol · Automatic · Vellore',
      image: {
        url: expect.stringMatching(/\/by-media\/media-1\/640\.webp$/),
        alt: '2023 Hyundai Creta SX(O), the primary photograph',
      },
      imageCount: 8,
      dealer: {
        name: 'Sri Lakshmi Motors',
        slug: 'sri-lakshmi-motors',
        initials: 'SL',
        isVerified: true,
      },
    });
  });

  it('says a reserved car is reserved, and nothing more about the lifecycle (R71)', () => {
    const reserved = toVehicleCard({ ...row(), status: 'RESERVED' });
    expect(reserved.availability).toBe('RESERVED');
    expect(Object.keys(reserved)).not.toContain('status');
  });

  it('leaves out what is not known rather than printing a blank', () => {
    const card = toVehicleCard(
      row({ kilometersDriven: null, fuelType: null, pricePaise: null, images: [] }),
    );
    expect(card.metaLabel).toBe('Automatic · Vellore');
    expect(card.priceLabel).toBeNull();
    expect(card.image).toBeNull();
  });
});

describe('who is public (R71)', () => {
  it('shows an ACTIVE or RESERVED listing, with a slug, of an ACTIVE dealership — nothing else', () => {
    expect(PUBLIC_VISIBLE_LISTING_WHERE).toEqual({
      status: { in: ['ACTIVE', 'RESERVED'] },
      slug: { not: null },
      dealer: { status: 'ACTIVE' },
    });
  });

  it('counts as available only an ACTIVE listing, with a slug, of an ACTIVE dealership', () => {
    expect(PUBLIC_AVAILABLE_LISTING_WHERE).toEqual({
      status: 'ACTIVE',
      slug: { not: null },
      dealer: { status: 'ACTIVE' },
    });
  });
});

describe('the router', () => {
  const router = createSearchRouter({} as never, () => (_req, _res, next) => next());

  it("declares the public list, the vehicle page, its similar cars, a dealership's list, the typeahead and the sitemap, in that order", () => {
    expect(signaturesOf(router)).toEqual([
      'GET /vehicles',
      'GET /vehicles/:slug',
      'GET /vehicles/:slug/similar',
      'GET /dealers/:slug/vehicles',
      'GET /search/vehicles',
      'GET /sitemap',
    ]);
  });

  it('asks for no permission and parses its query', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route)).toEqual([]);
      expect(validatedSources(route).length).toBeGreaterThan(0);
    }
  });
});

function detailRow(overrides: Partial<DetailRow['vehicle']> = {}): DetailRow {
  return {
    id: 'listing-1',
    slug: '2023-hyundai-creta-sx-o-vellore-0a1b2c3d',
    status: 'ACTIVE',
    publishedAt: new Date('2026-09-26T10:00:00.000Z'),
    vehicle: {
      id: 'vehicle-1',
      registrationNumber: 'TN23AB1234',
      rtoCode: 'TN23',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      manufacturingYear: 2023,
      registrationYear: 2023,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      bodyType: 'SUV',
      kilometersDriven: 22_400,
      ownerCount: 1,
      color: 'WHITE',
      insuranceType: 'COMPREHENSIVE',
      insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
      pricePaise: 145_000_000n,
      negotiability: 'FIXED',
      description: 'Single owner.',
      images: [
        { mediaId: 'm-a', position: 0, isPrimary: false },
        { mediaId: 'm-b', position: 1, isPrimary: true },
      ],
      ...overrides,
    },
    dealer: {
      brandName: 'Sri Lakshmi Motors',
      slug: 'sri',
      city: 'Katpadi',
      district: 'Vellore',
      state: 'Tamil Nadu',
    },
  } as unknown as DetailRow;
}

describe('toPublicVehicleDetail', () => {
  it('keeps the gallery order and points at the primary', () => {
    const detail = toPublicVehicleDetail(detailRow());
    expect(detail.images.map((image) => image.url)).toEqual([
      expect.stringMatching(/\/by-media\/m-a\/1024\.webp$/),
      expect.stringMatching(/\/by-media\/m-b\/1024\.webp$/),
    ]);
    expect(detail.images[1]?.alt).toBe('2023 Hyundai Creta SX(O), photograph 2 of 2');
    expect(detail.primaryIndex).toBe(1);
  });

  it('shows the registration only as its RTO', () => {
    const detail = toPublicVehicleDetail(detailRow());
    expect(detail.specs).toContainEqual({ label: 'Registered at', value: 'TN 23' });
    expect(JSON.stringify(detail)).not.toContain('TN23AB1234');
    expect(JSON.stringify(detail)).not.toContain('AB 1234');
  });

  it('names the dealership and where it is, once each', () => {
    expect(toPublicVehicleDetail(detailRow()).dealer).toEqual({
      name: 'Sri Lakshmi Motors',
      slug: 'sri',
      initials: 'SL',
      isVerified: true,
      location: 'Katpadi, Vellore',
      city: 'Katpadi',
      district: 'Vellore',
      state: 'Tamil Nadu',
    });
  });

  it('carries the specifications as values, labelled as the page prints them', () => {
    expect(toPublicVehicleDetail(detailRow()).facts).toEqual({
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      bodyType: 'SUV',
      fuelType: 'Petrol',
      transmission: 'Automatic',
      color: 'White',
      kilometersDriven: 22_400,
      ownerCount: 1,
      pricePaise: 145_000_000,
    });
  });

  it('leaves a fact the dealer never entered as null, never a guess', () => {
    const facts = toPublicVehicleDetail(
      detailRow({ fuelType: null, color: null, pricePaise: null, kilometersDriven: null }),
    ).facts;
    expect(facts.fuelType).toBeNull();
    expect(facts.color).toBeNull();
    expect(facts.pricePaise).toBeNull();
    expect(facts.kilometersDriven).toBeNull();
  });

  it('copes with a gallery that is empty and a listing that has no date', () => {
    const row = detailRow({ images: [] });
    const detail = toPublicVehicleDetail({ ...row, publishedAt: null });
    expect(detail.images).toEqual([]);
    expect(detail.primaryIndex).toBe(0);
    expect(detail.publishedLabel).toBeNull();
  });
});

describe('specsOf', () => {
  it('lists what is known, formatted, and leaves out what is not', () => {
    const specs = specsOf(detailRow({ variant: null, rtoCode: null, color: null }).vehicle);
    const labels = specs.map((entry) => entry.label);
    expect(labels).not.toContain('Variant');
    expect(labels).not.toContain('Registered at');
    expect(labels).not.toContain('Colour');
    expect(specs).toContainEqual({ label: 'Kilometres driven', value: '22,400 km' });
    expect(specs).toContainEqual({ label: 'Fuel', value: 'Petrol' });
  });
});

describe('the vehicle page', () => {
  it('answers a slug that is not public with a 404', async () => {
    const repo = { detail: vi.fn(async () => null) } as unknown as SearchRepository;
    await expect(createSearchService({ repo }).vehicle('gone')).rejects.toMatchObject({
      status: 404,
      code: 'VEHICLE_NOT_FOUND',
    });
  });
});

describe('similar vehicles (R73)', () => {
  function listed(id: string, overrides: Partial<CardRow['vehicle']> = {}): CardRow {
    const base = row(overrides);
    return {
      ...base,
      id,
      slug: `car-${id}`,
      publishedAt: new Date('2026-09-01T00:00:00Z'),
      dealer: { ...base.dealer, district: 'Vellore' },
    };
  }

  it('answers a slug that is not visible with a 404, and asks nothing else', async () => {
    const similarPool = vi.fn();
    const repo = {
      similarSource: vi.fn(async () => null),
      similarPool,
    } as unknown as SearchRepository;
    await expect(createSearchService({ repo }).similar('gone')).rejects.toMatchObject({
      status: 404,
      code: 'VEHICLE_NOT_FOUND',
    });
    expect(similarPool).not.toHaveBeenCalled();
  });

  it('falls back to the newest other available cars when too few are alike, without repeats', async () => {
    const newestAvailable = vi.fn(async () => [listed('n1'), listed('n2')]);
    const repo = {
      similarSource: vi.fn(async () => listed('source')),
      similarPool: vi.fn(async () => [listed('p1', { model: 'Venue' })]),
      newestAvailable,
    } as unknown as SearchRepository;

    const { data } = await createSearchService({ repo }).similar('car-source');

    expect(data.map((card) => card.slug)).toEqual(['car-p1', 'car-n1', 'car-n2']);
    expect(newestAvailable).toHaveBeenCalledWith(['source', 'p1'], 3);
  });

  it('asks for no filler when the pool already has four', async () => {
    const newestAvailable = vi.fn();
    const repo = {
      similarSource: vi.fn(async () => listed('source')),
      similarPool: vi.fn(async () => ['a', 'b', 'c', 'd', 'e'].map((id) => listed(id))),
      newestAvailable,
    } as unknown as SearchRepository;

    const { data } = await createSearchService({ repo }).similar('car-source');
    expect(data).toHaveLength(4);
    expect(newestAvailable).not.toHaveBeenCalled();
  });
});

describe('rankSuggestions', () => {
  const rows = [
    { make: 'Hyundai', model: 'Creta', variant: 'SX', count: 3 },
    { make: 'Hyundai', model: 'Creta', variant: 'sx', count: 1 },
    { make: 'HYUNDAI', model: 'i20', variant: null, count: 2 },
    { make: 'Kia', model: 'Carens', variant: 'Premium', count: 4 },
    { make: null, model: 'Orphan', variant: null, count: 9 },
  ];

  it('ranks a label that starts with the search first, then a word that does, then anywhere', () => {
    const labels = rankSuggestions(rows, 'cre', 10).data.map((row) => row.label);
    expect(labels).toEqual(['Hyundai Creta', 'Hyundai Creta SX']);
    expect(rankSuggestions(rows, 'ar', 10).data.map((row) => row.label)).toEqual([
      'Kia Carens',
      'Kia Carens Premium',
    ]);
  });

  it('folds spellings into one row labelled with the commonest, and sums the count', () => {
    const { data } = rankSuggestions(rows, 'hyundai', 10);
    expect(data[0]).toMatchObject({ kind: 'BRAND', label: 'Hyundai', count: 6 });
    expect(data.filter((row) => row.kind === 'VARIANT')).toEqual([
      expect.objectContaining({ label: 'Hyundai Creta SX', variant: 'SX', count: 4 }),
    ]);
  });

  it('breaks ties brand, model, variant, then most cars, then alphabetically', () => {
    expect(rankSuggestions(rows, 'hyundai', 10).data.map((row) => row.label)).toEqual([
      'Hyundai',
      'Hyundai Creta',
      'Hyundai i20',
      'Hyundai Creta SX',
    ]);
  });

  it('skips a car with no make, and cuts to the limit while counting every match', () => {
    expect(rankSuggestions(rows, 'orphan', 10)).toEqual({ data: [], total: 0 });
    const cut = rankSuggestions(rows, 'hyundai', 2);
    expect(cut.data).toHaveLength(2);
    expect(cut.total).toBe(4);
  });
});

describe('the sitemap entries', () => {
  it("dates a car by the later of the listing's and the vehicle's changes", () => {
    expect(
      toSitemapListing({
        slug: 'a-car',
        updatedAt: new Date('2026-09-20T00:00:00.000Z'),
        vehicle: { updatedAt: new Date('2026-09-25T08:00:00.000Z') },
      }),
    ).toEqual({ slug: 'a-car', lastModified: '2026-09-25T08:00:00.000Z' });
  });

  it("dates a dealership by its approval or its newest car's change, whichever is later", () => {
    expect(
      toSitemapDealer({
        slug: 'sri',
        approvedAt: new Date('2026-01-01T00:00:00.000Z'),
        inventoryUpdatedAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
    ).toEqual({ slug: 'sri', lastModified: '2026-09-01T00:00:00.000Z' });
    expect(
      toSitemapDealer({ slug: 'sri', approvedAt: null, inventoryUpdatedAt: null }).lastModified,
    ).toBeNull();
  });
});
