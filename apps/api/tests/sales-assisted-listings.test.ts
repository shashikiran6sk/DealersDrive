import { ListingCheckKey } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { seedImages } from './images-kit.js';
import { COMPLETE_VEHICLE } from './marketplace-fixtures.js';

/**
 * R114 — a Sales Representative prepares listings for a dealership they
 * onboarded. Drafts before approval; submission only after it; the ordinary
 * moderation queue; and never a decision by the member who prepared it.
 */
let h: AuthHarness;
let superAdmin: request.Agent;
let sales: request.Agent;
let otherSales: request.Agent;
let moderator: request.Agent;
let salesMemberId: string;
let counter = 0;
let plate = 1000;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  h.google.claims = {
    subject: 'listings-suite-super',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
    name: 'Dealers-Drive Operations',
  };
  superAdmin = h.agent();
  await h.signInAdmin(superAdmin);
  const salesEmail = nextEmail('listing.rep');
  sales = await member(salesEmail, 'SALES_REP');
  otherSales = await member(nextEmail('other.listing.rep'), 'SALES_REP');
  moderator = await member(nextEmail('listing.mod'), 'MODERATOR');
  salesMemberId = (
    await h.prisma.adminMember.findFirstOrThrow({ where: { user: { email: salesEmail } } })
  ).id;
});

afterAll(async () => {
  await h.close();
});

function nextEmail(label: string): string {
  counter += 1;
  return `${label}.${String(counter)}.${Date.now().toString(36)}@dealers-drive.test`;
}

function nextPlate(): string {
  plate += 1;
  return `UP 32 SR ${String(plate)}`;
}

async function member(email: string, role: string): Promise<request.Agent> {
  await superAdmin.post('/v1/admin/members').send({ email, role }).expect(201);
  counter += 1;
  h.google.claims = { subject: `listings-suite-${String(counter)}`, email, emailVerified: true };
  const agent = h.agent();
  await h.signInAdmin(agent);
  return agent;
}

async function assistedDealer(agent: request.Agent = sales): Promise<string> {
  counter += 1;
  const phone = `96644${String(10000 + counter).slice(-5)}`;
  const verified = await agent
    .post('/v1/sales/dealers/phone/verify')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:lst-${String(counter)}`,
      consent: true,
    })
    .expect(200);
  const created = await agent
    .post('/v1/sales/dealers')
    .send({
      phoneTicket: verified.body.phoneTicket,
      contactName: 'Imran K',
      email: `imran.${String(counter)}@gmail.com`,
      legalName: `Listing Motors ${String(counter)} ${Date.now().toString(36)}`,
      addressLine: '9, Hazratganj',
      city: 'Lucknow',
      district: 'Lucknow',
      state: 'Uttar Pradesh',
      pincode: '226001',
      mapsUrl: 'https://maps.app.goo.gl/listing',
      tagline: 'Second-hand SUVs, inspected and serviced.',
      specialities: ['SUVs'],
    })
    .expect(201);
  return created.body.id as string;
}

async function approveDealer(dealerId: string): Promise<void> {
  await h.prisma.dealer.update({
    where: { id: dealerId },
    data: { status: 'ACTIVE', approvedAt: new Date() },
  });
}

async function draft(dealerId: string, agent: request.Agent = sales) {
  const created = await agent
    .post(`/v1/sales/dealers/${dealerId}/vehicles`)
    .send({ registrationNumber: nextPlate() })
    .expect(201);
  const vehicleId = created.body.id as string;
  await agent
    .patch(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}`)
    .send(COMPLETE_VEHICLE)
    .expect(200);
  return vehicleId;
}

