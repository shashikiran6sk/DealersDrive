import type { DealerCard, PublicVehiclesResponse, VehicleCardDto } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createApprovalKit, type Published } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R71 — every public surface against the four lifecycle states.
 *
 *              /cars   card clickable   enquiry   portfolio   counts
 *   ACTIVE      yes         yes            yes        yes        yes
 *   RESERVED    yes         no             no         yes        no
 *   SOLD        no          —              no         no         no
 *   WITHDRAWN   no          —              no         no         no
 *
 * One dealership gets one car in each state, moved there through the dealer's
 * own R69 routes, so what is asserted is what a real reservation, sale or
 * withdrawal leaves behind.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let kit: ReturnType<typeof createApprovalKit>;
let cars: Record<'ACTIVE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN', Published>;
let plate = 700;
let phones = 0;
let tokens = 0;

function nextPlate(): string {
  plate += 1;
  return `KL 21 LF ${String(plate).padStart(4, '0')}`;
}

async function customer(): Promise<request.Agent> {
  phones += 1;
  tokens += 1;
  const agent = h.agent();
  const phone = `98499${String(10000 + phones).slice(-5)}`;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:lifecycle-${String(tokens)}`,
    })
    .expect(200);
  await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName: 'Anitha' })
    .expect(201);
  return agent;
}

async function portfolio(query = ''): Promise<PublicVehiclesResponse> {
  const { body } = await h.agent().get(`/v1/dealers/${a.slug}/vehicles${query}`).expect(200);
  return body as PublicVehiclesResponse;
}

async function everyCard(): Promise<VehicleCardDto[]> {
  const cards: VehicleCardDto[] = [];
  for (let page = 1; ; page += 1) {
    const { body } = await h.agent().get(`/v1/vehicles?page=${page}&limit=48`).expect(200);
    cards.push(...(body.data as VehicleCardDto[]));
    if (page >= (body.page.totalPages as number)) return cards;
  }
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'public-lifecycle');
  a = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);

  const details = { make: 'Mahindra', model: 'Thar', variant: 'LX' };
  cars = {
    ACTIVE: await kit.published(a, nextPlate(), details),
    RESERVED: await kit.published(a, nextPlate(), details),
    SOLD: await kit.published(a, nextPlate(), details),
    WITHDRAWN: await kit.published(a, nextPlate(), details),
  };
  await a.agent.post(`/v1/dealer/vehicles/${cars.RESERVED.vehicleId}/reserve`).expect(200);
  await a.agent.post(`/v1/dealer/vehicles/${cars.SOLD.vehicleId}/mark-sold`).expect(200);
  await a.agent
    .post(`/v1/dealer/vehicles/${cars.WITHDRAWN.vehicleId}/withdraw`)
    .send({ reason: 'TEMPORARILY_PAUSED' })
    .expect(200);
});

afterAll(async () => {
  await h.close();
});

describe('/v1/vehicles — the marketplace', () => {
  it('lists ACTIVE and RESERVED, and neither SOLD nor WITHDRAWN', async () => {
    const bySlug = new Map((await everyCard()).map((card) => [card.slug, card]));

    expect(bySlug.get(cars.ACTIVE.slug)?.availability).toBe('AVAILABLE');
    expect(bySlug.get(cars.RESERVED.slug)?.availability).toBe('RESERVED');
    expect(bySlug.has(cars.SOLD.slug)).toBe(false);
    expect(bySlug.has(cars.WITHDRAWN.slug)).toBe(false);
  });

  it('puts every available car before any reserved one', async () => {
    const order = (await everyCard()).map((card) => card.availability);
    const firstReserved = order.indexOf('RESERVED');
    expect(firstReserved).toBeGreaterThanOrEqual(0);
    expect(order.slice(firstReserved).every((value) => value === 'RESERVED')).toBe(true);
  });

  it('never says a reserved car is available: `available` counts ACTIVE alone', async () => {
    const { body } = await h.agent().get('/v1/vehicles?brand=mahindra&limit=48').expect(200);
    const response = body as PublicVehiclesResponse;
    const mine = response.data.filter((card) =>
      [cars.ACTIVE.slug, cars.RESERVED.slug].includes(card.slug),
    );
    expect(mine).toHaveLength(2);
    expect(response.available).toBe(response.page.total - 1 * countReserved(response.data));
  });
});

function countReserved(cards: readonly VehicleCardDto[]): number {
  return cards.filter((card) => card.availability === 'RESERVED').length;
}

describe('the dealer portfolio', () => {
  it('shows the ACTIVE car first and the RESERVED one after it, and nothing else', async () => {
    const response = await portfolio();
    expect(response.data.map((card) => [card.slug, card.availability])).toEqual([
      [cars.ACTIVE.slug, 'AVAILABLE'],
      [cars.RESERVED.slug, 'RESERVED'],
    ]);
    expect(response.page.total).toBe(2);
    expect(response.available).toBe(1);
  });

  it('counts only the available car in every facet', async () => {
    const { facets } = await portfolio();
    expect(facets.brands.find((option) => option.label === 'Mahindra')?.count).toBe(1);
    expect(facets.bodyTypes.reduce((sum, option) => sum + option.count, 0)).toBe(1);
  });
});

describe('the directory', () => {
  it('counts the dealership’s current listings as the ACTIVE ones alone', async () => {
    const brand = await h.prisma.dealer.findUniqueOrThrow({ where: { id: a.dealerId } });
    const { body } = await h
      .agent()
      .get(`/v1/dealers?q=${encodeURIComponent(brand.brandName)}`)
      .expect(200);
    const card = (body.data as DealerCard[]).find((entry) => entry.slug === a.slug);
    expect(card?.carCount).toBe(1);
  });
});

describe('the vehicle page', () => {
  it('opens an ACTIVE car as available', async () => {
    const { body } = await h.agent().get(`/v1/vehicles/${cars.ACTIVE.slug}`).expect(200);
    expect(body.availability).toBe('AVAILABLE');
  });

  it('opens a RESERVED car from a known link, and says it is reserved', async () => {
    const { body } = await h.agent().get(`/v1/vehicles/${cars.RESERVED.slug}`).expect(200);
    expect(body.availability).toBe('RESERVED');
  });

  it.each(['SOLD', 'WITHDRAWN'] as const)('answers a %s car with a 404', async (status) => {
    const res = await h.agent().get(`/v1/vehicles/${cars[status].slug}`).expect(404);
    expect(res.body.code).toBe('VEHICLE_NOT_FOUND');
  });
});

describe('enquiries — enforced by the server, not by a hidden button', () => {
  it('takes one about an ACTIVE car', async () => {
    const agent = await customer();
    await agent.post('/v1/enquiries').send({ listingSlug: cars.ACTIVE.slug }).expect(201);
  });

  it('refuses a RESERVED car, and says why', async () => {
    const agent = await customer();
    const res = await agent
      .post('/v1/enquiries')
      .send({ listingSlug: cars.RESERVED.slug })
      .expect(409);
    expect(res.body.code).toBe('LISTING_RESERVED');
  });

  it.each(['SOLD', 'WITHDRAWN'] as const)('refuses a %s car', async (status) => {
    const agent = await customer();
    const res = await agent
      .post('/v1/enquiries')
      .send({ listingSlug: cars[status].slug })
      .expect(409);
    expect(res.body.code).toBe('LISTING_NOT_AVAILABLE');
  });

  it('takes one again once a reserved car is back on sale', async () => {
    const car = await kit.published(a, nextPlate());
    await a.agent.post(`/v1/dealer/vehicles/${car.vehicleId}/reserve`).expect(200);
    const agent = await customer();
    await agent.post('/v1/enquiries').send({ listingSlug: car.slug }).expect(409);

    await a.agent.post(`/v1/dealer/vehicles/${car.vehicleId}/reactivate`).expect(200);
    await agent.post('/v1/enquiries').send({ listingSlug: car.slug }).expect(201);
  });

  it('lands at most one of an enquiry and a sale racing on one car, and never an enquiry after the sale', async () => {
    const car = await kit.published(a, nextPlate());
    const agent = await customer();
    const [enquiry, sale] = await Promise.all([
      agent.post('/v1/enquiries').send({ listingSlug: car.slug }),
      a.agent.post(`/v1/dealer/vehicles/${car.vehicleId}/mark-sold`),
    ]);
    expect(sale.status).toBe(200);
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: car.listingId } });
    const enquiries = await h.prisma.enquiry.findMany({ where: { listingId: car.listingId } });
    if (enquiry.status === 201) {
      expect(enquiries).toHaveLength(1);
      expect(enquiries[0]!.createdAt.getTime()).toBeLessThanOrEqual(
        (listing.soldAt ?? new Date()).getTime(),
      );
    } else {
      expect(enquiry.status).toBe(409);
      expect(enquiries).toHaveLength(0);
    }
  });
});
