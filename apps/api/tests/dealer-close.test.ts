import { setTimeout as pause } from 'node:timers/promises';

import { Client } from 'pg';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { documentKey } from '../src/modules/dealers/dealer-storage-keys.js';
import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * ORIG-GAP-CLOSE. An application that will never be completed — abandoned, a
 * duplicate, a dealer who changed their mind — had two outcomes: wait forever
 * in DRAFT or PENDING_APPROVAL, or be rejected, which purges it. Close is the
 * third: CLOSED, with a mandatory reason, keeping the dealership, its
 * memberships, its documents and its audit trail. Admin only; DRAFT and
 * PENDING_APPROVAL only; ACTIVE and SUSPENDED stay suspend-only. A closed
 * dealership's members cannot enter it.
 */

const storage = createLocalStorage();
const PDF = Buffer.from('%PDF-1.4');
const REASON = 'Duplicate application — the dealer applied again under their group name.';

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let admin: request.Agent;
let sequence = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'dealer-close');
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

async function withDocument(dealer: Dealership) {
  const presigned = await dealer.agent
    .post('/v1/dealer/documents/presign')
    .send({ type: 'PAN_CARD', fileName: 'pan.pdf', mimeType: 'application/pdf', bytes: 8 })
    .expect(201);
  const url = new URL(String(presigned.body.uploadUrl));
  await dealer.agent
    .put(url.pathname + url.search)
    .set('Content-Type', 'application/pdf')
    .send(PDF)
    .expect(200);
  await dealer.agent
    .post('/v1/dealer/documents/PAN_CARD/commit')
    .send({ documentId: presigned.body.documentId })
    .expect(200);
}

async function completeDraft() {
  const dealer = await fixtures.dealership('DRAFT');
  sequence += 1;
  const number = String(5000 + sequence);
  await dealer.agent
    .patch('/v1/dealer/onboarding')
    .send({ gstin: `33CLOSE${number}B1ZX`, pan: `CLOSE${number}B` })
    .expect(200);
  for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
    const presigned = await dealer.agent
      .post('/v1/dealer/documents/presign')
      .send({ type, fileName: 'kyc.pdf', mimeType: 'application/pdf', bytes: PDF.length })
      .expect(201);
    const url = new URL(String(presigned.body.uploadUrl));
    await dealer.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'application/pdf')
      .send(PDF)
      .expect(200);
    await dealer.agent
      .post(`/v1/dealer/documents/${type}/commit`)
      .send({ documentId: presigned.body.documentId })
      .expect(200);
  }
  const jpeg = Buffer.from('\xff\xd8\xff a fixture yard photograph', 'binary');
  const cover = await dealer.agent
    .post('/v1/dealer/yard-photo/presign')
    .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: jpeg.length })
    .expect(201);
  const coverUrl = new URL(String(cover.body.uploadUrl));
  await dealer.agent
    .put(coverUrl.pathname + coverUrl.search)
    .set('Content-Type', 'image/jpeg')
    .send(jpeg)
    .expect(200);
  await dealer.agent
    .post('/v1/dealer/yard-photo/commit')
    .send({ mediaId: cover.body.mediaId })
    .expect(200);
  const state = await dealer.agent.get('/v1/dealer/completeness').expect(200);
  expect(state.body.canSubmit).toBe(true);
  return dealer;
}

async function snapshot(dealerId: string) {
  const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealerId } });
  const documents = await h.prisma.dealerDocument.findMany({
    where: { dealerId },
    orderBy: { type: 'asc' },
  });
  return {
    status: dealer.status,
    statusReason: dealer.statusReason,
    members: await h.prisma.dealerMember.findMany({
      where: { dealerId },
      orderBy: { id: 'asc' },
    }),
    documents: await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        stored: (await storage.head(documentKey(dealer.slug, doc.type, doc.id))) !== null,
      })),
    ),
  };
}

function close(dealerId: string, body: unknown = { reason: REASON }) {
  return admin.post(`/v1/admin/dealers/${dealerId}/close`).send(body ?? {});
}

