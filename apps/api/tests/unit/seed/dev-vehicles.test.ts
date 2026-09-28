import { parseRegistration, slugify, VehicleColor } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import { DEV_DEALERS } from '../../../prisma/seed/dev-dealers.data.js';
import {
  DEV_VEHICLE_COUNT,
  VEHICLE_CATALOG,
  devUuid,
  generateDevVehicles,
  mulberry32,
} from '../../../prisma/seed/dev-vehicles.data.js';

/**
 * The dev cars (`pnpm db:seed:dev`). Nothing in `src` uses them, but the
 * search and its filter panel are developed and eyeballed against them, so a
 * seed that dealt "Hyundai Swift", orphaned a car, or dealt a different set on
 * the second run would quietly make every manual check wrong.
 */
const cars = generateDevVehicles(DEV_DEALERS);
const live = cars.filter((car) => car.status === 'ACTIVE');

describe('the dev vehicle seed', () => {
  it('deals at least three hundred cars, most of them live', () => {
    expect(cars).toHaveLength(DEV_VEHICLE_COUNT);
    expect(DEV_VEHICLE_COUNT).toBeGreaterThanOrEqual(300);
    expect(live.length).toBeGreaterThanOrEqual(250);
  });

  it('is the same on every run, ids and all', () => {
    expect(generateDevVehicles(DEV_DEALERS)).toEqual(cars);
    expect(mulberry32(7)()).toBe(mulberry32(7)());
    expect(devUuid('x')).toBe(devUuid('x'));
    expect(devUuid('x')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('puts every car with a seeded dealership, and every dealership gets one', () => {
    const gstins = new Set(DEV_DEALERS.map((dealer) => dealer.gstin));
    for (const car of cars) expect(gstins.has(car.dealerGstin)).toBe(true);
    expect(new Set(cars.map((car) => car.dealerGstin)).size).toBe(DEV_DEALERS.length);
  });

  it('takes the location from the dealership, never invents one', () => {
    const bySlug = new Map(DEV_DEALERS.map((dealer) => [dealer.slug, dealer]));
    for (const car of cars) {
      const dealer = bySlug.get(car.dealerSlug);
      expect([car.city, car.district, car.state]).toEqual([
        dealer?.city,
        dealer?.district,
        dealer?.state,
      ]);
    }
  });

  it('pairs every brand only with its own models', () => {
    const models = new Map(VEHICLE_CATALOG.map((brand) => [brand.make, brand.models]));
    for (const car of cars) {
      const entry = models.get(car.make)?.find((model) => model.model === car.model);
      expect(entry, `${car.make} ${car.model}`).toBeDefined();
      expect(entry?.variants).toContain(car.variant);
      expect(entry?.fuels).toContain(car.fuelType);
      expect(entry?.gearboxes).toContain(car.transmission);
      expect(car.bodyType).toBe(entry?.body);
    }
    const everyModel = VEHICLE_CATALOG.flatMap((brand) => brand.models.map((m) => m.model));
    expect(new Set(everyModel).size).toBe(everyModel.length);
  });

  it('writes registrations the platform can read, all different', () => {
    for (const car of cars) {
      const parsed = parseRegistration(car.registrationNumber);
      expect(parsed.ok && parsed.value.rtoCode).toBe(car.rtoCode);
    }
    expect(new Set(cars.map((car) => car.registrationNumber)).size).toBe(cars.length);
    expect(new Set(cars.map((car) => car.id)).size).toBe(cars.length);
  });

  it('gives a live car a unique public slug, and a car never approved none', () => {
    const slugs = cars.flatMap((car) => (car.listingSlug ? [car.listingSlug] : []));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const car of cars) {
      const everLive = ['ACTIVE', 'RESERVED', 'SOLD', 'WITHDRAWN'].includes(car.status);
      expect(car.listingSlug !== null).toBe(everLive);
      expect(car.publishedAt !== null).toBe(everLive);
    }
  });

  it('stamps each lifecycle state, and gives every withdrawal a reason (R69)', () => {
    for (const car of cars) {
      expect(car.reservedAt !== null).toBe(car.status === 'RESERVED');
      expect(car.soldAt !== null).toBe(car.status === 'SOLD');
      expect(car.withdrawnAt !== null).toBe(car.status === 'WITHDRAWN');
      expect(car.withdrawalReason !== null).toBe(car.status === 'WITHDRAWN');
    }
    expect(cars.filter((car) => car.status === 'RESERVED')).toHaveLength(12);
    expect(cars.filter((car) => car.status === 'ACTIVE')).toHaveLength(260);
  });

  it('holds the registration claims the database constraints expect', () => {
    for (const car of cars) {
      expect(car.claimedAt === null).toBe(car.status === 'DRAFT');
      expect(car.releasedAt !== null).toBe(['SOLD', 'REJECTED'].includes(car.status));
    }
  });

  it('includes every non-public state, so the public queries have something to exclude', () => {
    const statuses = new Set(cars.map((car) => car.status));
    for (const status of [
      'DRAFT',
      'PENDING_REVIEW',
      'CHANGES_REQUESTED',
      'REJECTED',
      'SOLD',
      'WITHDRAWN',
      'RESERVED',
    ]) {
      expect(statuses.has(status as never)).toBe(true);
    }
  });

  it('varies every facet the filter panel offers', () => {
    const distinct = (key: (car: (typeof live)[number]) => string | number) =>
      new Set(live.map(key)).size;
    expect(distinct((car) => car.state)).toBe(4);
    expect(distinct((car) => car.district)).toBe(12);
    expect(distinct((car) => car.city)).toBeGreaterThanOrEqual(40);
    expect(distinct((car) => car.make)).toBeGreaterThanOrEqual(10);
    expect(distinct((car) => car.model)).toBeGreaterThanOrEqual(30);
    expect(distinct((car) => car.fuelType)).toBeGreaterThanOrEqual(4);
    expect(distinct((car) => car.transmission)).toBe(2);
    expect(distinct((car) => car.bodyType)).toBe(5);
    expect(distinct((car) => car.color)).toBeGreaterThanOrEqual(8);
    expect(distinct((car) => Math.min(car.ownerCount, 4))).toBe(4);
    expect(distinct((car) => car.manufacturingYear)).toBeGreaterThanOrEqual(8);
  });

  it('spreads prices and distances across every preset band', () => {
    const lakh = live.map((car) => Number(car.pricePaise) / 10_000_000);
    for (const [low, high] of [
      [0, 5],
      [5, 10],
      [10, 15],
      [15, 20],
      [20, Infinity],
    ]) {
      expect(lakh.some((price) => price >= low! && price < high!)).toBe(true);
    }
    const km = live.map((car) => car.kilometersDriven);
    for (const [low, high] of [
      [0, 20_000],
      [20_000, 40_000],
      [40_000, 60_000],
      [60_000, 100_000],
      [100_000, Infinity],
    ]) {
      expect(km.some((value) => value >= low! && value < high!)).toBe(true);
    }
  });

  it('gives every Ranipet town enough live cars to filter by', () => {
    const ranipet = live.filter((car) => car.district === 'Ranipet');
    expect(ranipet.length).toBeGreaterThanOrEqual(25);
    for (const town of ['Ranipet', 'Arcot', 'Arakkonam', 'Walajapet']) {
      expect(ranipet.filter((car) => car.city === town).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('names its slugs the way the platform does', () => {
    const car = live[0]!;
    expect(car.listingSlug?.startsWith(slugify(`${car.manufacturingYear} ${car.make}`))).toBe(true);
  });
});

describe('the dev colours (R52)', () => {
  it('are only the generic families the form offers and the search filters on', () => {
    for (const car of cars) expect(VehicleColor.options).toContain(car.color);
  });
});
