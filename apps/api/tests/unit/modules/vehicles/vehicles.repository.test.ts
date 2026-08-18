import type { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  createVehiclesRepository,
  vehicleInclude,
} from '../../../../src/modules/vehicles/vehicles.repository.js';

/**
 * Layer 2 of tenant isolation (ARCHITECTURE §7). The invariant this file
 * exists to hold is mechanical and worth stating plainly: **every
 * dealer-scoped method puts `dealerId` in the WHERE clause**, and it stays
 * there on the write path too. The service already checked the guard; the
 * repository checks again inside the same statement that writes, so there is
 * no window between "you may" and "this row is yours".
 *
 * A missing `deletedAt: null` is the second failure mode — a soft-deleted car
 * reappearing in a list is the same bug class as one belonging to another
 * dealership appearing in it.
 */

const DEALER = 'dealer-1';
const OTHER_DEALER = 'dealer-2';
const VEHICLE = 'vehicle-1';

function fakePrisma(results: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = {};
  /**
   * `null` is a meaningful result here — it is how a broken catalogue
   * reference is expressed — so the override is looked up by key presence,
   * not by `??`, which would silently restore the default.
   */
  const record = (name: string, fallback: unknown) => {
    const result = name in results ? results[name] : fallback;
    return vi.fn((args: unknown) => {
      (calls[name] ??= []).push(args);
      return Promise.resolve(result);
    });
  };

  const prisma = {
    vehicle: {
      findFirst: record('vehicle.findFirst', null),
      findMany: record('vehicle.findMany', []),
      findUnique: record('vehicle.findUnique', null),
      count: record('vehicle.count', 0),
      create: record('vehicle.create', { id: VEHICLE }),
      updateMany: record('vehicle.updateMany', { count: 1 }),
    },
    vehicleMedia: {
      count: record('vehicleMedia.count', 0),
    },
    make: { findUnique: record('make.findUnique', { id: 'm' }) },
    model: { findFirst: record('model.findFirst', { id: 'mo' }) },
    variant: {
      findFirst: record('variant.findFirst', { id: 'v' }),
    },
    color: { findUnique: record('color.findUnique', { id: 'c' }) },
    city: { findUnique: record('city.findUnique', { id: 'ci' }) },
  } as unknown as PrismaClient;

  return { prisma, repo: createVehiclesRepository(prisma), calls };
}

function whereOf(
  calls: Record<string, unknown[]>,
  key: string,
  index = 0,
): Record<string, unknown> {
  return (calls[key]?.[index] as { where: Record<string, unknown> }).where;
}

describe('findForDealer', () => {
  it('scopes to the dealer, the id and the undeleted rows together', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findForDealer(DEALER, VEHICLE);

    expect(whereOf(calls, 'vehicle.findFirst')).toEqual({
      id: VEHICLE,
      dealerId: DEALER,
      deletedAt: null,
    });
  });

  /** Cross-tenant reads answer 404, and this is where that 404 comes from. */
  it('returns null for another dealer’s vehicle rather than the row', async () => {
    const { repo } = fakePrisma({ 'vehicle.findFirst': null });

    expect(await repo.findForDealer(OTHER_DEALER, VEHICLE)).toBeNull();
  });

  it('loads the relations a detail view needs in one round trip', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findForDealer(DEALER, VEHICLE);

    expect((calls['vehicle.findFirst']?.[0] as { include: unknown }).include).toBe(vehicleInclude);
  });
});

