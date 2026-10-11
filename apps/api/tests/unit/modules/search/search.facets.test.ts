import { describe, expect, it } from 'vitest';

import {
  cityFacet,
  dealerFacet,
  fuelFacet,
  locationScope,
  modelFacet,
  oneDealerScope,
  ownerFacet,
  rangeFacets,
  textFacet,
  yearFacet,
  type PublicDealerRow,
} from '../../../../src/modules/search/search.facets.js';

const DEALERS: PublicDealerRow[] = [
  { id: 'a', slug: 'arcot-motors', brandName: 'Arcot Motors', city: 'Arcot', district: 'Ranipet' },
  { id: 'b', slug: 'royal-cars', brandName: 'Royal Cars', city: 'Arakkonam', district: 'Ranipet' },
  { id: 'c', slug: 'prime-auto', brandName: 'Prime Auto', city: 'Arcot', district: 'Ranipet' },
  {
    id: 'd',
    slug: 'vellore-cars',
    brandName: 'Vellore Cars',
    city: 'Katpadi',
    district: 'Vellore',
  },
];

describe('the location scope', () => {
  it('resolves old district filter URLs to canonical districts after backfill', () => {
    const dealer = {
      id: 'legacy',
      slug: 'legacy',
      brandName: 'Legacy QA',
      city: 'Preserved Town',
      district: 'Tirupathur',
    };
    expect(locationScope([dealer], { district: 'tirupattur' }).resultIds).toEqual(['legacy']);
    expect(
      locationScope([{ ...dealer, district: 'Tirupattur' }], { district: 'tirupathur' }).resultIds,
    ).toEqual(['legacy']);
  });
  it('is no restriction at all with no district, town or dealer', () => {
    const scope = locationScope(DEALERS, {});
    expect(scope.resultIds).toBeNull();
    expect(scope.scopeIds).toBeNull();
    expect(scope.inScope).toHaveLength(4);
  });

  it('narrows to the district, then the towns, then the dealers', () => {
    expect(locationScope(DEALERS, { district: 'ranipet' }).resultIds).toEqual(['a', 'b', 'c']);
    expect(locationScope(DEALERS, { district: 'ranipet', city: ['arcot'] }).resultIds).toEqual([
      'a',
      'c',
    ]);
    expect(
      locationScope(DEALERS, { district: 'ranipet', city: ['arcot'], dealer: ['prime-auto'] })
        .resultIds,
    ).toEqual(['c']);
  });

  it('never lets a town or dealer outside the district back in', () => {
    const scope = locationScope(DEALERS, {
      district: 'ranipet',
      city: ['katpadi'],
      dealer: ['vellore-cars'],
    });
    expect(scope.resultIds).toEqual([]);
  });

  it('is an empty scope, not every dealership, for a district nobody is in', () => {
    const scope = locationScope(DEALERS, { district: 'atlantis' });
    expect(scope.resultIds).toEqual([]);
    expect(scope.scopeIds).toEqual([]);
  });

  it('is one dealership for a portfolio', () => {
    const scope = oneDealerScope(DEALERS[0]!);
    expect(scope.resultIds).toEqual(['a']);
  });
});

