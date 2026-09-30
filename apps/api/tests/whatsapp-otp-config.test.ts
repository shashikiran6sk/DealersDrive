import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * WhatsApp OTP is a platform setting (`otp.whatsappEnabled`), switched on the
 * admin Configuration page and read by the two widget endpoints on every
 * request. The suite runs the `fake` driver, which sends nothing either way —
 * what is asserted is the decision: who may change it, that it persists, that
 * the widget reports it, and that a code proves a handset exactly as before.
 */
const KEY = '/v1/admin/config/otp.whatsappEnabled';

let h: AuthHarness;
let admin: request.Agent;
let dealer: Dealership;
let phones = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'whatsapp-otp');
  admin = await fixtures.moderator();
  dealer = await fixtures.dealership();
});

afterAll(async () => {
  await admin.put(KEY).send({ value: false });
  await h.close();
});

function freeNumber(): string {
  phones += 1;
  return `97311${String(10000 + phones).slice(-5)}`;
}

async function channel(): Promise<string> {
  const { body } = await h.agent().get('/v1/auth/sign-in/phone/widget').expect(200);
  return body.channel as string;
}

async function customer(): Promise<request.Agent> {
  const agent = h.agent();
  const phone = freeNumber();
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:wa-${phone}` })
    .expect(200);
  await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName: 'Anitha' })
    .expect(201);
  return agent;
}

describe('the admin setting', () => {
  it('is off by default, and listed on the Configuration page as a boolean', async () => {
    expect(await channel()).toBe('sms');
    const { body } = await admin.get('/v1/admin/config').expect(200);
    const entries: { key: string; type: string; value: unknown }[] = body.data;
    expect(entries.find((entry) => entry.key === 'otp.whatsappEnabled')).toMatchObject({
      type: 'boolean',
      value: false,
    });
  });

  it('lets an admin turn WhatsApp OTP on, persists it, and the widget follows at once', async () => {
    await admin.put(KEY).send({ value: true }).expect(200);

    const row = await h.prisma.platformConfig.findUniqueOrThrow({
      where: { key: 'otp.whatsappEnabled' },
    });
    expect(row.value).toBe(true);
    expect(await channel()).toBe('whatsapp');
    const { body } = await dealer.agent.get('/v1/auth/phone/widget').expect(200);
    expect(body).toMatchObject({ channel: 'whatsapp', driver: 'fake', devCode: '123456' });
  });

  it('lets an admin turn it off again, back to SMS', async () => {
    await admin.put(KEY).send({ value: true }).expect(200);
    await admin.put(KEY).send({ value: false }).expect(200);
    expect(await channel()).toBe('sms');
  });

  it('refuses a value that is not a boolean', async () => {
    await admin
      .put(KEY)
      .send({ value: 'yes' })
      .expect((res) => {
        expect([400, 422]).toContain(res.status);
      });
    expect(await channel()).toBe('sms');
  });

  it('may not be changed by anybody but an admin', async () => {
    await h.agent().put(KEY).send({ value: true }).expect(401);

    const buyer = await customer();
    const asCustomer = await buyer.put(KEY).send({ value: true });
    expect([401, 403]).toContain(asCustomer.status);

    const asDealer = await dealer.agent.put(KEY).send({ value: true });
    expect([401, 403]).toContain(asDealer.status);

    expect(await channel()).toBe('sms');
    const row = await h.prisma.platformConfig.findUnique({
      where: { key: 'otp.whatsappEnabled' },
    });
    expect(row?.value ?? false).toBe(false);
  });
});

describe('proving a handset, whichever channel carried the code', () => {
  it.each([false, true])('signs a customer in the same way with WhatsApp OTP %s', async (on) => {
    await admin.put(KEY).send({ value: on }).expect(200);
    const phone = freeNumber();
    const good = await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:same-${phone}` })
      .expect(200);
    expect(good.body).toMatchObject({ status: 'NAME_REQUIRED' });

    const wrong = await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({ phone, accessToken: `dev-otp:91${phone}:000000:wrong-${phone}` });
    expect(wrong.status).toBe(422);
    expect(wrong.body.code).toBe('PHONE_VERIFICATION_FAILED');
  });
});
