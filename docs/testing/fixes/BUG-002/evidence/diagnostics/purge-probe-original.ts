import { setTimeout as pause } from 'node:timers/promises';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { COMPLETE_VEHICLE, marketplaceFixtures } from './marketplace-fixtures.js';

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let applicationSequence = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'approval-gate');
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
    .send({ gstin: `33APPRO${number}B1ZX`, pan: `APPRO${number}B` })
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

async function waitForDealerWaiters(observer: Client, count: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rows = await observer.query(`
      SELECT pid FROM pg_stat_activity
      WHERE datname=current_database() AND wait_event_type='Lock' AND state='active'
        AND query LIKE '%SELECT "id" FROM "dealers"%'
    `);
    if (rows.rowCount !== null && rows.rowCount >= count) return;
    await pause(20);
  }
  throw new Error(`Expected ${String(count)} moderation lock waiters`);
}

async function holdDealer(id: string) {
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  await holder.query('SELECT "id" FROM "dealers" WHERE "id"=$1::uuid FOR UPDATE', [id]);
  return { holder, observer };
}

it('diagnostic: stale rejection racing approval must not purge an approved dealer', async () => {
  const { dealer, admin } = await application();
  const { holder, observer } = await holdDealer(dealer.dealerId);
  let approving: Promise<unknown> | undefined, rejecting: Promise<unknown> | undefined;
  try {
    approving = admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/approve`)
      .send({})
      .then((r) => r);
    await waitForDealerWaiters(observer, 1);
    rejecting = admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/reject`)
      .send({ reason: 'Invalid supporting documents' })
      .then((r) => r);
    const deadline = Date.now() + 5000;
    let observed = false;
    while (Date.now() < deadline) {
      const r = await observer.query(
        `SELECT query FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type='Lock' AND query NOT LIKE '%SELECT "id" FROM "dealers"%'`,
      );
      if (r.rows.some((row) => /INSERT INTO|DELETE FROM/.test(String(row.query)))) {
        observed = true;
        break;
      }
      await pause(20);
    }
    expect(observed).toBe(true);
    await holder.query('COMMIT');
    const [a, b] = (await Promise.all([approving, rejecting])) as {
      status: number;
      body: unknown;
    }[];
    const state = await h.prisma.dealer.findUnique({ where: { id: dealer.dealerId } });
    console.log(
      JSON.stringify({
        finding: 'approval-versus-destructive-rejection',
        approvalHttp: a.status,
        rejectionHttp: b.status,
        dealerExists: state !== null,
        finalStatus: state?.status ?? null,
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
    expect(state?.status).toBe('ACTIVE');
  } finally {
    await holder.query('ROLLBACK');
    await Promise.allSettled([approving, rejecting].filter(Boolean));
    await holder.end();
    await observer.end();
  }
});
