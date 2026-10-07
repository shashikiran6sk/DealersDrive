import { ListingCheckKey } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { seedImages } from './images-kit.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R116 — the listing lifecycle, told to the people it concerns: Operations
 * when a listing or a reactivation needs a decision, the dealer when one is
 * made. Selling a car emails nobody.
 */
let h: AuthHarness;
let admin: request.Agent;
let dealer: Dealership;
let ownerEmail: string;
let plate = 3000;
const OPS = env.adminAllowlist[0] ?? '';

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'listing-mail');
  dealer = await fixtures.dealership();
  admin = await fixtures.moderator();
  const owner = await h.prisma.dealerMember.findFirstOrThrow({
    where: { dealerId: dealer.dealerId, role: 'OWNER' },
    include: { user: true },
  });
  ownerEmail = owner.user.email ?? '';
});

afterAll(async () => {
  await h.close();
});

function sentSince(before: number) {
  return h.mailer.sent.slice(before).map((message) => ({
    to: message.to,
    tag: message.tag,
    subject: message.subject,
    text: message.text,
  }));
}

/*
 * Every file in the run shares one outbox and the Operations inbox, so a drain
 * can deliver another file's listing to the same address. An email is this
 * file's when it names this listing.
 */
function toOpsAbout(before: number, needle: string) {
  return sentSince(before).find((message) => message.to === OPS && message.text.includes(needle));
}

async function submitted(): Promise<{ listingId: string; vehicleId: string }> {
  plate += 1;
  const created = await dealer.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: `GJ 05 LM ${String(plate)}` })
    .expect(201);
  const vehicleId = created.body.id as string;
  await dealer.agent.patch(`/v1/dealer/vehicles/${vehicleId}`).send(COMPLETE_VEHICLE).expect(200);
  const done = await dealer.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);
  return { listingId: done.body.listing.id as string, vehicleId };
}

async function approved(): Promise<{ listingId: string; vehicleId: string }> {
  const candidate = await submitted();
  for (const key of ListingCheckKey.options) {
    await admin
      .put(`/v1/admin/listings/${candidate.listingId}/checks/${key}`)
      .send({ checked: true })
      .expect(200);
  }
  await seedImages(h.prisma, { vehicleId: candidate.vehicleId, dealerId: dealer.dealerId }, 6);
  await admin.post(`/v1/admin/listings/${candidate.listingId}/approve`).send({}).expect(200);
  return candidate;
}

describe('a submission', () => {
  it('tells Operations, with a link to the listing, and not the dealer', async () => {
    const before = h.mailer.sent.length;
    const { listingId } = await submitted();
    await h.drainEmails();
    const mail = sentSince(before);

    const toOps = toOpsAbout(before, listingId);
    expect(toOps?.tag).toBe('admin.listing.submitted');
    expect(toOps?.subject).toContain('Hyundai Creta');
    expect(toOps?.text).toContain(`/admin/listings/${listingId}`);
    expect(mail.some((message) => message.to === ownerEmail)).toBe(false);
  });

  it('tells Operations it is back after changes, and the dealer what to change', async () => {
    const { listingId, vehicleId } = await submitted();
    await h.drainEmails();

    let before = h.mailer.sent.length;
    await admin
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Add a photo of the odometer.' })
      .expect(200);
    await h.drainEmails();
    const asked = sentSince(before).find((message) => message.to === ownerEmail);
    expect(asked?.tag).toBe('dealer.listing.changes-requested');
    expect(asked?.text).toContain('Add a photo of the odometer.');
    expect(asked?.text).toContain(`/dealer/vehicles/${vehicleId}/edit?step=review`);

    before = h.mailer.sent.length;
    await dealer.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).expect(200);
    await h.drainEmails();
    expect(toOpsAbout(before, listingId)?.tag).toBe('admin.listing.resubmitted');
  });
});

describe('a decision', () => {
  it('tells the dealer their listing is live, with the public link', async () => {
    await h.drainEmails();
    const before = h.mailer.sent.length;
    const { listingId } = await approved();
    await h.drainEmails();

    const live = sentSince(before).find((message) => message.tag === 'dealer.listing.approved');
    const slug = (await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).slug;
    expect(live?.to).toBe(ownerEmail);
    expect(live?.text).toContain(`/car/${slug ?? ''}`);
  });

  it('tells the dealer a rejection, with the reviewer’s reason', async () => {
    const { listingId } = await submitted();
    await h.drainEmails();
    const before = h.mailer.sent.length;
    await admin
      .post(`/v1/admin/listings/${listingId}/reject`)
      .send({ reason: 'The RC does not match this car.' })
      .expect(200);
    await h.drainEmails();

    const refused = sentSince(before).find((message) => message.to === ownerEmail);
    expect(refused?.tag).toBe('dealer.listing.rejected');
    expect(refused?.text).toContain('The RC does not match this car.');
  });
});

describe('reactivation', () => {
  it('tells Operations about a request and the dealer about the decision', async () => {
    const { vehicleId } = await approved();
    await dealer.agent.post(`/v1/dealer/vehicles/${vehicleId}/reserve`).send({}).expect(200);
    await h.drainEmails();

    let before = h.mailer.sent.length;
    await dealer.agent
      .post(`/v1/dealer/vehicles/${vehicleId}/request-reactivation`)
      .send({ reason: 'The buyer backed out.' })
      .expect(200);
    await h.drainEmails();
    const asked = toOpsAbout(before, 'The buyer backed out.');
    expect(asked?.tag).toBe('admin.listing.reactivation-requested');
    expect(asked?.text).toContain('The buyer backed out.');

    const request = await h.prisma.listingReactivationRequest.findFirstOrThrow({
      where: { listing: { vehicleId }, status: 'PENDING' },
    });
    before = h.mailer.sent.length;
    await admin.post(`/v1/admin/reactivation-requests/${request.id}/approve`).send({}).expect(200);
    await h.drainEmails();
    expect(sentSince(before).find((message) => message.to === ownerEmail)?.tag).toBe(
      'dealer.listing.reactivation-approved',
    );
  });
});

describe('a sale', () => {
  it('emails nobody', async () => {
    const { listingId, vehicleId } = await approved();
    await h.drainEmails();
    const before = h.mailer.sent.length;
    const soldAt = new Date();
    await dealer.agent.post(`/v1/dealer/vehicles/${vehicleId}/mark-sold`).send({}).expect(200);
    await h.drainEmails();
    const slug =
      (await h.prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).slug ?? '';
    const about = sentSince(before).filter(
      (message) =>
        message.to === ownerEmail ||
        message.text.includes(listingId) ||
        message.text.includes(vehicleId) ||
        message.text.includes(slug),
    );
    expect(about).toEqual([]);
    expect(
      await h.prisma.notificationDelivery.count({
        where: { dealerId: dealer.dealerId, createdAt: { gte: soldAt } },
      }),
    ).toBe(0);
  });
});
