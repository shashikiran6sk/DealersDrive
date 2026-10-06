import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { mergeAccounts, mergeRefusal } from '../src/modules/auth/account-merge.js';
import { createAuditService } from '../src/platform/audit/audit.service.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * One person, whichever door they came in by.
 *
 * A customer proves their phone on the Customer tab. Later the same person
 * opens the Dealer tab and signs in with Google, which makes a Google-only
 * account; step 1 then asks for a phone, and they type the one they already
 * use. That used to be refused. With proof of both identities in the same
 * request — the Google session and a fresh OTP — the Google-only account is
 * folded into the phone holder, keeping every saved car and enquiry.
 *
 * The other direction (phone session, then the Google link round trip) folds
 * the same way. What never happens is a merge on a typed number alone.
 */
let h: AuthHarness;
let counter = 0;
let tokens = 0;
let listingId: string;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const dealer = await h.prisma.dealer.findFirstOrThrow({ select: { id: true } });
  const vehicle = await h.prisma.vehicle.create({
    data: { dealerId: dealer.id, registrationNumber: `TN23AL${String(Date.now()).slice(-4)}` },
  });
  const listing = await h.prisma.listing.create({
    data: { vehicleId: vehicle.id, dealerId: dealer.id, status: 'ACTIVE', publishedAt: new Date() },
  });
  listingId = listing.id;
});

afterAll(async () => {
  await h.close();
});