describe('town and dealer facets', () => {
  const counts = new Map([
    ['a', 5],
    ['b', 3],
    ['c', 2],
    ['d', 9],
  ]);

  it('lists only the towns of the district, counted over their dealers', () => {
    const scope = locationScope(DEALERS, { district: 'ranipet' });
    expect(cityFacet(counts, scope, undefined)).toEqual([
      { value: 'arcot', label: 'Arcot', count: 7 },
      { value: 'arakkonam', label: 'Arakkonam', count: 3 },
    ]);
  });

  it('counts towns under the dealer filter, and dealers under the town filter', () => {
    const byDealer = locationScope(DEALERS, { district: 'ranipet', dealer: ['royal-cars'] });
    expect(cityFacet(counts, byDealer, undefined)).toEqual([
      { value: 'arakkonam', label: 'Arakkonam', count: 3 },
    ]);

    const byTown = locationScope(DEALERS, { district: 'ranipet', city: ['arcot'] });
    expect(dealerFacet(counts, byTown, undefined)).toEqual([
      { value: 'arcot-motors', label: 'Arcot Motors', count: 5 },
      { value: 'prime-auto', label: 'Prime Auto', count: 2 },
    ]);
  });

  it('leaves out a dealer with nothing to show, unless it is ticked', () => {
    const scope = locationScope(DEALERS, { district: 'ranipet', dealer: ['arcot-motors'] });
    const none = new Map<string, number>([['b', 1]]);
    expect(dealerFacet(none, scope, ['arcot-motors'])).toEqual([
      { value: 'royal-cars', label: 'Royal Cars', count: 1 },
      { value: 'arcot-motors', label: 'Arcot Motors', count: 0 },
    ]);
  });
});

describe('text facets', () => {
  it('merges spellings by slug and labels with the commonest one', () => {
    expect(
      textFacet(
        [
          { value: 'Maruti Suzuki', count: 4 },
          { value: 'MARUTI SUZUKI', count: 1 },
          { value: 'Hyundai', count: 5 },
          { value: null, count: 7 },
          { value: '   ', count: 2 },
        ],
        undefined,
      ),
    ).toEqual([
      { value: 'hyundai', label: 'Hyundai', count: 5 },
      { value: 'maruti-suzuki', label: 'Maruti Suzuki', count: 5 },
    ]);
  });

  it('keeps a ticked value with nothing behind it, so it can be unticked', () => {
    expect(textFacet([{ value: 'Tata', count: 2 }], ['bugatti'])).toEqual([
      { value: 'tata', label: 'Tata', count: 2 },
      { value: 'bugatti', label: 'Bugatti', count: 0 },
    ]);
  });

  it('names the brand of every model', () => {
    expect(
      modelFacet(
        [
          { make: 'Hyundai', model: 'Creta', count: 3 },
          { make: 'Hyundai', model: 'Venue', count: 1 },
        ],
        undefined,
      ),
    ).toEqual([
      { value: 'creta', label: 'Creta', count: 3, parent: 'hyundai' },
      { value: 'venue', label: 'Venue', count: 1, parent: 'hyundai' },
    ]);
  });
});

describe('the fixed facets', () => {
  it('labels an enum and writes it as the URL spells it', () => {
    expect(
      fuelFacet(
        [
          { value: 'DIESEL', count: 2 },
          { value: 'PETROL', count: 5 },
          { value: null, count: 1 },
        ],
        ['cng'],
      ),
    ).toEqual([
      { value: 'petrol', label: 'Petrol', count: 5 },
      { value: 'diesel', label: 'Diesel', count: 2 },
      { value: 'cng', label: 'CNG', count: 0 },
    ]);
  });

  it('buckets owners at four or more, in order', () => {
    expect(
      ownerFacet(
        [
          { value: 5, count: 1 },
          { value: 1, count: 6 },
          { value: 4, count: 2 },
          { value: 0, count: 9 },
        ],
        undefined,
      ),
    ).toEqual([
      { value: '1', label: 'First owner', count: 6 },
      { value: '4', label: 'Fourth owner or more', count: 3 },
    ]);
  });

  it('lists years newest first', () => {
    expect(
      yearFacet([
        { value: 2019, count: 1 },
        { value: null, count: 4 },
        { value: 2023, count: 2 },
      ]).map((option) => option.value),
    ).toEqual(['2023', '2019']);
  });

  it('pairs each preset with its count', () => {
    expect(rangeFacets([{ min: null, max: 10, label: 'Under 10' }], [7])).toEqual([
      { min: null, max: 10, label: 'Under 10', count: 7 },
    ]);
  });
});
