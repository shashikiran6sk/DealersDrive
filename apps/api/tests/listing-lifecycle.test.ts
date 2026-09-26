import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Listing } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createListingsTestKit } from './listings-kit.js';

/**
 * The listing state machine against the real database (**F064**, **R47**).
 *
 * The property worth proving here is the one a unit test cannot: two decisions
 * racing on one listing. `transition()` writes with the expected status in the
 * `WHERE`, so whichever commits second finds nothing to update and is told so.
 */
let prisma: PrismaClient;
let kit: ReturnType<typeof createListingsTestKit>;

beforeAll(async () => {
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  kit = createListingsTestKit(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a listing is born with its vehicle', () => {
  it('is DRAFT, with nothing stamped', async () => {
    const { listing } = await kit.vehicleWithListing();
    expect(listing).toMatchObject({
      status: 'DRAFT',
      submittedAt: null,
      publishedAt: null,
      submissionCount: 0,
    });
  });

  it('goes when its vehicle goes', async () => {
    const { vehicle, listing } = await kit.vehicleWithListing();
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
    await expect(prisma.listing.findUnique({ where: { id: listing.id } })).resolves.toBeNull();
  });

  it('is one per vehicle', async () => {
    const { vehicle } = await kit.vehicleWithListing();
    await expect(
      prisma.listing.create({ data: { vehicleId: vehicle.id, dealerId: vehicle.dealerId } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('the whole happy path, audited', () => {
  it('walks DRAFT → PENDING_REVIEW → CHANGES_REQUESTED → PENDING_REVIEW → ACTIVE → SOLD', async () => {
    const { vehicle, listing } = await kit.vehicleWithListing();

    let current: Listing = await kit.move(listing, 'submit', 'DEALER');
    expect(current.status).toBe('PENDING_REVIEW');
    current = await kit.move(current, 'requestChanges', 'ADMIN', 'Wrong variant.');
    expect(current).toMatchObject({
      status: 'CHANGES_REQUESTED',
      decisionReason: 'Wrong variant.',
    });
    current = await kit.move(current, 'resubmit', 'DEALER');
    expect(current).toMatchObject({ status: 'PENDING_REVIEW', submissionCount: 2 });
    current = await kit.move(current, 'approve', 'ADMIN');
    expect(current).toMatchObject({ status: 'ACTIVE', decisionReason: null });
    expect(current.publishedAt).toBeInstanceOf(Date);
    current = await kit.move(current, 'markSold', 'DEALER');
    expect(current.status).toBe('SOLD');

    const trail = await prisma.auditLog.findMany({
      where: { entityType: 'Listing', entityId: listing.id },
      orderBy: { id: 'asc' },
    });
    expect(trail.map((row) => row.action)).toEqual([
      'listing.submitted',
      'listing.changes_requested',
      'listing.resubmitted',
      'listing.approved',
      'listing.marked_sold',
    ]);

    const released = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(released.releasedAt).toBeInstanceOf(Date);
  });

  it('keeps a rejected vehicle, and its reason, rather than deleting it', async () => {
    const { vehicle, listing } = await kit.vehicleWithListing();
    const pending = await kit.move(listing, 'submit', 'DEALER');
    const rejected = await kit.move(pending, 'reject', 'ADMIN', 'Not a genuine listing.');

    expect(rejected).toMatchObject({
      status: 'REJECTED',
      decisionReason: 'Not a genuine listing.',
    });
    await expect(prisma.vehicle.findUnique({ where: { id: vehicle.id } })).resolves.not.toBeNull();
  });
});

describe('racing decisions', () => {
  it('lets exactly one of two simultaneous decisions win', async () => {
    const { listing } = await kit.vehicleWithListing();
    const pending = await kit.move(listing, 'submit', 'DEALER');

    const results = await Promise.allSettled([
      kit.move(pending, 'approve', 'ADMIN'),
      kit.move(pending, 'reject', 'ADMIN', 'Duplicate of another listing.'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((result) => result.status === 'rejected');
    expect(refused?.status === 'rejected' ? refused.reason : null).toMatchObject({
      code: 'LISTING_STATE_CHANGED',
    });

    const decisions = await prisma.auditLog.count({
      where: {
        entityId: listing.id,
        action: { in: ['listing.approved', 'listing.rejected'] },
      },
    });
    expect(decisions).toBe(1);
  });

  it('refuses a stale second submit rather than counting it twice', async () => {
    const { listing } = await kit.vehicleWithListing();
    await kit.move(listing, 'submit', 'DEALER');
    await expect(kit.move(listing, 'submit', 'DEALER')).rejects.toMatchObject({
      code: 'LISTING_STATE_CHANGED',
    });
    const stored = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(stored.submissionCount).toBe(1);
  });
});