describe('listForDealer', () => {
  it('scopes to the dealer and hides soft-deleted rows', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect(whereOf(calls, 'vehicle.findMany')).toMatchObject({
      dealerId: DEALER,
      deletedAt: null,
    });
  });

  it('adds no cursor clause on the first page', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect(whereOf(calls, 'vehicle.findMany')).not.toHaveProperty('createdAt');
  });

  it('pages strictly past the cursor, so the boundary row is not repeated', async () => {
    const cursor = new Date('2026-03-01T10:00:00Z');
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20, cursor });

    expect(whereOf(calls, 'vehicle.findMany').createdAt).toEqual({ lt: cursor });
  });

  /** One row past the page is how the caller learns whether there is a next one. */
  it('over-fetches by exactly one to detect a next page', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect((calls['vehicle.findMany']?.[0] as { take: number }).take).toBe(21);
  });

  it('orders newest first', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect((calls['vehicle.findMany']?.[0] as { orderBy: unknown }).orderBy).toEqual({
      createdAt: 'desc',
    });
  });

  it('adds no OR clause when there is no search term', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect(whereOf(calls, 'vehicle.findMany')).not.toHaveProperty('OR');
  });

  it('searches make, model and variant case-insensitively', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20, q: 'swift' });

    expect(whereOf(calls, 'vehicle.findMany').OR).toEqual([
      { make: { name: { contains: 'swift', mode: 'insensitive' } } },
      { model: { name: { contains: 'swift', mode: 'insensitive' } } },
      { variant: { name: { contains: 'swift', mode: 'insensitive' } } },
    ]);
  });

  /**
   * The search term narrows *within* the tenant. If a future edit ever moved
   * the OR outside the dealer clause, this is the test that would catch it.
   */
  it('keeps the dealer scope alongside the search term, not instead of it', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20, q: 'swift' });

    const where = whereOf(calls, 'vehicle.findMany');
    expect(where.dealerId).toBe(DEALER);
    expect(where.deletedAt).toBeNull();
  });

  it('treats an empty search term as no search', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20, q: '' });

    expect(whereOf(calls, 'vehicle.findMany')).not.toHaveProperty('OR');
  });
});

describe('countForDealer', () => {
  it('counts only that dealer’s undeleted vehicles', async () => {
    const { repo, calls } = fakePrisma({ 'vehicle.count': 7 });

    expect(await repo.countForDealer(DEALER)).toBe(7);
    expect(whereOf(calls, 'vehicle.count')).toEqual({ dealerId: DEALER, deletedAt: null });
  });
});

describe('create', () => {
  /** The tenant is stamped by the server, so a `dealerId` in the payload cannot win. */
  it('stamps the dealer id last, overriding anything in the payload', async () => {
    const { repo, calls } = fakePrisma();

    await repo.create(DEALER, {
      dealerId: OTHER_DEALER,
      year: 2019,
    } as unknown as Prisma.VehicleUncheckedCreateInput);

    const data = (calls['vehicle.create']?.[0] as { data: { dealerId: string } }).data;
    expect(data.dealerId).toBe(DEALER);
  });

  it('returns the row with its relations loaded', async () => {
    const { repo, calls } = fakePrisma();

    await repo.create(DEALER, { year: 2019 } as unknown as Prisma.VehicleUncheckedCreateInput);

    expect((calls['vehicle.create']?.[0] as { include: unknown }).include).toBe(vehicleInclude);
  });
});

