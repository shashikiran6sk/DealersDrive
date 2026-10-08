import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  reserveStorefront,
  transitionStorefront,
} from '../src/modules/storefront/storefront.facade.js';
import { createPrisma } from '../src/platform/db/prisma.js';

const prisma = createPrisma();
const stamp = randomUUID().slice(0, 8);
let dealerId: string;
let otherId: string;
let storefrontId: string;
const subdomain = `foundation-${stamp}`;

beforeAll(async () => {
  const rows = await Promise.all(
    ['a', 'b'].map((name) =>
      prisma.dealer.create({
        data: {
          slug: `foundation-${name}-${stamp}`,
          brandName: `Foundation ${name}`,
          legalName: `Foundation ${name} ${stamp}`,
          status: 'ACTIVE',
        },
      }),
    ),
  );
  dealerId = rows[0]!.id;
  otherId = rows[1]!.id;
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('database tenant and reservation invariants', () => {
  it('serializes concurrent retries into one storefront and default domain', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        prisma.$transaction((tx) =>
          reserveStorefront(tx, dealerId, { subdomain, theme: 'LIGHT' }, 'dealers-drive.com'),
        ),
      ),
    );
    storefrontId = results[0]!.id;
    expect(new Set(results.map((row) => row.id)).size).toBe(1);
    expect(await prisma.storefrontDomain.count({ where: { storefrontId } })).toBe(1);
    expect(results[0]!.status).toBe('DRAFT');
  });
  it('refuses a retry with a different identity', async () => {
    await expect(
      prisma.$transaction((tx) =>
        reserveStorefront(
          tx,
          dealerId,
          { subdomain: `different-${stamp}`, theme: 'DARK' },
          'dealers-drive.com',
        ),
      ),
    ).rejects.toMatchObject({ code: 'STOREFRONT_ALREADY_CREATED' });
  });
  it('enforces globally unique reservations at the database', async () => {
    await expect(
      prisma.$transaction((tx) =>
        reserveStorefront(tx, otherId, { subdomain, theme: 'DARK' }, 'dealers-drive.com'),
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.dealerStorefront.count({ where: { dealerId: otherId } })).toBe(0);
  });
  it('rejects malformed and reserved identities even without application validation', async () => {
    for (const name of ['www', 'api', 'Mixed-Case', 'abc--motors']) {
      await expect(
        prisma.dealerStorefront.create({
          data: { dealerId: otherId, subdomain: name, displayName: 'Invalid' },
        }),
      ).rejects.toThrow();
    }
    for (const hostname of ['UPPER.example.com', 'http://bad.com', 'bad.com:443', 'xn--abc.com']) {
      await expect(
        prisma.storefrontDomain.create({ data: { storefrontId, hostname, kind: 'CUSTOM' } }),
      ).rejects.toThrow();
    }
  });
  it('refuses activation before the primary domain is verified', async () => {
    await expect(
      prisma.$transaction((tx) => transitionStorefront(tx, dealerId, 'ACTIVE')),
    ).rejects.toMatchObject({ code: 'INVALID_STOREFRONT_TRANSITION' });
    await prisma.$transaction((tx) => transitionStorefront(tx, dealerId, 'PENDING_ACTIVATION'));
    await expect(
      prisma.$transaction((tx) => transitionStorefront(tx, dealerId, 'ACTIVE')),
    ).rejects.toMatchObject({ code: 'STOREFRONT_NOT_READY' });
  });
  it('refuses unverified ACTIVE domains at the database', async () => {
    await expect(
      prisma.storefrontDomain.create({
        data: {
          storefrontId,
          hostname: `${stamp}.example.com`,
          kind: 'CUSTOM',
          status: 'ACTIVE',
          isPrimary: true,
        },
      }),
    ).rejects.toThrow();
  });
  it('permits a verified primary, but never two primaries', async () => {
    await prisma.storefrontDomain.updateMany({
      where: { storefrontId, kind: 'DEFAULT' },
      data: { status: 'ACTIVE', isPrimary: true, verifiedAt: new Date(), certificateReady: true },
    });
    await expect(
      prisma.storefrontDomain.create({
        data: {
          storefrontId,
          hostname: `${stamp}.example.com`,
          kind: 'CUSTOM',
          status: 'ACTIVE',
          isPrimary: true,
          verifiedAt: new Date(),
          ownershipVerifiedAt: new Date(),
          certificateReady: true,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(
      (await prisma.$transaction((tx) => transitionStorefront(tx, dealerId, 'ACTIVE'))).status,
    ).toBe('ACTIVE');
  });
  it('blocks reactivation for a suspended or closed dealer and preserves records', async () => {
    await prisma.$transaction((tx) => transitionStorefront(tx, dealerId, 'SUSPENDED'));
    for (const status of ['SUSPENDED', 'CLOSED'] as const) {
      await prisma.dealer.update({ where: { id: dealerId }, data: { status } });
      await prisma.$transaction((tx) => transitionStorefront(tx, dealerId, 'PENDING_ACTIVATION'));
      await expect(
        prisma.$transaction((tx) => transitionStorefront(tx, dealerId, 'ACTIVE')),
      ).rejects.toMatchObject({ code: 'STOREFRONT_NOT_READY' });
      await prisma.$transaction((tx) => transitionStorefront(tx, dealerId, 'SUSPENDED'));
    }
    expect(await prisma.dealerStorefront.count({ where: { dealerId } })).toBe(1);
  });
  it('preserves inventory and enquiry defaults for existing clients', async () => {
    const vehicle = await prisma.vehicle.create({
      data: {
        dealerId: otherId,
        registrationNumber: `TN99ZZ${stamp}`,
        listing: { create: { dealerId: otherId } },
      },
      include: { listing: true },
    });
    expect(vehicle.listing).toMatchObject({
      status: 'DRAFT',
      marketplacePublished: true,
      storefrontPublished: true,
    });
    const customer = await prisma.user.create({ data: {} });
    const enquiry = await prisma.enquiry.create({
      data: { customerId: customer.id, dealerId: otherId, listingId: vehicle.listing!.id },
    });
    expect(enquiry).toMatchObject({ source: 'MARKETPLACE', storefrontId: null, consentAt: null });
  });
});
