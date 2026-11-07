import { NO_VEHICLE_FACETS } from '@dealers-drive/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  ApiRequestError,
  apiUrl,
  fetchDealersWithStock,
  fetchInventory,
  fetchProfile,
} from '../src/data/api';

import { card, jsonResponse, profile } from './fixtures';

const BASE = 'https://api.example.test';

function page(pageNumber: number, totalPages: number) {
  return { page: pageNumber, limit: 48, total: totalPages * 48, totalPages };
}

function dealerCard(slug: string, carCount: number) {
  return {
    slug,
    brandName: slug,
    initials: 'XX',
    city: 'Vellore',
    state: 'Tamil Nadu',
    yearsOperating: null,
    yearsLabel: 'Vellore, Tamil Nadu',
    tagline: null,
    services: [],
    carCount,
    fromPricePaise: null,
    fromPriceLabel: '—',
    isVerified: false,
    logoUrl: null,
    coverUrl: null,
  };
}

describe('apiUrl', () => {
  it('joins the base and path and sets the query', () => {
    expect(apiUrl('https://api.example.test', 'v1/dealers', { page: '2' })).toBe(
      'https://api.example.test/v1/dealers?page=2',
    );
    expect(apiUrl('https://api.example.test/', 'v1/dealers')).toBe(
      'https://api.example.test/v1/dealers',
    );
  });
});

describe('fetchDealersWithStock', () => {
  it('walks every page and keeps dealerships with cars', async () => {
    const fetcher = vi.fn((url: string) => {
      const pageNumber = Number(new URL(url).searchParams.get('page'));
      const data =
        pageNumber === 1 ? [dealerCard('a', 3), dealerCard('b', 0)] : [dealerCard('c', 1)];
      return Promise.resolve(
        jsonResponse({
          data,
          page: page(pageNumber, 2),
          countLabel: '3',
          cities: [],
          districts: [],
        }),
      );
    });
    const dealers = await fetchDealersWithStock(BASE, fetcher);
    expect(dealers.map((dealer) => dealer.slug)).toEqual(['a', 'c']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('throws a named error on a failed request', async () => {
    const fetcher = () => Promise.resolve(jsonResponse({}, 503));
    await expect(fetchDealersWithStock(BASE, fetcher)).rejects.toBeInstanceOf(ApiRequestError);
  });
});

describe('fetchProfile', () => {
  it('parses the public profile', async () => {
    const fetcher = vi.fn(() => Promise.resolve(jsonResponse(profile())));
    const result = await fetchProfile(BASE, 'sample motors', fetcher);
    expect(result.brandName).toBe('Sample Motors');
    expect(fetcher).toHaveBeenCalledWith(`${BASE}/v1/dealers/sample%20motors`);
  });
});

describe('fetchInventory', () => {
  it('collects every page, newest first, and reports the available count', async () => {
    const fetcher = vi.fn((url: string) => {
      const query = new URL(url).searchParams;
      expect(query.get('sort')).toBe('newest');
      const pageNumber = Number(query.get('page'));
      return Promise.resolve(
        jsonResponse({
          data: [card({ slug: `car-${pageNumber}` })],
          page: page(pageNumber, 2),
          available: 2,
          facets: NO_VEHICLE_FACETS,
        }),
      );
    });
    const inventory = await fetchInventory(BASE, 'sample', fetcher);
    expect(inventory.cards.map((c) => c.slug)).toEqual(['car-1', 'car-2']);
    expect(inventory.available).toBe(2);
  });
});

describe('fetchInventory models', () => {
  it('asks each brand for its models', async () => {
    const fetcher = vi.fn((url: string) => {
      const brand = new URL(url).searchParams.get('brand');
      const facets =
        brand === null
          ? {
              ...NO_VEHICLE_FACETS,
              brands: [{ value: 'maruti-suzuki', label: 'Maruti Suzuki', count: 2 }],
            }
          : {
              ...NO_VEHICLE_FACETS,
              models: [
                { value: 'swift', label: 'Swift', count: 1 },
                { value: 'swift-dzire', label: 'Swift Dzire', count: 1 },
              ],
            };
      return Promise.resolve(
        jsonResponse({ data: [card()], page: page(1, 1), available: 1, facets }),
      );
    });
    const inventory = await fetchInventory(BASE, 'sample', fetcher);
    expect(inventory.models).toEqual([
      { brand: 'Maruti Suzuki', model: 'Swift' },
      { brand: 'Maruti Suzuki', model: 'Swift Dzire' },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      `${BASE}/v1/dealers/sample/vehicles?limit=1&brand=maruti-suzuki`,
    );
  });
});
