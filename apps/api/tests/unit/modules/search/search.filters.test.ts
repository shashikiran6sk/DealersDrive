import { PublicVehicleQuery } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import {
  inventoryWhere,
  listingWhere,
  needsVocabulary,
  orderOf,
  resolveFilters,
  vehicleWhere,
  wordsOf,
  type Vocabulary,
} from '../../../../src/modules/search/search.filters.js';
import { PUBLIC_LISTING_WHERE } from '../../../../src/modules/search/search.repository.js';

const VOCABULARY: Vocabulary = {
  makes: ['Hyundai', 'Maruti Suzuki', 'MARUTI SUZUKI', 'Tata'],
  models: [
    { make: 'Hyundai', model: 'Creta' },
    { make: 'Hyundai', model: 'Venue' },
    { make: 'Tata', model: 'Nexon' },
  ],
};

function filtersOf(raw: Record<string, string>) {
  const query = PublicVehicleQuery.parse(raw);
  return resolveFilters(query, needsVocabulary(query) ? VOCABULARY : null);
}

describe('the words of a text search', () => {
  it('collapses spacing and keeps at most six words', () => {
    expect(wordsOf('  hyundai   creta ')).toEqual(['hyundai', 'creta']);
    expect(wordsOf('a b c d e f g h')).toHaveLength(6);
    expect(wordsOf(undefined)).toEqual([]);
  });

  it('requires every word to match somewhere, case-insensitively', () => {
    expect(vehicleWhere(filtersOf({ q: 'creta sx' }))).toEqual({
      AND: ['creta', 'sx'].map((word) => {
        const contains = { contains: word, mode: 'insensitive' };
        return {
          OR: [
            { make: contains },
            { model: contains },
            { variant: contains },
            { dealer: { brandName: contains } },
          ],
        };
      }),
    });
  });

  it('never searches the registration or anything private', () => {
    const text = JSON.stringify(vehicleWhere(filtersOf({ q: 'KA01' })));
    expect(text).not.toMatch(/registration|rtoCode|description|phone|email/i);
  });
});

describe('text a dealer typed, matched by its slug', () => {
  it('asks for the vocabulary only when a slug has to be resolved', () => {
    expect(needsVocabulary(PublicVehicleQuery.parse({ fuel: 'petrol' }))).toBe(false);
    expect(needsVocabulary(PublicVehicleQuery.parse({ brand: 'tata' }))).toBe(true);
    expect(needsVocabulary(PublicVehicleQuery.parse({ color: 'red' }))).toBe(false);
  });

  it('matches every spelling that slugifies to the value, so case variants are one brand', () => {
    expect(filtersOf({ brand: 'maruti-suzuki' }).makes).toEqual(['Maruti Suzuki', 'MARUTI SUZUKI']);
    expect(filtersOf({ color: 'white,other' }).colors).toEqual(['WHITE', 'OTHER']);
  });

  it('resolves a slug nobody carries to nothing, which is an empty page rather than no filter', () => {
    const filters = filtersOf({ brand: 'bugatti' });
    expect(filters.makes).toEqual([]);
    expect(vehicleWhere(filters)).toEqual({ AND: [{ make: { in: [] } }] });
  });
});

describe('the rest of the filters', () => {
  it('turns ranges into inclusive bounds', () => {
    expect(
      vehicleWhere(
        filtersOf({ minPrice: '50000000', maxPrice: '100000000', minKm: '0', maxYear: '2020' }),
      ),
    ).toEqual({
      AND: [
        { pricePaise: { gte: 50_000_000, lte: 100_000_000 } },
        { manufacturingYear: { lte: 2020 } },
        { kilometersDriven: { gte: 0 } },
      ],
    });
  });

  it('maps URL values to the enums, and ORs within a group', () => {
    expect(
      vehicleWhere(
        filtersOf({ fuel: 'petrol,diesel', transmission: 'automatic', bodyType: 'suv' }),
      ),
    ).toEqual({
      AND: [
        { fuelType: { in: ['PETROL', 'DIESEL'] } },
        { transmission: { in: ['AUTOMATIC'] } },
        { bodyType: { in: ['SUV'] } },
      ],
    });
  });

  it('reads the fourth owner bucket as four or more', () => {
    expect(vehicleWhere(filtersOf({ owners: '1,4' }))).toEqual({
      AND: [{ OR: [{ ownerCount: { in: [1] } }, { ownerCount: { gte: 4 } }] }],
    });
  });

  it('leaves a group out when its own facet is being counted', () => {
    const filters = filtersOf({ fuel: 'petrol', brand: 'tata', model: 'nexon' });
    expect(JSON.stringify(vehicleWhere(filters, ['fuel']))).not.toContain('fuelType');
    const brandless = JSON.stringify(vehicleWhere(filters, ['brand', 'model']));
    expect(brandless).not.toContain('"make"');
    expect(brandless).not.toContain('"model"');
    expect(brandless).toContain('fuelType');
  });
});

describe('the public rule underneath every query', () => {
  it('is the public rule alone with no location, and narrowed by dealer ids with one', () => {
    expect(listingWhere(null)).toBe(PUBLIC_LISTING_WHERE);
    expect(listingWhere(['d1'])).toEqual({ ...PUBLIC_LISTING_WHERE, dealerId: { in: ['d1'] } });
    expect(listingWhere([])).toEqual({ ...PUBLIC_LISTING_WHERE, dealerId: { in: [] } });
  });

  it('puts it under every facet count too', () => {
    expect(inventoryWhere(filtersOf({}), ['d1'])).toEqual({
      listing: { is: { ...PUBLIC_LISTING_WHERE, dealerId: { in: ['d1'] } } },
    });
  });
});

describe('the order', () => {
  it('ends every sort on the newest approval and the id, so pages are stable', () => {
    for (const sort of ['newest', 'price_asc', 'price_desc', 'year_desc', 'km_asc'] as const) {
      expect(orderOf(sort).slice(-2)).toEqual([{ publishedAt: 'desc' }, { id: 'desc' }]);
    }
  });

  it('puts cars with no price, year or distance last', () => {
    expect(orderOf('price_asc')[0]).toEqual({
      vehicle: { pricePaise: { sort: 'asc', nulls: 'last' } },
    });
    expect(orderOf('price_desc')[0]).toEqual({
      vehicle: { pricePaise: { sort: 'desc', nulls: 'last' } },
    });
    expect(orderOf('year_desc')[0]).toEqual({
      vehicle: { manufacturingYear: { sort: 'desc', nulls: 'last' } },
    });
    expect(orderOf('km_asc')[0]).toEqual({
      vehicle: { kilometersDriven: { sort: 'asc', nulls: 'last' } },
    });
  });
});