describe('findBrokenCatalogueRef', () => {
  it('returns null when every reference resolves', async () => {
    const { repo } = fakePrisma();

    expect(
      await repo.findBrokenCatalogueRef({
        makeId: 'm',
        modelId: 'mo',
        variantId: 'v',
        colorId: 'c',
        cityId: 'ci',
      }),
    ).toBeNull();
  });

  it('checks nothing when nothing was supplied', async () => {
    const { repo, calls } = fakePrisma();

    expect(await repo.findBrokenCatalogueRef({})).toBeNull();
    expect(calls['make.findUnique']).toBeUndefined();
    expect(calls['city.findUnique']).toBeUndefined();
  });

  it.each([
    ['makeId', { 'make.findUnique': null }],
    ['modelId', { 'model.findFirst': null }],
    ['variantId', { 'variant.findFirst': null }],
    ['colorId', { 'color.findUnique': null }],
    ['cityId', { 'city.findUnique': null }],
  ])('names %s when that reference does not exist', async (field, results) => {
    const { repo } = fakePrisma(results);

    expect(
      await repo.findBrokenCatalogueRef({
        makeId: 'm',
        modelId: 'mo',
        variantId: 'v',
        colorId: 'c',
        cityId: 'ci',
      }),
    ).toBe(field);
  });

  it('reports the first failure and stops', async () => {
    const { repo, calls } = fakePrisma({ 'make.findUnique': null });

    expect(await repo.findBrokenCatalogueRef({ makeId: 'm', cityId: 'ci' })).toBe('makeId');
    expect(calls['city.findUnique']).toBeUndefined();
  });

  /**
   * §6.2: existence alone is not enough. A real Seltos id filed under Maruti
   * Suzuki would pass an existence check and then take search, the filters and
   * the SEO slug down with it — so the model is looked up *under its make*.
   */
  it('constrains the model to the make, catching an incoherent pairing', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findBrokenCatalogueRef({ makeId: 'maruti', modelId: 'seltos' });

    expect(whereOf(calls, 'model.findFirst')).toEqual({ id: 'seltos', makeId: 'maruti' });
  });

  it('constrains the variant to the model for the same reason', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findBrokenCatalogueRef({ modelId: 'swift', variantId: 'gt-line' });

    expect(whereOf(calls, 'variant.findFirst')).toEqual({ id: 'gt-line', modelId: 'swift' });
  });

  /**
   * A PATCH that changes only the model has no make to check against. Falling
   * back to a bare existence check is the honest behaviour — the service's
   * merged view is what supplies the pairing on a full update.
   */
  it('checks the model’s existence alone when no make was supplied', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findBrokenCatalogueRef({ modelId: 'swift' });

    expect(whereOf(calls, 'model.findFirst')).toEqual({ id: 'swift' });
  });

  it('checks the variant’s existence alone when no model was supplied', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findBrokenCatalogueRef({ variantId: 'vxi' });

    expect(whereOf(calls, 'variant.findFirst')).toEqual({ id: 'vxi' });
  });

  /** `null` is "clear this optional field", which is always valid. */
  it('treats a null variant as a clear, not a reference to check', async () => {
    const { repo, calls } = fakePrisma({ 'variant.findFirst': null });

    expect(await repo.findBrokenCatalogueRef({ variantId: null })).toBeNull();
    expect(calls['variant.findFirst']).toBeUndefined();
  });

  it('treats a null colour the same way', async () => {
    const { repo, calls } = fakePrisma({ 'color.findUnique': null });

    expect(await repo.findBrokenCatalogueRef({ colorId: null })).toBeNull();
    expect(calls['color.findUnique']).toBeUndefined();
  });

  it('skips a field left out of a PATCH entirely', async () => {
    const { repo, calls } = fakePrisma({ 'make.findUnique': null });

    expect(await repo.findBrokenCatalogueRef({ cityId: 'ci' })).toBeNull();
    expect(calls['make.findUnique']).toBeUndefined();
  });
});

