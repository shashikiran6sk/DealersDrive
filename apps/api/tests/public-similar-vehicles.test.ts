import { SimilarVehiclesResponse, type VehicleCardDto } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApprovalKit, type Published } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R73 — similar vehicles on the vehicle page: available cars only, never the
 * car itself, most alike first, and never an empty section while the
 * marketplace has cars.
 *
 * The source is a make and model no other suite lists (a Kia Carens MUV), so
 * the cars that share it are this suite's own and their ranking can be asserted
 * exactly, whatever else the shared test database holds.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let b: Dealership;
let kit: ReturnType<typeof createApprovalKit>;
let plate = 900;
let source: Published;
let sameModel: Published;
let sameBody: Published;
let reservedTwin: Published;
let soldTwin: Published;
let withdrawnTwin: Published;

const CARENS = {
  make: 'Kia',
  model: 'Carens',
  variant: 'Luxury Plus',
  bodyType: 'MUV',
  pricePaise: 170_000_000,
};

function nextPlate(): string {
  plate += 1;
  return `KL 31 SM ${String(plate).padStart(4, '0')}`;
}

async function similar(slug: string): Promise<VehicleCardDto[]> {
  const { body } = await h.agent().get(`/v1/vehicles/${slug}/similar`).expect(200);
  return SimilarVehiclesResponse.parse(body).data;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'similar');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);

  source = await kit.published(a, nextPlate(), CARENS);
  sameModel = await kit.published(b, nextPlate(), CARENS);
  sameBody = await kit.published(b, nextPlate(), {
    ...CARENS,
    make: 'Toyota',
    model: 'Innova Crysta',
  });
  reservedTwin = await kit.published(b, nextPlate(), CARENS);
  soldTwin = await kit.published(b, nextPlate(), CARENS);
  withdrawnTwin = await kit.published(b, nextPlate(), CARENS);

  await kit.published(a, nextPlate(), {
    make: 'Tata',
    model: 'Tiago',
    bodyType: 'HATCHBACK',
    pricePaise: 45_000_000,
  });
  await kit.published(a, nextPlate(), {
    make: 'Maruti Suzuki',
    model: 'Alto',
    bodyType: 'HATCHBACK',
    pricePaise: 30_000_000,
  });

  await b.agent.post(`/v1/dealer/vehicles/${reservedTwin.vehicleId}/reserve`).expect(200);
  await b.agent.post(`/v1/dealer/vehicles/${soldTwin.vehicleId}/mark-sold`).expect(200);
  await b.agent
    .post(`/v1/dealer/vehicles/${withdrawnTwin.vehicleId}/withdraw`)
    .send({ reason: 'OTHER' })
    .expect(200);
});

afterAll(async () => {
  await h.close();
});

describe('GET /v1/vehicles/:slug/similar', () => {
  it('ranks the same model first, then the same body type, from any dealership', async () => {
    const slugs = (await similar(source.slug)).map((card) => card.slug);
    expect(slugs.slice(0, 2)).toEqual([sameModel.slug, sameBody.slug]);
  });

  it('never suggests the car itself', async () => {
    const slugs = (await similar(source.slug)).map((card) => card.slug);
    expect(slugs).not.toContain(source.slug);
  });

  it('suggests only available cars — never a reserved, sold or withdrawn one', async () => {
    const cards = await similar(source.slug);
    const slugs = cards.map((card) => card.slug);
    expect(slugs).not.toContain(reservedTwin.slug);
    expect(slugs).not.toContain(soldTwin.slug);
    expect(slugs).not.toContain(withdrawnTwin.slug);
    expect(cards.every((card) => card.availability === 'AVAILABLE')).toBe(true);
  });

  it('returns at most four different cars', async () => {
    const cards = await similar(source.slug);
    expect(cards).toHaveLength(4);
    expect(new Set(cards.map((card) => card.slug)).size).toBe(4);
  });

  it('gives the same answer twice', async () => {
    expect(await similar(source.slug)).toEqual(await similar(source.slug));
  });

  it('keeps the dealer strip on every card, since these are often other dealerships’ cars', async () => {
    const [first] = await similar(source.slug);
    expect(first?.dealer.slug).toBe(b.slug);
  });

  it('answers for a reserved car’s page too', async () => {
    const cards = await similar(reservedTwin.slug);
    expect(cards.map((card) => card.slug)).not.toContain(reservedTwin.slug);
    expect(cards.length).toBeGreaterThan(0);
  });

  it.each(['sold', 'withdrawn'] as const)('is a 404 for a %s car', async (which) => {
    const slug = which === 'sold' ? soldTwin.slug : withdrawnTwin.slug;
    const res = await h.agent().get(`/v1/vehicles/${slug}/similar`).expect(404);
    expect(res.body.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('is a 404 for a slug that never existed, and a 400 for one that is not a slug', async () => {
    await h.agent().get('/v1/vehicles/no-such-car-00000000/similar').expect(404);
    await h.agent().get('/v1/vehicles/Not%20A%20Slug/similar').expect(400);
  });

  it('is cacheable for a minute, like the page it sits on', async () => {
    const res = await h.agent().get(`/v1/vehicles/${source.slug}/similar`).expect(200);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });
});
