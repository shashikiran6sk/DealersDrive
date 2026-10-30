import { randomUUID } from 'node:crypto';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';
import { proveEmail } from './sales-kit.js';
import { submitDocumentSet } from './document-uploads.js';
import { env } from '../src/config/env.js';

let h: AuthHarness;
let n = 0;
const accept = (agent: request.Agent, scope = 'CUSTOMER') =>
  agent.post('/v1/legal/accept').send({ scope, accepted: true });

beforeAll(async () => {
  vi.stubEnv('LEGAL_V1_PREVIEW', 'true');
  h = await createAuthHarness(createFakeGoogle());
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await h.close();
});

async function customer() {
  n += 1;
  const phone = `984770${String(n).padStart(4, '0')}`;
  const agent = h.agent();
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:legal-${n}` })
    .expect(200);
  const result = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName: 'Legal Test Customer' })
    .expect(201);
  return { agent, phone, userId: result.body.customer.id as string };
}

async function readyDealer() {
  const dealer = await marketplaceFixtures(h, 'legal-v1').dealership('DRAFT');
  await submitDocumentSet(dealer.agent);
  return dealer;
}

describe('customer post-authentication activation', () => {
  it('authenticates an OTP account without fabricating acceptance; unchecked and missing checkboxes fail', async () => {
    const c = await customer();
    await c.agent.get('/v1/auth/customer/me').expect(200);
    const status = await c.agent.get('/v1/legal/status?scope=CUSTOMER').expect(200);
    expect(status.body).toMatchObject({ accepted: false, enabled: true });
    await c.agent.post('/v1/legal/accept').send({ scope: 'CUSTOMER', accepted: false }).expect(400);
    await c.agent.post('/v1/legal/accept').send({ scope: 'CUSTOMER' }).expect(400);
    expect(await h.prisma.legalAcceptance.count({ where: { userId: c.userId } })).toBe(0);
    for (const path of ['/v1/saved-vehicles', '/v1/enquiries', '/v1/invitations']) {
      const res = await c.agent.get(path).expect(403);
      expect(res.body.code).toBe('LEGAL_ACCEPTANCE_REQUIRED');
    }
    await accept(c.agent).expect(200);
    await c.agent.get('/v1/saved-vehicles').expect(200);
    await c.agent.get('/v1/enquiries').expect(200);
  });
  it('prompts an existing account once, preserves original timestamp across concurrent sessions and logout/login', async () => {
    const c = await customer();
    const responses = await Promise.all(Array.from({ length: 8 }, () => accept(c.agent)));
    expect(responses.every((res) => res.status === 200)).toBe(true);
    const original = await h.prisma.legalAcceptance.findMany({ where: { userId: c.userId } });
    expect(original).toHaveLength(1);
    await c.agent.post('/v1/auth/customer/logout').expect(204);
    await c.agent
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone: c.phone,
        accessToken: `dev-otp:91${c.phone}:${env.PHONE_OTP_DEV_CODE}:legal-return-${n}`,
      })
      .expect(200);
    expect((await c.agent.get('/v1/legal/status?scope=CUSTOMER').expect(200)).body.accepted).toBe(
      true,
    );
    await accept(c.agent).expect(200);
    expect(await h.prisma.legalAcceptance.findMany({ where: { userId: c.userId } })).toEqual(
      original,
    );
  });
  it('rejects invalid scopes and a disabled draft release without creating a receipt', async () => {
    const c = await customer();
    await c.agent.get('/v1/legal/status?scope=ADMIN').expect(400);
    await c.agent.get('/v1/legal/status?scope=CUSTOMER&userId=forged').expect(400);
    vi.stubEnv('LEGAL_V1_PREVIEW', 'false');
    const res = await accept(c.agent).expect(403);
    expect(res.body.code).toBe('LEGAL_NOT_ACTIVE');
    expect((await c.agent.get('/v1/legal/status?scope=CUSTOMER').expect(200)).body.enabled).toBe(
      false,
    );
    expect(await h.prisma.legalAcceptance.count({ where: { userId: c.userId } })).toBe(0);
    vi.stubEnv('LEGAL_V1_PREVIEW', 'true');
    await accept(c.agent, 'DEALER').expect(403);
  });
  it('keeps Google authentication/callbacks and policy acceptance separate', async () => {
    h.google.claims = {
      subject: `legal-google-${randomUUID()}`,
      email: `legal-${randomUUID()}@example.com`,
      emailVerified: true,
      name: 'Google Customer Dealer',
    };
    const agent = h.agent();
    const callback = await h.signIn(agent);
    expect(callback.status).toBe(302);
    expect(callback.location).toBe(`${env.WEB_BASE_URL}/dealer/onboarding`);
    await agent.get('/v1/auth/customer/me').expect(401);
    expect((await agent.get('/v1/legal/status?scope=CUSTOMER').expect(200)).body.accepted).toBe(
      false,
    );
    await agent.post('/v1/legal/accept').send({ scope: 'CUSTOMER', accepted: false }).expect(400);
    await accept(agent).expect(200);
    expect((await agent.get('/v1/legal/status?scope=CUSTOMER').expect(200)).body.accepted).toBe(
      true,
    );
    await agent.get('/v1/auth/customer/me').expect(401);
    const dealerSession = await agent.get('/v1/auth/me').expect(200);
    expect(dealerSession.body).toMatchObject({
      next: 'ONBOARDING',
      user: { phoneVerified: false },
    });

    n += 1;
    const phone = `984770${String(n).padStart(4, '0')}`;
    await agent
      .post('/v1/auth/phone/verify')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:legal-google-${n}`,
      })
      .expect(200);
    const customerSession = await agent.get('/v1/auth/customer/me').expect(200);
    expect(customerSession.body.customer.phone).toBe(`+91${phone}`);
    expect((await agent.get('/v1/legal/status?scope=CUSTOMER').expect(200)).body.accepted).toBe(
      true,
    );
    expect((await agent.get('/v1/auth/me').expect(200)).body.next).toBe('ONBOARDING');
  });
  it('retains support/privacy requests and public browsing without acceptance', async () => {
    const c = await customer();
    await c.agent.get('/v1/support/tickets').expect(200);
    await h.agent().get('/v1/vehicles').expect(200);
    await h.agent().get('/v1/config/public').expect(200);
    await h.agent().get('/v1/legal/status?scope=CUSTOMER').expect(401);
    await accept(h.agent()).expect(401);
  });
  it('refuses identity/version spoofing, cross-origin requests and non-JSON requests', async () => {
    const c = await customer();
    for (const extra of [
      { userId: randomUUID() },
      { dealerId: randomUUID() },
      { termsVersion: 'terms-v0.0' },
      { acceptedAt: new Date().toISOString() },
    ])
      await c.agent
        .post('/v1/legal/accept')
        .send({ scope: 'CUSTOMER', accepted: true, ...extra })
        .expect(400);
    await c.agent
      .post('/v1/legal/accept')
      .set('Origin', 'https://untrusted.example')
      .send({ scope: 'CUSTOMER', accepted: true })
      .expect(403);
    await c.agent
      .post('/v1/legal/accept')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ scope: 'CUSTOMER', accepted: true })
      .expect(403);
    await c.agent
      .post('/v1/legal/accept')
      .type('form')
      .send({ scope: 'CUSTOMER', accepted: true })
      .expect(400);
    expect(await h.prisma.legalAcceptance.count({ where: { userId: c.userId } })).toBe(0);
  });
});

