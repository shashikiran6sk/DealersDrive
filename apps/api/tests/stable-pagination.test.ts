import {
  CustomerEnquiriesResponse,
  DealerEnquiriesResponse,
  SavedVehiclesResponse,
} from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import {
  decodeKeysetCursor,
  encodeCursor,
  encodeKeysetCursor,
} from '../src/platform/pagination.js';
import { createApprovalKit } from './approval-kit.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

let h: AuthHarness;
let owner: Dealership;
let buyer: request.Agent;
let customerId: string;
const at = new Date('2026-10-01T09:00:00.123Z');
type Collection = 'saved' | 'customer' | 'inbox';
let sequence = 0;
let plate = 4800;
let kit: ReturnType<typeof createApprovalKit>;
let admin: request.Agent;

async function scenario(size = 3) {
  sequence += 1;
  const dealer = await marketplaceFixtures(h, `stable-scope-${String(sequence)}`).dealership();
  const agent = h.agent();
  const phone = `98275${String(10000 + sequence).slice(-5)}`;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:stable-scope-${String(sequence)}`,
    })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({
      signUpToken: proved.body.signUpToken,
      fullName: 'Pagination Fixture',
    })
    .expect(201);
  const id = String(created.body.customer.id);
  const cars = [];
  for (let n = 0; n < size; n += 1) {
    plate += 1;
    const car = await kit.published(dealer, `KL41PG${String(plate)}`);
    cars.push(car);
    await agent.put(`/v1/saved-vehicles/${car.slug}`).expect(200);
    await agent.post('/v1/enquiries').send({ listingSlug: car.slug }).expect(201);
  }
  await h.prisma.savedVehicle.updateMany({ where: { customerId: id }, data: { createdAt: at } });
  await h.prisma.enquiry.updateMany({ where: { customerId: id }, data: { createdAt: at } });
  return { dealer, agent, customerId: id, cars };
}

function collectionPath(collection: Collection): string {
  return collection === 'saved'
    ? '/v1/saved-vehicles'
    : collection === 'customer'
      ? '/v1/enquiries'
      : '/v1/dealer/enquiries';
}

async function readPage(
  collection: Collection,
  agent: request.Agent,
  query: { limit?: number; cursor?: string; status?: string } = {},
) {
  const response = await agent.get(collectionPath(collection)).query(query).expect(200);
  const body =
    collection === 'saved'
      ? SavedVehiclesResponse.parse(response.body)
      : collection === 'customer'
        ? CustomerEnquiriesResponse.parse(response.body)
        : DealerEnquiriesResponse.parse(response.body);
  return { ...body, keys: body.data.map((row) => ('id' in row ? row.id : row.vehicle.slug)) };
}

async function expectedKeys(collection: Collection, buyerId: string, dealerId: string) {
  if (collection === 'saved') {
    const rows = await h.prisma.savedVehicle.findMany({
      where: { customerId: buyerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { listing: true },
    });
    return rows.map((row) => row.listing.slug);
  }
  const rows = await h.prisma.enquiry.findMany({
    where: collection === 'customer' ? { customerId: buyerId } : { dealerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return rows.map((row) => row.id);
}

async function walk(collection: Collection, agent: request.Agent, limit: number, status?: string) {
  const visited: string[] = [];
  let cursor: string | undefined;
  for (let n = 0; n < 10; n += 1) {
    const page = await readPage(collection, agent, {
      limit,
      ...(cursor ? { cursor } : {}),
      ...(status ? { status } : {}),
    });
    visited.push(...page.keys);
    if (!page.page.hasMore) {
      expect(page.page.nextCursor).toBeNull();
      return visited;
    }
    expect(page.page.nextCursor).not.toBeNull();
    expect(page.page.nextCursor).not.toBe(cursor);
    cursor = page.page.nextCursor ?? undefined;
  }
  throw new Error('Pagination did not terminate');
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'stable-page');
  owner = await fixtures.dealership();
  admin = await fixtures.moderator();
  kit = createApprovalKit(h, admin);
  buyer = h.agent();
  const phone = '9827310001';
  const proved = await buyer
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:stable-page-buyer`,
    })
    .expect(200);
  const created = await buyer
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName: 'Pagination Fixture' })
    .expect(201);
  customerId = String(created.body.customer.id);
  for (let n = 0; n < 3; n += 1) {
    const car = await kit.published(owner, `KL41PG${String(4100 + n)}`);
    await buyer.put(`/v1/saved-vehicles/${car.slug}`).expect(200);
    await buyer.post('/v1/enquiries').send({ listingSlug: car.slug }).expect(201);
  }
  await h.prisma.savedVehicle.updateMany({ where: { customerId }, data: { createdAt: at } });
  await h.prisma.enquiry.updateMany({ where: { customerId }, data: { createdAt: at } });
});

