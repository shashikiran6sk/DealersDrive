import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * The WhatsApp OTP switch: an operator turns `otp.whatsappEnabled` on or off
 * in `/admin/config`, and `GET /v1/config/public` carries the answer as one
 * boolean, which the web app reads to show or hide the WhatsApp logo on the
 * OTP button. Nothing about delivery changes with it.
 */
const KEY = 'otp.whatsappEnabled';

let h: AuthHarness;
let admin: request.Agent;
let dealer: Dealership;

async function publicSwitch(): Promise<unknown> {
  const res = await h.agent().get('/v1/config/public').expect(200);
  return res.body.whatsappOtpEnabled;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'whatsapp-otp');
  dealer = await fixtures.dealership();
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await admin.put(`/v1/admin/config/${KEY}`).send({ value: false });
  await h.close();
});

describe('the WhatsApp OTP switch in admin configuration', () => {
  it('is listed as a boolean, off by default', async () => {
    const res = await admin.get('/v1/admin/config').expect(200);
    const entry = (res.body.data as { key: string; type: string; value: unknown }[]).find(
      (candidate) => candidate.key === KEY,
    );

    expect(entry).toMatchObject({ type: 'boolean', value: false });
    expect(await publicSwitch()).toBe(false);
  });

  it('turns the public flag on and off, and persists each change', async () => {
    await admin.put(`/v1/admin/config/${KEY}`).send({ value: true }).expect(200);
    expect(await publicSwitch()).toBe(true);
    expect((await h.prisma.platformConfig.findUniqueOrThrow({ where: { key: KEY } })).value).toBe(
      true,
    );

    await admin.put(`/v1/admin/config/${KEY}`).send({ value: false }).expect(200);
    expect(await publicSwitch()).toBe(false);
    expect((await h.prisma.platformConfig.findUniqueOrThrow({ where: { key: KEY } })).value).toBe(
      false,
    );
  });

  it('refuses a value that is not a boolean', async () => {
    const res = await admin.put(`/v1/admin/config/${KEY}`).send({ value: 'yes' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.code).toBe('CONFIG_TYPE_MISMATCH');
    expect(await publicSwitch()).toBe(false);
  });

  it('cannot be changed without an admin session', async () => {
    await h.agent().put(`/v1/admin/config/${KEY}`).send({ value: true }).expect(401);

    const asDealer = await dealer.agent.put(`/v1/admin/config/${KEY}`).send({ value: true });
    expect([401, 403]).toContain(asDealer.status);

    expect(await publicSwitch()).toBe(false);
  });

  it('puts no provider setting or credential on the public document', async () => {
    await admin.put(`/v1/admin/config/${KEY}`).send({ value: true }).expect(200);
    const res = await h.agent().get('/v1/config/public').expect(200);

    expect(JSON.stringify(res.body)).not.toMatch(/msg91|authkey|tokenAuth|widgetId|secret/i);
    await admin.put(`/v1/admin/config/${KEY}`).send({ value: false }).expect(200);
  });
});
