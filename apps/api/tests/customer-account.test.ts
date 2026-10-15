import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import {
  CustomerSignInResponse,
  NativeCustomerSignIn,
  NativeCustomerSignUp,
  NativeOtpChallenge,
  ENQUIRY_NOTICE_VERSION,
} from '@dealers-drive/contracts';
import type * as EnvModule from '../src/config/env.js';
import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { createMemoryCache } from '../src/platform/cache/memory.adapter.js';
import { createSessionService } from '../src/modules/auth/session.service.js';
import {
  SHARING_PURPOSE,
  SHARING_CATEGORIES,
  SHARING_SCOPE_DIGEST,
  SHARING_NOTICE_DIGEST,
} from '../src/modules/legal/contact-sharing.js';

let h: AuthHarness;
let sequence = 0;
const cache = createMemoryCache();
beforeAll(async () => {
  env.NATIVE_CUSTOMER_AUTH_ENABLED = true;
  h = await createAuthHarness(createFakeGoogle(), undefined, { cache });
});
afterAll(async () => {
  await h.close();
});
async function customer() {
  const phone = `95566${String(++sequence).padStart(5, '0')}`;
  const agent = h.agent();
  const proof = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:${randomUUID()}` })
    .expect(200);
  const signup = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proof.body.signUpToken, fullName: 'Account Customer' })
    .expect(201);
  return { agent, phone, id: signup.body.customer.id as string };
}
async function verify(phone: string) {
  return CustomerSignInResponse.parse(
    (
      await h
        .agent()
        .post('/v1/auth/sign-in/phone/customer')
        .send({
          phone,
          accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:${randomUUID()}`,
        })
        .expect(200)
    ).body,
  );
}
async function deactivate(who: Awaited<ReturnType<typeof customer>>) {
  return who.agent
    .post('/v1/auth/customer/account/deactivate')
    .send({ confirmed: true })
    .expect(200);
}

