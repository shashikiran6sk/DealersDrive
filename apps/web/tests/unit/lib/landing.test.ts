import { describe, expect, it } from 'vitest';

import type { PublicVehicleDetail } from '@dealers-drive/contracts';

import {
  browseLandingGroups,
  isIndexableLanding,
  landingPath,
  landingSearch,
  popularLandingLinks,
  relatedLandingGroups,
  resolveLanding,
  vehicleFacetSlugs,
  vehicleLandingGroups,
} from '@/lib/landing';

import { LANDING_MAP } from './landing-fixtures';

function placeOf(slug: string) {
  const place = LANDING_MAP.places.find((candidate) => candidate.slug === slug);
  if (!place) throw new Error(`no place ${slug}`);
  return place;
}

describe('resolveLanding', () => {
  it('answers a town with its own page', () => {
    expect(resolveLanding(LANDING_MAP, ['arcot'])).toMatchObject({
      kind: 'page',
      place: { slug: 'arcot', kind: 'TOWN' },
      facet: null,
      entry: { cars: 6 },
    });
  });

  it('sends a district to the district page that already exists, permanently', () => {
    expect(resolveLanding(LANDING_MAP, ['ranipet'])).toEqual({
      kind: 'redirect',
      to: '/cars?district=ranipet',
    });
  });

  it('sends a town that shares its district’s name to that same district page', () => {
    expect(resolveLanding(LANDING_MAP, ['vellore'])).toEqual({
      kind: 'redirect',
      to: '/cars?district=vellore',
    });
  });

  it('answers a district or a town with a facet', () => {
    expect(resolveLanding(LANDING_MAP, ['vellore', 'maruti-suzuki'])).toMatchObject({
      kind: 'page',
      place: { kind: 'DISTRICT' },
      facet: { kind: 'BRAND', params: { brand: 'maruti-suzuki' } },
      label: 'Maruti Suzuki',
    });
    expect(resolveLanding(LANDING_MAP, ['arcot', 'diesel'])).toMatchObject({
      kind: 'page',
      label: 'Diesel',
      entry: { cars: 2 },
    });
  });

  it('answers a fixed facet with no cars behind it, so a stale link is not a 404', () => {
    expect(resolveLanding(LANDING_MAP, ['arcot', 'petrol'])).toMatchObject({
      kind: 'page',
      label: 'Petrol',
      entry: undefined,
    });
  });

  it('is a 404 for an unknown place, an unknown facet, a model with no car, or a third segment', () => {
    for (const segments of [
      ['nowhere'],
      ['arcot', 'cheap'],
      ['arcot', 'tata-nexon'],
      ['arcot', 'diesel', 'extra'],
      [],
    ]) {
      expect(resolveLanding(LANDING_MAP, segments)).toEqual({ kind: 'not-found' });
    }
  });
});

describe('landingSearch', () => {
  it('scopes a town by its district and its own slug, as /cars does', () => {
    const route = resolveLanding(LANDING_MAP, ['arcot', 'diesel']);
    if (route.kind !== 'page') throw new Error('not a page');
    expect(landingSearch(route.place, route.facet)).toEqual({
      district: 'ranipet',
      city: 'arcot',
      fuel: 'diesel',
    });
  });

  it('scopes a district by itself alone', () => {
    const route = resolveLanding(LANDING_MAP, ['vellore', 'maruti-suzuki']);
    if (route.kind !== 'page') throw new Error('not a page');
    expect(landingSearch(route.place, route.facet)).toEqual({
      district: 'vellore',
      brand: 'maruti-suzuki',
    });
  });
});

describe('the paths and the threshold', () => {
  it('writes the two path shapes', () => {
    expect(landingPath('arcot')).toBe('/used-cars/arcot');
    expect(landingPath('arcot', 'maruti-suzuki-swift')).toBe(
      '/used-cars/arcot/maruti-suzuki-swift',
    );
  });

  it('indexes a page from two cars', () => {
    expect(isIndexableLanding(LANDING_MAP, { cars: 2 })).toBe(true);
    expect(isIndexableLanding(LANDING_MAP, { cars: 1 })).toBe(false);
  });
});