afterAll(async () => {
  await h.close();
});

it.each(['saved', 'customer', 'inbox'] as const)(
  'visits every equal-time row once in the %s collection (BUG-003)',
  async (collection) => {
    const isSaved = collection === 'saved';
    const agent = collection === 'inbox' ? owner.agent : buyer;
    const path = isSaved
      ? '/v1/saved-vehicles'
      : collection === 'customer'
        ? '/v1/enquiries'
        : '/v1/dealer/enquiries';
    const rows = isSaved
      ? await h.prisma.savedVehicle.findMany({
          where: { customerId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { listing: true },
        })
      : await h.prisma.enquiry.findMany({
          where: { customerId, dealerId: owner.dealerId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.createdAt.getTime() === at.getTime())).toBe(true);
    const expected = rows.map((row) => ('listing' in row ? row.listing.slug : row.id));
    const visited: string[] = [];
    const pages: { count: number; hasMore: boolean }[] = [];
    let cursor: string | null = null;
    for (let n = 0; n < 5; n += 1) {
      const response: request.Response = await agent
        .get(path)
        .query({ limit: 1, ...(cursor ? { cursor } : {}) })
        .expect(200);
      const page: SavedVehiclesResponse | CustomerEnquiriesResponse | DealerEnquiriesResponse =
        isSaved
          ? SavedVehiclesResponse.parse(response.body)
          : collection === 'customer'
            ? CustomerEnquiriesResponse.parse(response.body)
            : DealerEnquiriesResponse.parse(response.body);
      for (const row of page.data) {
        visited.push('id' in row ? row.id : row.vehicle.slug);
      }
      pages.push({ count: page.data.length, hasMore: page.page.hasMore });
      cursor = page.page.nextCursor;
      if (!page.page.hasMore) break;
      expect(cursor).not.toBeNull();
    }
    console.log(JSON.stringify({ finding: 'BUG-003', collection, expected, visited, pages }));
    expect(visited).toEqual(expected);
    expect(new Set(visited).size).toBe(3);
    expect(pages).toEqual([
      { count: 1, hasMore: true },
      { count: 1, hasMore: true },
      { count: 1, hasMore: false },
    ]);
    expect(cursor).toBeNull();
  },
);

it.each(['saved', 'customer', 'inbox'] as const)(
  'handles page sizes, replay and legacy cursors in %s',
  async (collection) => {
    const agent = collection === 'inbox' ? owner.agent : buyer;
    const expected = await expectedKeys(collection, customerId, owner.dealerId);
    for (const limit of [2, 3, 5]) expect(await walk(collection, agent, limit)).toEqual(expected);
    const first = await readPage(collection, agent, { limit: 1 });
    const cursor = first.page.nextCursor;
    expect(cursor).not.toBeNull();
    expect(decodeKeysetCursor(cursor ?? '').at).toEqual(at);
    const next = await readPage(collection, agent, { limit: 1, cursor: cursor ?? '' });
    const replay = await readPage(collection, agent, { limit: 1, cursor: cursor ?? '' });
    expect(replay.keys).toEqual(next.keys);
    expect(replay.page).toEqual(next.page);
    const legacy = await readPage(collection, agent, {
      limit: 1,
      cursor: encodeCursor(new Date(at.getTime() + 1)),
    });
    expect(legacy.keys).toEqual(expected.slice(0, 1));
    expect(decodeKeysetCursor(legacy.page.nextCursor ?? '').at).toEqual(at);
    expect((await readPage(collection, agent, { cursor: encodeCursor(at) })).keys).toEqual([]);
  },
);

it.each(['saved', 'customer', 'inbox'] as const)(
  'preserves mixed-time order and continues after a deleted anchor in %s',
  async (collection) => {
    const fixture = await scenario(4);
    const agent = collection === 'inbox' ? fixture.dealer.agent : fixture.agent;
    const saved = await h.prisma.savedVehicle.findMany({
      where: { customerId: fixture.customerId },
      orderBy: { id: 'desc' },
    });
    const enquiries = await h.prisma.enquiry.findMany({
      where: { customerId: fixture.customerId },
      orderBy: { id: 'desc' },
    });
    for (const [n, row] of saved.entries())
      await h.prisma.savedVehicle.update({
        where: { id: row.id },
        data: { createdAt: new Date(at.getTime() + (n === 0 ? 1 : n === 3 ? -1 : 0)) },
      });
    for (const [n, row] of enquiries.entries())
      await h.prisma.enquiry.update({
        where: { id: row.id },
        data: { createdAt: new Date(at.getTime() + (n === 0 ? 1 : n === 3 ? -1 : 0)) },
      });
    const expected = await expectedKeys(collection, fixture.customerId, fixture.dealer.dealerId);
    expect(await walk(collection, agent, 1)).toEqual(expected);
    const first = await readPage(collection, agent, { limit: 2 });
    const cursor = first.page.nextCursor;
    const anchor = first.keys[1];
    expect(anchor).toBeDefined();
    if (collection === 'saved')
      await agent.delete(`/v1/saved-vehicles/${anchor ?? ''}`).expect(200);
    else await h.prisma.enquiry.delete({ where: { id: anchor ?? '' } });
    const next = await readPage(collection, agent, { limit: 2, cursor: cursor ?? '' });
    expect(next.keys).toEqual(expected.slice(2));
    expect(next.page).toEqual({ hasMore: false, nextCursor: null });
    expect(await expectedKeys(collection, fixture.customerId, fixture.dealer.dealerId)).toEqual(
      expected.filter((id) => id !== anchor),
    );
  },
);

it.each(['saved', 'customer', 'inbox'] as const)(
  'keeps foreign cursor IDs scoped and rejects malformed or forged queries in %s',
  async (collection) => {
    const other = await scenario(1);
    const agent = collection === 'inbox' ? owner.agent : buyer;
    const foreign = await h.prisma.enquiry.findFirstOrThrow({
      where: { customerId: other.customerId },
    });
    const forged = encodeKeysetCursor(new Date('2027-01-01T00:00:00.000Z'), foreign.id);
    const page = await readPage(collection, agent, { cursor: forged });
    expect(page.keys).toEqual(await expectedKeys(collection, customerId, owner.dealerId));
    await h.agent().get(collectionPath(collection)).query({ cursor: forged }).expect(401);
    for (const cursor of [
      'garbage',
      Buffer.from(`${at.toISOString()}|bad-id`).toString('base64url'),
      Buffer.from(`${at.toISOString()}|${foreign.id}|extra`).toString('base64url'),
    ]) {
      const result = await agent.get(collectionPath(collection)).query({ cursor }).expect(409);
      expect(result.body.code).toBe('MALFORMED_CURSOR');
    }
    for (const field of ['dealerId', 'customerId'])
      await agent
        .get(collectionPath(collection))
        .query({ [field]: other.dealer.dealerId, cursor: forged })
        .expect(400);
    for (const limit of [0, -1, 101])
      await agent.get(collectionPath(collection)).query({ limit }).expect(400);
    const foreignAgent = collection === 'inbox' ? other.dealer.agent : other.agent;
    expect((await readPage(collection, foreignAgent, { cursor: forged })).keys).toEqual(
      await expectedKeys(collection, other.customerId, other.dealer.dealerId),
    );
  },
);

it.each(['ACTIVE', 'SUSPENDED'] as const)(
  'paginates tied historical rows across listing/enquiry lifecycle with a %s dealer',
  async (dealerStatus) => {
    const fixture = await scenario(8);
    const listingStates = ['ACTIVE', 'RESERVED', 'SOLD', 'WITHDRAWN'] as const;
    const enquiryStates = ['NEW', 'CONTACTED', 'CLOSED', 'SPAM'] as const;
    for (const [n, car] of fixture.cars.entries()) {
      const status = listingStates[n % 4];
      const action =
        status === 'RESERVED'
          ? 'reserve'
          : status === 'SOLD'
            ? 'mark-sold'
            : status === 'WITHDRAWN'
              ? 'withdraw'
              : null;
      if (action) {
        const change = fixture.dealer.agent.post(`/v1/dealer/vehicles/${car.vehicleId}/${action}`);
        await (action === 'withdraw' ? change.send({ reason: 'OTHER' }) : change).expect(200);
      }
      const enquiry = await h.prisma.enquiry.findFirstOrThrow({
        where: { customerId: fixture.customerId, listingId: car.listingId },
      });
      const enquiryStatus = enquiryStates[n % 4];
      if (enquiryStatus && enquiryStatus !== 'NEW')
        await fixture.dealer.agent
          .patch(`/v1/dealer/enquiries/${enquiry.id}`)
          .send({ status: enquiryStatus })
          .expect(200);
    }
    if (dealerStatus === 'SUSPENDED')
      await admin
        .post(`/v1/admin/dealers/${fixture.dealer.dealerId}/suspend`)
        .send({ reason: 'Isolated lifecycle verification' })
        .expect(200);
    const before = await h.prisma.enquiry.findMany({
      where: { customerId: fixture.customerId },
      orderBy: { id: 'asc' },
    });
    const auditCount = await h.prisma.auditLog.count({
      where: { dealerId: fixture.dealer.dealerId },
    });
    for (const collection of ['saved', 'customer'] as const)
      expect(await walk(collection, fixture.agent, 1)).toEqual(
        await expectedKeys(collection, fixture.customerId, fixture.dealer.dealerId),
      );
    const saved = SavedVehiclesResponse.parse(
      (await fixture.agent.get('/v1/saved-vehicles').expect(200)).body,
    );
    for (const [n, car] of fixture.cars.entries()) {
      const status = listingStates[n % 4];
      const row = saved.data.find((entry) => entry.vehicle.slug === car.slug);
      expect(row?.vehicle.availability).toBe(
        status === 'SOLD'
          ? 'SOLD'
          : dealerStatus === 'SUSPENDED' || status === 'WITHDRAWN'
            ? 'UNAVAILABLE'
            : status === 'RESERVED'
              ? 'RESERVED'
              : 'AVAILABLE',
      );
      if (dealerStatus === 'SUSPENDED' || status === 'SOLD' || status === 'WITHDRAWN')
        expect(row?.vehicle.image).toBeNull();
    }
    const mine = await fixture.agent.get('/v1/enquiries').expect(200);
    expect(JSON.stringify(mine.body)).not.toMatch(/spam/i);
    if (dealerStatus === 'SUSPENDED') {
      await fixture.dealer.agent.get('/v1/dealer/enquiries').query({ limit: 1 }).expect(401);
    } else {
      expect(await walk('inbox', fixture.dealer.agent, 1)).toEqual(
        await expectedKeys('inbox', fixture.customerId, fixture.dealer.dealerId),
      );
      for (const status of enquiryStates) {
        const rows = await h.prisma.enquiry.findMany({
          where: { dealerId: fixture.dealer.dealerId, status },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        expect(await walk('inbox', fixture.dealer.agent, 1, status)).toEqual(
          rows.map((row) => row.id),
        );
        const page = DealerEnquiriesResponse.parse(
          (
            await fixture.dealer.agent
              .get('/v1/dealer/enquiries')
              .query({ status, limit: 1 })
              .expect(200)
          ).body,
        );
        expect(page.counts).toEqual({ ALL: 8, NEW: 2, CONTACTED: 2, CLOSED: 2, SPAM: 2 });
      }
    }
    expect(
      await h.prisma.enquiry.findMany({
        where: { customerId: fixture.customerId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);
    expect(await h.prisma.auditLog.count({ where: { dealerId: fixture.dealer.dealerId } })).toBe(
      auditCount,
    );
    expect(await h.prisma.savedVehicle.count({ where: { customerId: fixture.customerId } })).toBe(
      8,
    );
    expect(before.every((row) => row.createdAt.getTime() === at.getTime())).toBe(true);
  },
);

it('enforces current membership and logout on a cursor obtained in an existing dealer session', async () => {
  const fixture = await scenario();
  const fixtures = marketplaceFixtures(h, 'stable-revocation');
  const member = await fixtures.member(fixture.dealer, 'MANAGER');
  const first = await readPage('inbox', member.agent, { limit: 1 });
  const cursor = first.page.nextCursor;
  const membership = await h.prisma.dealerMember.findUniqueOrThrow({
    where: { dealerId_userId: { dealerId: fixture.dealer.dealerId, userId: member.userId } },
  });
  await fixture.dealer.agent
    .patch(`/v1/dealer/team/members/${membership.id}`)
    .send({ role: 'STAFF' })
    .expect(200);
  expect(
    (await readPage('inbox', member.agent, { limit: 1, cursor: cursor ?? '' })).keys,
  ).toHaveLength(1);
  await fixture.dealer.agent.delete(`/v1/dealer/team/members/${membership.id}`).expect(204);
  await member.agent.get('/v1/dealer/enquiries').query({ cursor }).expect(401);
  expect(
    await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: membership.id } }),
  ).toMatchObject({ status: 'REMOVED', role: 'STAFF', removedBy: fixture.dealer.userId });
  await fixture.agent.post('/v1/auth/customer/logout').expect(204);
  await fixture.agent.get('/v1/enquiries').query({ cursor }).expect(401);
  await fixture.agent.get('/v1/saved-vehicles').query({ cursor }).expect(401);
  expect(await h.prisma.enquiry.count({ where: { customerId: fixture.customerId } })).toBe(3);
  expect(await h.prisma.savedVehicle.count({ where: { customerId: fixture.customerId } })).toBe(3);
  const customer = await h.prisma.user.findUniqueOrThrow({ where: { id: fixture.customerId } });
  const phone = customer.phone?.replace(/^\+91/, '') ?? '';
  const fresh = h.agent();
  await fresh
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:stable-relogin`,
    })
    .expect(200);
  expect(await walk('saved', fresh, 1)).toEqual(
    await expectedKeys('saved', fixture.customerId, fixture.dealer.dealerId),
  );
  expect(await walk('customer', fresh, 1)).toEqual(
    await expectedKeys('customer', fixture.customerId, fixture.dealer.dealerId),
  );
});
