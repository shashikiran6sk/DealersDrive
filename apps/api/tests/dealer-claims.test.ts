import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * R113 — the dealer claims a dealership a Sales Representative set up with them.
 *
 * Two proofs, and only both: the link emailed to the address the representative
 * typed, confirmed by a POST; and an OTP on the phone verified during
 * onboarding. The representative never sees the link, and a staff account,
 * an account with a dealership already, or a stranger with only one of the two
 * proofs never becomes an owner.
 */
let h: AuthHarness;
let superAdmin: request.Agent;
let sales: request.Agent;
let counter = 0;
let tokens = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  h.google.claims = {
    subject: 'claims-suite-super',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
    name: 'Dealers-Drive Operations',
  };
  superAdmin = h.agent();
  await h.signInAdmin(superAdmin);
  const email = nextEmail('claims.rep');
  await superAdmin.post('/v1/admin/members').send({ email, role: 'SALES_REP' }).expect(201);
  h.google.claims = { subject: 'claims-suite-rep', email, emailVerified: true };
  sales = h.agent();
  await h.signInAdmin(sales);
});

afterAll(async () => {
  await h.close();
});

function nextEmail(label: string): string {
  counter += 1;
  return `${label}.${String(counter)}.${Date.now().toString(36)}@dealers-drive.test`;
}

