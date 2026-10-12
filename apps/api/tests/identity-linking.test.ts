import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createIdentityService } from '../src/modules/auth/identity.service.js';
import type { OAuthClaims } from '../src/modules/auth/oauth.port.js';
import type { ProvenPhone } from '../src/modules/auth/phone-proof.service.js';
import { createAuditService } from '../src/platform/audit/audit.service.js';

/**
 * R59 — a phone and a Google account are two ways into one account.
 *
 * Everything here runs against the real database, because every guarantee in
 * it is the database's: two concurrent sign-ups for one number, two concurrent
 * links of one Google account, and a stored number in a second spelling are
 * all refused by an index or a CHECK, not by a read that happened first.
 */
let prisma: PrismaClient;
let identities: ReturnType<typeof createIdentityService>;
let counter = 0;

beforeAll(() => {
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  identities = createIdentityService({ prisma, audit: createAuditService(prisma) });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A number nothing else in the suite or the seed holds. */
function freeNumber(): string {
  counter += 1;
  return `+9197733${String(10000 + counter).slice(-5)}`;
}

function proven(phone = freeNumber()): ProvenPhone {
  return { phone, purpose: 'DEALER_LOGIN', provenAt: new Date() };
}

function google(overrides: Partial<OAuthClaims> = {}): OAuthClaims {
  counter += 1;
  return {
    subject: `link-sub-${String(counter)}`,
    email: `link${String(counter)}@example.com`,
    emailVerified: true,
    name: 'Linked Dealer',
    ...overrides,
  };
}

it('refuses to collapse conflicting primary dealership ownership and rolls back both identities', async () => {
  const claims = google();
  const source = await identities.createWithGoogle(claims);
  const phone = await identities.createWithPhone(proven());
  const first = await prisma.dealer.create({
    data: {
      slug: `merge-primary-a-${counter}`,
      legalName: `Merge Primary A ${counter}`,
      brandName: 'Synthetic A',
      contactEmail: claims.email,
      members: { create: { userId: source, role: 'OWNER', permissions: [] } },
    },
  });
  const second = await prisma.dealer.create({
    data: {
      slug: `merge-primary-b-${counter}`,
      legalName: `Merge Primary B ${counter}`,
      brandName: 'Synthetic B',
      contactEmail: `phone-owner-${counter}@example.test`,
      members: { create: { userId: phone.userId, role: 'OWNER', permissions: [] } },
    },
  });
  await expect(identities.absorbGoogleHolder(phone.userId, claims)).rejects.toMatchObject({
    code: 'DEALER_EMAIL_TAKEN',
  });
  expect(
    (await prisma.dealerMember.findFirstOrThrow({ where: { dealerId: first.id, role: 'OWNER' } }))
      .userId,
  ).toBe(source);
  expect(
    (await prisma.dealerMember.findFirstOrThrow({ where: { dealerId: second.id, role: 'OWNER' } }))
      .userId,
  ).toBe(phone.userId);
  expect(
    (
      await prisma.oAuthIdentity.findUniqueOrThrow({
        where: {
          provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject },
        },
      })
    ).userId,
  ).toBe(source);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: source } })).status).toBe('ACTIVE');
  expect((await prisma.user.findUniqueOrThrow({ where: { id: source } })).mergedIntoId).toBeNull();
});

describe('an account that starts with a phone', () => {
  it('is one user row, holding the proved number and nothing else', async () => {
    const phone = freeNumber();
    const account = await identities.createWithPhone(proven(phone), { fullName: 'Ravi' });

    expect(account.created).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    expect(user).toMatchObject({ phone, fullName: 'Ravi', email: null });
    expect(user.phoneVerifiedAt).toBeInstanceOf(Date);

    await expect(identities.identitiesOf(account.userId)).resolves.toMatchObject({
      google: null,
      phone: { phone },
      complete: false,
    });
  });

  it('is found again by its number, however the number is written', async () => {
    const phone = freeNumber();
    const { userId } = await identities.createWithPhone(proven(phone));

    const local = phone.slice(3);
    await expect(identities.findByVerifiedPhone(`0${local}`)).resolves.toMatchObject({
      id: userId,
    });
    await expect(
      identities.findByVerifiedPhone(`+91 ${local.slice(0, 5)} ${local.slice(5)}`),
    ).resolves.toMatchObject({ id: userId });
  });

  it('answers the existing account, not a second one, when the number is proved again', async () => {
    const phone = freeNumber();
    const first = await identities.createWithPhone(proven(phone));
    const second = await identities.createWithPhone(proven(phone));

    expect(second).toEqual({ userId: first.userId, created: false });
    expect(await prisma.user.count({ where: { phone } })).toBe(1);
  });

  /** Two OTP callbacks for one new number, at the same instant. */
  it('survives a race: two sign-ups for one number make one account', async () => {
    const phone = freeNumber();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => identities.createWithPhone(proven(phone))),
    );

    expect(new Set(results.map((result) => result.userId)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await prisma.user.count({ where: { phone } })).toBe(1);
  });
});

