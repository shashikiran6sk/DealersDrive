import { describe, expect, it, vi } from 'vitest';

import { toVehicleCard } from '../../../../src/modules/search/search.mapper.js';
import type { CardRow } from '../../../../src/modules/search/search.repository.js';
import { PUBLIC_LISTING_WHERE } from '../../../../src/modules/search/search.repository.js';
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
    const repo = { cards: vi.fn(async () => [row()]), count: vi.fn(async () => 49) };
    const response = await createSearchService({ repo }).vehicles({ page: 3, limit: 24 });

    expect(repo.cards).toHaveBeenCalledWith(48, 24);
    expect(response.page).toEqual({ page: 3, limit: 24, total: 49, totalPages: 3 });
    expect(response.data).toHaveLength(1);
  });

  it('reports one page when there is nothing at all', async () => {
    const repo = { cards: vi.fn(async () => []), count: vi.fn(async () => 0) };
    const response = await createSearchService({ repo }).vehicles({ page: 1, limit: 24 });
    expect(response.page.totalPages).toBe(1);
  });
});

describe('the router', () => {
  const router = createSearchRouter({} as never, () => (_req, _res, next) => next());

  it('declares the public list and nothing else', () => {
    expect(signaturesOf(router)).toEqual(['GET /vehicles']);
  });

  it('asks for no permission and parses its query', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route)).toEqual([]);
      expect(validatedSources(route)).toContain('query');
    }
  });
});