describe('drafts', () => {
  it('can be prepared before the dealership is approved, attributed to the member', async () => {
    const dealerId = await assistedDealer();
    const vehicleId = await draft(dealerId);

    const row = await h.prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicleId },
      include: { listing: true },
    });
    expect(row).toMatchObject({ dealerId, createdByMemberId: salesMemberId, createdBy: null });
    expect(row.listing?.status).toBe('DRAFT');

    const list = await sales.get(`/v1/sales/dealers/${dealerId}/vehicles`).expect(200);
    expect(list.body).toMatchObject({ dealerApproved: false, canCreate: true });
    expect(list.body.data.map((vehicle: { id: string }) => vehicle.id)).toEqual([vehicleId]);

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'vehicle.created', entityId: vehicleId },
    });
    expect(audit).toMatchObject({ actorType: 'SALES' });
    expect(audit.after).toMatchObject({ assistedByMemberId: salesMemberId });
  });

  it('cannot be submitted until the dealership is approved', async () => {
    const dealerId = await assistedDealer();
    const vehicleId = await draft(dealerId);
    const refused = await sales
      .post(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}/submit`)
      .expect(409);
    expect(refused.body.code).toBe('DEALER_NOT_APPROVED');
  });

  it('refuses an incomplete vehicle, and a duplicate registration', async () => {
    const dealerId = await assistedDealer();
    await approveDealer(dealerId);
    const registrationNumber = nextPlate();
    const created = await sales
      .post(`/v1/sales/dealers/${dealerId}/vehicles`)
      .send({ registrationNumber })
      .expect(201);
    const incomplete = await sales
      .post(`/v1/sales/dealers/${dealerId}/vehicles/${created.body.id as string}/submit`)
      .expect(422);
    expect(incomplete.body.code).toBe('VEHICLE_INCOMPLETE');

    const duplicate = await sales
      .post(`/v1/sales/dealers/${dealerId}/vehicles`)
      .send({ registrationNumber })
      .expect(409);
    expect(duplicate.body.code).toBe('DUPLICATE_REGISTRATION');
  });

  it('refuses a dealerId, a status or unknown fields in the body', async () => {
    const dealerId = await assistedDealer();
    await sales
      .post(`/v1/sales/dealers/${dealerId}/vehicles`)
      .send({ registrationNumber: nextPlate(), dealerId })
      .expect(400);
    const vehicleId = await draft(dealerId);
    await sales
      .patch(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}`)
      .send({ status: 'ACTIVE' })
      .expect(400);
  });
});

