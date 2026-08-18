import { describe, expect, it } from 'vitest';

import { FUEL_LABELS, TRANSMISSION_LABELS, formatLakh } from '@dealers-drive/contracts';

import {
  bodyTypeLabel,
  carCountLabel,
  toVehicleCard,
} from '../../../../src/modules/search/search.mapper.js';
import type { SearchRow } from '../../../../src/modules/search/search.repository.js';
import { mediaUrl, srcsetFor } from '../../../../src/platform/media/urls.js';

/**
 * Unit tests for `src/modules/search/search.mapper.ts`.
 *
 * This is the single place a `listing_search` row becomes the card every public
 * surface renders, and the reason it is single is API-SPEC §0.4: the API returns
 * `pricePaise` **and** `priceLabel` so the homepage, the results grid, the detail
 * page and the saved list cannot disagree about Lakh rounding. Two clients
 * deriving it independently would eventually disagree about the price of a car.
 */
function row(overrides: Partial<SearchRow> = {}): SearchRow {
  return {
    vehicle_id: '11111111-0000-4000-8000-000000000000',
    vehicle_slug: '2021-maruti-suzuki-alto-800-vxi-vellore-111111',
    year: 2021,
    title: 'Maruti Suzuki Alto 800 VXI',
    price_paise: 64_500_000n,
    km: 42_180,
    fuel: 'PETROL',
    transmission: 'MANUAL',
    body_type: 'HATCHBACK',
    city_slug: 'vellore',
    city_name: 'Vellore',
    dealer_slug: 'sri-lakshmi-motors',
    dealer_name: 'Sri Lakshmi Motors',
    dealer_initials: 'SL',
    primary_media_id: '22222222-0000-4000-8000-000000000000',
    primary_blurhash: 'L6PZ',
    photo_count: 8,
    ...overrides,
  } as SearchRow;
}

