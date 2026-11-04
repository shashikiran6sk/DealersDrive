import { describe, expect, it } from 'vitest';

import {
  priceRange,
  priceRupees,
  selectFeatured,
  selectGallery,
  showcaseCars,
  spreadIndexes,
} from '../src/data/featured';

import { card } from './fixtures';

function priced(slug: string, label: string | null) {
  return card({ slug, priceLabel: label });
}

describe('priceRupees', () => {
  it('reads the digits of an Indian price label', () => {
    expect(priceRupees('₹7,49,999')).toBe(749999);
  });

  it('is null for no label, no digits or zero', () => {
    expect(priceRupees(null)).toBeNull();
    expect(priceRupees('Price on request')).toBeNull();
    expect(priceRupees('₹0')).toBeNull();
  });
});

describe('showcaseCars', () => {
  it('keeps only available cars that have a photo', () => {
    const cars = [
      card({ slug: 'a' }),
      card({ slug: 'b', availability: 'RESERVED' }),
      card({ slug: 'c', image: null }),
    ];
    expect(showcaseCars(cars).map((c) => c.slug)).toEqual(['a']);
  });
});

describe('spreadIndexes', () => {
  it('spans first to last', () => {
    expect(spreadIndexes(19, 4)).toEqual([0, 6, 12, 18]);
  });

  it('handles short lists and single picks', () => {
    expect(spreadIndexes(3, 4)).toEqual([0, 1, 2]);
    expect(spreadIndexes(5, 1)).toEqual([4]);
    expect(spreadIndexes(0, 4)).toEqual([]);
  });
});

describe('selectFeatured', () => {
  it('spreads across the price range, cheapest first', () => {
    const cars = ['5', '1', '9', '3', '7', '2', '8'].map((lakh) =>
      priced(`car-${lakh}`, `₹${lakh},00,000`),
    );
    expect(selectFeatured(cars, 4).map((c) => c.slug)).toEqual([
      'car-1',
      'car-3',
      'car-7',
      'car-9',
    ]);
  });

  it('tops up with unpriced cars when too few are priced', () => {
    const cars = [priced('a', '₹5,00,000'), priced('b', null), priced('c', null)];
    expect(selectFeatured(cars, 4).map((c) => c.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('selectGallery', () => {
  it('prefers cars that were not featured, then fills with featured ones', () => {
    const cars = ['a', 'b', 'c', 'd'].map((slug) => card({ slug }));
    const featured = [cars[0], cars[2]].flatMap((c) => (c === undefined ? [] : [c]));
    expect(selectGallery(cars, featured, 3).map((c) => c.slug)).toEqual(['b', 'd', 'a']);
  });
});

describe('priceRange', () => {
  it('reads lowest to highest in lakh', () => {
    expect(priceRange([priced('a', '₹26,00,000'), priced('b', '₹3,75,000')])).toBe(
      '₹3.75 Lakh – ₹26.00 Lakh',
    );
  });

  it('collapses to one price and is null without prices', () => {
    expect(priceRange([priced('a', '₹5,00,000'), priced('b', '₹5,00,000')])).toBe('₹5.00 Lakh');
    expect(priceRange([priced('a', null)])).toBeNull();
  });
});
