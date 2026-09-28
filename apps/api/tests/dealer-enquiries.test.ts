import type { ListingStatus } from '@prisma/client';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R66 — the dealership's enquiry inbox.
 *
 * The properties worth pinning are about whose inbox an enquiry is in and what
 * the dealer is shown: only their own dealership's, never another's by any
 * path; the customer's current name and proved number, read from the account
 * rather than stored; and a status that moves only by the dealership's hand,
 * each move audited. Customers enquire through the real endpoint, so every
 * row here was made the way production makes one.
 */
let h: AuthHarness;
let a: Dealership;
let b: Dealership;
let counter = 0;
let tokens = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'inbox');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
});

afterAll(async () => {
  await h.close();
});

function freeNumber(): string {
  counter += 1;
  return `98477${String(10000 + counter).slice(-5)}`;
}

async function customer(fullName: string) {
  const agent = h.agent();
  const phone = freeNumber();
  tokens += 1;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:inbox-${String(tokens)}`,
    })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, phone: `+91${phone}`, id: created.body.customer.id as string };
}

async function car(owner: Dealership, status: ListingStatus = 'ACTIVE') {
  counter += 1;
  const stamp = `${String(counter)}-${Date.now().toString(36)}`;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.dealerId,
      registrationNumber: `TN23IB${String(1000 + counter)}`,
      rtoCode: 'TN23',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      manufacturingYear: 2023,
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: owner.dealerId,
      status,
      slug: `2023-hyundai-creta-inbox-${stamp}`,
      publishedAt: new Date(),
    },
  });
  return { vehicleId: vehicle.id, listingId: listing.id, slug: listing.slug ?? '' };
}

async function enquire(agent: request.Agent, slug: string, message?: string): Promise<string> {
  const res = await agent
    .post('/v1/enquiries')
    .send({ listingSlug: slug, ...(message ? { message } : {}) })
    .expect(201);
  return String(res.body.id);
}

function setStatus(owner: Dealership, id: string, status: string) {
  return owner.agent.patch(`/v1/dealer/enquiries/${id}`).send({ status });
}

async function auditRows(entityId: string) {
  return h.prisma.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } });
}

describe('who may read an inbox', () => {
  it('refuses nobody-in-particular', async () => {
    await h.agent().get('/v1/dealer/enquiries').expect(401);
    await h.agent().get('/v1/dealer/enquiries/counts').expect(401);
  });

  it('refuses a customer session — a customer has no inbox', async () => {
    const { agent } = await customer('Asha');
    await agent.get('/v1/dealer/enquiries').expect(401);
  });
});

describe('what the dealership sees', () => {
  it('lists its enquiries newest first, with the customer read from their account', async () => {
    const owner = await marketplaceFixtures(h, 'inbox-list').dealership();
    const first = await car(owner);
    const second = await car(owner);
    const ravi = await customer('Ravi Kumar');
    const meena = await customer('Meena');
    const older = await enquire(ravi.agent, first.slug, 'Is the price negotiable?');
    const newer = await enquire(meena.agent, second.slug);

    const { body, headers } = await owner.agent.get('/v1/dealer/enquiries').expect(200);

    expect(headers['cache-control']).toBe('no-store');
    expect(body.data.map((row: { id: string }) => row.id)).toEqual([newer, older]);
    expect(body.data[1]).toMatchObject({
      status: 'NEW',
      statusLabel: 'New',
      statusTone: 'accent',
      message: 'Is the price negotiable?',
      contactedAt: null,
      closedAt: null,
      customer: {
        name: 'Ravi Kumar',
        initials: 'RK',
        phone: ravi.phone,
        phoneDisplay: `+91 ${ravi.phone.slice(3, 8)} ${ravi.phone.slice(8)}`,
        callHref: `tel:${ravi.phone}`,
      },
      vehicle: {
        id: first.vehicleId,
        title: '2023 Hyundai Creta SX(O)',
        listingStatus: 'ACTIVE',
        href: `/car/${first.slug}`,
      },
    });
    expect(body.data[0].message).toBeNull();
    expect(body.counts).toEqual({ ALL: 2, NEW: 2, CONTACTED: 0, CLOSED: 0, SPAM: 0 });
    expect(body.page).toEqual({ nextCursor: null, hasMore: false });
  });

  /** Nothing is copied at enquiry time, so a corrected name is the name shown. */
  it('shows the customer’s current name, not the one they had when they enquired', async () => {
    const owner = await marketplaceFixtures(h, 'inbox-rename').dealership();
    const { slug } = await car(owner);
    const who = await customer('Karthik');
    await enquire(who.agent, slug);

    await h.prisma.user.update({ where: { id: who.id }, data: { fullName: 'Karthik Raman' } });

    const { body } = await owner.agent.get('/v1/dealer/enquiries').expect(200);
    expect(body.data[0].customer.name).toBe('Karthik Raman');
  });

  it('drops the public link once the car is no longer on the marketplace', async () => {
    const owner = await marketplaceFixtures(h, 'inbox-sold').dealership();
    const { slug, listingId } = await car(owner);
    await enquire((await customer('Divya')).agent, slug);

    await h.prisma.listing.update({ where: { id: listingId }, data: { status: 'SOLD' } });

    const { body } = await owner.agent.get('/v1/dealer/enquiries').expect(200);
    expect(body.data[0].vehicle).toMatchObject({ listingStatus: 'SOLD', href: null });
  });

  it('pages with a cursor, newest first, without repeating a row', async () => {
    const owner = await marketplaceFixtures(h, 'inbox-page').dealership();
    const ids: string[] = [];
    for (let n = 0; n < 3; n += 1) {
      const { slug } = await car(owner);
      ids.unshift(await enquire((await customer(`Page ${String(n)} Buyer`)).agent, slug));
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const first = await owner.agent.get('/v1/dealer/enquiries?limit=2').expect(200);
    expect(first.body.data.map((row: { id: string }) => row.id)).toEqual(ids.slice(0, 2));
    expect(first.body.page.hasMore).toBe(true);

    const second = await owner.agent
      .get(`/v1/dealer/enquiries?limit=2&cursor=${String(first.body.page.nextCursor)}`)
      .expect(200);
    expect(second.body.data.map((row: { id: string }) => row.id)).toEqual(ids.slice(2));
    expect(second.body.page).toEqual({ nextCursor: null, hasMore: false });
  });

  it('filters to one tab without changing the counts', async () => {
    const owner = await marketplaceFixtures(h, 'inbox-tab').dealership();
    const one = await car(owner);
    const two = await car(owner);
    const contacted = await enquire((await customer('Tab One')).agent, one.slug);
    await enquire((await customer('Tab Two')).agent, two.slug);
    await setStatus(owner, contacted, 'CONTACTED').expect(200);

    const { body } = await owner.agent.get('/v1/dealer/enquiries?status=CONTACTED').expect(200);

    expect(body.data.map((row: { id: string }) => row.id)).toEqual([contacted]);
    expect(body.counts).toEqual({ ALL: 2, NEW: 1, CONTACTED: 1, CLOSED: 0, SPAM: 0 });

    const counts = await owner.agent.get('/v1/dealer/enquiries/counts').expect(200);
    expect(counts.body).toEqual(body.counts);
  });

  it.each([
    ['an unknown status', '?status=OPEN'],
    ['a dealerId', `?dealerId=00000000-0000-4000-8000-000000000001`],
    ['a malformed cursor', '?cursor=not-a-cursor'],
  ])('refuses %s in the query', async (_label, query) => {
    const res = await a.agent.get(`/v1/dealer/enquiries${query}`);
    expect([400, 409]).toContain(res.status);
  });
});

describe('one dealership never sees another’s', () => {
  it('lists only its own enquiries, and counts only its own', async () => {
    const mine = await car(a);
    const theirs = await car(b);
    const buyer = await customer('Both Sides');
    const ours = await enquire(buyer.agent, mine.slug);
    const other = await enquire(buyer.agent, theirs.slug);

    const inboxA = await a.agent.get('/v1/dealer/enquiries?limit=100').expect(200);
    const inboxB = await b.agent.get('/v1/dealer/enquiries?limit=100').expect(200);
    const idsA = inboxA.body.data.map((row: { id: string }) => row.id);
    const idsB = inboxB.body.data.map((row: { id: string }) => row.id);

    expect(idsA).toContain(ours);
    expect(idsA).not.toContain(other);
    expect(idsB).toContain(other);
    expect(idsB).not.toContain(ours);
    expect(inboxA.body.counts.ALL).toBe(idsA.length);
  });

  /** A 404, not a 403: another dealership's id cannot be probed for existence. */
  it('answers 404 for another dealership’s enquiry, and leaves it untouched', async () => {
    const theirs = await car(b);
    const id = await enquire((await customer('Not Yours')).agent, theirs.slug);

    const res = await setStatus(a, id, 'SPAM').expect(404);

    expect(res.body.code).toBe('ENQUIRY_NOT_FOUND');
    const row = await h.prisma.enquiry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('NEW');
    expect((await auditRows(id)).map((entry) => entry.action)).toEqual(['enquiry.created']);
  });

  it('answers the same 404 for an id that was never an enquiry', async () => {
    const res = await setStatus(a, '00000000-0000-4000-8000-00000000abcd', 'CLOSED').expect(404);
    expect(res.body.code).toBe('ENQUIRY_NOT_FOUND');
  });
});

describe('moving an enquiry between tabs', () => {
  it('marks it contacted, stamps when, and audits it against the dealership', async () => {
    const { slug } = await car(a);
    const id = await enquire((await customer('Contact Me')).agent, slug);

    const { body } = await setStatus(a, id, 'CONTACTED').expect(200);

    expect(body).toMatchObject({ id, status: 'CONTACTED', statusTone: 'ok', closedAt: null });
    expect(body.contactedAt).toEqual(expect.any(String));
    const entry = (await auditRows(id)).at(-1);
    expect(entry).toMatchObject({
      action: 'enquiry.contacted',
      actorType: 'DEALER',
      actorId: a.userId,
      dealerId: a.dealerId,
      before: { status: 'NEW' },
      after: { status: 'CONTACTED' },
    });
  });

  it('closes it, and reopening clears the close but keeps the first contact', async () => {
    const { slug } = await car(a);
    const id = await enquire((await customer('Close Me')).agent, slug);

    const contacted = await setStatus(a, id, 'CONTACTED').expect(200);
    const closed = await setStatus(a, id, 'CLOSED').expect(200);
    expect(closed.body.closedAt).toEqual(expect.any(String));
    expect(closed.body.contactedAt).toBe(contacted.body.contactedAt);

    const reopened = await setStatus(a, id, 'NEW').expect(200);
    expect(reopened.body).toMatchObject({
      status: 'NEW',
      closedAt: null,
      contactedAt: contacted.body.contactedAt,
    });

    expect((await auditRows(id)).map((entry) => entry.action)).toEqual([
      'enquiry.created',
      'enquiry.contacted',
      'enquiry.closed',
      'enquiry.reopened',
    ]);
  });

  it('marks it as spam', async () => {
    const { slug } = await car(a);
    const id = await enquire((await customer('Spam Sender')).agent, slug);

    const { body } = await setStatus(a, id, 'SPAM').expect(200);

    expect(body).toMatchObject({ status: 'SPAM', statusLabel: 'Spam', statusTone: 'err' });
    expect((await auditRows(id)).at(-1)?.action).toBe('enquiry.spam');
  });

  it('changes nothing and records nothing when the status is the one it has', async () => {
    const { slug } = await car(a);
    const id = await enquire((await customer('Same Again')).agent, slug);
    await setStatus(a, id, 'CONTACTED').expect(200);
    const before = await h.prisma.enquiry.findUniqueOrThrow({ where: { id } });

    await setStatus(a, id, 'CONTACTED').expect(200);

    const after = await h.prisma.enquiry.findUniqueOrThrow({ where: { id } });
    expect(after.contactedAt).toEqual(before.contactedAt);
    expect(await auditRows(id)).toHaveLength(2);
  });

  /** Two people on one dealership press at once: one audit row per real change. */
  it('serialises two simultaneous changes to one enquiry', async () => {
    const { slug } = await car(a);
    const id = await enquire((await customer('Two Hands')).agent, slug);

    const results = await Promise.all([
      setStatus(a, id, 'CONTACTED'),
      setStatus(a, id, 'CONTACTED'),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    expect((await auditRows(id)).map((entry) => entry.action)).toEqual([
      'enquiry.created',
      'enquiry.contacted',
    ]);
  });

  it.each(['message', 'customerName', 'customerPhone', 'dealerId', 'listingId'])(
    'refuses %s in the body, by name — only the status moves',
    async (field) => {
      const { slug } = await car(a);
      const id = await enquire((await customer('Strict Body')).agent, slug);

      const res = await a.agent
        .patch(`/v1/dealer/enquiries/${id}`)
        .send({ status: 'CONTACTED', [field]: 'x' })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain(field);
      expect((await h.prisma.enquiry.findUniqueOrThrow({ where: { id } })).status).toBe('NEW');
    },
  );

  it.each([
    ['an unknown status', { status: 'DONE' }],
    ['no status', {}],
  ])('refuses %s', async (_label, body) => {
    const { slug } = await car(a);
    const id = await enquire((await customer('Bad Status')).agent, slug);
    await a.agent.patch(`/v1/dealer/enquiries/${id}`).send(body).expect(400);
  });

  it('refuses an id that is not a uuid', async () => {
    await setStatus(a, 'not-an-id', 'CLOSED').expect(400);
  });
});
