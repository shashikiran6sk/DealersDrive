import type { ListingStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R67 — the dashboard and the session count real enquiries.
 *
 * Until R64 there was no `enquiries` table, so the dashboard's New enquiries
 * tile, its Recent enquiries panel and the session's `counts.newEnquiries`
 * answered zero. These pin that each now reads the dealership's own rows, and
 * only its own.
 */
let h: AuthHarness;
let counter = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

async function customer(fullName: string) {
  counter += 1;
  const agent = h.agent();
  const phone = `98488${String(10000 + counter).slice(-5)}`;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:counts-${String(counter)}`,
    })
    .expect(200);
  await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, phone: `+91${phone}` };
}

async function car(owner: Dealership, status: ListingStatus = 'ACTIVE') {
  counter += 1;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.dealerId,
      registrationNumber: `TN23CT${String(1000 + counter)}`,
      rtoCode: 'TN23',
      make: 'Tata',
      model: 'Nexon',
      manufacturingYear: 2021,
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: owner.dealerId,
      status,
      slug: `2021-tata-nexon-counts-${String(counter)}-${Date.now().toString(36)}`,
      publishedAt: new Date(),
    },
  });
  return listing.slug ?? '';
}

async function enquire(agent: ReturnType<AuthHarness['agent']>, slug: string): Promise<string> {
  const res = await agent.post('/v1/enquiries').send({ listingSlug: slug }).expect(201);
  return String(res.body.id);
}

describe('the dashboard and the session count real enquiries', () => {
  it('shows this week’s new enquiries, the newest few, and the new count in the session', async () => {
    const fixtures = marketplaceFixtures(h, 'counts');
    const mine = await fixtures.dealership();
    const other = await fixtures.dealership();

    const asha = await customer('Asha Menon');
    const bala = await customer('Bala');
    const spammer = await customer('Spam Sender');
    await enquire(asha.agent, await car(mine));
    const contacted = await enquire(bala.agent, await car(mine));
    const spam = await enquire(spammer.agent, await car(mine));
    await enquire((await customer('Elsewhere')).agent, await car(other));

    await mine.agent
      .patch(`/v1/dealer/enquiries/${contacted}`)
      .send({ status: 'CONTACTED' })
      .expect(200);
    await mine.agent.patch(`/v1/dealer/enquiries/${spam}`).send({ status: 'SPAM' }).expect(200);

    const { body: dashboard } = await mine.agent.get('/v1/dealer/dashboard').expect(200);
    const tile = dashboard.stats.find((stat: { key: string }) => stat.key === 'newEnquiries');
    expect(tile).toMatchObject({ value: 1, valueLabel: '1' });
    expect(dashboard.recentEnquiries.map((row: { name: string }) => row.name)).toEqual([
      'Bala',
      'Asha Menon',
    ]);
    expect(dashboard.recentEnquiries[1]).toMatchObject({
      initials: 'AM',
      vehicleTitle: '2021 Tata Nexon',
      phoneDisplay: `+91 ${asha.phone.slice(3, 8)} ${asha.phone.slice(8)}`,
      callHref: `tel:${asha.phone}`,
    });

    const { body: me } = await mine.agent.get('/v1/auth/me').expect(200);
    expect(me.counts.newEnquiries).toBe(1);
  });

  it('counts none of another dealership’s', async () => {
    const lonely = await marketplaceFixtures(h, 'counts-empty').dealership();
    await enquire(
      (await customer('Not Theirs')).agent,
      await car(await marketplaceFixtures(h, 'counts-busy').dealership()),
    );

    const { body: dashboard } = await lonely.agent.get('/v1/dealer/dashboard').expect(200);
    expect(dashboard.recentEnquiries).toEqual([]);
    expect(
      dashboard.stats.find((stat: { key: string }) => stat.key === 'newEnquiries')?.value,
    ).toBe(0);
    expect((await lonely.agent.get('/v1/auth/me').expect(200)).body.counts.newEnquiries).toBe(0);
  });
});
