import { setTimeout as pause } from 'node:timers/promises';

import { Client } from 'pg';
import { afterAll, beforeAll, expect, it, vi, afterEach } from 'vitest';

import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { documentKey } from '../src/modules/dealers/dealers.facade.js';

import { createApprovalKit } from './approval-kit.js';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';

const blockedKeys = vi.hoisted(() => new Set<string>());
vi.mock('../src/platform/storage/factory.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/platform/storage/factory.js')>();
  return {
    createStorage() {
      const storage = original.createStorage();
      return {
        ...storage,
        async delete(key: string) {
          if (blockedKeys.has(key)) throw new Error('Certification storage unavailable');
          await storage.delete(key);
        },
      };
    },
  };
});
afterEach(() => blockedKeys.clear());

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let applicationSequence = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'rejection-atomicity');
});

afterAll(async () => {
  await h.close();
});
async function application(verify = true) {
  const dealer = await fixtures.dealership('DRAFT');
  const admin = await fixtures.moderator();
  applicationSequence += 1;
  const number = String(1000 + applicationSequence);
  await dealer.agent
    .patch('/v1/dealer/onboarding')
    .send({ gstin: `33REJEC${number}B1ZX`, pan: `REJEC${number}B` })
    .expect(200);
  const documents: string[] = [];
  for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
    const presigned = await dealer.agent
      .post('/v1/dealer/documents/presign')
      .send({ type, fileName: 'verification.pdf', mimeType: 'application/pdf', bytes: 8 })
      .expect(201);
    const url = new URL(String(presigned.body.uploadUrl));
    await dealer.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4'))
      .expect(200);
    await dealer.agent
      .post(`/v1/dealer/documents/${type}/commit`)
      .send({ documentId: presigned.body.documentId })
      .expect(200);
    documents.push(String(presigned.body.documentId));
  }
  const jpeg = Buffer.from('\xff\xd8\xff a fixture yard photograph', 'binary');
  const cover = await dealer.agent
    .post('/v1/dealer/yard-photo/presign')
    .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: jpeg.length })
    .expect(201);
  const url = new URL(String(cover.body.uploadUrl));
  await dealer.agent
    .put(url.pathname + url.search)
    .set('Content-Type', 'image/jpeg')
    .send(jpeg)
    .expect(200);
  await dealer.agent
    .post('/v1/dealer/yard-photo/commit')
    .send({ mediaId: cover.body.mediaId })
    .expect(200);
  await dealer.agent.post('/v1/dealer/submit').expect(200);
  if (verify) {
    for (const id of documents) {
      await admin.post(`/v1/admin/documents/${id}/verify`).send({}).expect(200);
    }
  }
  return { dealer, admin, documents };
}

async function waitForOutboxWaiters(observer: Client, count: number, includeDealer = false) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const r = await observer.query(
      `SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type='Lock' AND (query ILIKE '%INSERT INTO%outbox_events%' OR ($1 AND query LIKE '%SELECT "id" FROM "dealers"%'))`,
      [includeDealer],
    );
    if ((r.rowCount ?? 0) >= count) return;
    await pause(20);
  }
  throw new Error('Expected moderation writes waiting on outbox table');
}

it('rejection must not purge a dealer after approval has passed upload checks', async () => {
  const { dealer, admin } = await application();
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  await holder.query('LOCK TABLE outbox_events IN ACCESS EXCLUSIVE MODE');
  let approving: Promise<{ status: number }> | undefined,
    rejecting: Promise<{ status: number }> | undefined;
  try {
    approving = admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/approve`)
      .send({})
      .then((r) => r);
    await waitForOutboxWaiters(observer, 1);
    rejecting = admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/reject`)
      .send({ reason: 'Invalid supporting documents' })
      .then((r) => r);
    await waitForOutboxWaiters(observer, 2, true);
    await holder.query('COMMIT');
    const [a, b] = await Promise.all([approving, rejecting]);
    const row = await h.prisma.dealer.findUnique({ where: { id: dealer.dealerId } });
    console.log(
      JSON.stringify({
        finding: 'approval-versus-destructive-rejection',
        approvalHttp: a.status,
        rejectionHttp: b.status,
        dealerExists: row !== null,
        finalStatus: row?.status ?? null,
        approvedAudit: await h.prisma.auditLog.count({
          where: { entityId: dealer.dealerId, action: 'dealer.approved' },
        }),
        rejectedAudit: await h.prisma.auditLog.count({
          where: { entityId: dealer.dealerId, action: 'dealer.rejected' },
        }),
      }),
    );
    expect(a.status).toBe(200);
    expect(b.status).toBe(422);
    expect(row?.status).toBe('ACTIVE');
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: dealer.dealerId, action: 'dealer.rejected' },
      }),
    ).toBe(0);
    expect(
      (
        await Promise.all(
          (await storedKeys(dealer.dealerId)).map((key) => createLocalStorage().head(key)),
        )
      ).every(Boolean),
    ).toBe(true);
  } finally {
    await holder.query('ROLLBACK');
    await Promise.allSettled([approving, rejecting].filter(Boolean));
    await holder.end();
    await observer.end();
  }
});