describe('relatedLandingGroups', () => {
  it('links a town’s indexable searches by kind, and its district and sibling towns', () => {
    const [searches, towns] = relatedLandingGroups(LANDING_MAP, placeOf('arcot'), null);

    expect(searches?.title).toBe('Popular searches in Arcot');
    expect(searches?.links).toEqual([
      { href: '/used-cars/arcot/maruti-suzuki', label: 'Used Maruti Suzuki Cars in Arcot' },
      {
        href: '/used-cars/arcot/maruti-suzuki-swift',
        label: 'Used Maruti Suzuki Swift Cars in Arcot',
      },
      { href: '/used-cars/arcot/diesel', label: 'Used Diesel Cars in Arcot' },
      { href: '/used-cars/arcot/under-5-lakh', label: 'Used Cars Under ₹5 lakh in Arcot' },
    ]);
    expect(towns?.title).toBe('Towns in Ranipet district');
    expect(towns?.links).toEqual([
      { href: '/cars?district=ranipet', label: 'All used cars in Ranipet district' },
      { href: '/used-cars/walajapet', label: 'Used Cars in Walajapet' },
    ]);
  });

  it('on a facet page, leaves the page itself out and links the same facet nearby', () => {
    const [searches, towns] = relatedLandingGroups(LANDING_MAP, placeOf('arcot'), 'diesel');

    expect(searches?.links.map((link) => link.href)).not.toContain('/used-cars/arcot/diesel');
    expect(towns?.links).toEqual([
      { href: '/used-cars/ranipet/diesel', label: 'Used Diesel Cars in Ranipet' },
      { href: '/used-cars/walajapet/diesel', label: 'Used Diesel Cars in Walajapet' },
    ]);
  });

  it('orders price searches by budget, cheapest first, whatever their counts', () => {
    const map = {
      ...LANDING_MAP,
      pages: [
        ...LANDING_MAP.pages,
        {
          place: 'arcot',
          facet: 'under-10-lakh',
          kind: 'PRICE' as const,
          label: 'Under ₹10 lakh',
          cars: 6,
          lastModified: null,
        },
      ],
    };
    const [searches] = relatedLandingGroups(map, placeOf('arcot'), null);
    expect(searches?.links.slice(-2).map((link) => link.href)).toEqual([
      '/used-cars/arcot/under-5-lakh',
      '/used-cars/arcot/under-10-lakh',
    ]);
  });

  it('caps each kind of search, so a big place still links its fuels and budgets', () => {
    const brands = Array.from({ length: 12 }, (_, index) => ({
      place: 'arcot',
      facet: `brand-${String(index)}`,
      kind: 'BRAND' as const,
      label: `Brand ${String(index)}`,
      cars: 20 - index,
      lastModified: null,
    }));
    const map = { ...LANDING_MAP, pages: [...brands, ...LANDING_MAP.pages] };
    const [searches] = relatedLandingGroups(map, placeOf('arcot'), null);
    const hrefs = searches?.links.map((link) => link.href) ?? [];

    expect(hrefs.filter((href) => href.includes('/brand-'))).toHaveLength(8);
    expect(hrefs).toContain('/used-cars/arcot/brand-0');
    expect(hrefs).not.toContain('/used-cars/arcot/brand-11');
    expect(hrefs).toContain('/used-cars/arcot/diesel');
    expect(hrefs).toContain('/used-cars/arcot/under-5-lakh');
  });

  it('never links a page with one car', () => {
    const groups = relatedLandingGroups(LANDING_MAP, placeOf('arcot'), null);
    const hrefs = groups.flatMap((group) => group.links.map((link) => link.href));
    expect(hrefs).not.toContain('/used-cars/arcot/hyundai-creta');
  });

  it('links a district’s towns from the district', () => {
    const [searches, towns] = relatedLandingGroups(LANDING_MAP, placeOf('ranipet'), null);
    expect(searches?.links).toEqual([
      { href: '/used-cars/ranipet/diesel', label: 'Used Diesel Cars in Ranipet' },
    ]);
    expect(towns?.links.map((link) => link.href)).toEqual([
      '/used-cars/arcot',
      '/used-cars/walajapet',
    ]);
  });
});

function vehicle(
  facts: Partial<PublicVehicleDetail['facts']> = {},
  dealer: Partial<PublicVehicleDetail['dealer']> = {},
): PublicVehicleDetail {
  return {
    slug: '2021-maruti-suzuki-swift-vxi-arcot-1a2b3c4d',
    availability: 'AVAILABLE',
    title: '2021 Maruti Suzuki Swift VXi',
    year: 2021,
    priceLabel: '₹4,50,000',
    negotiabilityLabel: null,
    summary: 'Petrol · Manual · 30,000 km',
    description: null,
    specs: [],
    images: [],
    primaryIndex: 0,
    publishedLabel: null,
    facts: {
      make: 'Maruti Suzuki',
      model: 'Swift',
      variant: 'VXi',
      bodyType: 'Hatchback',
      fuelType: 'Petrol',
      transmission: 'Manual',
      color: 'White',
      kilometersDriven: 30_000,
      ownerCount: 1,
      pricePaise: 45_000_000,
      ...facts,
    },
    dealer: {
      name: 'Sri Murugan Cars',
      slug: 'sri-murugan',
      initials: 'SM',
      isVerified: true,
      location: 'Arcot, Ranipet',
      city: 'Arcot',
      district: 'Ranipet',
      state: 'Tamil Nadu',
      ...dealer,
    },
  };
}

describe('vehicleFacetSlugs', () => {
  it('names every search the car belongs to, most specific first', () => {
    expect(vehicleFacetSlugs(vehicle())).toEqual([
      'maruti-suzuki-swift',
      'maruti-suzuki',
      'hatchback',
      'petrol',
      'manual',
      'under-5-lakh',
    ]);
  });

  it('files an aliased make under its brand, and the price under the lowest band it fits', () => {
    expect(
      vehicleFacetSlugs(vehicle({ make: 'MARUTI', pricePaise: 62_000_000, bodyType: null })),
    ).toEqual(['maruti-suzuki-swift', 'maruti-suzuki', 'petrol', 'manual', 'under-7-lakh']);
  });

  it('leaves out what the car does not say, and a price above every band', () => {
    expect(
      vehicleFacetSlugs(
        vehicle({
          make: 'Premier Padmini',
          fuelType: null,
          transmission: null,
          pricePaise: 150_000_000,
        }),
      ),
    ).toEqual(['hatchback']);
  });
});

