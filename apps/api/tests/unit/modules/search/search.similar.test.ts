import { describe, expect, it } from 'vitest';

import {
  SIMILARITY_WEIGHTS,
  priceGap,
  rankSimilar,
  similarityScore,
  type SimilarTraits,
} from '../../../../src/modules/search/search.similar.js';
import { similarPoolWhere } from '../../../../src/modules/search/search.repository.js';

/**
 * R73 — similar vehicles, ranked by a small deterministic score. Every weight
 * is asserted by building a candidate that differs from the source in exactly
 * one trait.
 */
const SOURCE: SimilarTraits = {
  id: 'source',
  make: 'Hyundai',
  model: 'Creta',
  bodyType: 'SUV',
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  manufacturingYear: 2021,
  pricePaise: 100_000_000n,
  district: 'Vellore',
  publishedAt: new Date('2026-09-01T00:00:00Z'),
};

const NOTHING_IN_COMMON: SimilarTraits = {
  id: 'other',
  make: 'Tata',
  model: 'Tiago',
  bodyType: 'HATCHBACK',
  fuelType: 'CNG',
  transmission: 'MANUAL',
  manufacturingYear: 2012,
  pricePaise: 30_000_000n,
  district: 'Chennai',
  publishedAt: new Date('2026-09-02T00:00:00Z'),
};

function car(id: string, overrides: Partial<SimilarTraits> = {}): SimilarTraits {
  return { ...NOTHING_IN_COMMON, id, ...overrides };
}

describe('similarityScore', () => {
  it('scores a car with nothing in common as zero', () => {
    expect(similarityScore(SOURCE, NOTHING_IN_COMMON)).toBe(0);
  });

  it.each([
    ['the same make', { make: 'HYUNDAI' }, SIMILARITY_WEIGHTS.sameMake],
    [
      'the same model of the same make',
      { make: 'Hyundai', model: 'creta' },
      SIMILARITY_WEIGHTS.sameMake + SIMILARITY_WEIGHTS.sameModel,
    ],
    ['the same model name under another make', { model: 'Creta' }, 0],
    ['the same body type', { bodyType: 'SUV' as const }, SIMILARITY_WEIGHTS.sameBodyType],
    ['the same district', { district: 'vellore' }, SIMILARITY_WEIGHTS.sameDistrict],
    ['a price within 20%', { pricePaise: 118_000_000n }, SIMILARITY_WEIGHTS.closePrice],
    ['a price just outside 20%', { pricePaise: 121_000_000n }, 0],
    ['the same fuel', { fuelType: 'PETROL' as const }, SIMILARITY_WEIGHTS.sameFuel],
    [
      'the same transmission',
      { transmission: 'AUTOMATIC' as const },
      SIMILARITY_WEIGHTS.sameTransmission,
    ],
    ['a year within two', { manufacturingYear: 2023 }, SIMILARITY_WEIGHTS.closeYear],
    ['a year three away', { manufacturingYear: 2018 }, 0],
  ] as const)('adds its weight for %s', (_label, overrides, expected) => {
    expect(similarityScore(SOURCE, car('c', overrides))).toBe(expected);
  });

  it('never matches on an unknown value', () => {
    const unknown: SimilarTraits = {
      ...SOURCE,
      id: 'u',
      make: null,
      model: null,
      bodyType: null,
      fuelType: null,
      transmission: null,
      manufacturingYear: null,
      pricePaise: null,
      district: null,
    };
    expect(similarityScore(unknown, unknown)).toBe(0);
  });
});

describe('priceGap', () => {
  it('is the relative distance from the source price, and unknown without both', () => {
    expect(priceGap(100n, 80n)).toBeCloseTo(0.2);
    expect(priceGap(100n, null)).toBeNull();
    expect(priceGap(0n, 100n)).toBeNull();
  });
});

describe('rankSimilar', () => {
  const identity = (row: SimilarTraits) => row;

  it('puts the closest car first and never returns the source itself', () => {
    const ranked = rankSimilar(
      SOURCE,
      [
        car('far'),
        car('same-body', { bodyType: 'SUV' }),
        { ...SOURCE },
        car('same-model', { make: 'Hyundai', model: 'Creta' }),
      ],
      identity,
      4,
    );
    expect(ranked.map((row) => row.id)).toEqual(['same-model', 'same-body', 'far']);
  });

  it('breaks ties by the closer price, then the newer listing, then the id', () => {
    const ranked = rankSimilar(
      SOURCE,
      [
        car('b', { bodyType: 'SUV', pricePaise: 150_000_000n }),
        car('a', { bodyType: 'SUV', pricePaise: 150_000_000n }),
        car('newer', {
          bodyType: 'SUV',
          pricePaise: 150_000_000n,
          publishedAt: new Date('2026-09-20T00:00:00Z'),
        }),
        car('closer', { bodyType: 'SUV', pricePaise: 140_000_000n }),
      ],
      identity,
      4,
    );
    expect(ranked.map((row) => row.id)).toEqual(['closer', 'newer', 'a', 'b']);
  });

  it('returns the same order whatever order the candidates arrive in', () => {
    const pool = [
      car('x', { bodyType: 'SUV' }),
      car('y', { make: 'Hyundai' }),
      car('z', { district: 'Vellore' }),
      car('w', { fuelType: 'PETROL' }),
    ];
    const once = rankSimilar(SOURCE, pool, identity, 4).map((row) => row.id);
    const reversed = rankSimilar(SOURCE, [...pool].reverse(), identity, 4).map((row) => row.id);
    expect(reversed).toEqual(once);
  });

  it('stops at the limit', () => {
    const pool = Array.from({ length: 10 }, (_, index) => car(`c${String(index)}`));
    expect(rankSimilar(SOURCE, pool, identity, 4)).toHaveLength(4);
  });
});

describe('the candidate pool', () => {
  it('is available cars only, never the source, near on make, body type, price or district', () => {
    const where = similarPoolWhere(SOURCE);
    expect(where).toMatchObject({
      status: 'ACTIVE',
      dealer: { status: 'ACTIVE' },
      id: { not: 'source' },
    });
    expect(where.OR).toHaveLength(4);
  });

  it('only asks about what the source actually has', () => {
    const where = similarPoolWhere({ ...SOURCE, make: null, pricePaise: null });
    expect(where.OR).toHaveLength(2);
  });
});