async function storedKeys(dealerId: string) {
  const dealer = await h.prisma.dealer.findUniqueOrThrow({
    where: { id: dealerId },
    include: { documents: true },
  });
  const media = await h.prisma.media.findMany({ where: { dealerId } });
  return [
    ...dealer.documents.map((doc) => documentKey(dealer.slug, doc.type, doc.id)),
    ...media.map((item) => item.storageKey),
  ];
}

it('a rolled-back rejection retains all stored uploads and produces no rejection history', async () => {
  const { dealer, admin } = await application();
  const keys = await storedKeys(dealer.dealerId);
  const storage = createLocalStorage();
  expect((await Promise.all(keys.map((key) => storage.head(key)))).every(Boolean)).toBe(true);
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  await client.query(
    `CREATE FUNCTION certification_fail_rejection() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."eventType" = 'DealerRejected' THEN RAISE EXCEPTION 'certification rejection rollback'; END IF; RETURN NEW; END; $$`,
  );
  await client.query(
    'CREATE TRIGGER certification_fail_rejection BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION certification_fail_rejection()',
  );
  try {
    await admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/reject`)
      .send({ reason: 'Invalid supporting documents' })
      .expect(500);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
    const remaining = await Promise.all(keys.map((key) => storage.head(key)));
    console.log(
      JSON.stringify({
        finding: 'rejection-rollback-storage',
        status: row.status,
        storedUploads: remaining.filter(Boolean).length,
        expectedUploads: keys.length,
      }),
    );
    expect(row.status).toBe('PENDING_APPROVAL');
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: dealer.dealerId, action: 'dealer.rejected' },
      }),
    ).toBe(0);
    expect(
      await h.prisma.outboxEvent.count({
        where: { aggregateId: dealer.dealerId, eventType: 'DealerRejected' },
      }),
    ).toBe(0);
    expect(remaining.every(Boolean)).toBe(true);
  } finally {
    await client.query('DROP TRIGGER certification_fail_rejection ON outbox_events');
    await client.query('DROP FUNCTION certification_fail_rejection()');
    await client.end();
  }
});

it.each(['approve', 'reject'])('re-reads state when rejection wins against %s', async (second) => {
  const { dealer, admin } = await application();
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  await holder.query('LOCK TABLE outbox_events IN ACCESS EXCLUSIVE MODE');
  let rejecting: Promise<{ status: number }> | undefined;
  let following: Promise<{ status: number }> | undefined;
  try {
    rejecting = admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/reject`)
      .send({ reason: 'Invalid supporting documents' })
      .then((response) => response);
    await waitForOutboxWaiters(observer, 1);
    following = admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/${second}`)
      .send(second === 'reject' ? { reason: 'Duplicate rejection' } : {})
      .then((response) => response);
    await waitForOutboxWaiters(observer, 2, true);
    await holder.query('COMMIT');
    const [first, next] = await Promise.all([rejecting, following]);
    expect(first.status).toBe(200);
    expect(next.status).toBe(404);
    expect(await h.prisma.dealer.findUnique({ where: { id: dealer.dealerId } })).toBeNull();
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: dealer.dealerId, action: 'dealer.rejected' },
      }),
    ).toBe(1);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: dealer.dealerId, action: 'dealer.approved' },
      }),
    ).toBe(0);
  } finally {
    await holder.query('ROLLBACK');
    await Promise.allSettled([rejecting, following].filter(Boolean));
    await holder.end();
    await observer.end();
  }
});

it('commits durable cleanup, retries provider failures, preserves the audit actor and sends one rejection email', async () => {
  const { dealer, admin } = await application();
  const keys = await storedKeys(dealer.dealerId);
  const failedKey = keys[0];
  expect(failedKey).toBeDefined();
  blockedKeys.add(failedKey!);
  const response = await admin
    .post(`/v1/admin/dealers/${dealer.dealerId}/reject`)
    .send({ reason: 'Invalid supporting documents' })
    .expect(200);
  expect(response.body.objectsDeleted).toBe(keys.length - 1);
  const cleanup = await h.prisma.outboxEvent.findFirstOrThrow({
    where: { aggregateId: dealer.dealerId, eventType: 'StorageObjectsDelete' },
  });
  expect(cleanup.publishedAt).toBeNull();
  const storage = createLocalStorage();
  expect(await storage.head(failedKey!)).not.toBeNull();
  for (let n = 0; n < 30; n += 1) {
    await h.drainEmails();
    if ((await h.prisma.outboxEvent.findUniqueOrThrow({ where: { id: cleanup.id } })).attempts > 0)
      break;
  }
  expect(await h.prisma.outboxEvent.findUniqueOrThrow({ where: { id: cleanup.id } })).toMatchObject(
    { attempts: 1, publishedAt: null },
  );
  blockedKeys.clear();
  await h.drainEmails();
  await h.drainEmails();
  expect(
    (await h.prisma.outboxEvent.findUniqueOrThrow({ where: { id: cleanup.id } })).publishedAt,
  ).not.toBeNull();
  expect(
    (await Promise.all(keys.map((key) => storage.head(key)))).every((item) => item === null),
  ).toBe(true);
  expect(await h.prisma.dealerMember.count({ where: { dealerId: dealer.dealerId } })).toBe(0);
  expect(await h.prisma.dealerDocument.count({ where: { dealerId: dealer.dealerId } })).toBe(0);
  expect(await h.prisma.media.count({ where: { dealerId: dealer.dealerId } })).toBe(0);
  expect(await h.prisma.session.count({ where: { activeDealerId: dealer.dealerId } })).toBe(0);
  expect(await h.prisma.user.findUnique({ where: { id: dealer.userId } })).not.toBeNull();
  const audit = await h.prisma.auditLog.findFirstOrThrow({
    where: { entityId: dealer.dealerId, action: 'dealer.rejected' },
  });
  expect(audit.actorType).toBe('ADMIN');
  expect(audit.actorId).toBe(
    (await h.prisma.user.findUniqueOrThrow({ where: { email: env.adminAllowlist[0] } })).id,
  );
  expect(audit.after).toMatchObject({ purged: true, objectsDeleteRequested: keys.length });
  const email = h.mailer.sent.filter(
    (item) =>
      item.tag === 'dealer.application.rejected' &&
      item.to === (audit.before as { recipientEmail: string }).recipientEmail,
  );
  expect(email).toHaveLength(1);
  await dealer.agent.get('/v1/dealer').expect(401);
});

it.each(
  ['ACTIVE', 'SUSPENDED'].flatMap((status) =>
    ['ACTIVE', 'RESERVED', 'SOLD', 'WITHDRAWN'].map((listingStatus) => ({ status, listingStatus })),
  ),
)(
  'protects $status dealer history with $listingStatus stock from rejection',
  async ({ status, listingStatus }) => {
    const { dealer, admin } = await application();
    await admin.post(`/v1/admin/dealers/${dealer.dealerId}/approve`).send({}).expect(200);
    const uploadedKeys = await storedKeys(dealer.dealerId);
    const listed = await createApprovalKit(h, admin).published(
      dealer,
      `KL 41 RJ ${String(1000 + applicationSequence)}`,
    );
    const customer = h.agent();
    const phone = `98365${String(10000 + applicationSequence)}`;
    const proof = await customer
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:rejection-${String(applicationSequence)}`,
      })
      .expect(200);
    await customer
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: proof.body.signUpToken, fullName: 'Certification Customer' })
      .expect(201);
    await customer.put(`/v1/saved-vehicles/${listed.slug}`).expect(200);
    await customer
      .post('/v1/enquiries')
      .send({ listingSlug: listed.slug, message: 'Can I visit tomorrow?' })
      .expect(201);
    if (listingStatus !== 'ACTIVE') {
      const action =
        listingStatus === 'RESERVED'
          ? 'reserve'
          : listingStatus === 'SOLD'
            ? 'mark-sold'
            : 'withdraw';
      const request = dealer.agent.post(`/v1/dealer/vehicles/${listed.vehicleId}/${action}`);
      await (
        action === 'withdraw' ? request.send({ reason: 'TEMPORARILY_PAUSED' }) : request
      ).expect(200);
    }
    if (status === 'SUSPENDED')
      await admin
        .post(`/v1/admin/dealers/${dealer.dealerId}/suspend`)
        .send({ reason: 'Review required' })
        .expect(200);
    const snapshot = () =>
      Promise.all([
        h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } }),
        h.prisma.vehicle.findUniqueOrThrow({ where: { id: listed.vehicleId } }),
        h.prisma.listing.findUniqueOrThrow({ where: { id: listed.listingId } }),
        h.prisma.enquiry.findMany({ where: { dealerId: dealer.dealerId }, orderBy: { id: 'asc' } }),
        h.prisma.savedVehicle.findMany({
          where: { listingId: listed.listingId },
          orderBy: { id: 'asc' },
        }),
        h.prisma.dealerMember.findMany({
          where: { dealerId: dealer.dealerId },
          orderBy: { id: 'asc' },
        }),
        h.prisma.auditLog.findMany({
          where: { dealerId: dealer.dealerId },
          orderBy: { id: 'asc' },
        }),
      ]);
    const before = await snapshot();
    const savedBefore = await customer.get('/v1/saved-vehicles').expect(200);
    await admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/reject`)
      .send({ reason: 'Invalid supporting documents' })
      .expect(422);
    expect(await snapshot()).toEqual(before);
    expect((await customer.get('/v1/saved-vehicles').expect(200)).body).toEqual(savedBefore.body);
    expect(
      (await Promise.all(uploadedKeys.map((key) => createLocalStorage().head(key)))).every(Boolean),
    ).toBe(true);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: dealer.dealerId, action: 'dealer.rejected' },
      }),
    ).toBe(0);
  },
);

it('denies direct anonymous, owner and cross-dealer rejection and rejects forged fields and malformed IDs', async () => {
  const { dealer, admin } = await application(false);
  const other = await fixtures.dealership();
  const manager = await fixtures.member(other, 'MANAGER');
  const staff = await fixtures.member(other, 'STAFF');
  const path = `/v1/admin/dealers/${dealer.dealerId}/reject`;
  for (const agent of [h.agent(), dealer.agent, other.agent, manager.agent, staff.agent])
    await agent.post(path).send({ reason: 'Invalid supporting documents' }).expect(401);
  await admin
    .post(path)
    .send({ reason: 'Invalid supporting documents', dealerId: other.dealerId })
    .expect(400);
  await admin
    .post('/v1/admin/dealers/not-a-uuid/reject')
    .send({ reason: 'Invalid supporting documents' })
    .expect(400);
  expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } })).status).toBe(
    'PENDING_APPROVAL',
  );
  expect(
    await h.prisma.auditLog.count({
      where: { entityId: dealer.dealerId, action: 'dealer.rejected' },
    }),
  ).toBe(0);
});

it('honors a role downgrade, logout/login and seat revocation on an existing Admin cookie', async () => {
  const f = await application(false);
  const email = `rejection.role.${String(applicationSequence)}@example.com`;
  await f.admin.post('/v1/admin/access').send({ email, adminRole: 'MODERATOR' }).expect(201);
  h.google.claims = {
    subject: `rejection-role-${String(applicationSequence)}`,
    email,
    emailVerified: true,
    name: 'Rejection Role Fixture',
  };
  const moderator = h.agent();
  await h.signInAdmin(moderator);
  await moderator.get(`/v1/admin/dealers/${f.dealer.dealerId}`).expect(200);
  await f.admin.post('/v1/admin/access').send({ email, adminRole: 'SUPPORT' }).expect(201);
  await moderator
    .post(`/v1/admin/dealers/${f.dealer.dealerId}/reject`)
    .send({ reason: 'Invalid supporting documents' })
    .expect(403);
  await moderator.post('/v1/auth/admin/logout').expect(204);
  await moderator
    .post(`/v1/admin/dealers/${f.dealer.dealerId}/reject`)
    .send({ reason: 'Invalid supporting documents' })
    .expect(401);
  await h.signInAdmin(moderator);
  await moderator
    .post(`/v1/admin/dealers/${f.dealer.dealerId}/reject`)
    .send({ reason: 'Invalid supporting documents' })
    .expect(403);
  const user = await h.prisma.user.findUniqueOrThrow({ where: { email } });
  await f.admin.delete(`/v1/admin/access/${user.id}`).expect(204);
  await moderator
    .post(`/v1/admin/dealers/${f.dealer.dealerId}/reject`)
    .send({ reason: 'Invalid supporting documents' })
    .expect(401);
  await h.signInAdmin(moderator);
  await moderator
    .post(`/v1/admin/dealers/${f.dealer.dealerId}/reject`)
    .send({ reason: 'Invalid supporting documents' })
    .expect(401);
  const state = await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.dealer.dealerId } });
  expect(state.status).toBe('PENDING_APPROVAL');
  expect(state.approvedAt).toBeNull();
  expect(
    await h.prisma.outboxEvent.count({
      where: { aggregateId: state.id, eventType: 'DealerRejected' },
    }),
  ).toBe(0);
});