describe('vehicleLandingGroups', () => {
  it('links the indexable searches the car belongs to, in its town and across its district', () => {
    const groups = vehicleLandingGroups(LANDING_MAP, vehicle());
    expect(groups).toEqual([
      {
        title: 'In Arcot',
        links: [
          {
            href: '/used-cars/arcot/maruti-suzuki-swift',
            label: 'Used Maruti Suzuki Swift Cars in Arcot',
          },
          { href: '/used-cars/arcot/maruti-suzuki', label: 'Used Maruti Suzuki Cars in Arcot' },
          { href: '/used-cars/arcot/under-5-lakh', label: 'Used Cars Under ₹5 lakh in Arcot' },
        ],
      },
      { title: 'Across Ranipet district', links: [] },
    ]);
  });

  it('links the same search across the district when the district has it', () => {
    const groups = vehicleLandingGroups(
      LANDING_MAP,
      vehicle({ make: 'Hyundai', model: 'Creta', fuelType: 'Diesel', pricePaise: 120_000_000 }),
    );
    expect(groups.flatMap((group) => group.links.map((link) => link.href))).toEqual([
      '/used-cars/arcot/diesel',
      '/used-cars/ranipet/diesel',
    ]);
  });

  it('links nothing for a car whose place has no landing pages', () => {
    const groups = vehicleLandingGroups(
      LANDING_MAP,
      vehicle({}, { city: 'Madurai', district: 'Madurai' }),
    );
    expect(groups).toEqual([]);
  });
});

describe('popularLandingLinks', () => {
  it('takes the largest page of each kind in turn, so the list stays varied', () => {
    const links = popularLandingLinks(LANDING_MAP);
    expect(links.map((link) => link.href)).toEqual([
      '/cars?district=vellore',
      '/used-cars/vellore/maruti-suzuki',
      '/used-cars/arcot',
      '/used-cars/arcot/under-5-lakh',
      '/used-cars/ranipet/diesel',
      '/used-cars/arcot/maruti-suzuki-swift',
      '/cars?district=ranipet',
      '/used-cars/arcot/maruti-suzuki',
      '/used-cars/walajapet',
      '/used-cars/arcot/diesel',
    ]);
    expect(links[0]?.label).toBe('Used Cars in Vellore');
  });

  it('stops at the limit, and at the pages there are', () => {
    expect(popularLandingLinks(LANDING_MAP, 3)).toHaveLength(3);
    expect(popularLandingLinks(LANDING_MAP, 50).length).toBeLessThan(50);
    expect(popularLandingLinks(LANDING_MAP, 50).map((link) => link.href)).not.toContain(
      '/used-cars/arcot/hyundai-creta',
    );
  });
});

describe('browseLandingGroups', () => {
  it('shows at most two pages of the same search, so one budget or fuel cannot fill a group', () => {
    const extra = [0, 1, 2].map((index) => ({
      place: 'arcot',
      facet: `under-10-lakh`,
      kind: 'PRICE' as const,
      label: 'Under ₹10 lakh',
      cars: 9 - index,
      lastModified: null,
    }));
    const places = ['x', 'y', 'z'].map((slug) => ({
      slug,
      name: slug.toUpperCase(),
      kind: 'TOWN' as const,
      district: { slug: 'ranipet', name: 'Ranipet' },
      state: 'Tamil Nadu',
      cars: 9,
    }));
    const map = {
      ...LANDING_MAP,
      places: [...LANDING_MAP.places, ...places],
      pages: [
        ...LANDING_MAP.pages,
        ...extra.map((page, index) => ({ ...page, place: places[index]?.slug ?? '' })),
      ],
    };
    const budget = browseLandingGroups(map).find((group) => group.title === 'By budget');
    expect(budget?.links.map((link) => link.href)).toEqual([
      '/used-cars/x/under-10-lakh',
      '/used-cars/y/under-10-lakh',
      '/used-cars/arcot/under-5-lakh',
    ]);
  });

  it('groups the indexable pages by place, brand, budget, body and fuel', () => {
    const groups = browseLandingGroups(LANDING_MAP);
    expect(groups.map((group) => [group.title, group.links.map((link) => link.href)])).toEqual([
      [
        'By place',
        [
          '/cars?district=vellore',
          '/cars?district=ranipet',
          '/used-cars/arcot',
          '/used-cars/walajapet',
        ],
      ],
      ['By brand', ['/used-cars/vellore/maruti-suzuki', '/used-cars/arcot/maruti-suzuki']],
      ['By budget', ['/used-cars/arcot/under-5-lakh']],
      ['By body type', []],
      ['By fuel and gearbox', ['/used-cars/ranipet/diesel', '/used-cars/arcot/diesel']],
    ]);
  });
});
