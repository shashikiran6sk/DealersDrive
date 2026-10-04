import { setTimeout as pause } from 'node:timers/promises';

import { Client } from 'pg';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * BUG-NEW-012. A dealer's enquiry status change was authorised from the
 * session read at the start of the request. A member removed while that
 * request was queued on the enquiry row lock still committed, because the
 * write never re-read membership. The decision is now made inside the write
 * transaction, against the member row as it stands at commit time.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let counter = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'enquiry-commit');
});

afterAll(async () => {
  await h.close();
});

async function customer() {
  counter += 1;
  const agent = h.agent();
  const phone = `98478${String(10000 + counter).slice(-5)}`;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:enquiry-commit-${String(counter)}`,
    })
    .expect(200);
  await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName: 'Commit Buyer' })
    .expect(201);
  return agent;
}

async function enquiryFor(owner: Dealership) {
  counter += 1;
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: owner.dealerId,
      registrationNumber: `TN23EC${String(1000 + counter)}`,
      rtoCode: 'TN23',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      manufacturingYear: 2023,
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: owner.dealerId,
      status: 'ACTIVE',
      slug: `2023-hyundai-creta-commit-${String(counter)}-${Date.now().toString(36)}`,
      publishedAt: new Date(),
    },
  });
  const buyer: request.Agent = await customer();
  const created = await buyer
    .post('/v1/enquiries')
    .send({ listingSlug: listing.slug, message: 'Is this still available?' })
    .expect(201);
  return String(created.body.id);
}

async function waitOnEnquiryLock(observer: Client, holderPid: number) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      `SELECT pid FROM pg_stat_activity WHERE datname=current_database()
       AND state='active' AND wait_event_type='Lock' AND query ILIKE '%enquiries%'
       AND $1::int = ANY(pg_blocking_pids(pid))`,
      [holderPid],
    );
    if ((result.rowCount ?? 0) > 0) return;
    await pause(10);
  }
  throw new Error('No enquiry write observed waiting on the held row');
}

async function queuedBehindEnquiryLock(
  enquiryId: string,
  write: () => Promise<{ status: number }>,
  meanwhile: () => Promise<void>,
) {
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  const holderPid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  await holder.query('SELECT id FROM enquiries WHERE id=$1 FOR UPDATE', [enquiryId]);
  let pending: Promise<{ status: number }> | undefined;
  try {
    pending = Promise.resolve(write());
    await waitOnEnquiryLock(observer, holderPid);
    await meanwhile();
    await holder.query('COMMIT');
    return await pending;
  } finally {
    await holder.query('ROLLBACK').catch(() => undefined);
    if (pending) await Promise.allSettled([pending]);
    await holder.end();
    await observer.end();
  }
}

describe('BUG-NEW-012 — an enquiry write is authorised at commit time', () => {
  it('refuses a queued close from a manager removed while it waited', async () => {
    const owner = await fixtures.dealership();
    const manager = await fixtures.member(owner, 'MANAGER');
    const membership = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: owner.dealerId, userId: manager.userId },
    });
    const enquiryId = await enquiryFor(owner);
    const before = await h.prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId } });
    const auditBefore = await h.prisma.auditLog.count({ where: { entityId: enquiryId } });

    const response = await queuedBehindEnquiryLock(
      enquiryId,
      () => manager.agent.patch(`/v1/dealer/enquiries/${enquiryId}`).send({ status: 'CLOSED' }),
      async () => {
        await owner.agent.delete(`/v1/dealer/team/members/${membership.id}`).expect(204);
      },
    );

    expect({
      http: response.status,
      membership: (await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: membership.id } }))
        .status,
      enquiry: await h.prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId } }),
      audits: await h.prisma.auditLog.count({ where: { entityId: enquiryId } }),
    }).toEqual({ http: 401, membership: 'REMOVED', enquiry: before, audits: auditBefore });
  });

  it('refuses a queued close from a dealership suspended while it waited', async () => {
    const owner = await fixtures.dealership();
    const admin = await fixtures.moderator();
    const enquiryId = await enquiryFor(owner);
    const before = await h.prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId } });

    const response = await queuedBehindEnquiryLock(
      enquiryId,
      () => owner.agent.patch(`/v1/dealer/enquiries/${enquiryId}`).send({ status: 'CLOSED' }),
      async () => {
        await admin
          .post(`/v1/admin/dealers/${owner.dealerId}/suspend`)
          .send({ reason: 'Suspended while an enquiry write waited.' })
          .expect(200);
      },
    );

    expect(response.status).toBe(401);
    expect(await h.prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId } })).toEqual(before);
  });

  it('still lets a current member move an enquiry', async () => {
    const owner = await fixtures.dealership();
    const manager = await fixtures.member(owner, 'MANAGER');
    const enquiryId = await enquiryFor(owner);

    const response = await manager.agent
      .patch(`/v1/dealer/enquiries/${enquiryId}`)
      .send({ status: 'CONTACTED' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('CONTACTED');
  });
});
