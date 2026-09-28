import { VehicleCardDto } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApprovalKit, type Published } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * The public marketplace list (**F075**, **F077** as scoped by **R45**):
 * only an ACTIVE listing of an ACTIVE dealership, and nothing internal.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let b: Dealership;
let kit: ReturnType<typeof createApprovalKit>;
let live: Published;
let older: Published;
let plate = 100;

function nextPlate(): string {
  plate += 1;
  return `KL 11 PV ${String(plate).padStart(4, '0')}`;
}

async function allCards(): Promise<VehicleCardDto[]> {
  const cards: VehicleCardDto[] = [];
  for (let page = 1; ; page += 1) {
    const { body } = await h.agent().get(`/v1/vehicles?page=${page}&limit=48`).expect(200);
    cards.push(...(body.data as VehicleCardDto[]));
    if (page >= (body.page.totalPages as number)) return cards;
  }
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'public-vehicles');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);

  older = await kit.published(a, nextPlate());
  live = await kit.published(a, nextPlate(), { make: 'Tata', model: 'Nexon', variant: 'XZ+' });
});

afterAll(async () => {
  await h.close();
});

describe('what the marketplace lists', () => {
  it('lists an approved car as a card, newest approval first', async () => {
    const { body } = await h.agent().get('/v1/vehicles?limit=48').expect(200);
    const slugs = (body.data as VehicleCardDto[]).map((card) => card.slug);

    expect(slugs.indexOf(live.slug)).toBeGreaterThanOrEqual(0);
    expect(slugs.indexOf(live.slug)).toBeLessThan(slugs.indexOf(older.slug));
    expect(body.page).toMatchObject({ page: 1, limit: 48 });
    expect(body.page.total).toBeGreaterThanOrEqual(2);
  });

  it('describes the car the way the card draws it', async () => {
    const card = (await allCards()).find((entry) => entry.slug === live.slug);
    expect(card).toEqual({
      slug: live.slug,
      availability: 'AVAILABLE',
      title: '2023 Tata Nexon XZ+',
      year: 2023,
      priceLabel: '₹14,50,000',
      metaLabel: expect.stringMatching(/^22,400 km · Petrol · Automatic · /),
      image: {
        url: expect.stringContaining(`/by-media/${live.mediaIds[0]!}/640.webp`),
        alt: '2023 Tata Nexon XZ+, the primary photograph',
      },
      imageCount: 6,
      dealer: {
        name: expect.any(String),
        slug: a.slug,
        initials: expect.any(String),
        isVerified: true,
      },
    });
    expect(live.slug).toMatch(/^2023-tata-nexon-xz-.*-[0-9a-f]{8}$/);
  });

  it('shows the image the admin chose as primary', async () => {
    const chosen = await kit.published(b, nextPlate());
    await h.prisma.listing.update({
      where: { id: chosen.listingId },
      data: { status: 'PENDING_REVIEW' },
    });
    await admin
      .put(`/v1/admin/listings/${chosen.listingId}/images/${chosen.mediaIds[3]!}/primary`)
      .expect(200);
    await h.prisma.listing.update({ where: { id: chosen.listingId }, data: { status: 'ACTIVE' } });

    const card = (await allCards()).find((entry) => entry.slug === chosen.slug);
    expect(card?.image?.url).toContain(`/by-media/${chosen.mediaIds[3]!}/`);
  });

  it.each([
    'DRAFT',
    'PENDING_REVIEW',
    'CHANGES_REQUESTED',
    'REJECTED',
    'SOLD',
    'WITHDRAWN',
  ] as const)('leaves out a listing that is %s', async (status) => {
    const hidden = await kit.published(a, nextPlate());
    await h.prisma.listing.update({ where: { id: hidden.listingId }, data: { status } });

    const slugs = (await allCards()).map((card) => card.slug);
    expect(slugs).not.toContain(hidden.slug);
  });

  it('leaves out every listing of a dealership that is no longer active', async () => {
    const suspended = await kit.published(b, nextPlate());
    await h.prisma.dealer.update({ where: { id: b.dealerId }, data: { status: 'SUSPENDED' } });
    try {
      const slugs = (await allCards()).map((card) => card.slug);
      expect(slugs).not.toContain(suspended.slug);
    } finally {
      await h.prisma.dealer.update({ where: { id: b.dealerId }, data: { status: 'ACTIVE' } });
    }
  });

  it('never lists a car that was submitted but not approved', async () => {
    const { listingId } = await kit.submitted(a, nextPlate());
    const ids = JSON.stringify(await allCards());
    expect(ids).not.toContain(listingId);
  });
});