describe('update', () => {
  /**
   * The dealer clause here is not redundant with the route guard: it is the
   * check that runs *inside* the writing statement, which is what closes the
   * TOCTOU gap the guard alone would leave.
   */
  it('re-checks ownership inside the statement that writes', async () => {
    const { repo, calls } = fakePrisma();

    await repo.update(DEALER, VEHICLE, { kmDriven: 1000 });

    expect(whereOf(calls, 'vehicle.updateMany')).toEqual({
      id: VEHICLE,
      dealerId: DEALER,
      deletedAt: null,
    });
  });

  it('returns null when the row was not this dealer’s, without reading it back', async () => {
    const { repo, calls } = fakePrisma({ 'vehicle.updateMany': { count: 0 } });

    expect(await repo.update(OTHER_DEALER, VEHICLE, { kmDriven: 1000 })).toBeNull();
    expect(calls['vehicle.findUnique']).toBeUndefined();
  });

  it('reads the updated row back with its relations', async () => {
    const { repo, calls } = fakePrisma({ 'vehicle.findUnique': { id: VEHICLE } });

    expect(await repo.update(DEALER, VEHICLE, { kmDriven: 1000 })).toEqual({ id: VEHICLE });
    expect((calls['vehicle.findUnique']?.[0] as { include: unknown }).include).toBe(vehicleInclude);
  });

  it('uses the ambient client when no transaction is given', async () => {
    const { repo, calls } = fakePrisma();

    await repo.update(DEALER, VEHICLE, { kmDriven: 1 });

    expect(calls['vehicle.updateMany']).toHaveLength(1);
  });

  /** A price change and its listing_search re-index must land or fail together. */
  it('runs on the transaction client when one is given', async () => {
    const { repo, calls } = fakePrisma();
    const tx = {
      vehicle: {
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
        findUnique: vi.fn(() => Promise.resolve({ id: VEHICLE })),
      },
    };

    await repo.update(DEALER, VEHICLE, { kmDriven: 1 }, tx as never);

    expect(tx.vehicle.updateMany).toHaveBeenCalledOnce();
    expect(tx.vehicle.findUnique).toHaveBeenCalledOnce();
    expect(calls['vehicle.updateMany']).toBeUndefined();
  });

  it('does not read back on the transaction client when nothing matched', async () => {
    const { repo } = fakePrisma();
    const tx = {
      vehicle: {
        updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
        findUnique: vi.fn(() => Promise.resolve(null)),
      },
    };

    expect(await repo.update(OTHER_DEALER, VEHICLE, { kmDriven: 1 }, tx as never)).toBeNull();
    expect(tx.vehicle.findUnique).not.toHaveBeenCalled();
  });
});

