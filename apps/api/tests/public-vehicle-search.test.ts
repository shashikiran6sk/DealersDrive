import type { FacetOption, PublicVehiclesResponse, VehicleFacets } from '@dealers-drive/contracts';
import { PublicVehiclesResponse as ResponseSchema } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApprovalKit, type Published } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * The marketplace search (**F076**) against a real database: every filter on
 * its own and together, facet counts that equal the page they lead to, the
 * dependent facets, the sorts and the refusals.
 *
 * Everything here lives in two districts nobody else's suite uses, and every
 * assertion is scoped to one of them, so rows other suites leave behind in the
 * shared test database cannot move a number.
 */
let h: AuthHarness;
let admin: request.Agent;
let kit: ReturnType<typeof createApprovalKit>;
let arcot: Dealership;
let arakkonam: Dealership;
let katpadi: Dealership;
const cars: Record<string, Published> = {};
let plate = 5000;

const HERE = 'district=search-north';
const THERE = 'district=search-south';

function nextPlate(): string {
  plate += 1;
  return `KL 07 SR ${String(plate).padStart(4, '0')}`;
}

async function search(query: string): Promise<PublicVehiclesResponse> {
  const { body } = await h.agent().get(`/v1/vehicles?${query}`).expect(200);
  return ResponseSchema.parse(body);
}

async function slugs(query: string): Promise<string[]> {
  return (await search(`${query}&limit=48`)).data.map((card) => card.slug);
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'vehicle-search');
  arcot = await fixtures.dealership();
  arakkonam = await fixtures.dealership();
  katpadi = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);

  const place = async (dealer: Dealership, city: string, district: string) =>
    h.prisma.dealer.update({
      where: { id: dealer.dealerId },
      data: { city, district, brandName: `${city} Motor Yard`, legalName: `${city} Motor Yard` },
    });
  await place(arcot, 'Arcot', 'Search North');
  await place(arakkonam, 'Arakkonam', 'Search North');
  await place(katpadi, 'Katpadi', 'Search South');

  const car = (make: string, model: string, extra: Record<string, unknown>) => ({
    make,
    model,
    variant: 'Base',
    ...extra,
  });

  cars.creta = await kit.published(
    arcot,
    nextPlate(),
    car('Hyundai', 'Creta', {
      variant: 'SX(O)',
      manufacturingYear: 2022,
      pricePaise: 140_000_000,
      kilometersDriven: 30_000,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      bodyType: 'SUV',
      ownerCount: 1,
      color: 'Polar White',
    }),
  );
  cars.venue = await kit.published(
    arcot,
    nextPlate(),
    car('Hyundai', 'Venue', {
      manufacturingYear: 2020,
      pricePaise: 80_000_000,
      kilometersDriven: 45_000,
      fuelType: 'DIESEL',
      transmission: 'MANUAL',
      bodyType: 'SUV',
      ownerCount: 2,
      color: 'polar white',
    }),
  );
  cars.nexon = await kit.published(
    arakkonam,
    nextPlate(),
    car('Tata', 'Nexon', {
      manufacturingYear: 2023,
      pricePaise: 110_000_000,
      kilometersDriven: 12_000,
      fuelType: 'ELECTRIC',
      transmission: 'AUTOMATIC',
      bodyType: 'SUV',
      ownerCount: 1,
      color: 'Flame Red',
    }),
  );
  cars.swift = await kit.published(
    arakkonam,
    nextPlate(),
    car('Maruti Suzuki', 'Swift', {
      manufacturingYear: 2018,
      pricePaise: 45_000_000,
      kilometersDriven: 82_000,
      fuelType: 'PETROL',
      transmission: 'MANUAL',
      bodyType: 'HATCHBACK',
      ownerCount: 4,
      color: 'Fiery Red',
    }),
  );
  cars.dzire = await kit.published(
    arakkonam,
    nextPlate(),
    car('MARUTI SUZUKI', 'Dzire', {
      manufacturingYear: 2019,
      pricePaise: 55_000_000,
      kilometersDriven: 120_000,
      fuelType: 'CNG',
      transmission: 'MANUAL',
      bodyType: 'SEDAN',
      ownerCount: 3,
      color: 'Silver',
    }),
  );
  cars.city = await kit.published(
    katpadi,
    nextPlate(),
    car('Honda', 'City', {
      manufacturingYear: 2021,
      pricePaise: 105_000_000,
      kilometersDriven: 38_000,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      bodyType: 'SEDAN',
      ownerCount: 1,
      color: 'Polar White',
    }),
  );

  const sold = await kit.published(arcot, nextPlate(), car('Hyundai', 'Creta', {}));
  await h.prisma.listing.update({ where: { id: sold.listingId }, data: { status: 'SOLD' } });
  cars.sold = sold;
  await kit.submitted(arcot, nextPlate(), car('Hyundai', 'Creta', {}));
});

afterAll(async () => {
  await h.close();
});

