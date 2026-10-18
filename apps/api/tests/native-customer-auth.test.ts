import type * as EnvModule from '../src/config/env.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  NativeCustomerSignIn,
  NativeCustomerSignUp,
  NativeOtpChallenge,
  NativeCustomerSession,
  LegalPublication,
  CustomerSupportTicket,
} from '@dealers-drive/contracts';
import { createSessionService } from '../src/modules/auth/session.service.js';
import { env } from '../src/config/env.js';
import { createMemoryCache } from '../src/platform/cache/memory.adapter.js';
import { createListingsTestKit } from './listings-kit.js';
import { createAuthHarness, type AuthHarness } from './auth-harness.js';

let h: AuthHarness;
const original = env.NATIVE_CUSTOMER_AUTH_ENABLED;
const cache = createMemoryCache();
let count = 0;
beforeAll(async () => {
  env.NATIVE_CUSTOMER_AUTH_ENABLED = true;
  h = await createAuthHarness(undefined, undefined, { cache });
});
afterAll(async () => {
  env.NATIVE_CUSTOMER_AUTH_ENABLED = original;
  await h.close();
});
async function nativeCustomer() {
  await cache.reset();
  count++;
  const phone = `98456${String(count).padStart(5, '0')}`;
  const sent = await h.agent().post('/v1/auth/native/customer/otp').send({ phone }).expect(200);
  const challenge = NativeOtpChallenge.parse(sent.body);
  const verified = await h
    .agent()
    .post('/v1/auth/native/customer/otp/verify')
    .send({ challenge: challenge.challenge, otp: env.PHONE_OTP_DEV_CODE })
    .expect(200);
  const result = NativeCustomerSignIn.parse(verified.body);
  if (result.status !== 'NAME_REQUIRED') throw new Error('fresh test phone was already registered');
  const response = await h
    .agent()
    .post('/v1/auth/native/customer/sign-up')
    .send({ signUpToken: result.signUpToken, fullName: 'Native Customer' })
    .expect(201);
  expect(response.headers['set-cookie']).toBeUndefined();
  return { ...NativeCustomerSignUp.parse(response.body), phone, challenge };
}
describe('same customer identity and restricted native bearer', () => {
  it('creates the existing User/customer seat, restores securely and works on web', async () => {
    const created = await nativeCustomer();
    const bearer = `Bearer ${created.credential.token}`;
    const me = await h
      .agent()
      .get('/v1/auth/native/customer/me')
      .set('Authorization', bearer)
      .expect(200);
    expect(NativeCustomerSession.parse(me.body).customer.id).toBe(created.customer.id);
    await h
      .agent()
      .get('/v1/auth/customer/me')
      .set('Cookie', `dd_session=${created.credential.token}`)
      .expect(401);
    const user = await h.prisma.user.findUniqueOrThrow({
      where: { id: created.customer.id },
      include: { roles: true },
    });
    expect(user.roles.map((role) => role.role)).toEqual(['CUSTOMER']);
    expect(user.phone).toBe(`+91${created.phone}`);
    expect(user.phoneVerifiedAt).not.toBeNull();
    await cache.reset();
    const webSignIn = await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone: created.phone,
        accessToken: `dev-otp:91${created.phone}:${env.PHONE_OTP_DEV_CODE}:web-roundtrip`,
      })
      .expect(200);
    expect(webSignIn.body.customer.id).toBe(created.customer.id);
  });
  it('recognizes an existing web customer through a fresh native OTP', async () => {
    await cache.reset();
    const phone = '9845605000';
    const proved = await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:web-first` })
      .expect(200);
    const web = await h
      .agent()
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: proved.body.signUpToken, fullName: 'Website Customer' })
      .expect(201);
    const sent = await h.agent().post('/v1/auth/native/customer/otp').send({ phone }).expect(200);
    const verified = await h
      .agent()
      .post('/v1/auth/native/customer/otp/verify')
      .send({
        challenge: NativeOtpChallenge.parse(sent.body).challenge,
        otp: env.PHONE_OTP_DEV_CODE,
      })
      .expect(200);
    const signed = NativeCustomerSignIn.parse(verified.body);
    expect(signed.status).toBe('SIGNED_IN');
    if (signed.status === 'SIGNED_IN') expect(signed.customer.id).toBe(web.body.customer.id);
    expect(verified.headers['set-cookie']).toBeUndefined();
  });
  it('accepts customer bearer only for customer routes, never workspaces/invitations or privileged consoles', async () => {
    const customer = await nativeCustomer();
    const authorization = `Bearer ${customer.credential.token}`;
    for (const scope of ['DEALER', 'ADMIN'] as const) {
      const privileged = await createSessionService(h.prisma).issue({
        userId: customer.customer.id,
        scope,
      });
      await h
        .agent()
        .get('/v1/auth/native/customer/me')
        .set('Authorization', `Bearer ${privileged.token}`)
        .expect(401);
    }
    await h.agent().get('/v1/saved-vehicles').set('Authorization', authorization).expect(200);
    await h.agent().get('/v1/enquiries').set('Authorization', authorization).expect(200);
    await h.agent().get('/v1/support/tickets').set('Authorization', authorization).expect(200);
    await h
      .agent()
      .get('/v1/legal/customer/status')
      .set('Authorization', authorization)
      .expect(200);
    for (const path of [
      '/v1/auth/workspaces',
      '/v1/invitations',
      '/v1/auth/me',
      '/v1/dealer/me',
      '/v1/admin/dealers',
      '/v1/sales/dealers',
    ]) {
      const res = await h.agent().get(path).set('Authorization', authorization);
      expect([401, 403, 404]).toContain(res.status);
    }
  });
  it('keeps native and cookie credentials apart, even for a person who is also a dealer member', async () => {
    const customer = await nativeCustomer();
    const { listing } = await createListingsTestKit(h.prisma).vehicleWithListing();
    await h.prisma.dealerMember.create({
      data: {
        dealerId: listing.dealerId,
        userId: customer.customer.id,
        role: 'OWNER',
        permissions: [],
      },
    });
    const bearer = `Bearer ${customer.credential.token}`;
    await h.agent().get('/v1/enquiries').set('Authorization', bearer).expect(200);
    for (const path of [
      '/v1/dealer/me',
      '/v1/auth/workspaces',
      '/v1/invitations',
      '/v1/auth/me',
      '/v1/auth/customer/me',
      '/v1/enquiries',
    ]) {
      const res = await h
        .agent()
        .get(path)
        .set('Cookie', `dd_session=${customer.credential.token}`);
      expect(res.status, path).toBe(401);
    }
    const sessions = createSessionService(h.prisma);
    const web = await sessions.issue({ userId: customer.customer.id, scope: 'CUSTOMER' });
    await h
      .agent()
      .get('/v1/auth/native/customer/me')
      .set('Authorization', `Bearer ${web.token}`)
      .expect(401);
    await h.agent().get('/v1/enquiries').set('Authorization', `Bearer ${web.token}`).expect(401);
    await h
      .agent()
      .post('/v1/auth/native/customer/logout')
      .set('Authorization', `Bearer ${web.token}`)
      .expect(204);
    await h.agent().get('/v1/enquiries').set('Cookie', `dd_session=${web.token}`).expect(200);
  });
  it('leaves web cookie sessions alone and still lets apps sign out while native sign-in is off', async () => {
    const customer = await nativeCustomer();
    const web = await createSessionService(h.prisma).issue({
      userId: customer.customer.id,
      scope: 'CUSTOMER',
    });
    env.NATIVE_CUSTOMER_AUTH_ENABLED = false;
    try {
      await h
        .agent()
        .get('/v1/auth/customer/me')
        .set('Authorization', 'Basic c3RhZ2luZzpnYXRl')
        .set('Cookie', `dd_session=${web.token}`)
        .expect(200);
      await h
        .agent()
        .get('/v1/enquiries')
        .set('Authorization', `Bearer ${customer.credential.token}`)
        .expect(401);
      await h
        .agent()
        .post('/v1/auth/native/customer/logout')
        .set('Authorization', `Bearer ${customer.credential.token}`)
        .expect(204);
    } finally {
      env.NATIVE_CUSTOMER_AUTH_ENABLED = true;
    }
    await h
      .agent()
      .get('/v1/auth/native/customer/me')
      .set('Authorization', `Bearer ${customer.credential.token}`)
      .expect(401);
  });
  it('rejects foreign/invalid/expired/revoked credentials and never falls back from a bad bearer to a cookie', async () => {
    const first = await nativeCustomer();
    const second = await nativeCustomer();
    const ticket = await h
      .agent()
      .post('/v1/support/tickets')
      .set('Authorization', `Bearer ${first.credential.token}`)
      .send({
        category: 'ACCOUNT_ISSUE',
        subject: 'Customer privacy request',
        description: 'Please help with my customer account and privacy settings.',
      })
      .expect(201);
    await h
      .agent()
      .get(`/v1/support/tickets/${CustomerSupportTicket.parse(ticket.body).id}`)
      .set('Authorization', `Bearer ${second.credential.token}`)
      .expect(404);
    const ownTicketId = CustomerSupportTicket.parse(ticket.body).id;
    await cache.reset();
    const webSignIn = await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone: first.phone,
        accessToken: `dev-otp:91${first.phone}:${env.PHONE_OTP_DEV_CODE}:web-support`,
      })
      .expect(200);
    const webCookie = [webSignIn.headers['set-cookie']]
      .flat()
      .find((cookie) => cookie?.startsWith('dd_session='))
      ?.split(';')[0];
    expect(webCookie).toBeDefined();
    await h
      .agent()
      .get(`/v1/support/tickets/${ownTicketId}`)
      .set('Cookie', `dd_session=${first.credential.token}`)
      .expect(401);
    await h
      .agent()
      .get(`/v1/support/tickets/${ownTicketId}`)
      .set('Cookie', webCookie ?? '')
      .expect(200);
    await h
      .agent()
      .post(`/v1/support/tickets/${ownTicketId}/messages`)
      .set('Cookie', webCookie ?? '')
      .send({ message: 'A reply sent through the website session.' })
      .expect(201);
    const nativeConversation = await h
      .agent()
      .get(`/v1/support/tickets/${ownTicketId}`)
      .set('Authorization', `Bearer ${first.credential.token}`)
      .expect(200);
    expect(CustomerSupportTicket.parse(nativeConversation.body).messages).toHaveLength(1);
    await h
      .agent()
      .post(`/v1/support/tickets/${ownTicketId}/messages`)
      .set('Authorization', `Bearer ${second.credential.token}`)
      .send({ message: 'A foreign native reply must be denied.' })
      .expect(404);
    await h
      .agent()
      .get('/v1/support/tickets/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${first.credential.token}`)
      .expect(404);
    await h
      .agent()
      .get('/v1/auth/customer/me')
      .set('Authorization', 'Bearer invalid')
      .set('Cookie', `dd_session=${second.credential.token}`)
      .expect(401);
    await h
      .agent()
      .get('/v1/auth/native/customer/me')
      .set('Cookie', `dd_session=${second.credential.token}`)
      .expect(401);
    const { createHash } = await import('node:crypto');
    await h.prisma.session.updateMany({
      where: { tokenHash: createHash('sha256').update(first.credential.token).digest('hex') },
      data: { expiresAt: new Date(0) },
    });
    await h
      .agent()
      .get('/v1/auth/native/customer/me')
      .set('Authorization', `Bearer ${first.credential.token}`)
      .expect(401);
    await h
      .agent()
      .post('/v1/auth/native/customer/logout')
      .set('Authorization', `Bearer ${second.credential.token}`)
      .expect(204);
    await h
      .agent()
      .get('/v1/auth/native/customer/me')
      .set('Authorization', `Bearer ${second.credential.token}`)
      .expect(401);
  });
  it('refuses signed challenge replay, tamper, unknown fields and unapproved browser Origin', async () => {
    const created = await nativeCustomer();
    await h
      .agent()
      .post('/v1/auth/native/customer/otp/verify')
      .send({ challenge: created.challenge.challenge, otp: env.PHONE_OTP_DEV_CODE })
      .expect(422);
    await h
      .agent()
      .post('/v1/auth/native/customer/otp/verify')
      .send({ challenge: created.challenge.challenge + 'x', otp: env.PHONE_OTP_DEV_CODE })
      .expect(422);
    await h
      .agent()
      .post('/v1/auth/native/customer/otp')
      .send({ phone: '9845607000', dealerId: created.customer.id })
      .expect(400);
    await h
      .agent()
      .post('/v1/auth/native/customer/otp')
      .set('Origin', 'https://untrusted.example')
      .send({ phone: '9845607000' })
      .expect(403);
  });
  it('keeps credentials and policy drafts behind their independent deployment/publication gates', async () => {
    const publication = await h.agent().get('/v1/legal/publication').expect(200);
    expect(publication.headers['cache-control']).toBe('no-store');
    expect(LegalPublication.parse(publication.body).state).toBe('DRAFT');
    const oldAppEnv = env.APP_ENV;
    try {
      env.APP_ENV = 'production';
      const production = await h.agent().get('/v1/legal/publication').expect(200);
      expect(LegalPublication.parse(production.body)).toEqual({
        state: 'UNAVAILABLE',
        collectionEnabled: false,
        documents: [],
        sharing: null,
      });
      await h
        .agent()
        .post('/v1/auth/native/customer/otp')
        .send({ phone: '9845607000' })
        .expect(503);
    } finally {
      env.APP_ENV = oldAppEnv;
    }
    env.NATIVE_CUSTOMER_AUTH_ENABLED = false;
    try {
      await h
        .agent()
        .post('/v1/auth/native/customer/otp')
        .send({ phone: '9845607000' })
        .expect(503);
    } finally {
      env.NATIVE_CUSTOMER_AUTH_ENABLED = true;
    }
  });
});

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return { ...actual, env: { ...actual.env } };
});
