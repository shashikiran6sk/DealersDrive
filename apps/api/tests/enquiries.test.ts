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
 * one; and the same customer cannot flood the same car.
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

describe('floods are refused, follow-ups are not', () => {
  it('refuses a second enquiry about the same car within a day', async () => {
    const { agent } = await customer();
    const { slug, listing: row } = await listing();

    await enquire(agent, { listingSlug: slug }).expect(201);
    const again = await enquire(agent, { listingSlug: slug, message: 'Hello?' }).expect(409);

    expect(again.body.code).toBe('ENQUIRY_ALREADY_SUBMITTED_RECENTLY');
    expect(await h.prisma.enquiry.count({ where: { listingId: row.id } })).toBe(1);
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

  it('allows a follow-up once the day has passed', async () => {
    const { agent, id } = await customer();
    const { slug, listing: row } = await listing();

    await enquire(agent, { listingSlug: slug }).expect(201);
    await h.prisma.enquiry.updateMany({
      where: { customerId: id, listingId: row.id },
      data: { createdAt: new Date(Date.now() - 25 * 3_600_000) },
    });

    await enquire(agent, { listingSlug: slug }).expect(201);
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