describe('one filter at a time', () => {
  it('scopes to the district, and only its public cars', async () => {
    expect(new Set(await slugs(HERE))).toEqual(
      new Set([cars.creta, cars.venue, cars.nexon, cars.swift, cars.dzire].map((car) => car!.slug)),
    );
    expect(await slugs(HERE)).not.toContain(cars.sold!.slug);
  });

  it.each([
    ['city=arcot', ['creta', 'venue']],
    [`dealer=${'__arakkonam__'}`, ['nexon', 'swift', 'dzire']],
    ['brand=hyundai', ['creta', 'venue']],
    ['brand=maruti-suzuki', ['swift', 'dzire']],
    ['brand=hyundai&model=creta', ['creta']],
    ['minPrice=50000000&maxPrice=100000000', ['venue', 'dzire']],
    ['minYear=2020&maxYear=2022', ['creta', 'venue']],
    ['minKm=0&maxKm=40000', ['creta', 'nexon']],
    ['fuel=petrol,diesel', ['creta', 'venue', 'swift']],
    ['transmission=automatic', ['creta', 'nexon']],
    ['bodyType=hatchback,sedan', ['swift', 'dzire']],
    ['color=polar-white', ['creta', 'venue']],
    ['owners=4', ['swift']],
    ['owners=1,3', ['creta', 'nexon', 'dzire']],
    ['q=creta', ['creta']],
    ['q=MARUTI%20%20swift', ['swift']],
    ['q=arakkonam', ['nexon', 'swift', 'dzire']],
  ])('%s', async (filter, expected) => {
    const resolved = filter.replace('__arakkonam__', arakkonam.slug);
    const found = await search(`${HERE}&${resolved}&limit=48`);
    expect(new Set(found.data.map((card) => card.slug))).toEqual(
      new Set(expected.map((name) => cars[name]!.slug)),
    );
    expect(found.page.total).toBe(expected.length);
  });
});

describe('filters together', () => {
  it('ANDs groups and ORs within one', async () => {
    const found = await slugs(`${HERE}&city=arcot,arakkonam&fuel=petrol&transmission=automatic`);
    expect(found).toEqual([cars.creta!.slug]);
  });

  it('answers a combination nothing matches with an empty page', async () => {
    const found = await search(`${HERE}&brand=tata&fuel=diesel`);
    expect(found.data).toEqual([]);
    expect(found.page.total).toBe(0);
  });

  it('keeps a town from another district out, even when asked for', async () => {
    expect(await slugs(`${HERE}&city=katpadi`)).toEqual([]);
    expect(await slugs(`${HERE}&dealer=${katpadi.slug}`)).toEqual([]);
  });
});

describe('facet counts', () => {
  const GROUPS: [keyof VehicleFacets, string][] = [
    ['cities', 'city'],
    ['brands', 'brand'],
    ['fuelTypes', 'fuel'],
    ['transmissions', 'transmission'],
    ['bodyTypes', 'bodyType'],
    ['colors', 'color'],
    ['ownerCounts', 'owners'],
    ['dealers', 'dealer'],
  ];

  it.each(['', '&fuel=petrol', '&city=arakkonam', '&brand=hyundai&transmission=manual'])(
    'equal the page each value leads to (%s)',
    async (active) => {
      const { facets } = await search(`${HERE}${active}`);
      for (const [group, param] of GROUPS) {
        const options = facets[group] as FacetOption[];
        for (const option of options) {
          const without = active.replace(new RegExp(`&${param}=[^&]*`), '');
          const { page } = await search(`${HERE}${without}&${param}=${option.value}`);
          expect({ group, value: option.value, count: option.count }).toEqual({
            group,
            value: option.value,
            count: page.total,
          });
        }
      }
    },
  );

  it('does not count a group under its own filter, so a second value can be added', async () => {
    const { facets } = await search(`${HERE}&fuel=petrol`);
    expect(facets.fuelTypes.map((option) => [option.value, option.count])).toEqual(
      expect.arrayContaining([
        ['petrol', 2],
        ['diesel', 1],
        ['electric', 1],
        ['cng', 1],
      ]),
    );
  });

  it('counts the price and distance presets the same way', async () => {
    const { facets } = await search(HERE);
    for (const band of [...facets.price, ...facets.kilometers]) {
      const isPrice = facets.price.includes(band);
      const [low, high] = isPrice ? ['minPrice', 'maxPrice'] : ['minKm', 'maxKm'];
      const bounds = [
        band.min === null ? '' : `&${low}=${band.min}`,
        band.max === null ? '' : `&${high}=${band.max}`,
      ].join('');
      expect((await search(`${HERE}${bounds}`)).page.total).toBe(band.count);
    }
  });

  it('counts only public cars', async () => {
    const { facets } = await search(HERE);
    const creta = facets.brands.find((option) => option.value === 'hyundai');
    expect(creta?.count).toBe(2);
  });
});

