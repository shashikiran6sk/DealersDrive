import { describe, expect, it } from 'vitest';

import {
  buildLandingPages,
  facetsOfListing,
  resolveTown,
} from '../../../../src/modules/search/search.landing.js';
import type {
  LandingDealerRow,
  LandingListingRow,
} from '../../../../src/modules/search/search.repository.js';

const RANIPET: LandingDealerRow = { city: 'Arcot', district: 'Ranipet', state: 'Tamil Nadu' };
const VELLORE: LandingDealerRow = { city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu' };
const KATPADI: LandingDealerRow = { city: 'Katpadi', district: 'Vellore', state: 'Tamil Nadu' };

let clock = 0;

function car(
  dealer: Pick<LandingDealerRow, 'city' | 'district'>,
  vehicle: Partial<LandingListingRow['vehicle']> = {},
  updatedAt = new Date(Date.UTC(2026, 9, 1) + (clock += 60_000)),
): LandingListingRow {
  return {
    updatedAt,
    dealer: { city: dealer.city, district: dealer.district },
    vehicle: {
      make: 'Maruti Suzuki',
      model: 'Swift',
      fuelType: 'PETROL',
      transmission: 'MANUAL',
      bodyType: 'HATCHBACK',
      pricePaise: 45_000_000n,
      updatedAt,
      ...vehicle,
    },
  };
}

function page(result: ReturnType<typeof buildLandingPages>, place: string, facet: string | null) {
  return result.pages.find((entry) => entry.place === place && entry.facet === facet);
}

const SRI_MURUGAN = [
  car(RANIPET),
  car(RANIPET),
  car(RANIPET, { model: 'Baleno', pricePaise: 68_000_000n }),
  car(RANIPET, {
    make: 'Hyundai',
    model: 'Creta',
    fuelType: 'DIESEL',
    bodyType: 'SUV',
    pricePaise: 120_000_000n,
  }),
  car(RANIPET, { make: 'Hyundai', model: 'i20', pricePaise: 62_000_000n }),
  car(RANIPET, {
    make: 'Tata',
    model: 'Nexon',
    fuelType: 'DIESEL',
    bodyType: 'SUV',
    pricePaise: 95_000_000n,
  }),
];

describe('the Ranipet example', () => {
  const result = buildLandingPages([RANIPET], SRI_MURUGAN);

  it('lists the district and the town, each with its six cars', () => {
    expect(result.places).toEqual([
      {
        slug: 'ranipet',
        name: 'Ranipet',
        kind: 'DISTRICT',
        district: { slug: 'ranipet', name: 'Ranipet' },
        state: 'Tamil Nadu',
        cars: 6,
      },
      {
        slug: 'arcot',
        name: 'Arcot',
        kind: 'TOWN',
        district: { slug: 'ranipet', name: 'Ranipet' },
        state: 'Tamil Nadu',
        cars: 6,
      },
    ]);
  });

  it('counts every facet the cars have, in the town and the district alike', () => {
    for (const place of ['ranipet', 'arcot']) {
      expect(page(result, place, null)?.cars).toBe(6);
      expect(page(result, place, 'maruti-suzuki')).toMatchObject({
        kind: 'BRAND',
        label: 'Maruti Suzuki',
        cars: 3,
      });
      expect(page(result, place, 'maruti-suzuki-swift')).toMatchObject({
        kind: 'MODEL',
        label: 'Maruti Suzuki Swift',
        cars: 2,
      });
      expect(page(result, place, 'hyundai')?.cars).toBe(2);
      expect(page(result, place, 'petrol')?.cars).toBe(4);
      expect(page(result, place, 'diesel')?.cars).toBe(2);
      expect(page(result, place, 'suv')?.cars).toBe(2);
      expect(page(result, place, 'under-5-lakh')).toMatchObject({ kind: 'PRICE', cars: 2 });
      expect(page(result, place, 'under-7-lakh')?.cars).toBe(4);
      expect(page(result, place, 'under-10-lakh')?.cars).toBe(5);
      expect(page(result, place, 'hyundai-creta')?.cars).toBe(1);
      expect(page(result, place, 'tata')?.cars).toBe(1);
      expect(page(result, place, 'under-3-lakh')).toBeUndefined();
    }
  });

  it('says how many cars a page needs to be indexed', () => {
    expect(result.minCars).toBe(2);
  });

  it("dates a page by the newest change to one of its cars, never the request's time", () => {
    const newest = Math.max(...SRI_MURUGAN.map((row) => row.updatedAt.getTime()));
    expect(page(result, 'arcot', null)?.lastModified).toBe(new Date(newest).toISOString());
    const swifts = SRI_MURUGAN.slice(0, 2).map((row) => row.updatedAt.getTime());
    expect(page(result, 'arcot', 'maruti-suzuki-swift')?.lastModified).toBe(
      new Date(Math.max(...swifts)).toISOString(),
    );
  });
});

describe('a town that shares its district’s name', () => {
  const result = buildLandingPages(
    [VELLORE, KATPADI],
    [car(VELLORE), car(VELLORE), car(KATPADI), car(KATPADI)],
  );

  it('is the district, not a second place competing with it', () => {
    expect(result.places.map((place) => [place.slug, place.kind])).toEqual([
      ['vellore', 'DISTRICT'],
      ['katpadi', 'TOWN'],
    ]);
  });

  it('counts the whole district under the district’s pages', () => {
    expect(page(result, 'vellore', null)?.cars).toBe(4);
    expect(page(result, 'vellore', 'maruti-suzuki')?.cars).toBe(4);
    expect(page(result, 'katpadi', null)?.cars).toBe(2);
  });

  it('treats a legacy spelling of the district as the district too', () => {
    const kanchi = buildLandingPages(
      [{ city: 'Kanchipuram', district: 'Kancheepuram', state: 'Tamil Nadu' }],
      [],
    );
    expect(kanchi.places.map((place) => [place.slug, place.kind])).toEqual([
      ['kancheepuram', 'DISTRICT'],
    ]);
  });
});

describe('an ambiguous town', () => {
  it('belongs to the district most of its dealerships are in, so one mis-filed dealer cannot remove it', () => {
    const misfiled = { city: 'Katpadi', district: 'Search South', state: 'Tamil Nadu' };
    const result = buildLandingPages(
      [KATPADI, KATPADI, misfiled],
      [car(KATPADI), car(KATPADI), car(misfiled)],
    );
    expect(result.places.find((place) => place.slug === 'katpadi')).toMatchObject({
      kind: 'TOWN',
      district: { slug: 'vellore' },
      cars: 2,
    });
    expect(page(result, 'katpadi', null)?.cars).toBe(2);
  });

  it('gets no place when two districts have as many dealerships in a town of that name', () => {
    const result = buildLandingPages(
      [
        { city: 'Palayam', district: 'Vellore', state: 'Tamil Nadu' },
        { city: 'Palayam', district: 'Ranipet', state: 'Tamil Nadu' },
      ],
      [
        car({ city: 'Palayam', district: 'Vellore' }),
        car({ city: 'Palayam', district: 'Ranipet' }),
      ],
    );
    expect(result.places.map((place) => place.slug)).toEqual(['ranipet', 'vellore']);
    expect(result.pages.some((entry) => entry.place === 'palayam')).toBe(false);
  });

  it('gets no place when its name is a different district', () => {
    const one = (district: string) => new Map([[district, 1]]);
    expect(resolveTown('ranipet', one('vellore'), new Set(['vellore', 'ranipet']))).toEqual({
      kind: 'AMBIGUOUS',
    });
    expect(resolveTown('arcot', one('ranipet'), new Set(['ranipet']))).toEqual({
      kind: 'TOWN',
      district: 'ranipet',
    });
    expect(resolveTown('vellore', one('vellore'), new Set(['vellore']))).toEqual({
      kind: 'DISTRICT',
      district: 'vellore',
    });
    expect(
      resolveTown(
        'vellore',
        new Map([
          ['vellore', 3],
          ['ranipet', 1],
        ]),
        new Set(['vellore']),
      ),
    ).toEqual({ kind: 'DISTRICT', district: 'vellore' });
  });
});

describe('what never gets a page', () => {
  it('a brand outside the closed list, and the models under it', () => {
    const facets = facetsOfListing(car(RANIPET, { make: 'Premier Padmini Motors Co' }).vehicle);
    expect(facets.map((facet) => facet.kind)).not.toContain('BRAND');
    expect(facets.map((facet) => facet.kind)).not.toContain('MODEL');
  });

  it('files an aliased spelling under its canonical brand', () => {
    const facets = facetsOfListing(car(RANIPET, { make: 'MARUTI', model: 'Alto K10' }).vehicle);
    expect(facets.filter((facet) => facet.kind === 'BRAND' || facet.kind === 'MODEL')).toEqual([
      { facet: 'maruti-suzuki', kind: 'BRAND', label: 'Maruti Suzuki' },
      { facet: 'maruti-suzuki-alto-k10', kind: 'MODEL', label: 'Maruti Suzuki Alto K10' },
    ]);
  });

  it('a price band for a car with no price, or a facet the car does not state', () => {
    const facets = facetsOfListing(
      car(RANIPET, {
        pricePaise: null,
        fuelType: null,
        bodyType: null,
        transmission: null,
        model: '  ',
      }).vehicle,
    );
    expect(facets).toEqual([{ facet: 'maruti-suzuki', kind: 'BRAND', label: 'Maruti Suzuki' }]);
  });

  it('a car whose dealership has no district', () => {
    const result = buildLandingPages([], [car({ city: 'Arcot', district: null })]);
    expect(result).toEqual({ minCars: 2, places: [], pages: [] });
  });

  it('a place with no cars, which is still listed with a count of zero', () => {
    const result = buildLandingPages([RANIPET], []);
    expect(result.places.map((place) => [place.slug, place.cars])).toEqual([
      ['ranipet', 0],
      ['arcot', 0],
    ]);
    expect(result.pages).toEqual([]);
  });
});

describe('spellings', () => {
  it('names a model the way most of its dealers spell it', () => {
    const result = buildLandingPages(
      [RANIPET],
      [
        car(RANIPET, { model: 'WagonR' }),
        car(RANIPET, { model: 'Wagon R' }),
        car(RANIPET, { model: 'Wagon R' }),
      ],
    );
    expect(page(result, 'arcot', 'maruti-suzuki-wagon-r')).toMatchObject({
      label: 'Maruti Suzuki Wagon R',
      cars: 2,
    });
    expect(page(result, 'arcot', 'maruti-suzuki-wagonr')?.cars).toBe(1);
  });
});
