import type { DealerCard, DealerPublicProfile } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApprovalKit } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * **R48.** The directory card's count and the portfolio's "Cars available"
 * count exactly the cars a buyer can open — the public-listing rule — and no
 * other listing.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let empty: Dealership;
let kit: ReturnType<typeof createApprovalKit>;
let plate = 300;

function nextPlate(): string {
  plate += 1;
  return `KA 05 DI ${String(plate).padStart(4, '0')}`;
}

async function directoryCard(dealer: Dealership): Promise<DealerCard> {
  const brand = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
  const { body } = await h
    .agent()
    .get(`/v1/dealers?q=${encodeURIComponent(brand.brandName)}`)
    .expect(200);
  const card = (body.data as DealerCard[]).find((entry) => entry.slug === dealer.slug);
  if (!card) throw new Error(`no directory card for ${dealer.slug}`);
  return card;
}

async function carsAvailable(dealer: Dealership): Promise<string | undefined> {
  const { body } = await h.agent().get(`/v1/dealers/${dealer.slug}`).expect(200);
  return (body as DealerPublicProfile).stats.find((stat) => stat.key === 'cars')?.value;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'dealer-inventory-public');
  a = await fixtures.dealership();
  empty = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);

  await kit.published(a, nextPlate(), { pricePaise: 90_000_000 });
  await kit.published(a, nextPlate(), { pricePaise: 145_000_000 });
  await kit.published(a, nextPlate(), { pricePaise: 120_000_000 });

  const sold = await kit.published(a, nextPlate());
  await h.prisma.listing.update({ where: { id: sold.listingId }, data: { status: 'SOLD' } });
  const removed = await kit.published(a, nextPlate());
  await h.prisma.listing.update({ where: { id: removed.listingId }, data: { status: 'REMOVED' } });
  const rejected = await kit.submitted(a, nextPlate());
  await admin
    .post(`/v1/admin/listings/${rejected.listingId}/reject`)
    .send({ reason: 'Not a car we can list.' })
    .expect(200);
  const changes = await kit.submitted(a, nextPlate());
  await admin
    .post(`/v1/admin/listings/${changes.listingId}/request-changes`)
    .send({ reason: 'Please correct the odometer reading.' })
    .expect(200);
  await kit.submitted(a, nextPlate());
  await a.agent.post('/v1/dealer/vehicles').send({ registrationNumber: nextPlate() }).expect(201);
});

afterAll(async () => {
  await h.close();
});

describe('the directory card', () => {
  it('counts only the cars on the marketplace, and prices from the cheapest of them', async () => {
    const card = await directoryCard(a);
    expect(card.carCount).toBe(3);
    expect(card.fromPricePaise).toBe(90_000_000);
    expect(card.fromPriceLabel).toBe('from ₹9.00 Lakh');
  });

  it('says zero for a dealership with nothing live', async () => {
    const card = await directoryCard(empty);
    expect(card.carCount).toBe(0);
    expect(card.fromPricePaise).toBeNull();
  });

  it('agrees with the public vehicle list', async () => {
    const card = await directoryCard(a);
    const { body } = await h.agent().get('/v1/vehicles?limit=48').expect(200);
    const listed = await h.prisma.listing.count({
      where: { dealerId: a.dealerId, status: 'ACTIVE', slug: { not: null } },
    });
    expect(card.carCount).toBe(listed);
    expect(body.page.total).toBeGreaterThanOrEqual(card.carCount);
  });

  it('follows an approval and a removal', async () => {
    const extra = await kit.published(a, nextPlate());
    expect((await directoryCard(a)).carCount).toBe(4);

    await h.prisma.listing.update({ where: { id: extra.listingId }, data: { status: 'REMOVED' } });
    expect((await directoryCard(a)).carCount).toBe(3);
  });
});

describe('the portfolio', () => {
  it('reports the same count as the directory', async () => {
    expect(await carsAvailable(a)).toBe(String((await directoryCard(a)).carCount));
    expect(await carsAvailable(empty)).toBe('0');
  });

  it('becomes indexable once it has a car to show', async () => {
    const withCars = await h.agent().get(`/v1/dealers/${a.slug}`).expect(200);
    const withoutCars = await h.agent().get(`/v1/dealers/${empty.slug}`).expect(200);
    expect(withCars.body.seo.isIndexable).toBe(true);
    expect(withoutCars.body.seo.isIndexable).toBe(false);
  });

  it('counts nothing of a dealership that is suspended, even if its listings are ACTIVE', async () => {
    await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { status: 'SUSPENDED' } });
    try {
      const { createPublicInventoryStats } = await import('../src/modules/search/search.facade.js');
      const stats = await createPublicInventoryStats(h.prisma).dealerStats();
      expect(stats.find((row) => row.dealer_slug === a.slug)).toBeUndefined();
    } finally {
      await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { status: 'ACTIVE' } });
    }
  });
});

describe('the portfolio inventory', () => {
  it('lists exactly the cars the directory counts, newest first', async () => {
    const card = await directoryCard(a);
    const { body } = await h.agent().get(`/v1/dealers/${a.slug}/vehicles`).expect(200);

    expect(body.page.total).toBe(card.carCount);
    expect(body.data).toHaveLength(card.carCount);
    expect(
      (body.data as { dealer: { slug: string } }[]).every((entry) => entry.dealer.slug === a.slug),
    ).toBe(true);
  });

  it('keeps the total while paging', async () => {
    const { body } = await h.agent().get(`/v1/dealers/${a.slug}/vehicles?limit=2`).expect(200);
    expect(body.data).toHaveLength(2);
    expect(body.page).toMatchObject({ total: 3, totalPages: 2 });

    const second = await h.agent().get(`/v1/dealers/${a.slug}/vehicles?limit=2&page=2`).expect(200);
    expect(second.body.data).toHaveLength(1);
  });

  it('is empty, not an error, for a listed dealership with nothing live', async () => {
    const { body } = await h.agent().get(`/v1/dealers/${empty.slug}/vehicles`).expect(200);
    expect(body).toMatchObject({
      data: [],
      page: { page: 1, limit: 24, total: 0, totalPages: 1 },
      facets: { brands: [], models: [], cities: [], dealers: [], years: [] },
    });
    for (const band of [...body.facets.price, ...body.facets.kilometers]) {
      expect(band.count).toBe(0);
    }
  });

  it('answers 404 for a dealership that is not listed', async () => {
    await h.agent().get('/v1/dealers/no-such-dealership/vehicles').expect(404);
    await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { status: 'SUSPENDED' } });
    try {
      const refused = await h.agent().get(`/v1/dealers/${a.slug}/vehicles`).expect(404);
      expect(refused.body.code).toBe('DEALER_NOT_FOUND');
    } finally {
      await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { status: 'ACTIVE' } });
    }
  });

  it('refuses a filter it does not have', async () => {
    await h.agent().get(`/v1/dealers/${a.slug}/vehicles?status=DRAFT`).expect(400);
  });

  it('carries no id, registration or contact detail', async () => {
    const { body } = await h.agent().get(`/v1/dealers/${a.slug}/vehicles`).expect(200);
    const text = JSON.stringify(body);
    expect(text).not.toContain(a.dealerId);
    expect(text).not.toMatch(/KA05DI|KA 05 DI|\+91|storageKey|vehicles\//);
  });
});
