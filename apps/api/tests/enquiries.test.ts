import type { ListingStatus } from '@prisma/client';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * R64 — enquiries come from signed-in customers.
 *
 * Every property worth pinning is about who an enquiry is from and who it
 * reaches, so the suite signs real customers in through the phone flow and
 * posts through the real guard. The customer never says who they are; the
 * dealership is the listing's; only a car on the marketplace right now takes
 * one; and the same customer has one open enquiry per car at a time (R68).
 */
let h: AuthHarness;
let counter = 0;
let tokens = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

function freeNumber(): string {
  counter += 1;
  return `98466${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string): string {
  tokens += 1;
  return `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:enquiry-${String(tokens)}`;
}

async function customer(fullName = 'Rahul') {
  const agent = h.agent();
  const phone = freeNumber();
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: devToken(phone) })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, phone: `+91${phone}`, id: created.body.customer.id as string };
}

/** A dealership and one car on it, in whatever state the test needs. */
async function listing(
  status: ListingStatus = 'ACTIVE',
  dealerStatus: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE',
) {
  counter += 1;
  const stamp = `${String(counter)}-${Date.now().toString(36)}`;
  const dealer = await h.prisma.dealer.create({
    data: {
      slug: `enquiry-dealer-${stamp}`,
      brandName: `Enquiry Motors ${stamp}`,
      legalName: `Enquiry Motors ${stamp}`,
      city: 'Katpadi',
      status: dealerStatus,
    },
  });
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: dealer.id,
      registrationNumber: `TN23EQ${String(1000 + counter)}`,
      rtoCode: 'TN23',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      manufacturingYear: 2023,
    },
  });
  const row = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: dealer.id,
      status,
      slug: `2023-hyundai-creta-${stamp}`,
      publishedAt: new Date(),
    },
  });
  return { dealer, vehicle, listing: row, slug: row.slug ?? '' };
}

function enquire(agent: request.Agent, body: Record<string, unknown>) {
  return agent.post('/v1/enquiries').send(body);
}

describe('who may enquire', () => {
  it('refuses nobody-in-particular', async () => {
    const { slug } = await listing();
    await enquire(h.agent(), { listingSlug: slug }).expect(401);
  });

  it('takes an enquiry from a signed-in customer', async () => {
    const { agent } = await customer();
    const { slug, dealer } = await listing();

    const res = await enquire(agent, {
      listingSlug: slug,
      message: 'Can I visit tomorrow?',
    }).expect(201);

    expect(res.body).toMatchObject({
      status: 'NEW',
      dealerName: dealer.brandName,
      vehicleTitle: '2023 Hyundai Creta SX(O)',
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  /** A dealer's own session enquires as the customer that dealer also is (R62). */
  it('takes one from a dealer browsing someone else’s car, as the same person', async () => {
    h.google.claims = {
      subject: `enquiry-dealer-${String(counter)}`,
      email: `enquiry.dealer${String(counter)}@example.com`,
      emailVerified: true,
      name: 'Karthik Raman',
    };
    const dealerAgent = h.agent();
    await h.signIn(dealerAgent);
    const phone = freeNumber();
    await h.proveNumber(dealerAgent, phone);
    const { slug } = await listing();

    await enquire(dealerAgent, { listingSlug: slug }).expect(201);

    const user = await h.prisma.user.findUniqueOrThrow({ where: { phone: `+91${phone}` } });
    expect(await h.prisma.enquiry.count({ where: { customerId: user.id } })).toBe(1);
  });
});

describe('what an enquiry carries', () => {
  it('derives the customer from the session and the dealership from the listing', async () => {
    const { agent, id } = await customer('Rahul');
    const { slug, dealer, listing: row } = await listing();

    const res = await enquire(agent, {
      listingSlug: slug,
      message: 'Is the price negotiable?',
    }).expect(201);

    const stored = await h.prisma.enquiry.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored).toMatchObject({
      customerId: id,
      dealerId: dealer.id,
      listingId: row.id,
      message: 'Is the price negotiable?',
      status: 'NEW',
    });
  });

  it.each([
    ['no message at all', {}],
    ['an empty message', { message: '' }],
    ['a whitespace-only message', { message: '   \n ' }],
  ])('accepts %s, and stores none', async (_label, extra) => {
    const { agent } = await customer();
    const { slug } = await listing();

    const res = await enquire(agent, { listingSlug: slug, ...extra }).expect(201);

    const stored = await h.prisma.enquiry.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.message).toBeNull();
  });

  /** None of these can be believed from a client, and none of them is asked for. */
  it.each(['customerPhone', 'customerName', 'dealerId', 'customerId', 'phone', 'name', 'status'])(
    'refuses %s in the body, by name',
    async (field) => {
      const { agent } = await customer();
      const { slug } = await listing();

      const res = await enquire(agent, { listingSlug: slug, [field]: 'x' }).expect(400);
      expect(JSON.stringify(res.body)).toContain(field);
    },
  );

  it('refuses a message past its limit', async () => {
    const { agent } = await customer();
    const { slug } = await listing();
    await enquire(agent, { listingSlug: slug, message: 'x'.repeat(1001) }).expect(400);
  });

  it('records the enquiry in the audit log, against the dealership', async () => {
    const { agent, id } = await customer();
    const { slug, dealer } = await listing();

    const res = await enquire(agent, { listingSlug: slug }).expect(201);

    const row = await h.prisma.auditLog.findFirstOrThrow({
      where: { entityId: res.body.id, action: 'enquiry.created' },
    });
    expect(row).toMatchObject({ actorType: 'CUSTOMER', actorId: id, dealerId: dealer.id });
  });
});

describe('only a car on the marketplace right now', () => {
  it.each(['SOLD', 'REMOVED', 'REJECTED', 'PENDING_REVIEW', 'DRAFT', 'CHANGES_REQUESTED'] as const)(
    'refuses a %s listing',
    async (status) => {
      const { agent } = await customer();
      const { slug } = await listing(status);

      const res = await enquire(agent, { listingSlug: slug }).expect(409);
      expect(res.body.code).toBe('LISTING_NOT_AVAILABLE');
    },
  );

  it('refuses a live listing on a suspended dealership', async () => {
    const { agent } = await customer();
    const { slug } = await listing('ACTIVE', 'SUSPENDED');

    const res = await enquire(agent, { listingSlug: slug }).expect(409);
    expect(res.body.code).toBe('LISTING_NOT_AVAILABLE');
  });

  /** The page was open when the car sold; the press arrives after. */
  it('refuses a car that sold between opening its page and pressing Send', async () => {
    const { agent } = await customer();
    const { slug, listing: row } = await listing();

    await h.prisma.listing.update({ where: { id: row.id }, data: { status: 'SOLD' } });

    const res = await enquire(agent, { listingSlug: slug }).expect(409);
    expect(res.body.code).toBe('LISTING_NOT_AVAILABLE');
    expect(await h.prisma.enquiry.count({ where: { listingId: row.id } })).toBe(0);
  });

  it('answers 404 for a slug that was never a listing', async () => {
    const { agent } = await customer();
    const res = await enquire(agent, { listingSlug: 'no-such-car' }).expect(404);
    expect(res.body.code).toBe('LISTING_NOT_FOUND');
  });

  it('refuses a dealer enquiring about their own dealership’s car', async () => {
    h.google.claims = {
      subject: `enquiry-own-${String(counter)}`,
      email: `enquiry.own${String(counter)}@example.com`,
      emailVerified: true,
      name: 'Own Dealer',
    };
    const agent = h.agent();
    await h.signIn(agent);
    const phone = freeNumber();
    await h.proveNumber(agent, phone);
    const user = await h.prisma.user.findUniqueOrThrow({ where: { phone: `+91${phone}` } });
    const { slug, dealer } = await listing();
    await h.prisma.dealerMember.create({
      data: { dealerId: dealer.id, userId: user.id, role: 'OWNER', permissions: [] },
    });

    const res = await enquire(agent, { listingSlug: slug });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ENQUIRY_OWN_LISTING');
  });
});

describe('one open enquiry per car (R68)', () => {
  async function closeAs(id: string, status: 'CONTACTED' | 'CLOSED' | 'SPAM') {
    await h.prisma.enquiry.update({ where: { id }, data: { status } });
  }

  it('refuses a second enquiry about the same car while the first is open', async () => {
    const { agent } = await customer();
    const { slug, listing: row } = await listing();

    await enquire(agent, { listingSlug: slug }).expect(201);
    const again = await enquire(agent, { listingSlug: slug, message: 'Hello?' }).expect(409);

    expect(again.body.code).toBe('ENQUIRY_ALREADY_OPEN');
    expect(await h.prisma.enquiry.count({ where: { listingId: row.id } })).toBe(1);
  });

  /** The old 24-hour window is gone: time alone does not reopen the door. */
  it('still refuses it days later, while the dealership has not closed it', async () => {
    const { agent, id } = await customer();
    const { slug, listing: row } = await listing();

    await enquire(agent, { listingSlug: slug }).expect(201);
    await h.prisma.enquiry.updateMany({
      where: { customerId: id, listingId: row.id },
      data: { createdAt: new Date(Date.now() - 5 * 86_400_000) },
    });

    const again = await enquire(agent, { listingSlug: slug }).expect(409);
    expect(again.body.code).toBe('ENQUIRY_ALREADY_OPEN');
  });

  it('refuses it while the dealership has marked the first contacted', async () => {
    const { agent } = await customer();
    const { slug } = await listing();
    const first = await enquire(agent, { listingSlug: slug }).expect(201);
    await closeAs(first.body.id, 'CONTACTED');

    const again = await enquire(agent, { listingSlug: slug }).expect(409);
    expect(again.body.code).toBe('ENQUIRY_ALREADY_OPEN');
  });

  it('allows a new enquiry once the dealership has closed the first', async () => {
    const { agent } = await customer();
    const { slug, listing: row } = await listing();
    const first = await enquire(agent, { listingSlug: slug }).expect(201);
    await closeAs(first.body.id, 'CLOSED');

    await enquire(agent, { listingSlug: slug, message: 'Still interested' }).expect(201);
    expect(await h.prisma.enquiry.count({ where: { listingId: row.id } })).toBe(2);
  });

  /** Spam reads as closed to the customer, but it does not let them straight back in. */
  it('keeps refusing after the first was marked as spam', async () => {
    const { agent } = await customer();
    const { slug } = await listing();
    const first = await enquire(agent, { listingSlug: slug }).expect(201);
    await closeAs(first.body.id, 'SPAM');

    const again = await enquire(agent, { listingSlug: slug }).expect(409);
    expect(again.body.code).toBe('ENQUIRY_ALREADY_OPEN');
  });

  /** Five presses at once — a double-tap on a slow phone — land exactly one. */
  it('lets only one of five simultaneous enquiries through', async () => {
    const { agent } = await customer();
    const { slug, listing: row } = await listing();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => enquire(agent, { listingSlug: slug })),
    );

    expect(results.filter((res) => res.status === 201)).toHaveLength(1);
    expect(results.filter((res) => res.status === 409)).toHaveLength(4);
    expect(await h.prisma.enquiry.count({ where: { listingId: row.id } })).toBe(1);
  });

  it('does not stop the same customer asking about a different car', async () => {
    const { agent } = await customer();
    const first = await listing();
    const second = await listing();

    await enquire(agent, { listingSlug: first.slug }).expect(201);
    await enquire(agent, { listingSlug: second.slug }).expect(201);
  });

  it('does not stop a different customer asking about the same car', async () => {
    const { slug, listing: row } = await listing();

    await enquire((await customer('Asha')).agent, { listingSlug: slug }).expect(201);
    await enquire((await customer('Bala')).agent, { listingSlug: slug }).expect(201);
    expect(await h.prisma.enquiry.count({ where: { listingId: row.id } })).toBe(2);
  });
});

describe('a customer’s own enquiries (R68)', () => {
  it('refuses nobody-in-particular', async () => {
    await h.agent().get('/v1/enquiries').expect(401);
  });

  it('lists only their own, newest first, with the dealership and the car', async () => {
    const me = await customer('Meena');
    const someoneElse = await customer('Other');
    const first = await listing();
    const second = await listing();
    const older = await enquire(me.agent, { listingSlug: first.slug, message: 'Price?' }).expect(
      201,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await enquire(me.agent, { listingSlug: second.slug }).expect(201);
    await enquire(someoneElse.agent, { listingSlug: first.slug }).expect(201);

    const res = await me.agent.get('/v1/enquiries').expect(200);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.map((row: { id: string }) => row.id)).toEqual([
      newer.body.id,
      older.body.id,
    ]);
    expect(res.body.data[1]).toMatchObject({
      status: 'SENT',
      statusLabel: 'Sent',
      message: 'Price?',
      dealerName: first.dealer.brandName,
      vehicle: { title: '2023 Hyundai Creta SX(O)', href: `/car/${first.slug}` },
    });
    expect(res.body.page).toEqual({ nextCursor: null, hasMore: false });
  });

  it.each([
    ['NEW', 'SENT'],
    ['CONTACTED', 'CONTACTED'],
    ['CLOSED', 'CLOSED'],
    ['SPAM', 'CLOSED'],
  ] as const)('shows a %s enquiry as %s, and never says spam', async (status, shown) => {
    const { agent } = await customer();
    const { slug } = await listing();
    const sent = await enquire(agent, { listingSlug: slug }).expect(201);
    await h.prisma.enquiry.update({ where: { id: sent.body.id }, data: { status } });

    const res = await agent.get('/v1/enquiries').expect(200);

    expect(res.body.data[0].status).toBe(shown);
    expect(JSON.stringify(res.body)).not.toMatch(/spam/i);
  });

  it('drops the link once the car is off the marketplace', async () => {
    const { agent } = await customer();
    const { slug, listing: row } = await listing();
    await enquire(agent, { listingSlug: slug }).expect(201);
    await h.prisma.listing.update({ where: { id: row.id }, data: { status: 'SOLD' } });

    const res = await agent.get('/v1/enquiries').expect(200);
    expect(res.body.data[0].vehicle.href).toBeNull();
  });

  it('pages with a cursor', async () => {
    const { agent } = await customer();
    for (let n = 0; n < 3; n += 1) {
      await enquire(agent, { listingSlug: (await listing()).slug }).expect(201);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const first = await agent.get('/v1/enquiries?limit=2').expect(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.page.hasMore).toBe(true);

    const second = await agent
      .get(`/v1/enquiries?limit=2&cursor=${String(first.body.page.nextCursor)}`)
      .expect(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.page.hasMore).toBe(false);
  });

  it.each(['customerId', 'status', 'dealerId'])('refuses %s in the query', async (field) => {
    const { agent } = await customer();
    await agent.get(`/v1/enquiries?${field}=x`).expect(400);
  });

  /** A dealer's session is the customer that dealer also is (R62), and sees only their own. */
  it('lists a dealer’s own enquiries as a customer, and none of their inbox', async () => {
    h.google.claims = {
      subject: `enquiry-mine-${String(counter)}`,
      email: `enquiry.mine${String(counter)}@example.com`,
      emailVerified: true,
      name: 'Karthik Raman',
    };
    const dealerAgent = h.agent();
    await h.signIn(dealerAgent);
    await h.proveNumber(dealerAgent, freeNumber());
    const { slug } = await listing();
    await enquire(dealerAgent, { listingSlug: slug }).expect(201);

    const res = await dealerAgent.get('/v1/enquiries').expect(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('the customer’s number stays private', () => {
  /** The public vehicle page is unchanged: no enquiry, no customer, no phone. */
  it('never appears on the public vehicle page', async () => {
    const { agent, phone } = await customer();
    const { slug } = await listing();
    await enquire(agent, { listingSlug: slug }).expect(201);

    const page = await h.agent().get(`/v1/vehicles/${slug}`);
    expect(JSON.stringify(page.body)).not.toContain(phone.slice(3));
  });
});