describe('what a card never carries', () => {
  it('has no internal id, registration, moderation, audit or contact field', async () => {
    const card = (await allCards()).find((entry) => entry.slug === live.slug);
    const text = JSON.stringify(card);

    expect(Object.keys(card ?? {}).sort()).toEqual(
      [
        'availability',
        'dealer',
        'image',
        'imageCount',
        'metaLabel',
        'priceLabel',
        'slug',
        'title',
        'year',
      ].sort(),
    );
    expect(Object.keys(card?.dealer ?? {}).sort()).toEqual(
      ['initials', 'isVerified', 'name', 'slug'].sort(),
    );
    expect(text).not.toContain(live.listingId);
    expect(text).not.toContain(live.vehicleId);
    expect(text).not.toContain(a.dealerId);
    expect(text).not.toMatch(/KL11PV|KL 11 PV/);
    expect(text).not.toMatch(/vehicles\/|storageKey|bucket|decision|audit|photography|checks/i);
    expect(text).not.toMatch(/\+91|98400/);
  });

  it('parses against the published contract', async () => {
    const { body } = await h.agent().get('/v1/vehicles').expect(200);
    for (const card of body.data as unknown[])
      expect(() => VehicleCardDto.parse(card)).not.toThrow();
  });
});

describe('the query', () => {
  it('refuses a filter that does not exist, naming it', async () => {
    const refused = await h.agent().get('/v1/vehicles?dealerId=x').expect(400);
    expect(JSON.stringify(refused.body)).toContain('dealerId');
  });

  it('refuses a page size over the limit', async () => {
    await h.agent().get('/v1/vehicles?limit=500').expect(400);
  });

  it('answers an empty page past the end, with the total', async () => {
    const { body } = await h.agent().get('/v1/vehicles?page=999&limit=48').expect(200);
    expect(body.data).toEqual([]);
    expect(body.page.total).toBeGreaterThanOrEqual(2);
  });

  it('is cacheable and takes no session', async () => {
    const response = await h.agent().get('/v1/vehicles').expect(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
  });
});

describe('the slug', () => {
  it('is minted once, at approval, and survives a second approval', async () => {
    const first = await kit.published(a, nextPlate());
    await h.prisma.listing.update({
      where: { id: first.listingId },
      data: { status: 'PENDING_REVIEW' },
    });
    await admin.post(`/v1/admin/listings/${first.listingId}/approve`).expect(200);

    const row = await h.prisma.listing.findUniqueOrThrow({ where: { id: first.listingId } });
    expect(row.slug).toBe(first.slug);
  });

  it('is not given to a listing that was never approved', async () => {
    const { listingId } = await kit.submitted(a, nextPlate());
    const row = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(row.slug).toBeNull();
  });
});

/**
 * R50 — `/cars` scoped to one district, by the same slug the directory and
 * the header's selector use. A car has no location of its own: the district
 * is the dealership's, so moving a dealership moves its cars.
 */
describe('one district', () => {
  let elsewhere: Dealership;
  let there: Published;

  async function slugsIn(district: string): Promise<{ slugs: string[]; total: number }> {
    const slugs: string[] = [];
    for (let page = 1; ; page += 1) {
      const { body } = await h
        .agent()
        .get(`/v1/vehicles?district=${district}&page=${page}&limit=48`)
        .expect(200);
      slugs.push(...(body.data as VehicleCardDto[]).map((card) => card.slug));
      if (page >= (body.page.totalPages as number)) {
        return { slugs, total: body.page.total as number };
      }
    }
  }

  beforeAll(async () => {
    elsewhere = await marketplaceFixtures(h, 'public-vehicles-district').dealership();
    there = await kit.published(elsewhere, nextPlate());
    await h.prisma.dealer.update({
      where: { id: elsewhere.dealerId },
      data: { city: 'Arcot', district: 'Ranipet' },
    });
  });

  it('lists only the cars of dealerships in that district, and counts only them', async () => {
    const ranipet = await slugsIn('ranipet');
    expect(ranipet.slugs).toContain(there.slug);
    expect(ranipet.slugs).not.toContain(live.slug);
    expect(ranipet.total).toBe(ranipet.slugs.length);

    const vellore = await slugsIn('vellore');
    expect(vellore.slugs).toContain(live.slug);
    expect(vellore.slugs).not.toContain(there.slug);
  });

  it('keeps the public rule inside the district', async () => {
    const hidden = await kit.published(elsewhere, nextPlate());
    await h.prisma.listing.update({ where: { id: hidden.listingId }, data: { status: 'SOLD' } });

    expect((await slugsIn('ranipet')).slugs).not.toContain(hidden.slug);
  });

  it('answers a district nobody trades in with an empty page, not every car', async () => {
    const { body } = await h.agent().get('/v1/vehicles?district=atlantis').expect(200);
    expect(body.data).toEqual([]);
    expect(body.page.total).toBe(0);
  });

  it('adds up, across districts, to the whole marketplace', async () => {
    const all = await allCards();
    const { body: locations } = await h.agent().get('/v1/locations').expect(200);

    expect(locations.cars.total).toBe(all.length);
    expect(locations.cars.districts.ranipet).toBe((await slugsIn('ranipet')).total);
    expect(locations.cars.districts.vellore).toBe((await slugsIn('vellore')).total);
  });

  it('refuses a district that is not a slug', async () => {
    const refused = await h.agent().get('/v1/vehicles?district=Ranipet%20District').expect(400);
    expect(JSON.stringify(refused.body)).toContain('district');
  });

  it("is not a filter on one dealership's cars — the dealership fixes where they are", async () => {
    const refused = await h
      .agent()
      .get(`/v1/dealers/${elsewhere.slug}/vehicles?district=ranipet`)
      .expect(400);
    expect(JSON.stringify(refused.body)).toContain('district');
  });
});