describe('dealer owner acceptance and preserved onboarding', () => {
  it('requires acceptance on final submission, keeps the draft, and stores agreement with the successful submission', async () => {
    const d = await readyDealer();
    const before = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    await d.agent.post('/v1/dealer/submit').send({}).expect(403);
    await d.agent.post('/v1/dealer/submit').send({ accepted: false }).expect(400);
    expect(await h.prisma.dealer.findUnique({ where: { id: d.dealerId } })).toEqual(before);
    await d.agent.get('/v1/dealer/documents').expect(200);
    await d.agent.get('/v1/dealer/completeness').expect(200);
    await d.agent.post('/v1/dealer/submit').send({ accepted: true }).expect(200);
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).status).toBe(
      'PENDING_APPROVAL',
    );
    expect(await h.prisma.legalAcceptance.count({ where: { userId: d.userId } })).toBe(2);
    expect((await d.agent.get('/v1/legal/status?scope=DEALER').expect(200)).body.accepted).toBe(
      true,
    );
  });
  it('does not record acceptance if final submission fails completeness checks', async () => {
    const d = await marketplaceFixtures(h, 'legal-incomplete').dealership('DRAFT');
    await d.agent.post('/v1/dealer/submit').send({ accepted: true }).expect(422);
    expect(await h.prisma.legalAcceptance.count({ where: { userId: d.userId } })).toBe(0);
  });
  it('gates an existing approved dealer once, supports OTP re-entry and retains permissions', async () => {
    const d = await marketplaceFixtures(h, 'legal-active').dealership('ACTIVE');
    const before = (await d.agent.get('/v1/auth/me').expect(200)).body;
    await d.agent.get('/v1/dealer').expect(403);
    await accept(d.agent, 'DEALER').expect(200);
    await d.agent.get('/v1/dealer').expect(200);
    const user = await h.prisma.user.findUniqueOrThrow({ where: { id: d.userId } });
    const phone = user.phone!.slice(-10);
    await d.agent.post('/v1/auth/logout').expect(204);
    await d.agent
      .post('/v1/auth/sign-in/phone/dealer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:legal-dealer-return`,
      })
      .expect(200);
    expect((await d.agent.get('/v1/legal/status?scope=DEALER').expect(200)).body.accepted).toBe(
      true,
    );
    const after = (await d.agent.get('/v1/auth/me').expect(200)).body;
    expect(after.permissions).toEqual(before.permissions);
    expect(after.dealer.status).toBe('ACTIVE');
  });
  it('allows manual activation without documents or agreement and requires owner acceptance at first dealer entry', async () => {
    const d = await marketplaceFixtures(h, 'legal-activation').dealership('DRAFT');
    const uploadedDocuments = { dealerId: d.dealerId, fileName: { not: null } };
    expect(await h.prisma.dealerDocument.count({ where: uploadedDocuments })).toBe(0);
    h.google.claims = {
      subject: `legal-activation-admin-${randomUUID()}`,
      email: env.adminAllowlist[0]!,
      emailVerified: true,
      name: 'Test Admin',
    };
    const admin = h.agent();
    await h.signInAdmin(admin);
    const body = {
      justification: 'Synthetic local exception authorized only for this legal regression test.',
      acknowledgedDisclaimer: 'manual-activation-2026-10-12',
    };
    await admin.post(`/v1/admin/dealers/${d.dealerId}/activation-override`).send(body).expect(200);
    const approved = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    expect(approved).toMatchObject({ status: 'ACTIVE', activationMethod: 'MANUAL_OVERRIDE' });
    expect(await h.prisma.dealerDocument.count({ where: uploadedDocuments })).toBe(0);
    expect(await h.prisma.legalAcceptance.count({ where: { dealerId: d.dealerId } })).toBe(0);
    await d.agent.get('/v1/dealer').expect(403);
    await accept(d.agent, 'DEALER').expect(200);
    await d.agent.get('/v1/dealer').expect(200);
    expect(await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).toEqual(
      approved,
    );
    expect(await h.prisma.dealerDocument.count({ where: uploadedDocuments })).toBe(0);
  });
  it('does not let staff forge owner acceptance, or acceptance bypass suspension', async () => {
    const fixtures = marketplaceFixtures(h, 'legal-staff');
    const d = await fixtures.dealership('ACTIVE');
    const staff = await fixtures.member(d, 'STAFF');
    expect(
      (await staff.agent.get('/v1/legal/status?scope=DEALER').expect(200)).body.canAccept,
    ).toBe(false);
    await accept(staff.agent, 'DEALER').expect(403);
    await accept(staff.agent).expect(200);
    await staff.agent.get('/v1/dealer').expect(403);
    await accept(d.agent, 'DEALER').expect(200);
    await accept(staff.agent, 'DEALER').expect(200);
    await staff.agent.get('/v1/dealer').expect(200);
    await staff.agent.post('/v1/dealer/submit').send({ accepted: true }).expect(403);
    await h.prisma.dealer.update({ where: { id: d.dealerId }, data: { status: 'SUSPENDED' } });
    await d.agent.get('/v1/dealer').expect(401);
    await accept(d.agent, 'DEALER').expect(403);
  });
  it('never creates dealer acceptance from an admin/sales session', async () => {
    const agent = h.agent();
    h.google.claims = {
      subject: `legal-admin-${randomUUID()}`,
      email: env.adminAllowlist[0]!,
      emailVerified: true,
      name: 'Test Admin',
    };
    await h.signInAdmin(agent);
    await accept(agent, 'DEALER').expect(401);
  });
  it('preserves assisted drafts, refuses representative acceptance, and lets the dealer accept through their own OTP session', async () => {
    h.google.claims = {
      subject: `legal-sales-admin-${randomUUID()}`,
      email: env.adminAllowlist[0]!,
      emailVerified: true,
      name: 'Test Admin',
    };
    const admin = h.agent();
    await h.signInAdmin(admin);
    const email = `legal-rep-${randomUUID()}@example.com`;
    await admin.post('/v1/admin/members').send({ email, role: 'SALES_REP' }).expect(201);
    h.google.claims = {
      subject: `legal-sales-${randomUUID()}`,
      email,
      emailVerified: true,
      name: 'Sales Representative',
    };
    const sales = h.agent();
    await h.signInAdmin(sales);
    const phone = '9857700099';
    const ownerEmail = `owner-${randomUUID()}@example.com`;
    const proved = await sales
      .post('/v1/sales/dealers/phone/verify')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:legal-assisted`,
        consent: true,
      })
      .expect(200);
    const mail = await proveEmail(h, sales, ownerEmail);
    const created = await sales
      .post('/v1/sales/dealers')
      .send({
        phoneTicket: proved.body.phoneTicket,
        emailTicket: mail.emailTicket,
        contactName: 'Dealer Owner',
        legalName: `Legal Assisted ${randomUUID()}`,
        addressLine: '18 Gandhi Road',
        city: 'Katpadi',
        district: 'Vellore',
        state: 'Tamil Nadu',
        pincode: '632007',
        mapsUrl: 'https://maps.app.goo.gl/legal-fixture',
        specialities: ['RC transfer'],
      })
      .expect(201);
    const id = created.body.id as string;
    const before = await h.prisma.dealer.findUniqueOrThrow({ where: { id } });
    expect(before.assistedConsentAt).not.toBeNull();
    expect(await h.prisma.legalAcceptance.count({ where: { dealerId: id } })).toBe(0);
    await accept(sales, 'DEALER').expect(401);
    await submitDocumentSet(sales, `/v1/sales/dealers/${id}`);
    await sales.post(`/v1/sales/dealers/${id}/submit`).expect(200);
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id } })).status).toBe(
      'PENDING_APPROVAL',
    );
    expect(await h.prisma.legalAcceptance.count({ where: { dealerId: id } })).toBe(0);
    await h.prisma.dealerDocument.updateMany({
      where: { dealerId: id },
      data: { status: 'VERIFIED' },
    });
    await admin.post(`/v1/admin/dealers/${id}/approve`).send({}).expect(200);
    expect(await h.prisma.legalAcceptance.count({ where: { dealerId: id } })).toBe(0);
    const owner = h.agent();
    await owner
      .post('/v1/auth/sign-in/phone/dealer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:legal-assisted-owner`,
      })
      .expect(200);
    await accept(owner, 'DEALER').expect(200);
    const receipt = await h.prisma.legalAcceptance.findFirstOrThrow({ where: { dealerId: id } });
    const member = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: id, role: 'OWNER' },
    });
    expect(receipt.userId).toBe(member.userId);
  });
  it('keeps customer acceptance after a verified account merge without changing evidence', async () => {
    const c = await customer();
    await accept(c.agent).expect(200);
    h.google.claims = {
      subject: `legal-merge-${randomUUID()}`,
      email: `merge-${randomUUID()}@example.com`,
      emailVerified: true,
      name: 'Merge User',
    };
    const google = h.agent();
    await h.signIn(google);
    await accept(google).expect(200);
    const original = await h.prisma.legalAcceptance.findMany({ where: { userId: c.userId } });
    await h.proveNumber(google, c.phone);
    expect((await google.get('/v1/legal/status?scope=CUSTOMER').expect(200)).body.accepted).toBe(
      true,
    );
    expect(await h.prisma.legalAcceptance.findMany({ where: { userId: c.userId } })).toEqual(
      original,
    );
  });
});