describe('linking Google to an account that started with a phone', () => {
  it('converges both identities on the one account', async () => {
    const { userId } = await identities.createWithPhone(proven());
    const claims = google();

    await expect(identities.linkGoogle(userId, claims)).resolves.toEqual({ linked: true });

    const view = await identities.identitiesOf(userId);
    expect(view).toMatchObject({ google: { email: claims.email }, complete: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user).toMatchObject({ email: claims.email, fullName: 'Linked Dealer' });

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: userId, action: 'auth.identity.linked' },
    });
    expect(audit?.after).toEqual({ provider: 'GOOGLE' });
  });

  it('is idempotent: the same Google account again is not a second link', async () => {
    const { userId } = await identities.createWithPhone(proven());
    const claims = google();

    await identities.linkGoogle(userId, claims);
    await expect(identities.linkGoogle(userId, claims)).resolves.toEqual({ linked: false });
    expect(await prisma.oAuthIdentity.count({ where: { userId } })).toBe(1);
  });

  it('does not overwrite a name the account already has', async () => {
    const { userId } = await identities.createWithPhone(proven(), { fullName: 'Ravi' });
    await identities.linkGoogle(userId, google({ name: 'Somebody Else' }));

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.fullName).toBe('Ravi');
  });
});

describe('collisions are refused, never merged', () => {
  /**
   * The case the brief names: the phone is User A's, the Google account is
   * User B's. Combining them would be merging two people on the strength of
   * one claim, so it is refused and both accounts are left exactly as they
   * were.
   */
  it('refuses a Google account that already belongs to another user', async () => {
    const claims = google();
    const userB = await identities.createWithGoogle(claims);
    const { userId: userA } = await identities.createWithPhone(proven());

    await expect(identities.linkGoogle(userA, claims)).rejects.toMatchObject({
      code: 'IDENTITY_ALREADY_LINKED',
      status: 409,
    });

    const identity = await prisma.oAuthIdentity.findUniqueOrThrow({
      where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject } },
    });
    expect(identity.userId).toBe(userB);
    await expect(identities.identitiesOf(userA)).resolves.toMatchObject({ google: null });
  });

  /** The refusal says what to do, and nothing about whose account it is. */
  it('does not name the account that holds it', async () => {
    const claims = google({ email: 'owner.of.abc.motors@example.com' });
    await identities.createWithGoogle(claims);
    const { userId } = await identities.createWithPhone(proven());

    const message = await identities
      .linkGoogle(userId, claims)
      .catch((error: Error) => error.message);
    expect(message).not.toContain('owner.of.abc.motors');
    expect(message).toMatch(/Sign in with it instead/);
  });

  it('refuses a second, different Google account on one user', async () => {
    const { userId } = await identities.createWithPhone(proven());
    await identities.linkGoogle(userId, google());

    await expect(identities.linkGoogle(userId, google())).rejects.toMatchObject({
      code: 'IDENTITY_ALREADY_LINKED',
    });
    expect(await prisma.oAuthIdentity.count({ where: { userId } })).toBe(1);
  });

  it('refuses a Google account whose email another user already holds', async () => {
    const claims = google();
    await prisma.user.create({ data: { email: claims.email } });
    const { userId } = await identities.createWithPhone(proven());

    await expect(identities.linkGoogle(userId, claims)).rejects.toMatchObject({
      code: 'IDENTITY_ALREADY_LINKED',
    });
    await expect(identities.identitiesOf(userId)).resolves.toMatchObject({ google: null });
  });

  /** Two accounts linking one Google account at the same instant: one wins. */
  it('survives a race: one Google account, linked from two accounts at once', async () => {
    const claims = google();
    const a = await identities.createWithPhone(proven());
    const b = await identities.createWithPhone(proven());

    const settled = await Promise.allSettled([
      identities.linkGoogle(a.userId, claims),
      identities.linkGoogle(b.userId, claims),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const refused = settled.find((result) => result.status === 'rejected');
    expect(refused?.status === 'rejected' ? refused.reason : null).toMatchObject({
      code: 'IDENTITY_ALREADY_LINKED',
    });
    expect(
      await prisma.oAuthIdentity.count({
        where: { provider: 'GOOGLE', providerSubject: claims.subject },
      }),
    ).toBe(1);
  });

  /**
   * One account linking two different Google accounts at the same instant —
   * two tabs, two consents. The user row is locked for the link, so the second
   * sees the first's identity and is refused rather than both landing.
   */
  it('survives a race: two Google accounts, linked to one account at once', async () => {
    const { userId } = await identities.createWithPhone(proven());

    const settled = await Promise.allSettled([
      identities.linkGoogle(userId, google()),
      identities.linkGoogle(userId, google()),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.oAuthIdentity.count({ where: { userId } })).toBe(1);
  });

  /**
   * A legacy account holding the number without ever proving it is not
   * silently taken over by the person who just proved it — that is support's
   * call, not an automatic one.
   */
  it('refuses a proved number held, unverified, by a legacy account', async () => {
    const phone = freeNumber();
    await prisma.user.create({ data: { phone } });

    await expect(identities.createWithPhone(proven(phone))).rejects.toMatchObject({
      code: 'IDENTITY_ALREADY_LINKED',
    });
    await expect(identities.findByVerifiedPhone(phone)).resolves.toBeNull();
  });
});

describe('what the database itself refuses', () => {
  it.each(['9840012345', '+91 98400 12345', '+09840012345', '+915840012345'])(
    'refuses %j as a stored phone',
    async (phone) => {
      await expect(prisma.user.create({ data: { phone } })).rejects.toThrow(
        /users_phone_canonical/,
      );
    },
  );
});
