import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * Submission and resubmission (**F065**, as revised by **R47**), end to end.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let a: Dealership;
let b: Dealership;

let plate = 2000;
function nextPlate(): string {
  plate += 1;
  return `TN 10 SB ${String(plate)}`;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'submission');
  a = await fixtures.dealership();
  b = await fixtures.dealership();
});

afterAll(async () => {
  await h.close();
});

async function vehicle(owner: Dealership = a, registrationNumber = nextPlate(), complete = true) {
  const created = await owner.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber })
    .expect(201);
  if (complete) {
    await owner.agent
      .patch(`/v1/dealer/vehicles/${created.body.id}`)
      .send(COMPLETE_VEHICLE)
      .expect(200);
  }
  return created.body.id as string;
}

describe('submitting', () => {
  it('moves a complete draft to PENDING_REVIEW and audits it', async () => {
    const id = await vehicle();
    const submitted = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);

    expect(submitted.body.listing).toMatchObject({
      status: 'PENDING_REVIEW',
      statusLabel: 'Pending review',
      canEdit: false,
      canSubmit: false,
      canDelete: false,
    });
    expect(submitted.body.listing.submittedAt).toEqual(expect.any(String));

    const audit = await h.prisma.auditLog.findFirst({
      where: { action: 'listing.submitted', entityId: submitted.body.listing.id },
    });
    expect(audit).toMatchObject({ actorType: 'DEALER', actorId: a.userId, dealerId: a.dealerId });
  });

  it('refuses an incomplete vehicle with every missing field named', async () => {
    const id = await vehicle(a, nextPlate(), false);
    const refused = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(422);

    expect(refused.body.code).toBe('VEHICLE_INCOMPLETE');
    expect(refused.body.errors.map((error: { field: string }) => error.field)).toEqual(
      expect.arrayContaining(['make', 'model', 'pricePaise']),
    );
    const stored = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    expect(stored.status).toBe('DRAFT');
  });

  it('refuses a second submit as a conflict, and counts the first once', async () => {
    const id = await vehicle();
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    const again = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(409);

    expect(again.body.code).toBe('LISTING_NOT_SUBMITTABLE');
    const stored = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    expect(stored.submissionCount).toBe(1);
  });

  it('lets exactly one of two simultaneous submits through', async () => {
    const id = await vehicle();
    const results = await Promise.all([
      a.agent.post(`/v1/dealer/vehicles/${id}/submit`),
      a.agent.post(`/v1/dealer/vehicles/${id}/submit`),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  });

  it('rejects a client-selected state and accepts an empty submission', async () => {
    const id = await vehicle();
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).send({ status: 'ACTIVE' }).expect(400);
    const unchanged = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    expect(unchanged.status).toBe('DRAFT');
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    const stored = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    expect(stored.status).toBe('PENDING_REVIEW');
  });
});

describe('who may submit', () => {
  it('refuses another dealership’s vehicle as not found', async () => {
    const id = await vehicle(a);
    const refused = await b.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(404);
    expect(refused.body.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('refuses a dealership that is not yet approved', async () => {
    const pending = await fixtures.dealership('PENDING_APPROVAL');
    const id = await vehicle(pending);
    const refused = await pending.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(403);
    expect(refused.body.code).toBe('DEALER_NOT_ACTIVE');
  });

  it('refuses STAFF', async () => {
    const staff = await fixtures.dealership();
    const id = await vehicle(staff);
    await h.prisma.dealerMember.updateMany({
      where: { dealerId: staff.dealerId },
      data: { role: 'STAFF' },
    });
    await staff.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(403);
  });

  it('needs a session', async () => {
    const id = await vehicle();
    await h.agent().post(`/v1/dealer/vehicles/${id}/submit`).expect(401);
  });
});

describe('one car on the marketplace once', () => {
  it('refuses a second dealership submitting a car already in review', async () => {
    const registrationNumber = nextPlate();
    const first = await vehicle(a, registrationNumber);
    await a.agent.post(`/v1/dealer/vehicles/${first}/submit`).expect(200);

    const second = await vehicle(b, registrationNumber);
    const refused = await b.agent.post(`/v1/dealer/vehicles/${second}/submit`).expect(409);

    expect(refused.body.code).toBe('DUPLICATE_REGISTRATION');
    expect(JSON.stringify(refused.body)).not.toContain(a.slug);
    const stored = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: second } });
    expect(stored.status).toBe('DRAFT');
  });

  it('lets the car be submitted again once the first listing is released', async () => {
    const registrationNumber = nextPlate();
    const first = await vehicle(a, registrationNumber);
    await a.agent.post(`/v1/dealer/vehicles/${first}/submit`).expect(200);
    await h.prisma.$transaction([
      h.prisma.listing.update({ where: { vehicleId: first }, data: { status: 'REJECTED' } }),
      h.prisma.vehicle.update({ where: { id: first }, data: { releasedAt: new Date() } }),
    ]);

    const second = await vehicle(b, registrationNumber);
    await b.agent.post(`/v1/dealer/vehicles/${second}/submit`).expect(200);
  });
});

describe('resubmitting after changes are requested', () => {
  it('edits, resubmits and counts the second submission', async () => {
    const id = await vehicle();
    await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);
    await h.prisma.listing.update({
      where: { vehicleId: id },
      data: { status: 'CHANGES_REQUESTED', decisionReason: 'The variant is SX, not SX(O).' },
    });

    await a.agent.patch(`/v1/dealer/vehicles/${id}`).send({ variant: 'SX' }).expect(200);
    const resubmitted = await a.agent.post(`/v1/dealer/vehicles/${id}/submit`).expect(200);

    expect(resubmitted.body.listing.status).toBe('PENDING_REVIEW');
    const stored = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: id } });
    expect(stored.submissionCount).toBe(2);
    const actions = await h.prisma.auditLog.findMany({
      where: { entityId: stored.id },
      orderBy: { id: 'asc' },
      select: { action: true },
    });
    expect(actions.map((row) => row.action)).toContain('listing.resubmitted');
  });
});