function freeNumber(): string {
  counter += 1;
  return `96611${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string, code: string = env.PHONE_OTP_DEV_CODE): string {
  tokens += 1;
  return `dev-otp:91${phone.slice(-10)}:${code}:linking-${String(tokens)}`;
}

function freshGoogle(): void {
  counter += 1;
  h.google.claims = {
    subject: `linking-sub-${String(counter)}`,
    email: `linking${String(counter)}@example.com`,
    emailVerified: true,
    name: 'Google Name',
  };
}

function sessionCookie(res: request.Response): string | undefined {
  return [res.headers['set-cookie']]
    .flat()
    .find((cookie) => cookie?.startsWith('dd_session='))
    ?.split(';')[0];
}

async function newCustomer(fullName = 'Priya Customer') {
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
  return { agent, phone, userId: created.body.customer.id as string };
}

async function googleFirstDealer() {
  freshGoogle();
  const agent = h.agent();
  const started = await agent.get('/v1/auth/google/start').expect(302);
  const state = new URL(started.headers.location as string).searchParams.get('state') ?? '';
  const callback = await agent.get(`/v1/auth/google/callback?code=auth-code&state=${state}`);
  const cookie = sessionCookie(callback) ?? '';
  const identity = await h.prisma.oAuthIdentity.findUniqueOrThrow({
    where: {
      provider_providerSubject: { provider: 'GOOGLE', providerSubject: h.google.claims.subject },
    },
  });
  return { agent, cookie, userId: identity.userId, email: h.google.claims.email };
}

describe('the customer → Google dealer bug', () => {
  it('links a customer phone to a new Google dealer identity after the OTP', async () => {
    const customer = await newCustomer();
    await h.prisma.savedVehicle.create({ data: { customerId: customer.userId, listingId } });
    await h.prisma.enquiry.create({
      data: { customerId: customer.userId, dealerId: await dealerOf(listingId), listingId },
    });

    const dealer = await googleFirstDealer();
    const oldCookie = dealer.cookie;

    await dealer.agent
      .post('/v1/auth/phone/availability')
      .send({ phone: customer.phone })
      .expect(204);

    const verified = await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(200);

    expect(verified.body).toMatchObject({ phone: `+91${customer.phone}`, accountsLinked: true });
    expect(sessionCookie(verified)).toBeDefined();

    const survivor = await h.prisma.user.findUniqueOrThrow({
      where: { id: customer.userId },
      include: { identities: true, roles: true, savedVehicles: true, enquiries: true },
    });
    expect(survivor.email).toBe(dealer.email);
    expect(survivor.fullName).toBe('Priya Customer');
    expect(survivor.identities.map((identity) => identity.provider)).toEqual(['GOOGLE']);
    expect(survivor.roles.map((seat) => seat.role).sort()).toEqual(['CUSTOMER', 'DEALER']);
    expect(survivor.savedVehicles).toHaveLength(1);
    expect(survivor.enquiries).toHaveLength(1);

    const absorbed = await h.prisma.user.findUniqueOrThrow({ where: { id: dealer.userId } });
    expect(absorbed).toMatchObject({
      status: 'DELETED',
      mergedIntoId: customer.userId,
      email: null,
    });

    const me = await dealer.agent.get('/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({
      next: 'ONBOARDING',
      user: { id: customer.userId, phoneVerified: true },
      identity: { email: dealer.email },
    });

    await h.agent().get('/v1/auth/me').set('Cookie', oldCookie).expect(401);

    const customerMe = await customer.agent.get('/v1/auth/customer/me').expect(200);
    expect(customerMe.body.customer.id).toBe(customer.userId);

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'auth.identity.merged', entityId: customer.userId },
    });
    expect(audit.before).toEqual({ absorbedUserId: dealer.userId });
    expect(audit.after).toMatchObject({
      proof: 'PHONE_OTP',
      savedVehiclesMoved: 0,
      enquiriesMoved: 0,
      emailMoved: true,
    });
    expect(JSON.stringify(audit)).not.toContain(env.PHONE_OTP_DEV_CODE);
  });

  it('lets the linked person create their dealership and keep shopping as a customer', async () => {
    const customer = await newCustomer('Arun');
    const dealer = await googleFirstDealer();
    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(200);

    const created = await dealer.agent
      .post('/v1/auth/onboarding')
      .send({
        fullName: 'Arun Kumar',
        phone: customer.phone,
        legalName: `Linked Motors ${String(counter)}`,
        addressLine: '1, Main Road',
        city: 'Arcot',
        district: 'Ranipet',
        state: 'Tamil Nadu',
        pincode: '632503',
        mapsUrl: 'https://maps.app.goo.gl/linked',
        tagline: 'Cars for a linked account.',
        specialities: ['SUVs'],
      })
      .expect(201);

    const owner = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: created.body.dealer.id },
    });
    expect(owner).toMatchObject({ userId: customer.userId, role: 'OWNER' });

    const saved = await dealer.agent.get('/v1/saved-vehicles/slugs').expect(200);
    expect(saved.body).toBeDefined();
  });

  it('keeps a dealership the phone holder already belongs to', async () => {
    const customer = await newCustomer('Staff Person');
    const dealerId = await dealerOf(listingId);
    await h.prisma.dealerMember.create({
      data: { dealerId, userId: customer.userId, role: 'STAFF', permissions: [] },
    });

    const dealer = await googleFirstDealer();
    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(200);

    const membership = await h.prisma.dealerMember.findUniqueOrThrow({
      where: { dealerId_userId: { dealerId, userId: customer.userId } },
    });
    expect(membership).toMatchObject({ role: 'STAFF', status: 'ACTIVE' });
    const me = await dealer.agent.get('/v1/auth/me').expect(200);
    expect(me.body.dealer.id).toBe(dealerId);
  });
});

describe('what never merges', () => {
  it('does not link on a typed number: a wrong code changes nothing', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();

    const refused = await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone, '000000') })
      .expect(422);
    expect(refused.body.code).toBe('PHONE_VERIFICATION_FAILED');

    await expectUntouched(customer.userId, dealer.userId);
  });

  it('does not link on a token the provider refuses as expired or forged', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();

    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: 'expired-provider-token' })
      .expect(422);

    await expectUntouched(customer.userId, dealer.userId);
  });

  it('does not link on a replayed token', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    const token = devToken(customer.phone);
    await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({ phone: customer.phone, accessToken: token })
      .expect(200);

    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: token })
      .expect(422);

    await expectUntouched(customer.userId, dealer.userId);
  });

  it('does not link a token proving a different handset', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();

    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(freeNumber()) })
      .expect(422);

    await expectUntouched(customer.userId, dealer.userId);
  });

  it('refuses a phone whose account already has its own Google identity', async () => {
    const first = await googleFirstDealer();
    const phone = freeNumber();
    await first.agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);

    const second = await googleFirstDealer();
    await second.agent.post('/v1/auth/phone/availability').send({ phone }).expect(409);
    const refused = await second.agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(409);

    expect(refused.body.code).toBe('PHONE_ALREADY_REGISTERED');
    expect(JSON.stringify(refused.body)).not.toContain(first.email);
    await expectUntouched(first.userId, second.userId);
  });

  it('refuses when the Google account already holds a different phone', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    const own = freeNumber();
    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: own, accessToken: devToken(own) })
      .expect(200);

    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(409);

    await expectUntouched(customer.userId, dealer.userId);
  });

  it('refuses to fold an operator account into a customer', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    await h.prisma.user.update({
      where: { id: dealer.userId },
      data: { isPlatformAdmin: true, adminRole: 'SUPPORT' },
    });

    await dealer.agent
      .post('/v1/auth/phone/availability')
      .send({ phone: customer.phone })
      .expect(409);
    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(409);

    await expectUntouched(customer.userId, dealer.userId);
  });
});

describe('races and repeats', () => {
  it('two verifications at once make one account, not two', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    const cookie = dealer.cookie;

    const [a, b] = await Promise.all(
      [0, 1].map(() =>
        h
          .agent()
          .post('/v1/auth/phone/verify')
          .set('Cookie', cookie)
          .send({ phone: customer.phone, accessToken: devToken(customer.phone) }),
      ),
    );

    const statuses = [a?.status, b?.status];
    expect(statuses).toContain(200);
    for (const status of statuses) expect([200, 401]).toContain(status);

    const identities = await h.prisma.oAuthIdentity.findMany({
      where: { providerSubject: h.google.claims.subject },
    });
    expect(identities).toHaveLength(1);
    expect(identities[0]?.userId).toBe(customer.userId);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.identity.merged', entityId: customer.userId },
      }),
    ).toBe(1);
  });

  it('an already-linked account re-proving its number is a plain verification', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(200);

    const again = await dealer.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(200);
    expect(again.body.accountsLinked).toBe(false);
    expect(sessionCookie(again)).toBeUndefined();
  });

  it('merging the same pair twice is a no-op the second time', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    const audit = createAuditService(h.prisma);
    const request = {
      survivorId: customer.userId,
      absorbedId: dealer.userId,
      proof: 'PHONE_OTP' as const,
    };

    const first = await h.prisma.$transaction((tx) => mergeAccounts(tx, audit, request));
    const second = await h.prisma.$transaction((tx) => mergeAccounts(tx, audit, request));
    const self = await h.prisma.$transaction((tx) =>
      mergeAccounts(tx, audit, { ...request, absorbedId: customer.userId }),
    );

    expect(first.merged).toBe(true);
    expect(second.merged).toBe(false);
    expect(self.merged).toBe(false);
  });

  it('an account already folded into someone else cannot be folded again', async () => {
    const one = await newCustomer();
    const two = await newCustomer();
    const dealer = await googleFirstDealer();
    const audit = createAuditService(h.prisma);
    await h.prisma.$transaction((tx) =>
      mergeAccounts(tx, audit, {
        survivorId: one.userId,
        absorbedId: dealer.userId,
        proof: 'PHONE_OTP',
      }),
    );

    await expect(
      h.prisma.$transaction((tx) =>
        mergeAccounts(tx, audit, {
          survivorId: two.userId,
          absorbedId: dealer.userId,
          proof: 'PHONE_OTP',
        }),
      ),
    ).rejects.toMatchObject({ code: 'IDENTITY_ALREADY_LINKED' });
  });
});

describe('the other direction: phone first, then Google', () => {
  it('folds an abandoned Google-only dealer account into the phone session on link', async () => {
    const customer = await newCustomer('Phone First');
    const google = await googleFirstDealer();
    const claims = h.google.claims;

    const phoneSession = h.agent();
    await phoneSession
      .post('/v1/auth/sign-in/phone/dealer')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(200);

    h.google.claims = claims;
    const started = await phoneSession.get('/v1/auth/google/link/start').expect(302);
    const state = new URL(started.headers.location as string).searchParams.get('state') ?? '';
    const callback = await phoneSession.get(
      `/v1/auth/google/callback?code=auth-code&state=${state}`,
    );
    expect(String(callback.headers.location)).not.toContain('error=');

    const identity = await h.prisma.oAuthIdentity.findUniqueOrThrow({
      where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject } },
    });
    expect(identity.userId).toBe(customer.userId);
    await expect(
      h.prisma.user.findUniqueOrThrow({ where: { id: google.userId } }),
    ).resolves.toMatchObject({ status: 'DELETED', mergedIntoId: customer.userId });

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'auth.identity.merged', entityId: customer.userId },
    });
    expect(audit.after).toMatchObject({ proof: 'GOOGLE_OAUTH' });

    await phoneSession.get('/v1/auth/me').expect(200);
    await google.agent.get('/v1/auth/me').expect(401);
  });

  it('still refuses a Google account that belongs to a complete account', async () => {
    const owner = await googleFirstDealer();
    const claims = h.google.claims;
    const ownPhone = freeNumber();
    await owner.agent
      .post('/v1/auth/phone/verify')
      .send({ phone: ownPhone, accessToken: devToken(ownPhone) })
      .expect(200);

    const customer = await newCustomer();
    const phoneSession = h.agent();
    await phoneSession
      .post('/v1/auth/sign-in/phone/dealer')
      .send({ phone: customer.phone, accessToken: devToken(customer.phone) })
      .expect(200);

    h.google.claims = claims;
    const started = await phoneSession.get('/v1/auth/google/link/start').expect(302);
    const state = new URL(started.headers.location as string).searchParams.get('state') ?? '';
    const callback = await phoneSession.get(
      `/v1/auth/google/callback?code=auth-code&state=${state}`,
    );
    expect(String(callback.headers.location)).toContain('error=identity_already_linked');

    await expectUntouched(customer.userId, owner.userId);
  });
});

describe('what a merge carries across', () => {
  it('keeps the stricter seat and the survivor’s saved cars without duplicates', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    await h.prisma.savedVehicle.create({ data: { customerId: customer.userId, listingId } });
    await h.prisma.savedVehicle.create({ data: { customerId: dealer.userId, listingId } });
    await h.prisma.userRole.update({
      where: { userId_role: { userId: dealer.userId, role: 'DEALER' } },
      data: { status: 'SUSPENDED', reason: 'Closed by support' },
    });
    await h.prisma.userRole.create({
      data: { userId: dealer.userId, role: 'CUSTOMER', status: 'ACTIVE' },
    });
    const audit = createAuditService(h.prisma);

    await h.prisma.$transaction((tx) =>
      mergeAccounts(tx, audit, {
        survivorId: customer.userId,
        absorbedId: dealer.userId,
        proof: 'PHONE_OTP',
      }),
    );

    const seats = await h.prisma.userRole.findMany({
      where: { userId: customer.userId },
      orderBy: { role: 'asc' },
    });
    expect(seats.map((seat) => [seat.role, seat.status])).toEqual([
      ['DEALER', 'SUSPENDED'],
      ['CUSTOMER', 'ACTIVE'],
    ]);
    expect(await h.prisma.savedVehicle.count({ where: { customerId: customer.userId } })).toBe(1);
    expect(await h.prisma.savedVehicle.count({ where: { customerId: dealer.userId } })).toBe(0);
  });

  it('carries a suspension onto a seat the survivor already holds', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    await h.prisma.userRole.create({
      data: { userId: dealer.userId, role: 'CUSTOMER', status: 'SUSPENDED', reason: 'Abuse' },
    });
    const audit = createAuditService(h.prisma);

    await h.prisma.$transaction((tx) =>
      mergeAccounts(tx, audit, {
        survivorId: customer.userId,
        absorbedId: dealer.userId,
        proof: 'PHONE_OTP',
      }),
    );

    await expect(
      h.prisma.userRole.findUniqueOrThrow({
        where: { userId_role: { userId: customer.userId, role: 'CUSTOMER' } },
      }),
    ).resolves.toMatchObject({ status: 'SUSPENDED', reason: 'Abuse' });
  });

  it('moves memberships, and refuses when both accounts sit in one dealership', async () => {
    const dealerId = await dealerOf(listingId);
    const audit = createAuditService(h.prisma);

    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    await h.prisma.dealerMember.create({
      data: { dealerId, userId: dealer.userId, role: 'STAFF', permissions: [] },
    });
    await h.prisma.$transaction((tx) =>
      mergeAccounts(tx, audit, {
        survivorId: customer.userId,
        absorbedId: dealer.userId,
        proof: 'PHONE_OTP',
      }),
    );
    await expect(
      h.prisma.dealerMember.count({ where: { dealerId, userId: customer.userId } }),
    ).resolves.toBe(1);

    const both = await newCustomer();
    const other = await googleFirstDealer();
    for (const userId of [both.userId, other.userId]) {
      await h.prisma.dealerMember.create({
        data: { dealerId, userId, role: 'STAFF', permissions: [] },
      });
    }
    await expect(
      h.prisma.$transaction((tx) =>
        mergeAccounts(tx, audit, {
          survivorId: both.userId,
          absorbedId: other.userId,
          proof: 'PHONE_OTP',
        }),
      ),
    ).rejects.toMatchObject({ code: 'IDENTITY_ALREADY_LINKED' });
  });

  it('names each reason it refuses', async () => {
    const customer = await newCustomer();
    const dealer = await googleFirstDealer();
    const load = (id: string) =>
      h.prisma.user.findUniqueOrThrow({
        where: { id },
        include: {
          roles: true,
          identities: { select: { id: true, provider: true } },
          adminMember: { select: { id: true } },
        },
      });
    const survivor = await load(customer.userId);
    const absorbed = await load(dealer.userId);

    expect(mergeRefusal(survivor, absorbed)).toBeNull();
    expect(mergeRefusal({ ...survivor, status: 'SUSPENDED' }, absorbed)).toBe('unavailable');
    expect(mergeRefusal({ ...survivor, phoneVerifiedAt: null }, absorbed)).toBe('unavailable');
    expect(mergeRefusal(survivor, { ...absorbed, phone: '+919999999999' })).toBe('phone-on-both');
    expect(mergeRefusal({ ...survivor, identities: absorbed.identities }, absorbed)).toBe(
      'google-on-both',
    );
    expect(
      mergeRefusal(survivor, {
        ...absorbed,
        roles: [...absorbed.roles, { ...absorbed.roles[0]!, role: 'ADMIN' }],
      }),
    ).toBe('staff');
    expect(mergeRefusal(survivor, { ...absorbed, adminMember: { id: 'member' } })).toBe('staff');
  });
});

async function dealerOf(id: string): Promise<string> {
  const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id } });
  return listing.dealerId;
}

async function expectUntouched(survivorId: string, otherId: string): Promise<void> {
  const [one, two] = await Promise.all([
    h.prisma.user.findUniqueOrThrow({ where: { id: survivorId } }),
    h.prisma.user.findUniqueOrThrow({ where: { id: otherId } }),
  ]);
  expect(one.status).toBe('ACTIVE');
  expect(two.status).toBe('ACTIVE');
  expect(one.mergedIntoId).toBeNull();
  expect(two.mergedIntoId).toBeNull();
  expect(
    await h.prisma.auditLog.count({
      where: { action: 'auth.identity.merged', entityId: { in: [survivorId, otherId] } },
    }),
  ).toBe(0);
}