describe('dependent facets', () => {
  it('offers only the towns of the chosen district, and none without one', async () => {
    const here = await search(HERE);
    expect(here.facets.cities.map((option) => option.value).sort()).toEqual(['arakkonam', 'arcot']);
    expect((await search(THERE)).facets.cities.map((option) => option.value)).toEqual(['katpadi']);
    expect((await search('')).facets.cities).toEqual([]);
  });

  it('offers only the dealers of the district, narrowed by town', async () => {
    const here = await search(HERE);
    expect(here.facets.dealers.map((option) => option.value).sort()).toEqual(
      [arcot.slug, arakkonam.slug].sort(),
    );
    const town = await search(`${HERE}&city=arcot`);
    expect(town.facets.dealers.map((option) => option.value)).toEqual([arcot.slug]);
  });

  it("offers a brand's models, and nothing until a brand is chosen", async () => {
    expect((await search(HERE)).facets.models).toEqual([]);
    const hyundai = await search(`${HERE}&brand=hyundai`);
    expect(hyundai.facets.models.map((option) => [option.value, option.parent])).toEqual(
      expect.arrayContaining([
        ['creta', 'hyundai'],
        ['venue', 'hyundai'],
      ]),
    );
    expect(hyundai.facets.models).toHaveLength(2);
  });

  it('merges spellings of one brand and one colour', async () => {
    const { facets } = await search(HERE);
    expect(facets.brands.find((option) => option.value === 'maruti-suzuki')?.count).toBe(2);
    expect(facets.colors.find((option) => option.value === 'polar-white')?.count).toBe(2);
  });

  it('keeps every other brand when a model is ticked', async () => {
    const { facets } = await search(`${HERE}&brand=hyundai&model=creta`);
    expect(facets.brands.map((option) => option.value)).toEqual(
      expect.arrayContaining(['hyundai', 'tata', 'maruti-suzuki']),
    );
  });
});

describe('the order', () => {
  async function prices(sort: string): Promise<string[]> {
    return (await search(`${HERE}&sort=${sort}&limit=48`)).data.map((card) => card.slug);
  }

  it.each([
    ['price_asc', ['swift', 'dzire', 'venue', 'nexon', 'creta']],
    ['price_desc', ['creta', 'nexon', 'venue', 'dzire', 'swift']],
    ['year_desc', ['nexon', 'creta', 'venue', 'dzire', 'swift']],
    ['km_asc', ['nexon', 'creta', 'venue', 'swift', 'dzire']],
  ])('%s', async (sort, expected) => {
    expect(await prices(sort)).toEqual(expected.map((name) => cars[name]!.slug));
  });

  it('is newest approval first by default', async () => {
    expect((await prices('newest'))[0]).toBe(cars.dzire!.slug);
    expect(await slugs(HERE)).toEqual(await prices('newest'));
  });

  it('pages without repeating or skipping a car', async () => {
    const seen: string[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const found = await search(`${HERE}&sort=price_asc&limit=2&page=${page}`);
      expect(found.page.total).toBe(5);
      seen.push(...found.data.map((card) => card.slug));
    }
    expect(seen).toEqual(await prices('price_asc'));
  });
});

describe('what the query refuses', () => {
  it.each([
    ['minPrice=100&maxPrice=50', 'minPrice'],
    ['minYear=2024&maxYear=2020', 'minYear'],
    ['minKm=9000&maxKm=10', 'minKm'],
    ['fuel=kerosene', 'fuel'],
    ['transmission=cvt', 'transmission'],
    ['owners=0', 'owners'],
    ['sort=cheapest', 'sort'],
    ['brand=Hyundai', 'brand'],
    ['limit=100000', 'limit'],
    ['pageSize=500', 'pageSize'],
  ])('%s', async (query, field) => {
    const refused = await h.agent().get(`/v1/vehicles?${query}`).expect(400);
    expect(JSON.stringify(refused.body)).toContain(field);
  });
});

describe("one dealership's cars, through the same search", () => {
  it('filters and counts inside the dealership only', async () => {
    const { body } = await h
      .agent()
      .get(`/v1/dealers/${arakkonam.slug}/vehicles?fuel=petrol,cng&sort=price_asc`)
      .expect(200);
    const found = ResponseSchema.parse(body);
    expect(found.data.map((card) => card.slug)).toEqual([cars.swift!.slug, cars.dzire!.slug]);
    expect(found.facets.brands.map((option) => option.value)).toEqual(['maruti-suzuki']);
    expect(found.facets.fuelTypes.map((option) => option.value).sort()).toEqual([
      'cng',
      'electric',
      'petrol',
    ]);
  });

  it('offers no town and no dealer to filter by, and leaks no other dealership', async () => {
    const { body } = await h.agent().get(`/v1/dealers/${arcot.slug}/vehicles`).expect(200);
    const found = ResponseSchema.parse(body);
    expect(found.facets.cities).toEqual([]);
    expect(found.facets.dealers).toEqual([]);
    expect(found.facets.brands.map((option) => [option.value, option.count])).toEqual([
      ['hyundai', 2],
    ]);
    expect(JSON.stringify(found)).not.toContain(arakkonam.slug);
  });

  it.each(['city=arcot', `dealer=x`, 'district=search-north'])('refuses %s', async (query) => {
    await h.agent().get(`/v1/dealers/${arcot.slug}/vehicles?${query}`).expect(400);
  });
});