describe('toVehicleCard', () => {
  it('carries the identity a link needs', () => {
    const card = toVehicleCard(row());

    expect(card.id).toBe('11111111-0000-4000-8000-000000000000');
    expect(card.slug).toBe('2021-maruti-suzuki-alto-800-vxi-vellore-111111');
    expect(card.year).toBe(2021);
    expect(card.title).toBe('Maruti Suzuki Alto 800 VXI');
  });

  it('returns the raw paise and the formatted label together', () => {
    const card = toVehicleCard(row({ price_paise: 64_500_000n }));

    // §0.4: both, always. A client that formats its own would round differently
    // on one screen out of four. ₹6.45 Lakh is 6,45,000 rupees, and paise are the
    // wire unit — so the number is a hundred times that.
    expect(card.pricePaise).toBe(64_500_000);
    expect(card.priceLabel).toBe(formatLakh(64_500_000));
    expect(card.priceLabel).toBe('₹6.45 Lakh');
  });

  it('converts BigInt paise to a JSON-safe number', () => {
    const card = toVehicleCard(row({ price_paise: 50_000_000_00n }));

    expect(typeof card.pricePaise).toBe('number');
    expect(card.pricePaise).toBe(5_000_000_000);
  });

  it('derives the EMI from the price, with a rupee-per-month label', () => {
    const card = toVehicleCard(row({ price_paise: 64_500_000n }));

    expect(card.emiPaise).toBeGreaterThan(0);
    expect(card.emiLabel).toMatch(/^₹[\d,]+\/mo$/);
    expect(card.emiLabel).toContain(Math.round(card.emiPaise / 100).toLocaleString('en-IN'));
  });

  it('formats the odometer in the Indian grouping', () => {
    expect(toVehicleCard(row({ km: 42_180 })).kmLabel).toBe('42,180 km');
    expect(toVehicleCard(row({ km: 1_20_000 })).kmLabel).toBe('1,20,000 km');
  });

  it('labels fuel and transmission from the shared tables', () => {
    const card = toVehicleCard(row({ fuel: 'DIESEL', transmission: 'AUTOMATIC' }));

    expect(card.fuelLabel).toBe(FUEL_LABELS.DIESEL);
    expect(card.transmissionLabel).toBe(TRANSMISSION_LABELS.AUTOMATIC);
  });

  it('falls back to the raw value for a fuel or transmission it does not know', () => {
    // The index is denormalised; an enum added to the schema and not to the label
    // table must degrade to something readable rather than `undefined`.
    const card = toVehicleCard(row({ fuel: 'HYDROGEN', transmission: 'CVT_PLUS' }));

    expect(card.fuelLabel).toBe('HYDROGEN');
    expect(card.transmissionLabel).toBe('CVT_PLUS');
  });

  it('nests the city and dealer the card links to', () => {
    const card = toVehicleCard(row());

    expect(card.city).toEqual({ slug: 'vellore', name: 'Vellore' });
    expect(card.dealer).toMatchObject({
      slug: 'sri-lakshmi-motors',
      brandName: 'Sri Lakshmi Motors',
      initials: 'SL',
    });
  });

  it('marks every dealer in the catalogue as verified', () => {
    // §11.1: being in `listing_search` at all means ACTIVE with verified
    // documents, so the flag is a restatement of the visibility rule.
    expect(toVehicleCard(row()).dealer.isVerified).toBe(true);
  });

  it('never carries a phone number', () => {
    const card = toVehicleCard(row());

    // Rule 7. The row does not have one to leak, and this asserts that stays true
    // if the index gains columns.
    expect(JSON.stringify(card)).not.toMatch(/\b[6-9]\d{9}\b/);
    expect(card.dealer).not.toHaveProperty('contactPhone');
  });

  it('builds a responsive image with a blurhash placeholder', () => {
    const card = toVehicleCard(row());

    expect(card.primaryImage?.url).toBe(mediaUrl('22222222-0000-4000-8000-000000000000', 640));
    expect(card.primaryImage?.srcset).toBe(srcsetFor('22222222-0000-4000-8000-000000000000'));
    expect(card.primaryImage?.blurhash).toBe('L6PZ');
  });

  it('writes alt text a screen reader can use', () => {
    const card = toVehicleCard(row());

    // Year, car, dealer, city — the same information a sighted user gets from the
    // card, rather than "vehicle image".
    expect(card.primaryImage?.alt).toBe(
      '2021 Maruti Suzuki Alto 800 VXI — Sri Lakshmi Motors, Vellore',
    );
  });

  it('returns a null image rather than a broken URL when there is no photo', () => {
    const card = toVehicleCard(row({ primary_media_id: null }));

    expect(card.primaryImage).toBeNull();
  });

  it('reports the photo count', () => {
    expect(toVehicleCard(row({ photo_count: 12 })).photoCount).toBe(12);
  });
});

describe('bodyTypeLabel', () => {
  it('labels the known body types', () => {
    expect(bodyTypeLabel('HATCHBACK')).toBe('Hatchback');
    expect(bodyTypeLabel('SUV')).toBe('SUV');
  });

  it('falls back to the raw value for an unknown one', () => {
    expect(bodyTypeLabel('HOVERCRAFT')).toBe('HOVERCRAFT');
  });
});

describe('carCountLabel', () => {
  it('pluralises correctly', () => {
    expect(carCountLabel(1)).toBe('1 car available');
    expect(carCountLabel(18)).toBe('18 cars available');
    expect(carCountLabel(0)).toBe('0 cars available');
  });

  it('groups large numbers the Indian way', () => {
    expect(carCountLabel(1_20_000)).toBe('1,20,000 cars available');
  });

  it('takes a different suffix', () => {
    expect(carCountLabel(3, 'in Vellore')).toBe('3 cars in Vellore');
  });

  it('trims cleanly when the suffix is empty', () => {
    // The dealer-portfolio endpoint passes '' and renders the count on its own.
    expect(carCountLabel(3, '')).toBe('3 cars');
    expect(carCountLabel(1, '')).toBe('1 car');
  });
});
