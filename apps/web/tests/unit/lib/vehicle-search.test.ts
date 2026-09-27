import { describe, expect, it } from 'vitest';

import {
  activeFilterCount,
  clearFilters,
  csvOf,
  pageOf,
  PRICE_KEYS,
  rangeOf,
  readVehicleSearch,
  searchHref,
  setParam,
  setRange,
  toggleCsv,
} from '@/lib/vehicle-search';

/**
 * The search state lives in the URL and nowhere else (**F078**). These are the
 * functions every filter control writes it through, so a rule here is a rule
 * about every shared link, bookmark and back-button press.
 */
describe('reading the URL', () => {
  it('keeps what the API would accept, in the canonical order', () => {
    expect(
      readVehicleSearch({ fuel: 'petrol,diesel', district: 'ranipet', page: '2', utm: 'x' }),
    ).toEqual({ district: 'ranipet', fuel: 'petrol,diesel', page: '2' });
  });

  it('drops a value the API would refuse, and only that one', () => {
    expect(
      readVehicleSearch({ district: 'ranipet', fuel: 'kerosene', minPrice: 'lots', brand: 'tata' }),
    ).toEqual({ district: 'ranipet', brand: 'tata' });
  });

  it('drops the floor of an inverted range rather than the whole search', () => {
    expect(readVehicleSearch({ minYear: '2024', maxYear: '2020', brand: 'kia' })).toEqual({
      maxYear: '2020',
      brand: 'kia',
    });
  });

  it('reads only the vehicle filters on a dealership page', () => {
    expect(
      readVehicleSearch({ district: 'ranipet', city: 'arcot', dealer: 'x', fuel: 'cng' }, 'dealer'),
    ).toEqual({ fuel: 'cng' });
  });

  it('takes the first of a repeated parameter and ignores blanks', () => {
    expect(readVehicleSearch({ brand: ['kia', 'tata'], q: '  ' })).toEqual({ brand: 'kia' });
  });
});

describe('writing the URL', () => {
  it('orders the parameters one way, whatever order they were set in', () => {
    expect(searchHref('/cars', { sort: 'price_asc', fuel: 'cng', district: 'ranipet' })).toBe(
      '/cars?district=ranipet&fuel=cng&sort=price_asc',
    );
  });

  it('leaves out the defaults, so there is one URL for one search', () => {
    expect(searchHref('/cars', { sort: 'newest', page: '1' })).toBe('/cars');
  });

  it('sorts a multi-select and resets the page when it changes', () => {
    const next = toggleCsv({ brand: 'tata', page: '3' }, 'brand', 'hyundai');
    expect(next).toEqual({ brand: 'hyundai,tata' });
    expect(toggleCsv(next, 'brand', 'tata')).toEqual({ brand: 'hyundai' });
    expect(toggleCsv({ brand: 'tata' }, 'brand', 'tata')).toEqual({});
  });

  it('resets the page on any change but the page itself', () => {
    expect(setParam({ page: '4', fuel: 'cng' }, 'sort', 'km_asc')).toEqual({
      fuel: 'cng',
      sort: 'km_asc',
    });
    expect(setParam({ page: '4' }, 'page', '5')).toEqual({ page: '5' });
  });

  it('writes and clears a range as its two bounds', () => {
    const priced = setRange({}, PRICE_KEYS, 50_000_000, null);
    expect(priced).toEqual({ minPrice: '50000000' });
    expect(rangeOf(priced, PRICE_KEYS)).toEqual({ min: 50_000_000, max: null });
    expect(setRange(priced, PRICE_KEYS, null, null)).toEqual({});
  });
});

describe('clearing', () => {
  it('clears every filter but keeps the district, the search and the sort', () => {
    expect(
      clearFilters({
        district: 'ranipet',
        city: 'arcot',
        dealer: 'x',
        q: 'creta',
        brand: 'hyundai',
        minKm: '0',
        sort: 'price_asc',
        page: '3',
      }),
    ).toEqual({ district: 'ranipet', q: 'creta', sort: 'price_asc' });
  });

  it('counts each ticked value and each range once', () => {
    expect(
      activeFilterCount({
        brand: 'hyundai,kia',
        fuel: 'cng',
        minPrice: '1',
        maxPrice: '9',
        q: 'x',
      }),
    ).toBe(4);
    expect(activeFilterCount({ district: 'ranipet', sort: 'km_asc' })).toBe(0);
  });

  it('reads a list and a page defensively', () => {
    expect(csvOf({ brand: 'a,,b ' }, 'brand')).toEqual(['a', 'b']);
    expect(pageOf({ page: 'x' })).toBe(1);
    expect(pageOf({ page: '3' })).toBe(3);
  });
});