describe('customer-only reversible account access', () => {
  it('never treats an old session, wrong method or changed phone verification as fresh customer OTP', async () => {
    const who = await customer();
    const sessions = createSessionService(h.prisma);
    for (const input of [
      {},
      { authenticationMethod: 'PHONE_OTP' as const },
      { authenticationMethod: 'GOOGLE' as const, authenticatedAt: new Date() },
      { authenticationMethod: 'PHONE_OTP' as const, authenticatedAt: new Date(Date.now() + 60000) },
    ]) {
      const issued = await sessions.issue({ userId: who.id, scope: 'CUSTOMER', ...input });
      const reply = await h
        .agent()
        .get('/v1/auth/customer/account')
        .set('Authorization', `Bearer ${issued.token}`)
        .expect(200);
      expect(reply.body.canDeactivate).toBe(false);
      await h
        .agent()
        .post('/v1/auth/customer/account/deactivate')
        .set('Authorization', `Bearer ${issued.token}`)
        .send({ confirmed: true })
        .expect(403);
    }
    await h.prisma.user.update({ where: { id: who.id }, data: { phoneVerifiedAt: new Date() } });
    expect((await who.agent.get('/v1/auth/customer/account').expect(200)).body.canDeactivate).toBe(
      false,
    );
    await who.agent
      .post('/v1/auth/customer/account/deactivate')
      .send({ confirmed: true })
      .expect(403);
  });
  it('requires authenticated fresh customer OTP and explicit strict confirmation', async () => {
    await h.agent().get('/v1/auth/customer/account').expect(401);
    const who = await customer();
    expect((await who.agent.get('/v1/auth/customer/account').expect(200)).body.canDeactivate).toBe(
      true,
    );
    await who.agent
      .post('/v1/auth/customer/account/deactivate')
      .send({ confirmed: false })
      .expect(400);
    await who.agent
      .post('/v1/auth/customer/account/deactivate')
      .send({ confirmed: true, userId: randomUUID() })
      .expect(400);
    await who.agent
      .post('/v1/auth/customer/account/deactivate')
      .set('Origin', 'https://evil.example')
      .send({ confirmed: true })
      .expect(403);
    await h.prisma.session.updateMany({
      where: { userId: who.id, scope: 'CUSTOMER' },
      data: { authenticatedAt: new Date(Date.now() - 3600000) },
    });
    expect((await who.agent.get('/v1/auth/customer/account').expect(200)).body.canDeactivate).toBe(
      false,
    );
    await who.agent
      .post('/v1/auth/customer/account/deactivate')
      .send({ confirmed: true })
      .expect(403);
    expect(
      (await h.prisma.user.findUniqueOrThrow({ where: { id: who.id } })).customerDeactivatedAt,
    ).toBeNull();
  });
  it('retains records, withdraws scoped and legacy disclosure, revokes customer sessions and preserves privileged roles', async () => {
    const who = await customer();
    const dealer = await h.prisma.dealer.findFirstOrThrow();
    const vehicle = await h.prisma.vehicle.create({
      data: {
        dealerId: dealer.id,
        registrationNumber: `KA01AC${String(sequence).padStart(4, '0')}`,
      },
    });
    const listing = await h.prisma.listing.create({
      data: {
        dealerId: dealer.id,
        vehicleId: vehicle.id,
        status: 'ACTIVE',
        slug: `account-car-${sequence}`,
      },
    });
    const grant = await h.prisma.contactSharingEvent.create({
      data: {
        customerId: who.id,
        actorId: who.id,
        dealerId: dealer.id,
        action: 'GRANT',
        purpose: SHARING_PURPOSE,
        dataCategories: SHARING_CATEGORIES,
        scopeDigest: SHARING_SCOPE_DIGEST,
        noticeDigest: SHARING_NOTICE_DIGEST,
        noticeVersion: ENQUIRY_NOTICE_VERSION,
        eventKey: randomUUID(),
      },
    });
    const linked = await h.prisma.enquiry.create({
      data: {
        customerId: who.id,
        dealerId: dealer.id,
        listingId: listing.id,
        sharingGrantId: grant.id,
      },
    });
    const legacy = await h.prisma.enquiry.create({
      data: { customerId: who.id, dealerId: dealer.id, listingId: listing.id },
    });
    await h.prisma.savedVehicle.create({ data: { customerId: who.id, listingId: listing.id } });
    await who.agent
      .post('/v1/support/tickets')
      .send({
        category: 'ACCOUNT_ISSUE',
        subject: 'Retained account request',
        description: 'Please retain the account request conversation.',
      })
      .expect(201);
    await h.prisma.user.update({
      where: { id: who.id },
      data: {
        email: `dual.account.${sequence}@example.test`,
        emailVerifiedAt: new Date(),
        isPlatformAdmin: true,
        adminRole: 'SUPER_ADMIN',
      },
    });
    await h.prisma.userRole.createMany({
      data: [
        { userId: who.id, role: 'DEALER' },
        { userId: who.id, role: 'ADMIN' },
      ],
    });
    await h.prisma.dealerMember.create({
      data: { userId: who.id, dealerId: dealer.id, role: 'STAFF', status: 'ACTIVE' },
    });
    await h.prisma.adminMember.create({
      data: { userId: who.id, role: 'SUPER_ADMIN', status: 'ACTIVE', source: 'INVITED' },
    });
    const sessions = createSessionService(h.prisma);
    const native = await sessions.issue({
      userId: who.id,
      scope: 'CUSTOMER',
      authenticationMethod: 'PHONE_OTP',
    });
    const dealerSession = await sessions.issue({ userId: who.id, scope: 'DEALER' });
    const adminSession = await sessions.issue({ userId: who.id, scope: 'ADMIN' });
    await deactivate(who);
    await h
      .agent()
      .get('/v1/saved-vehicles')
      .set('Authorization', `Bearer ${native.token}`)
      .expect(401);
    const user = await h.prisma.user.findUniqueOrThrow({ where: { id: who.id } });
    expect(user.status).toBe('ACTIVE');
    expect(user.customerDeactivatedAt).not.toBeNull();
    expect(
      await h.prisma.session.count({
        where: { userId: who.id, scope: 'CUSTOMER', revokedAt: null },
      }),
    ).toBe(0);
    await h
      .agent()
      .get('/v1/auth/me')
      .set('Cookie', `dd_session=${dealerSession.token}`)
      .expect(200);
    await h
      .agent()
      .get('/v1/auth/workspaces')
      .set('Cookie', `dd_session=${dealerSession.token}`)
      .expect(200);
    await h
      .agent()
      .get('/v1/invitations')
      .set('Cookie', `dd_session=${dealerSession.token}`)
      .expect(200);
    await h
      .agent()
      .get('/v1/admin/dealers')
      .set('Cookie', `dd_admin_session=${adminSession.token}`)
      .expect(200);
    await h
      .agent()
      .get('/v1/saved-vehicles')
      .set('Cookie', `dd_session=${dealerSession.token}`)
      .expect(401);
    expect(await h.prisma.savedVehicle.count({ where: { customerId: who.id } })).toBe(1);
    expect(await h.prisma.supportTicket.count({ where: { customerId: who.id } })).toBe(1);
    for (const id of [linked.id, legacy.id])
      expect(
        (await h.prisma.enquiry.findUniqueOrThrow({ where: { id } })).sharingWithdrawnAt,
      ).not.toBeNull();
    expect(
      await h.prisma.contactSharingEvent.count({
        where: { withdrawnGrantId: grant.id, action: 'WITHDRAW' },
      }),
    ).toBe(1);
    const result = await verify(who.phone);
    expect(result.status).toBe('REACTIVATION_REQUIRED');
    await h
      .agent()
      .post('/v1/auth/customer/reactivate')
      .send({ reactivationToken: result.reactivationToken, confirmed: false })
      .expect(400);
    const reactivated = await h
      .agent()
      .post('/v1/auth/customer/reactivate')
      .send({ reactivationToken: result.reactivationToken, confirmed: true })
      .expect(200);
    expect(reactivated.body.customer.id).toBe(who.id);
    expect(
      (await h.prisma.user.findUniqueOrThrow({ where: { id: who.id } })).customerDeactivatedAt,
    ).toBeNull();
    expect(
      await h.prisma.contactSharingEvent.count({
        where: { withdrawnGrantId: grant.id, action: 'WITHDRAW' },
      }),
    ).toBe(1);
    expect(
      (await h.prisma.enquiry.findUniqueOrThrow({ where: { id: legacy.id } })).sharingWithdrawnAt,
    ).not.toBeNull();
    await h
      .agent()
      .post('/v1/auth/customer/reactivate')
      .send({ reactivationToken: result.reactivationToken, confirmed: true })
      .expect(422);
  });
  it('uses the same native identity and issues no credential or cookie before reactivation confirmation', async () => {
    const who = await customer();
    await deactivate(who);
    await cache.reset();
    const sent = NativeOtpChallenge.parse(
      (await h.agent().post('/v1/auth/native/customer/otp').send({ phone: who.phone }).expect(200))
        .body,
    );
    const verified = await h
      .agent()
      .post('/v1/auth/native/customer/otp/verify')
      .send({ challenge: sent.challenge, otp: env.PHONE_OTP_DEV_CODE })
      .expect(200);
    expect(verified.headers['set-cookie']).toBeUndefined();
    const pending = NativeCustomerSignIn.parse(verified.body);
    expect(pending.status).toBe('REACTIVATION_REQUIRED');
    expect(pending).not.toHaveProperty('credential');
    if (pending.status !== 'REACTIVATION_REQUIRED')
      throw new Error('Expected reactivation confirmation');
    const response = await h
      .agent()
      .post('/v1/auth/native/customer/reactivate')
      .send({ reactivationToken: pending.reactivationToken, confirmed: true })
      .expect(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    const restored = NativeCustomerSignUp.parse(response.body);
    expect(restored.customer.id).toBe(who.id);
    await h
      .agent()
      .get('/v1/auth/customer/me')
      .set('Authorization', `Bearer ${restored.credential.token}`)
      .expect(200);
  });
  it('never lets a verified reactivation ticket clear an administrative suspension or changed phone', async () => {
    const who = await customer();
    await deactivate(who);
    const pending = await verify(who.phone);
    await h.prisma.userRole.update({
      where: { userId_role: { userId: who.id, role: 'CUSTOMER' } },
      data: { status: 'SUSPENDED' },
    });
    await h
      .agent()
      .post('/v1/auth/customer/reactivate')
      .send({ reactivationToken: pending.reactivationToken, confirmed: true })
      .expect(403);
    expect(
      (await h.prisma.user.findUniqueOrThrow({ where: { id: who.id } })).customerDeactivatedAt,
    ).not.toBeNull();
    const other = await customer();
    await deactivate(other);
    const ticket = await verify(other.phone);
    await h.prisma.user.update({
      where: { id: other.id },
      data: { phone: null, phoneVerifiedAt: null },
    });
    await h
      .agent()
      .post('/v1/auth/customer/reactivate')
      .send({ reactivationToken: ticket.reactivationToken, confirmed: true })
      .expect(403);
    await h
      .agent()
      .post('/v1/auth/customer/reactivate')
      .send({ reactivationToken: 'tampered', confirmed: true })
      .expect(422);
  });
});

vi.mock('../src/config/env.js', async (original) => {
  const actual = await original<typeof EnvModule>();
  return { ...actual, env: { ...actual.env } };
});