describe('softDelete', () => {
  /** Enquiries and audit rows still reference the car, so the row stays. */
  it('stamps deletedAt and archives rather than removing the row', async () => {
    const { repo, calls } = fakePrisma();

    await repo.softDelete(DEALER, VEHICLE);

    const data = (calls['vehicle.updateMany']?.[0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe('ARCHIVED');
    expect(data.deletedAt).toBeInstanceOf(Date);
  });

  it('is scoped to the dealer', async () => {
    const { repo, calls } = fakePrisma();

    await repo.softDelete(DEALER, VEHICLE);

    expect(whereOf(calls, 'vehicle.updateMany')).toMatchObject({ dealerId: DEALER });
  });

  it('reports true when a row was archived', async () => {
    const { repo } = fakePrisma({ 'vehicle.updateMany': { count: 1 } });

    expect(await repo.softDelete(DEALER, VEHICLE)).toBe(true);
  });

  it('reports false for another dealer’s vehicle', async () => {
    const { repo } = fakePrisma({ 'vehicle.updateMany': { count: 0 } });

    expect(await repo.softDelete(OTHER_DEALER, VEHICLE)).toBe(false);
  });

  it('is idempotent — a second delete matches nothing', async () => {
    const { repo, calls } = fakePrisma({ 'vehicle.updateMany': { count: 0 } });

    expect(await repo.softDelete(DEALER, VEHICLE)).toBe(false);
    expect(whereOf(calls, 'vehicle.updateMany').deletedAt).toBeNull();
  });
});

describe('readyPhotoCount', () => {
  /** The submit gate counts photos; it must not count another dealer's. */
  it('counts READY photos on that dealer’s vehicle only', async () => {
    const { repo, calls } = fakePrisma({ 'vehicleMedia.count': 6 });

    expect(await repo.readyPhotoCount(DEALER, VEHICLE)).toBe(6);
    expect(whereOf(calls, 'vehicleMedia.count')).toEqual({
      vehicleId: VEHICLE,
      vehicle: { dealerId: DEALER },
      media: { status: 'READY' },
    });
  });

  it('does not count photos still processing or failed', async () => {
    const { repo, calls } = fakePrisma({ 'vehicleMedia.count': 0 });

    await repo.readyPhotoCount(DEALER, VEHICLE);

    expect(whereOf(calls, 'vehicleMedia.count').media).toEqual({ status: 'READY' });
  });
});

describe('slugExists', () => {
  /**
   * Deliberately global, not dealer-scoped: the slug is a public URL, so a
   * collision with *any* dealer's car is a collision.
   */
  it('is true when any dealer already holds the slug', async () => {
    const { repo } = fakePrisma({ 'vehicle.findUnique': { id: 'someone-elses' } });

    expect(await repo.slugExists('maruti-swift-vxi-2019-abc')).toBe(true);
  });

  it('is false when it is free', async () => {
    const { repo, calls } = fakePrisma({ 'vehicle.findUnique': null });

    expect(await repo.slugExists('maruti-swift-vxi-2019-abc')).toBe(false);
    expect(whereOf(calls, 'vehicle.findUnique')).toEqual({
      slug: 'maruti-swift-vxi-2019-abc',
    });
  });
});

describe('findPublicById', () => {
  /** Named `findPublicById` so an unscoped read is never an accident. */
  it('is not dealer-scoped, but still hides soft-deleted rows', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findPublicById(VEHICLE);

    expect(whereOf(calls, 'vehicle.findFirst')).toEqual({ id: VEHICLE, deletedAt: null });
  });

  it('returns null for a vehicle that does not exist', async () => {
    const { repo } = fakePrisma({ 'vehicle.findFirst': null });

    expect(await repo.findPublicById(VEHICLE)).toBeNull();
  });
});

describe('unavailableReason', () => {
  const withListing = (status: string, vehicleStatus = 'LIVE') => ({
    'vehicle.findUnique': { status: vehicleStatus, listings: [{ status }] },
  });

  it('is NOT_FOUND when the vehicle never existed', async () => {
    const { repo } = fakePrisma({ 'vehicle.findUnique': null });

    expect(await repo.unavailableReason('gone')).toBe('NOT_FOUND');
  });

  /** The vehicle's own status wins — a sold car is sold whatever the listing says. */
  it('is SOLD when the vehicle is marked sold', async () => {
    const { repo } = fakePrisma(withListing('APPROVED', 'SOLD'));

    expect(await repo.unavailableReason(VEHICLE)).toBe('SOLD');
  });

  it('is NOT_FOUND when the vehicle was never listed', async () => {
    const { repo } = fakePrisma({ 'vehicle.findUnique': { status: 'DRAFT', listings: [] } });

    expect(await repo.unavailableReason(VEHICLE)).toBe('NOT_FOUND');
  });

  it('is EXPIRED when the newest listing lapsed', async () => {
    const { repo } = fakePrisma(withListing('EXPIRED'));

    expect(await repo.unavailableReason(VEHICLE)).toBe('EXPIRED');
  });

  it('is SOLD when the newest listing was closed as sold', async () => {
    const { repo } = fakePrisma(withListing('SOLD'));

    expect(await repo.unavailableReason(VEHICLE)).toBe('SOLD');
  });

  it.each(['REJECTED', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'TAKEN_DOWN', 'DRAFT'])(
    'is REMOVED for a listing in %s — the public reason is never the internal one',
    async (status) => {
      const { repo } = fakePrisma(withListing(status));

      expect(await repo.unavailableReason(VEHICLE)).toBe('REMOVED');
    },
  );

  it('reads only the newest listing', async () => {
    const { repo, calls } = fakePrisma(withListing('EXPIRED'));

    await repo.unavailableReason(VEHICLE);

    expect(
      (calls['vehicle.findUnique']?.[0] as { include: { listings: unknown } }).include,
    ).toEqual({ listings: { orderBy: { submittedAt: 'desc' }, take: 1 } });
  });
});
