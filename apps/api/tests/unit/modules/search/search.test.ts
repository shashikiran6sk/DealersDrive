import { describe, expect, it, vi } from 'vitest';

import {
  specsOf,
  toPublicVehicleDetail,
  toVehicleCard,
} from '../../../../src/modules/search/search.mapper.js';
import type { CardRow, DetailRow } from '../../../../src/modules/search/search.repository.js';
import {
  PUBLIC_LISTING_WHERE,
  publicListingsOf,
} from '../../../../src/modules/search/search.repository.js';
import { createSearchRouter } from '../../../../src/modules/search/search.routes.js';
import { createSearchService } from '../../../../src/modules/search/search.service.js';
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

  it('leaves out what is not known rather than printing a blank', () => {
    const card = toVehicleCard(
      row({ kilometersDriven: null, fuelType: null, pricePaise: null, images: [] }),
    );
    expect(card.metaLabel).toBe('Automatic · Vellore');
    expect(card.priceLabel).toBeNull();
    expect(card.image).toBeNull();
  });
});

describe('who is public', () => {
  it('is an ACTIVE listing, with a slug, of an ACTIVE dealership — nothing else', () => {
    expect(PUBLIC_LISTING_WHERE).toEqual({
      status: 'ACTIVE',
      slug: { not: null },
      dealer: { status: 'ACTIVE' },
    });
  });
});

describe('the service', () => {
  it('pages by offset and reports the total', async () => {
    const repo = {
      cards: vi.fn(async () => [row()]),
      count: vi.fn(async () => 49),
      detail: vi.fn(),
      publicDealerExists: vi.fn(),
    };
    const response = await createSearchService({ repo }).vehicles({ page: 3, limit: 24 });

    expect(repo.cards).toHaveBeenCalledWith(48, 24, undefined);
    expect(response.page).toEqual({ page: 3, limit: 24, total: 49, totalPages: 3 });
    expect(response.data).toHaveLength(1);
  });

  it('reports one page when there is nothing at all', async () => {
    const repo = {
      cards: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      detail: vi.fn(),
      publicDealerExists: vi.fn(),
    };
    const response = await createSearchService({ repo }).vehicles({ page: 1, limit: 24 });
    expect(response.page.totalPages).toBe(1);
  });
});

describe('the router', () => {
  const router = createSearchRouter({} as never, () => (_req, _res, next) => next());

  it("declares the public list, the vehicle page and a dealership's list, in that order", () => {
    expect(signaturesOf(router)).toEqual([
      'GET /vehicles',
      'GET /vehicles/:slug',
      'GET /dealers/:slug/vehicles',
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
      color: 'Polar White',
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
    });
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
    const specs = specsOf(detailRow({ variant: null, rtoCode: null, color: '' }).vehicle);
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
    const repo = {
      cards: vi.fn(),
      count: vi.fn(),
      detail: vi.fn(async () => null),
      publicDealerExists: vi.fn(),
    };
    await expect(createSearchService({ repo }).vehicle('gone')).rejects.toMatchObject({
      status: 404,
      code: 'VEHICLE_NOT_FOUND',
    });
  });
});

describe("one dealership's cars", () => {
  it('narrows the public rule to the dealership, and keeps every part of it', () => {
    expect(publicListingsOf('sri')).toEqual({
      status: 'ACTIVE',
      slug: { not: null },
      dealer: { status: 'ACTIVE', slug: 'sri' },
    });
    expect(publicListingsOf()).toBe(PUBLIC_LISTING_WHERE);
  });

  it("pages the dealership's cars and counts them with the same rule", async () => {
    const repo = {
      cards: vi.fn(async () => [row()]),
      count: vi.fn(async () => 1),
      detail: vi.fn(),
      publicDealerExists: vi.fn(async () => true),
    };
    const response = await createSearchService({ repo }).dealerVehicles('sri', {
      page: 1,
      limit: 24,
    });
    expect(repo.cards).toHaveBeenCalledWith(0, 24, 'sri');
    expect(repo.count).toHaveBeenCalledWith('sri');
    expect(response.page.total).toBe(1);
  });

  it('answers 404 for a dealership that is not listed', async () => {
    const repo = {
      cards: vi.fn(),
      count: vi.fn(),
      detail: vi.fn(),
      publicDealerExists: vi.fn(async () => false),
    };
    await expect(
      createSearchService({ repo }).dealerVehicles('gone', { page: 1, limit: 24 }),
    ).rejects.toMatchObject({ status: 404, code: 'DEALER_NOT_FOUND' });
    expect(repo.cards).not.toHaveBeenCalled();
  });
});