function freeNumber(): string {
  counter += 1;
  return `96633${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string, code: string = env.PHONE_OTP_DEV_CODE): string {
  tokens += 1;
  return `dev-otp:91${phone.slice(-10)}:${code}:claim-${String(tokens)}`;
}

async function assisted(overrides: Record<string, unknown> = {}) {
  const phone = freeNumber();
  const verified = await sales
    .post('/v1/sales/dealers/phone/verify')
    .send({ phone, accessToken: devToken(phone), consent: true })
    .expect(200);
  counter += 1;
  const email = `owner.${String(counter)}.${Date.now().toString(36)}@gmail.com`;
  const created = await sales
    .post('/v1/sales/dealers')
    .send({
      phoneTicket: verified.body.phoneTicket,
      contactName: 'Selvi R',
      email,
      legalName: `Claimable Motors ${String(counter)} ${Date.now().toString(36)}`,
      addressLine: '7, Arcot Road',
      city: 'Katpadi',
      district: 'Vellore',
      state: 'Tamil Nadu',
      pincode: '632007',
      mapsUrl: 'https://maps.app.goo.gl/claimable',
      tagline: 'Family-run since 1998, hatchbacks under six lakh.',
      specialities: ['Hatchbacks'],
      ...overrides,
    })
    .expect(201);
  await h.drainEmails();
  return { phone, email, dealerId: created.body.id as string };
}

function linkSentTo(email: string): { token: string; text: string } {
  const message = [...h.mailer.sent].reverse().find((sent) => sent.to === email);
  if (!message) throw new Error(`no email to ${email}`);
  const match = /\/claim\/([A-Za-z0-9_-]{32,})/.exec(message.text);
  if (!match?.[1]) throw new Error('no claim link in the email');
  return { token: match[1], text: message.text };
}

async function confirmEmail(token: string) {
  return h.agent().post(`/v1/dealer-claims/${token}/verify-email`).send().expect(200);
}

function claim(agent: request.Agent, token: string, phone: string, code?: string) {
  return agent
    .post(`/v1/dealer-claims/${token}/claim`)
    .send({ phone, accessToken: devToken(phone, code) });
}

describe('the verification email', () => {
  it('is sent on creation, to the typed address, with a link only the email holds', async () => {
    const { email, dealerId } = await assisted();
    const { token, text } = linkSentTo(email);
    expect(text).toContain(`${env.WEB_BASE_URL}/claim/`);

    const row = await h.prisma.dealerEmailVerification.findFirstOrThrow({ where: { dealerId } });
    expect(row.tokenHash).not.toBeNull();
    expect(row.tokenHash).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(token);

    const outbox = await h.prisma.outboxEvent.findMany({
      where: { eventType: 'DealerEmailVerificationRequested', aggregateId: row.id },
    });
    expect(JSON.stringify(outbox)).not.toContain(token);

    const detail = await sales.get(`/v1/sales/dealers/${dealerId}`).expect(200);
    expect(detail.body.emailVerification).toMatchObject({ email, verifiedAt: null });
    expect(JSON.stringify(detail.body)).not.toContain(token);
  });

  it('does not send status emails to an unverified address', async () => {
    const { email, dealerId } = await assisted();
    const before = h.mailer.sent.filter((sent) => sent.to === email).length;
    await h.prisma.dealer.update({ where: { id: dealerId }, data: { status: 'PENDING_APPROVAL' } });
    await superAdmin
      .post(`/v1/admin/dealers/${dealerId}/request-changes`)
      .send({ reason: 'Upload a clearer GST certificate.' })
      .expect(200);
    await h.drainEmails();
    expect(h.mailer.sent.filter((sent) => sent.to === email)).toHaveLength(before);
  });

  it('is superseded by a resend, and the resend is rate-limited', async () => {
    const { email, dealerId } = await assisted();
    const first = linkSentTo(email).token;
    await sales.post(`/v1/sales/dealers/${dealerId}/email-verification`).send().expect(409);

    await h.prisma.dealerEmailVerification.updateMany({
      where: { dealerId },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    await sales.post(`/v1/sales/dealers/${dealerId}/email-verification`).send().expect(200);
    await h.drainEmails();
    const second = linkSentTo(email).token;
    expect(second).not.toBe(first);

    const stale = await h.agent().get(`/v1/dealer-claims/${first}`).expect(200);
    expect(stale.body.state).toBe('SUPERSEDED');
    await h.agent().post(`/v1/dealer-claims/${first}/verify-email`).send().expect(409);
  });

  it('follows a change of address, and the old link stops working', async () => {
    const { email, dealerId } = await assisted();
    const old = linkSentTo(email).token;
    const next = `changed.${Date.now().toString(36)}@gmail.com`;
    await sales.patch(`/v1/sales/dealers/${dealerId}`).send({ email: next }).expect(200);
    await h.drainEmails();

    expect(linkSentTo(next).token).not.toBe(old);
    const stale = await h.agent().get(`/v1/dealer-claims/${old}`).expect(200);
    expect(stale.body.state).toBe('SUPERSEDED');
  });
});

describe('confirming the email', () => {
  it('needs a POST: reading the link changes nothing', async () => {
    const { email, dealerId } = await assisted();
    const { token } = linkSentTo(email);

    const preview = await h.agent().get(`/v1/dealer-claims/${token}`).expect(200);
    expect(preview.body).toMatchObject({ state: 'AWAITING_EMAIL' });
    expect(preview.body.emailMasked).not.toBe(email);
    expect(JSON.stringify(preview.body)).not.toContain(email);
    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealerId } });
    expect(dealer.contactEmailVerifiedAt).toBeNull();
  });

  it('verifies the dealership’s email, idempotently, and audits it', async () => {
    const { email, dealerId } = await assisted();
    const { token } = linkSentTo(email);

    const first = await confirmEmail(token);
    expect(first.body.state).toBe('AWAITING_CLAIM');
    await confirmEmail(token);

    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealerId } });
    expect(dealer.contactEmailVerifiedAt).toBeInstanceOf(Date);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'dealer.assisted.email_verified', entityId: dealerId },
      }),
    ).toBe(1);
  });

  it('refuses an unknown, malformed or expired link', async () => {
    await h
      .agent()
      .get(`/v1/dealer-claims/${'x'.repeat(43)}`)
      .expect(404);
    await h.agent().get('/v1/dealer-claims/short').expect(400);

    const { email, dealerId } = await assisted();
    const { token } = linkSentTo(email);
    await h.prisma.dealerEmailVerification.updateMany({
      where: { dealerId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const preview = await h.agent().get(`/v1/dealer-claims/${token}`).expect(200);
    expect(preview.body.state).toBe('EXPIRED');
    const refused = await h.agent().post(`/v1/dealer-claims/${token}/verify-email`).send();
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('CLAIM_LINK_EXPIRED');
  });
});

describe('claiming', () => {
  it('needs the email confirmed first', async () => {
    const { email, phone } = await assisted();
    const { token } = linkSentTo(email);
    const refused = await claim(h.agent(), token, phone);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('CLAIM_EMAIL_FIRST');
  });

  it('refuses another number, and a wrong code', async () => {
    const { email, phone } = await assisted();
    const { token } = linkSentTo(email);
    await confirmEmail(token);

    const stranger = await claim(h.agent(), token, freeNumber());
    expect(stranger.status).toBe(403);
    expect(stranger.body.code).toBe('CLAIM_PHONE_MISMATCH');

    const wrong = await claim(h.agent(), token, phone, '000000');
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    expect(await h.prisma.dealerMember.count({ where: { user: { phone: `+91${phone}` } } })).toBe(
      0,
    );
  });

  it('makes the phone holder the OWNER, signs them in, and locks Sales out', async () => {
    const { email, phone, dealerId } = await assisted();
    const { token } = linkSentTo(email);
    await confirmEmail(token);

    const dealer = h.agent();
    const claimed = await claim(dealer, token, phone).expect(200);
    expect(claimed.body).toEqual({ dealerId, returnTo: '/dealer' });
    expect(String(claimed.headers['set-cookie'])).toContain('dd_session=');

    const owner = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId, role: 'OWNER', status: 'ACTIVE' },
      include: { user: { include: { roles: true } } },
    });
    expect(owner.user.phone).toBe(`+91${phone}`);
    expect(owner.user.fullName).toBe('Selvi R');
    expect(owner.user.email).toBeNull();
    expect(owner.user.roles.map((seat) => seat.role)).toContain('DEALER');

    const me = await dealer.get('/v1/auth/me').expect(200);
    expect(JSON.stringify(me.body)).toContain(dealerId);

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'dealer.claimed', entityId: dealerId },
    });
    expect(audit.after).toMatchObject({ proof: ['EMAIL_LINK', 'PHONE_OTP'] });
    expect(JSON.stringify(audit)).not.toContain(token);

    const preview = await h.agent().get(`/v1/dealer-claims/${token}`).expect(200);
    expect(preview.body.state).toBe('CLAIMED');
    const again = await claim(h.agent(), token, phone);
    expect(again.status).toBe(409);

    await sales.patch(`/v1/sales/dealers/${dealerId}`).send({ contactName: 'X Y' }).expect(409);
    await sales.post(`/v1/sales/dealers/${dealerId}/email-verification`).send().expect(409);
    const detail = await sales.get(`/v1/sales/dealers/${dealerId}`).expect(200);
    expect(detail.body.claimed).toBe(true);
  });

  it('attaches an existing customer account that holds the number', async () => {
    const { email, phone, dealerId } = await assisted();
    const user = await h.prisma.user.create({
      data: { phone: `+91${phone}`, phoneVerifiedAt: new Date(), fullName: 'Selvi Customer' },
    });
    const { token } = linkSentTo(email);
    await confirmEmail(token);
    await claim(h.agent(), token, phone).expect(200);

    const owner = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId, role: 'OWNER' },
    });
    expect(owner.userId).toBe(user.id);
  });

  it('refuses a team account, and an account that already manages a dealership', async () => {
    const staffDealer = await assisted();
    await h.prisma.user.create({
      data: {
        phone: `+91${staffDealer.phone}`,
        phoneVerifiedAt: new Date(),
        adminMember: { create: { role: 'SUPPORT', status: 'ACTIVE', source: 'INVITED' } },
      },
    });
    const staffToken = linkSentTo(staffDealer.email).token;
    await confirmEmail(staffToken);
    const staff = await claim(h.agent(), staffToken, staffDealer.phone);
    expect(staff.status).toBe(403);
    expect(staff.body.code).toBe('CLAIM_STAFF_ACCOUNT');

    const busy = await assisted();
    const holder = await h.prisma.user.create({
      data: { phone: `+91${busy.phone}`, phoneVerifiedAt: new Date() },
    });
    const other = await h.prisma.dealer.findFirstOrThrow({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    await h.prisma.dealerMember.create({
      data: { dealerId: other.id, userId: holder.id, role: 'STAFF', permissions: [] },
    });
    const busyToken = linkSentTo(busy.email).token;
    await confirmEmail(busyToken);
    const refused = await claim(h.agent(), busyToken, busy.phone);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('CLAIM_ACCOUNT_HAS_DEALERSHIP');
  });

  it('owns the dealership once, whatever the race', async () => {
    const { email, phone, dealerId } = await assisted();
    const { token } = linkSentTo(email);
    await confirmEmail(token);

    const results = await Promise.all([
      claim(h.agent(), token, phone),
      claim(h.agent(), token, phone),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await h.prisma.dealerMember.count({ where: { dealerId, role: 'OWNER' } })).toBe(1);
  });

  it('refuses unknown fields, and never accepts a dealerId', async () => {
    const { email, phone } = await assisted();
    const { token } = linkSentTo(email);
    await confirmEmail(token);
    const res = await h
      .agent()
      .post(`/v1/dealer-claims/${token}/claim`)
      .send({ phone, accessToken: devToken(phone), dealerId: 'x' });
    expect(res.status).toBe(400);
  });
});