async function ownerPhone(dealer: Dealership) {
  const user = await h.prisma.user.findUniqueOrThrow({ where: { id: dealer.userId } });
  return String(user.phone).slice(-10);
}

describe('ORIG-GAP-CLOSE — an Admin closes a DRAFT or in-review application', () => {
  it.each(['DRAFT', 'PENDING_APPROVAL'] as const)(
    'closes a %s application and keeps the record, members, documents and audit trail',
    async (status) => {
      const dealer = await fixtures.dealership('DRAFT');
      await withDocument(dealer);
      if (status === 'PENDING_APPROVAL') {
        await h.prisma.dealer.update({ where: { id: dealer.dealerId }, data: { status } });
      }
      const detail = await admin.get(`/v1/admin/dealers/${dealer.dealerId}`).expect(200);
      expect(detail.body.actions.canClose).toBe(true);
      const before = await snapshot(dealer.dealerId);

      const response = await close(dealer.dealerId);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'CLOSED', statusLabel: 'Closed' });
      const after = await snapshot(dealer.dealerId);
      expect(after).toEqual({ ...before, status: 'CLOSED', statusReason: REASON });
      expect(after.documents.find((doc) => doc.type === 'PAN_CARD')?.stored).toBe(true);
      expect(
        await h.prisma.auditLog.findMany({
          where: { entityId: dealer.dealerId, action: 'dealer.closed' },
          select: { actorType: true, before: true, after: true },
        }),
      ).toEqual([
        { actorType: 'ADMIN', before: { status }, after: { status: 'CLOSED', reason: REASON } },
      ]);
      expect(
        await h.prisma.outboxEvent.groupBy({
          by: ['eventType'],
          where: {
            aggregateId: dealer.dealerId,
            eventType: { in: ['DealerApplicationClosed', 'DealerRejected'] },
          },
          _count: { _all: true },
        }),
      ).toEqual([{ eventType: 'DealerApplicationClosed', _count: { _all: 1 } }]);
      const refreshed = await admin.get(`/v1/admin/dealers/${dealer.dealerId}`).expect(200);
      expect(refreshed.body.actions).toMatchObject({
        canClose: false,
        canReject: false,
        canApprove: false,
        canSuspend: false,
        canReinstate: false,
      });
    },
  );

  it('sends a dedicated close email, not the rejection email', async () => {
    const dealer = await fixtures.dealership('DRAFT');
    await h.drainEmails();
    const owner = await h.prisma.user.findUniqueOrThrow({ where: { id: dealer.userId } });
    const before = h.mailer.sent.length;

    await close(dealer.dealerId).expect(200);
    await h.drainEmails();

    const sent = h.mailer.sent.slice(before).filter((message) => message.to === owner.email);
    expect(sent.map((message) => message.tag)).toEqual(['dealer.application.closed']);
    expect(sent[0]?.text).toContain(REASON);
    expect(sent[0]?.subject).not.toMatch(/reject|not able to verify/i);
  });

  it('shuts the members out: the open session stops working and sign-in names the closure', async () => {
    const dealer = await fixtures.dealership('DRAFT');
    await dealer.agent.get('/v1/dealer').expect(200);

    await close(dealer.dealerId).expect(200);

    await dealer.agent.get('/v1/dealer').expect(401);
    const phone = await ownerPhone(dealer);
    const signIn = await h
      .agent()
      .post('/v1/auth/sign-in/phone/dealer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:dealer-close-${String(++sequence)}`,
      });
    expect({ http: signIn.status, code: signIn.body.code }).toEqual({
      http: 403,
      code: 'APPLICATION_CLOSED',
    });
    await h.agent().get(`/v1/dealers/${dealer.slug}`).expect(404);
  });

  it.each(['ACTIVE', 'SUSPENDED', 'CLOSED'] as const)(
    'refuses to close a %s dealership and changes nothing',
    async (status) => {
      const dealer = await fixtures.dealership('DRAFT');
      await h.prisma.dealer.update({
        where: { id: dealer.dealerId },
        data: { status, approvedAt: new Date() },
      });
      const before = await snapshot(dealer.dealerId);
      const detail = await admin.get(`/v1/admin/dealers/${dealer.dealerId}`).expect(200);

      const response = await close(dealer.dealerId);

      expect({
        canClose: detail.body.actions.canClose,
        http: response.status,
        code: response.body.code,
      }).toEqual({ canClose: false, http: 422, code: 'INVALID_DEALER_TRANSITION' });
      expect(await snapshot(dealer.dealerId)).toEqual(before);
      expect(
        await h.prisma.auditLog.count({
          where: { entityId: dealer.dealerId, action: 'dealer.closed' },
        }),
      ).toBe(0);
    },
  );

  it.each([
    ['no reason', {}],
    ['an empty reason', { reason: '' }],
    ['a reason too short to mean anything', { reason: 'dup' }],
  ])('requires a reason — refuses %s', async (_label, body) => {
    const dealer = await fixtures.dealership('DRAFT');

    const response = await close(dealer.dealerId, body);

    expect(response.status).toBe(400);
    expect((await snapshot(dealer.dealerId)).status).toBe('DRAFT');
  });

  it('is not a dealer action', async () => {
    const dealer = await fixtures.dealership('DRAFT');

    const response = await dealer.agent
      .post(`/v1/admin/dealers/${dealer.dealerId}/close`)
      .send({ reason: REASON });

    expect([401, 403]).toContain(response.status);
    expect((await snapshot(dealer.dealerId)).status).toBe('DRAFT');
  });

  it('answers 404 for a dealership that does not exist', async () => {
    await close('00000000-0000-4000-8000-00000000c105').expect(404);
  });

  it('cannot be approved or rejected once closed', async () => {
    const dealer = await fixtures.dealership('PENDING_APPROVAL');
    await close(dealer.dealerId).expect(200);

    const approve = await admin.post(`/v1/admin/dealers/${dealer.dealerId}/approve`).send({});
    const reject = await admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/reject`)
      .send({ reason: 'Trying to purge a closed application.' });

    expect(approve.status).toBeGreaterThanOrEqual(400);
    expect(reject.status).toBeGreaterThanOrEqual(400);
    expect((await snapshot(dealer.dealerId)).status).toBe('CLOSED');
  });
});

describe('ORIG-GAP-CLOSE — a submission queued behind a close does not reopen it', () => {
  it('leaves the application CLOSED when the dealer submits while the close holds the row', async () => {
    const dealer = await completeDraft();
    const holder = new Client({ connectionString: env.DATABASE_URL });
    const observer = new Client({ connectionString: env.DATABASE_URL });
    await holder.connect();
    await observer.connect();
    await holder.query('BEGIN');
    await holder.query('SELECT "id" FROM "dealers" WHERE "id"=$1::uuid FOR UPDATE', [
      dealer.dealerId,
    ]);
    let closing: Promise<request.Response> | undefined;
    let submitting: Promise<request.Response> | undefined;
    try {
      closing = Promise.resolve(close(dealer.dealerId));
      await waitForDealerLockWaiters(observer, 1);
      submitting = Promise.resolve(dealer.agent.post('/v1/dealer/submit'));
      await pause(300);
      await holder.query('COMMIT');
      const [closed, submitted] = await Promise.all([closing, submitting]);

      expect(closed.status).toBe(200);
      expect(submitted.status).not.toBe(200);
      expect((await snapshot(dealer.dealerId)).status).toBe('CLOSED');
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      if (closing) await Promise.allSettled([closing]);
      if (submitting) await Promise.allSettled([submitting]);
      await holder.end();
      await observer.end();
    }
  });
});

async function waitForDealerLockWaiters(observer: Client, count: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rows = await observer.query(`
      SELECT pid FROM pg_stat_activity
      WHERE datname=current_database() AND wait_event_type='Lock' AND state='active'
        AND query LIKE '%FROM "dealers"%'
    `);
    if (rows.rowCount !== null && rows.rowCount >= count) return;
    await pause(20);
  }
  throw new Error(`Expected ${String(count)} dealer lock waiters`);
}
