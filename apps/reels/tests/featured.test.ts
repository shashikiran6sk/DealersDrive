import { describe, expect, it } from 'vitest';

import {
  pickFeatured,
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

describe('selectFeatured with models', () => {
  const byTitle = (c: { title: string }) => c.title.replace(/^\d{4} /, '');

  it('features each model once, keeping the newest, before repeating any', () => {
    const cars = [
      card({ slug: 'eeco-15', title: '2015 Eeco', year: 2015, priceLabel: '₹3,75,000' }),
      card({ slug: 'eeco-20', title: '2020 Eeco', year: 2020, priceLabel: '₹5,15,000' }),
      card({ slug: 'eeco-19', title: '2019 Eeco', year: 2019, priceLabel: '₹5,00,000' }),
      card({ slug: 'vento', title: '2012 Vento', year: 2012, priceLabel: '₹3,75,000' }),
      card({ slug: 'innova', title: '2012 Innova', year: 2012, priceLabel: '₹10,00,000' }),
    ];
    expect(selectFeatured(cars, 3, byTitle).map((c) => c.slug)).toEqual([
      'vento',
      'eeco-20',
      'innova',
    ]);
    expect(selectFeatured(cars, 4, byTitle).map((c) => c.slug)).toEqual([
      'vento',
      'eeco-15',
      'eeco-20',
      'innova',
    ]);
  });

  it('keeps the first of two same-year cars of one model', () => {
    const cars = [
      card({ slug: 'a', title: '2020 Eeco', priceLabel: '₹5,00,000' }),
      card({ slug: 'b', title: '2020 Eeco', priceLabel: '₹4,00,000' }),
      card({ slug: 'c', title: '2020 Swift', year: null, priceLabel: '₹6,00,000' }),
    ];
    expect(selectFeatured(cars, 2, byTitle).map((c) => c.slug)).toEqual(['a', 'c']);
  });
});

describe('pickFeatured', () => {
  const cars = [
    card({ slug: 'creta', title: '2016 Hyundai Creta', priceLabel: '₹7,25,000' }),
    card({ slug: 'brv', title: '2017 Honda BR-V', priceLabel: '₹7,50,000' }),
    card({ slug: 'eeco-a', title: '2015 Maruti Suzuki Eeco', priceLabel: '₹3,75,000' }),
    card({ slug: 'eeco-b', title: '2020 Maruti Suzuki Eeco', priceLabel: '₹5,15,000' }),
  ];

  it('picks the named cars, by model or slug, cheapest first', () => {
    expect(pickFeatured(cars, ['brv', 'creta', 'eeco-b'], 8).map((c) => c.slug)).toEqual([
      'eeco-b',
      'creta',
      'brv',
    ]);
  });

  it('gives a repeated name the next matching car', () => {
    expect(pickFeatured(cars, ['eeco', 'eeco'], 8).map((c) => c.slug)).toEqual([
      'eeco-a',
      'eeco-b',
    ]);
  });

  it('names a term nothing matches, and refuses too many', () => {
    expect(() => pickFeatured(cars, ['duster'], 8)).toThrow(/"duster".*Hyundai Creta/);
    expect(() => pickFeatured(cars, ['a', 'b', 'c'], 2)).toThrow(/At most 2/);
  });
});
