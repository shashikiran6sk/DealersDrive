import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R95 — the API offers each member only the moves their role allows.
 *
 * `actions`, `canSubmit` and `canDelete` on a dealer's vehicle are the
 * console's buttons. They were computed from the listing's status alone; now
 * the member's permissions narrow them too, so the inventory a STAFF member
 * sees has no Reserve, Sell or Withdraw at all — and the routes refuse those
 * moves regardless (R92). The inbox says who contacted and who closed.
 */
let h: AuthHarness;
let owner: Dealership;
let manager: Dealership;
let staff: Dealership;
let counter = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'role-actions');
  owner = await fixtures.dealership();
  manager = await fixtures.member(owner, 'MANAGER');
  staff = await fixtures.member(owner, 'STAFF');
});

afterAll(async () => {
  await h.close();
});

async function activeCar(): Promise<string> {
  counter += 1;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.dealerId,
      registrationNumber: `TN51RA${String(1000 + counter)}`,
      make: 'Kia',
      model: 'Seltos',
    },
  });
  await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: owner.dealerId,
      status: 'ACTIVE',
      slug: `kia-seltos-roles-${String(counter)}-${Date.now().toString(36)}`,
      publishedAt: new Date(),
    },
  });
  return vehicle.id;
}

async function completeDraft(): Promise<string> {
  counter += 1;
  const created = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `TN 51 RB ${String(1000 + counter)}` })
    .expect(201);
  await owner.agent
    .patch(`/v1/dealer/vehicles/${String(created.body.id)}`)
    .send(COMPLETE_VEHICLE)
    .expect(200);
  return String(created.body.id);
}

describe('what a vehicle offers each role', () => {
  it('offers STAFF no lifecycle move on a live car, and the manager all of them', async () => {
    const id = await activeCar();

    const forStaff = await staff.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(forStaff.body.listing.actions).toEqual([]);

    const forManager = await manager.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(forManager.body.listing.actions).toEqual(['reserve', 'markSold', 'withdraw']);

    const forOwner = await owner.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(forOwner.body.listing.actions).toEqual(['reserve', 'markSold', 'withdraw']);
  });

  it('lets STAFF edit a complete draft but never offers them Submit or Delete', async () => {
    const id = await completeDraft();

    const forStaff = await staff.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(forStaff.body.listing).toMatchObject({
      canEdit: true,
      canSubmit: false,
      canDelete: false,
    });

    const forManager = await manager.agent.get(`/v1/dealer/vehicles/${id}`).expect(200);
    expect(forManager.body.listing).toMatchObject({
      canEdit: true,
      canSubmit: true,
      canDelete: true,
    });
  });

  it('narrows the inventory rows the same way', async () => {
    const id = await activeCar();
    const rows = async (who: Dealership) => {
      const res = await who.agent.get('/v1/dealer/vehicles?status=ACTIVE').expect(200);
      return (res.body.data as { id: string; actions: string[] }[]).find((row) => row.id === id);
    };
    expect((await rows(staff))?.actions).toEqual([]);
    expect((await rows(manager))?.actions).toEqual(['reserve', 'markSold', 'withdraw']);
  });

  it('answers the move it just made with the role’s own view', async () => {
    const id = await activeCar();
    const reserved = await manager.agent
      .post(`/v1/dealer/vehicles/${id}/reserve`)
      .send({})
      .expect(200);
    expect(reserved.body.listing.actions).toEqual(['markSold', 'requestReactivation']);
  });
});

describe('who moved an enquiry', () => {
  it('names the member who contacted it and the one who closed it', async () => {
    counter += 1;
    const id = await activeCar();
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    const phone = `94411${String(10000 + counter).slice(-5)}`;
    const buyer = h.agent();
    const proved = await buyer
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:role-actions-${String(counter)}`,
      })
      .expect(200);
    await buyer
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: proved.body.signUpToken, fullName: 'Meena' })
      .expect(201);
    const sent = await buyer
      .post('/v1/enquiries')
      .send({ listingSlug: listing.slug ?? '' })
      .expect(201);
    const enquiryId = String(sent.body.id);

    const untouched = await owner.agent.get('/v1/dealer/enquiries?status=NEW').expect(200);
    expect(untouched.body.data.find((row: { id: string }) => row.id === enquiryId)).toMatchObject({
      contactedBy: null,
      closedBy: null,
    });

    const contacted = await staff.agent
      .patch(`/v1/dealer/enquiries/${enquiryId}`)
      .send({ status: 'CONTACTED' })
      .expect(200);
    expect(contacted.body.contactedBy).toEqual({
      name: expect.stringMatching(/^Staff/),
      atLabel: expect.stringMatching(/^\d{2} \w{3} \d{4}, \d{2}:\d{2}$/),
    });

    const closed = await manager.agent
      .patch(`/v1/dealer/enquiries/${enquiryId}`)
      .send({ status: 'CLOSED' })
      .expect(200);
    expect(closed.body.contactedBy.name).toMatch(/^Staff/);
    expect(closed.body.closedBy.name).toMatch(/^Manager/);
  });
});
