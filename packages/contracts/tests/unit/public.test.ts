import { describe, expect, it } from 'vitest';

import { BodyType, FuelType, Transmission, VehicleColor } from '../../src/enums.js';
import {
  BodyTypeSlug,
  CarSuggestQuery,
  ColorSlug,
  DealerVehicleQuery,
  FuelSlug,
  KM_PRESETS,
  NO_VEHICLE_FACETS,
  OWNER_BUCKET_LABELS,
  OwnerBucket,
  PRICE_PRESETS,
  PublicVehicleQuery,
  TransmissionSlug,
  VEHICLE_SORT_LABELS,
  VehicleFacets,
  VehicleSort,
} from '../../src/public.js';

/**
 * The marketplace search's query grammar (**F076**). What a URL may carry is
 * the contract the filter panel writes to, so every rule here is one a client
 * can break by hand-editing a link.
 */
describe('the URL values for the three enums', () => {
  it('are the enums, lower-cased — one cannot gain a value the other lacks', () => {
    expect(FuelSlug.options).toEqual(FuelType.options.map((value) => value.toLowerCase()));
    expect(TransmissionSlug.options).toEqual(
      Transmission.options.map((value) => value.toLowerCase()),
    );
    expect(BodyTypeSlug.options).toEqual(BodyType.options.map((value) => value.toLowerCase()));
    expect(ColorSlug.options).toEqual(VehicleColor.options.map((value) => value.toLowerCase()));
  });
});

describe('PublicVehicleQuery', () => {
  it('defaults to the first page of 24, newest first', () => {
    expect(PublicVehicleQuery.parse({})).toEqual({ page: 1, limit: 24, sort: 'newest' });
  });

  it('reads a comma-separated list as OR, trimming blanks', () => {
    expect(
      PublicVehicleQuery.parse({ fuel: 'petrol, diesel,', city: 'arcot,arakkonam', owners: '1,4' }),
    ).toMatchObject({
      fuel: ['petrol', 'diesel'],
      city: ['arcot', 'arakkonam'],
      owners: ['1', '4'],
    });
  });

  it('coerces the ranges from the strings a URL carries', () => {
    expect(
      PublicVehicleQuery.parse({ minPrice: '500000', maxYear: '2022', maxKm: '40000' }),
    ).toMatchObject({ minPrice: 500_000, maxYear: 2022, maxKm: 40_000 });
  });

  it.each([
    [{ minPrice: '9', maxPrice: '1' }, 'minPrice'],
    [{ minYear: '2024', maxYear: '2020' }, 'minYear'],
    [{ minKm: '10', maxKm: '1' }, 'minKm'],
  ])('refuses a floor above its ceiling, naming the floor', (raw, field) => {
    const result = PublicVehicleQuery.safeParse(raw);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it('accepts a floor equal to its ceiling', () => {
    expect(PublicVehicleQuery.safeParse({ minYear: '2020', maxYear: '2020' }).success).toBe(true);
  });

  it.each([
    { fuel: 'kerosene' },
    { transmission: 'cvt' },
    { bodyType: 'coupe' },
    { owners: '0' },
    { brand: 'Hyundai' },
    { brand: '' },
    { sort: 'cheapest' },
    { limit: '49' },
    { page: '0' },
    { minPrice: '-1' },
    { minYear: '1900' },
    { dealerId: 'x' },
  ])('refuses %o', (raw) => {
    expect(PublicVehicleQuery.safeParse(raw).success).toBe(false);
  });
});

describe('DealerVehicleQuery', () => {
  it('takes every vehicle filter', () => {
    expect(
      DealerVehicleQuery.parse({ brand: 'tata', fuel: 'cng', sort: 'price_asc' }),
    ).toMatchObject({ brand: ['tata'], fuel: ['cng'], sort: 'price_asc' });
  });

  it.each(['district', 'city', 'dealer'])('refuses %s — the dealership decides it', (key) => {
    expect(DealerVehicleQuery.safeParse({ [key]: 'x' }).success).toBe(false);
  });
});

describe('what the panel is built from', () => {
  it('labels every sort and every owner bucket', () => {
    expect(Object.keys(VEHICLE_SORT_LABELS)).toEqual(VehicleSort.options);
    expect(Object.keys(OWNER_BUCKET_LABELS)).toEqual(OwnerBucket.options);
  });

  it('has presets that climb, open at both ends', () => {
    for (const presets of [PRICE_PRESETS, KM_PRESETS]) {
      expect(presets[0]?.min).toBeNull();
      expect(presets.at(-1)?.max).toBeNull();
      for (let index = 1; index < presets.length; index += 1) {
        expect(presets[index]?.min).toBe(presets[index - 1]?.max);
      }
    }
  });

  it('has an empty facets payload that is a valid one', () => {
    expect(VehicleFacets.parse(NO_VEHICLE_FACETS)).toEqual(NO_VEHICLE_FACETS);
  });
});

/**
 * The car typeahead's query (**R54**): the suggest grammar the dealers' box
 * uses, plus the marketplace's place parameters — and nothing else.
 */
describe('CarSuggestQuery', () => {
  it('takes a search, a limit and the place, and reads the place like the marketplace', () => {
    const parsed = CarSuggestQuery.parse({
      search: ' cre ',
      limit: '8',
      district: 'ranipet',
      city: 'arcot,walajapet',
    });
    expect(parsed).toEqual({
      search: 'cre',
      limit: 8,
      district: 'ranipet',
      city: ['arcot', 'walajapet'],
    });
  });

  it('refuses an empty search, a limit above ten and any filter it does not take', () => {
    expect(CarSuggestQuery.safeParse({ search: '   ' }).success).toBe(false);
    expect(CarSuggestQuery.safeParse({ search: 'cre', limit: 11 }).success).toBe(false);
    const extra = CarSuggestQuery.safeParse({ search: 'cre', brand: 'hyundai' });
    expect(extra.success).toBe(false);
    expect(extra.error?.issues[0]?.message).toMatch(/brand/);
  });
});
