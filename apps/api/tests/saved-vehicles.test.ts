import {
  SavedVehicleSlugs,
  SavedVehiclesResponse,
  type SavedVehicle,
} from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createApprovalKit, type Published } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R74 — saved cars, on the server.
 *
 * Every customer here signs in through the real phone flow, so the guard and
 * the session are production code: whose list it is can only come from the
 * cookie. Cars are moved through the dealer's own R69 routes, so what a saved
 * row shows after a reservation, a sale or a withdrawal is what a customer
 * would really see.
 */
let h: AuthHarness;
let admin: request.Agent;
let a: Dealership;
let kit: ReturnType<typeof createApprovalKit>;
let plate = 1200;
let phones = 0;

function nextPlate(): string {
  plate += 1;
  return `KL 41 SV ${String(plate).padStart(4, '0')}`;
}

async function customer(): Promise<request.Agent> {
  phones += 1;
  const agent = h.agent();
  const phone = `98377${String(10000 + phones).slice(-5)}`;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:saved-${String(phones)}`,
    })
    .expect(200);
  await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName: 'Divya' })
    .expect(201);
  return agent;
}

async function car(): Promise<Published> {
  return kit.published(a, nextPlate());
}

async function saved(agent: request.Agent, query = ''): Promise<SavedVehiclesResponse> {
  const { body } = await agent.get(`/v1/saved-vehicles${query}`).expect(200);
  return SavedVehiclesResponse.parse(body);
}

function entry(list: SavedVehiclesResponse, slug: string): SavedVehicle | undefined {
  return list.data.find((row) => row.vehicle.slug === slug);
}

async function audits(listingId: string, action: string): Promise<number> {
  return h.prisma.auditLog.count({ where: { entityId: listingId, action } });
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'saved');
  a = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);
});

afterAll(async () => {
  await h.close();
});

describe('who may keep a list', () => {
  it.each([
    ['GET', '/v1/saved-vehicles'],
    ['GET', '/v1/saved-vehicles/slugs'],
    ['PUT', '/v1/saved-vehicles/any-car'],
    ['DELETE', '/v1/saved-vehicles/any-car'],
  ])('refuses %s %s signed out', async (method, path) => {
    const agent = h.agent();
    const req =
      method === 'GET' ? agent.get(path) : method === 'PUT' ? agent.put(path) : agent.delete(path);
    await req.expect(401);
  });

  it('keeps each customer’s list to themselves', async () => {
    const first = await customer();
    const second = await customer();
    const listed = await car();
    await first.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);

    expect((await saved(second)).data).toEqual([]);
    const { body } = await second.get('/v1/saved-vehicles/slugs').expect(200);
    expect(SavedVehicleSlugs.parse(body).slugs).toEqual([]);

    await second.delete(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    expect(entry(await saved(first), listed.slug)).toBeDefined();
  });

  it('takes no customer from the request — there is nowhere to put one', async () => {
    const agent = await customer();
    await agent.get('/v1/saved-vehicles?customerId=someone-else').expect(400);
  });
});

describe('saving', () => {
  it('saves an available car and lists it with its card, photograph and time', async () => {
    const agent = await customer();
    const listed = await car();

    const res = await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    expect(res.body).toEqual({ slug: listed.slug, saved: true });
    expect(res.headers['cache-control']).toBe('no-store');

    const row = entry(await saved(agent), listed.slug);
    expect(row?.vehicle.availability).toBe('AVAILABLE');
    expect(row?.vehicle.image).not.toBeNull();
    expect(Date.parse(row?.savedAt ?? '')).not.toBeNaN();

    const { body } = await agent.get('/v1/saved-vehicles/slugs').expect(200);
    expect(body.slugs).toContain(listed.slug);
    expect(await audits(listed.listingId, 'vehicle.saved')).toBe(1);
  });

  it('saves once however many times it is pressed, even all at once', async () => {
    const agent = await customer();
    const listed = await car();

    await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => agent.put(`/v1/saved-vehicles/${listed.slug}`)),
    );
    expect(burst.every((res) => res.status === 200)).toBe(true);

    await expect(
      h.prisma.savedVehicle.count({ where: { listingId: listed.listingId } }),
    ).resolves.toBe(1);
    expect(await audits(listed.listingId, 'vehicle.saved')).toBe(1);
  });

  it('saves a reserved car — it is still on show — and says it is reserved', async () => {
    const agent = await customer();
    const listed = await car();
    await a.agent.post(`/v1/dealer/vehicles/${listed.vehicleId}/reserve`).expect(200);

    await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    expect(entry(await saved(agent), listed.slug)?.vehicle.availability).toBe('RESERVED');
  });

  it.each(['mark-sold', 'withdraw'] as const)(
    'refuses to newly save a car after %s',
    async (move) => {
      const agent = await customer();
      const listed = await car();
      const req = a.agent.post(`/v1/dealer/vehicles/${listed.vehicleId}/${move}`);
      await (move === 'withdraw' ? req.send({ reason: 'OTHER' }) : req).expect(200);

      const res = await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(409);
      expect(res.body.code).toBe('LISTING_NOT_SAVEABLE');
    },
  );

  it('answers a slug that never existed with a 404, and one that is not a slug with a 400', async () => {
    const agent = await customer();
    const res = await agent.put('/v1/saved-vehicles/no-such-car-00000000').expect(404);
    expect(res.body.code).toBe('LISTING_NOT_FOUND');
    await agent.put('/v1/saved-vehicles/Not%20A%20Slug').expect(400);
  });
});

describe('the lifecycle never deletes a saved car', () => {
  it('keeps it through a reservation, a sale and says what became of it', async () => {
    const agent = await customer();
    const listed = await car();
    await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);

    await a.agent.post(`/v1/dealer/vehicles/${listed.vehicleId}/reserve`).expect(200);
    expect(entry(await saved(agent), listed.slug)?.vehicle.availability).toBe('RESERVED');

    await a.agent.post(`/v1/dealer/vehicles/${listed.vehicleId}/mark-sold`).expect(200);
    const sold = entry(await saved(agent), listed.slug);
    expect(sold?.vehicle.availability).toBe('SOLD');
    expect(sold?.vehicle.image).toBeNull();
    expect(sold?.vehicle.title).toBeTruthy();

    await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    await expect(
      h.prisma.savedVehicle.count({ where: { listingId: listed.listingId } }),
    ).resolves.toBe(1);
  });

  it('shows a withdrawn car as no longer available, and back again once approved back on sale', async () => {
    const agent = await customer();
    const listed = await car();
    await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);

    await a.agent
      .post(`/v1/dealer/vehicles/${listed.vehicleId}/withdraw`)
      .send({ reason: 'TEMPORARILY_PAUSED' })
      .expect(200);
    expect(entry(await saved(agent), listed.slug)?.vehicle.availability).toBe('UNAVAILABLE');

    const requested = await a.agent
      .post(`/v1/dealer/vehicles/${listed.vehicleId}/request-reactivation`)
      .send({})
      .expect(200);
    expect(entry(await saved(agent), listed.slug)?.vehicle.availability).toBe('UNAVAILABLE');
    await admin
      .post(`/v1/admin/reactivation-requests/${requested.body.listing.reactivation.id}/approve`)
      .send({})
      .expect(200);
    expect(entry(await saved(agent), listed.slug)?.vehicle.availability).toBe('AVAILABLE');
  });

  it('shows every car of a suspended dealership as no longer available', async () => {
    const fixtures = marketplaceFixtures(h, 'saved-suspended');
    const other = await fixtures.dealership();
    const listed = await kit.published(other, nextPlate());
    const agent = await customer();
    await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);

    await h.prisma.dealer.update({ where: { id: other.dealerId }, data: { status: 'SUSPENDED' } });
    const row = entry(await saved(agent), listed.slug);
    expect(row?.vehicle.availability).toBe('UNAVAILABLE');
    expect(row?.vehicle.image).toBeNull();
  });
});

describe('removing', () => {
  it('removes a saved car, idempotently, whatever state it is in', async () => {
    const agent = await customer();
    const listed = await car();
    await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    await a.agent.post(`/v1/dealer/vehicles/${listed.vehicleId}/mark-sold`).expect(200);

    const res = await agent.delete(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    expect(res.body).toEqual({ slug: listed.slug, saved: false });
    await agent.delete(`/v1/saved-vehicles/${listed.slug}`).expect(200);

    expect(entry(await saved(agent), listed.slug)).toBeUndefined();
    expect(await audits(listed.listingId, 'vehicle.unsaved')).toBe(1);
  });
});

describe('the list', () => {
  it('is newest first, and pages by cursor', async () => {
    const agent = await customer();
    const cars = [await car(), await car(), await car()];
    for (const listed of cars) {
      await agent.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    }

    const first = await saved(agent, '?limit=2');
    expect(first.data.map((row) => row.vehicle.slug)).toEqual([cars[2]!.slug, cars[1]!.slug]);
    expect(first.page.hasMore).toBe(true);

    const second = await saved(agent, `?limit=2&cursor=${first.page.nextCursor ?? ''}`);
    expect(second.data.map((row) => row.vehicle.slug)).toEqual([cars[0]!.slug]);
    expect(second.page.hasMore).toBe(false);
  });

  it('refuses a query it does not know', async () => {
    const agent = await customer();
    await agent.get('/v1/saved-vehicles?status=SOLD').expect(400);
  });
});