describe('scope', () => {
  it('hides another representative’s dealership and drafts behind a 404', async () => {
    const dealerId = await assistedDealer();
    const vehicleId = await draft(dealerId);

    await otherSales.get(`/v1/sales/dealers/${dealerId}/vehicles`).expect(404);
    await otherSales
      .post(`/v1/sales/dealers/${dealerId}/vehicles`)
      .send({ registrationNumber: nextPlate() })
      .expect(404);
    await otherSales.get(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}`).expect(404);
    await otherSales
      .patch(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}`)
      .send({ kilometersDriven: 1 })
      .expect(404);
    await otherSales.post(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}/submit`).expect(404);
  });

  it('never shows the dealer’s own inventory to Sales', async () => {
    const dealerId = await assistedDealer();
    const ownVehicle = await h.prisma.vehicle.create({
      data: { dealerId, registrationNumber: 'UP32SR9999', createdBy: null },
    });
    await h.prisma.listing.create({ data: { vehicleId: ownVehicle.id, dealerId } });

    const list = await sales.get(`/v1/sales/dealers/${dealerId}/vehicles`).expect(200);
    expect(list.body.data).toEqual([]);
    await sales.get(`/v1/sales/dealers/${dealerId}/vehicles/${ownVehicle.id}`).expect(404);
  });

  it('keeps console roles out, and stops new drafts for a suspended dealership', async () => {
    const dealerId = await assistedDealer();
    await moderator.get(`/v1/sales/dealers/${dealerId}/vehicles`).expect(403);

    await h.prisma.dealer.update({ where: { id: dealerId }, data: { status: 'SUSPENDED' } });
    const list = await sales.get(`/v1/sales/dealers/${dealerId}/vehicles`).expect(200);
    expect(list.body.canCreate).toBe(false);
    const refused = await sales
      .post(`/v1/sales/dealers/${dealerId}/vehicles`)
      .send({ registrationNumber: nextPlate() })
      .expect(409);
    expect(refused.body.code).toBe('ASSISTED_DEALER_INACTIVE');
  });
});

describe('review', () => {
  async function submitted() {
    const dealerId = await assistedDealer();
    await approveDealer(dealerId);
    const vehicleId = await draft(dealerId);
    const done = await sales
      .post(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}/submit`)
      .expect(200);
    return { dealerId, vehicleId, listingId: done.body.listing.id as string };
  }

  it('enters the ordinary queue as a Sales submission, with the reviewer told who', async () => {
    const { listingId, vehicleId } = await submitted();

    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing).toMatchObject({ status: 'PENDING_REVIEW', submittedByMemberId: salesMemberId });
    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'listing.submitted', entityId: listingId },
    });
    expect(audit.actorType).toBe('SALES');

    const detail = await moderator.get(`/v1/admin/listings/${listingId}`).expect(200);
    expect(detail.body.assisted).toMatchObject({
      createdBy: { email: expect.stringContaining('listing.rep') },
      submittedBy: { email: expect.stringContaining('listing.rep') },
      reviewerIsAssistant: false,
    });
    expect(detail.body.actions.canRequestChanges).toBe(true);

    await tickAll(listingId);
    await seedImages(h.prisma, { vehicleId, dealerId: listing.dealerId }, 6);
    await moderator.post(`/v1/admin/listings/${listingId}/approve`).send({}).expect(200);
  });

  it('lets the representative fix and resubmit after changes are requested', async () => {
    const { dealerId, vehicleId, listingId } = await submitted();
    await moderator
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Add the service history.' })
      .expect(200);
    await sales
      .patch(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}`)
      .send({ description: 'Full service history at the authorised workshop.' })
      .expect(200);
    await sales.post(`/v1/sales/dealers/${dealerId}/vehicles/${vehicleId}/submit`).expect(200);
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe('PENDING_REVIEW');
  });

  it('refuses every decision to the member who prepared it, even after a re-role', async () => {
    const { listingId, vehicleId } = await submitted();
    await tickAll(listingId);
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    await seedImages(h.prisma, { vehicleId, dealerId: listing.dealerId }, 6);

    await sales.post(`/v1/admin/listings/${listingId}/approve`).send({}).expect(403);

    await superAdmin
      .patch(`/v1/admin/members/${salesMemberId}`)
      .send({ role: 'MODERATOR' })
      .expect(200);
    try {
      const detail = await sales.get(`/v1/admin/listings/${listingId}`).expect(200);
      expect(detail.body.assisted.reviewerIsAssistant).toBe(true);
      expect(detail.body.actions).toEqual({
        canVerify: false,
        canRequestChanges: false,
        canReject: false,
        canApprove: false,
      });
      const check = await sales
        .put(`/v1/admin/listings/${listingId}/checks/${ListingCheckKey.options[0]}`)
        .send({ checked: false });
      expect(check.status).toBe(403);
      expect(check.body.code).toBe('SELF_REVIEW_FORBIDDEN');
      for (const [action, body] of [
        ['approve', {}],
        ['reject', { reason: 'Self-review attempt.' }],
        ['request-changes', { reason: 'Self-review attempt.' }],
      ] as const) {
        const refused = await sales.post(`/v1/admin/listings/${listingId}/${action}`).send(body);
        expect(refused.status, action).toBe(403);
        expect(refused.body.code, action).toBe('SELF_REVIEW_FORBIDDEN');
      }
      const after = await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
      expect(after.status).toBe('PENDING_REVIEW');
    } finally {
      await superAdmin
        .patch(`/v1/admin/members/${salesMemberId}`)
        .send({ role: 'SALES_REP' })
        .expect(200);
    }
  });
});

async function tickAll(listingId: string): Promise<void> {
  for (const key of ListingCheckKey.options) {
    await moderator
      .put(`/v1/admin/listings/${listingId}/checks/${key}`)
      .send({ checked: true })
      .expect(200);
  }
}
