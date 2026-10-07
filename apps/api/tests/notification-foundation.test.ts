import { randomUUID } from 'node:crypto';

import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R115 — the notification foundation: who an admin email reaches, which
 * listing moves are published as events, and the operator's delivery log.
 */
let h: AuthHarness;
let superAdmin: request.Agent;
let moderator: request.Agent;
let support: request.Agent;
let moderatorEmail: string;
let supportEmail: string;
let salesEmail: string;
let dealer: Dealership;
let counter = 0;
let plate = 2000;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  h.google.claims = {
    subject: 'foundation-super',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
    name: 'Dealers-Drive Operations',
  };
  superAdmin = h.agent();
  await h.signInAdmin(superAdmin);
  moderatorEmail = nextEmail('found.mod');
  supportEmail = nextEmail('found.desk');
  salesEmail = nextEmail('found.rep');
  moderator = await member(moderatorEmail, 'MODERATOR');
  support = await member(supportEmail, 'SUPPORT');
  await member(salesEmail, 'SALES_REP');
  await superAdmin
    .post('/v1/admin/members')
    .send({ email: nextEmail('found.invited'), role: 'MODERATOR' })
    .expect(201);
  dealer = await marketplaceFixtures(h, 'foundation').dealership();
});

afterAll(async () => {
  await h.close();
});

function nextEmail(label: string): string {
  counter += 1;
  return `${label}.${String(counter)}.${Date.now().toString(36)}@dealers-drive.test`;
}

async function member(email: string, role: string): Promise<request.Agent> {
  await superAdmin.post('/v1/admin/members').send({ email, role }).expect(201);
  counter += 1;
  h.google.claims = { subject: `foundation-${String(counter)}`, email, emailVerified: true };
  const agent = h.agent();
  await h.signInAdmin(agent);
  return agent;
}

async function publish(
  type: string,
  dealerId: string,
  payload: Record<string, string | boolean> = {},
) {
  const id = randomUUID();
  await h.prisma.outboxEvent.create({
    data: {
      aggregateType: 'Dealer',
      aggregateId: dealerId,
      eventType: type,
      payload: {
        id,
        type,
        version: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'Dealer',
        aggregateId: dealerId,
        dealerId,
        actor: { type: 'DEALER' },
        traceId: 'foundation-test',
        payload,
      },
    },
  });
  await h.drainEmails();
  return id;
}

describe('admin emails', () => {
  it('reach the active members whose role holds the permission, and no one else', async () => {
    const eventId = await publish('DealerApplied', dealer.dealerId);
    const sent = await h.prisma.notificationDelivery.findMany({
      where: { template: 'admin.application.received', dedupeKey: { contains: eventId } },
      select: { recipient: true },
    });
    const recipients = sent.map((row) => row.recipient.toLowerCase());

    expect(recipients).toContain(moderatorEmail.toLowerCase());
    expect(recipients).toContain((env.adminAllowlist[0] ?? '').toLowerCase());
    expect(recipients).not.toContain(supportEmail.toLowerCase());
    expect(recipients).not.toContain(salesEmail.toLowerCase());
    expect(recipients.some((email) => email.includes('found.invited'))).toBe(false);
  });

  it('send once per recipient however often the event is delivered', async () => {
    const eventId = await publish('DealerApplied', dealer.dealerId);
    await h.prisma.outboxEvent.updateMany({
      where: { eventType: 'DealerApplied', aggregateId: dealer.dealerId },
      data: { publishedAt: null },
    });
    await h.drainEmails();
    const rows = await h.prisma.notificationDelivery.findMany({
      where: { dedupeKey: { contains: eventId }, recipient: moderatorEmail },
    });
    expect(rows).toHaveLength(1);
    expect(rows.every((row) => row.status === 'SENT' && row.attempts === 1)).toBe(true);
  });
});

describe('listing events', () => {
  it('publishes submission and the moderator’s decision, in the transaction that made them', async () => {
    plate += 1;
    const created = await dealer.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: `MH 12 NF ${String(plate)}` })
      .expect(201);
    const vehicleId = created.body.id as string;
    await dealer.agent.patch(`/v1/dealer/vehicles/${vehicleId}`).send(COMPLETE_VEHICLE).expect(200);
    const submitted = await dealer.agent
      .post(`/v1/dealer/vehicles/${vehicleId}/submit`)
      .expect(200);
    const listingId = submitted.body.listing.id as string;

    await moderator
      .post(`/v1/admin/listings/${listingId}/request-changes`)
      .send({ reason: 'Add the service history.' })
      .expect(200);

    const events = await h.prisma.outboxEvent.findMany({
      where: { aggregateType: 'Listing', aggregateId: listingId },
      orderBy: { id: 'asc' },
    });
    expect(events.map((row) => row.eventType)).toEqual([
      'ListingSubmitted',
      'ListingChangesRequested',
    ]);
    const decision = events[1]?.payload as { payload: Record<string, unknown> };
    expect(decision.payload).toMatchObject({
      listingId,
      from: 'PENDING_REVIEW',
      to: 'CHANGES_REQUESTED',
      reason: 'Add the service history.',
    });
  });
});

describe('the delivery log', () => {
  it('lists deliveries newest first, filtered and searched, for a Super admin', async () => {
    await publish('DealerApplied', dealer.dealerId);

    const all = await superAdmin.get('/v1/admin/notifications').expect(200);
    expect(all.body.counts.ALL).toBeGreaterThan(0);
    expect(all.body.data[0]).toMatchObject({ statusLabel: expect.any(String) });

    const sent = await superAdmin.get('/v1/admin/notifications?status=SENT&limit=5').expect(200);
    expect(sent.body.data.every((row: { status: string }) => row.status === 'SENT')).toBe(true);

    const found = await superAdmin
      .get(`/v1/admin/notifications?q=${encodeURIComponent(moderatorEmail)}`)
      .expect(200);
    expect(found.body.data.length).toBeGreaterThan(0);
    expect(
      found.body.data.every((row: { recipient: string }) => row.recipient === moderatorEmail),
    ).toBe(true);
  });

  it('is refused to every role but Super admin, and refuses unknown filters', async () => {
    await moderator.get('/v1/admin/notifications').expect(403);
    await support.get('/v1/admin/notifications').expect(403);
    await h.agent().get('/v1/admin/notifications').expect(401);
    await superAdmin.get('/v1/admin/notifications?dealerId=x').expect(400);
  });

  it('pages by keyset without repeating a row', async () => {
    const first = await superAdmin.get('/v1/admin/notifications?limit=2').expect(200);
    if (!first.body.page.hasMore) return;
    const second = await superAdmin
      .get(
        `/v1/admin/notifications?limit=2&cursor=${encodeURIComponent(first.body.page.nextCursor as string)}`,
      )
      .expect(200);
    const ids = new Set(first.body.data.map((row: { id: string }) => row.id));
    for (const row of second.body.data as { id: string }[]) expect(ids.has(row.id)).toBe(false);
  });
});
