import { randomUUID } from 'node:crypto';
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

describe('BUG-NEW-003 — document review cannot invent a committed upload', () => {
  it.each(['REQUIRED', 'UPLOADING'] as const)(
    'refuses to verify a %s document without changing its review state',
    async (status) => {
      const dealer = await fixtures.dealership('DRAFT');
      const admin = await fixtures.moderator();
      if (status === 'UPLOADING') {
        await dealer.agent
          .post('/v1/dealer/documents/presign')
          .send({
            type: 'GST_CERTIFICATE',
            fileName: 'unuploaded.pdf',
            mimeType: 'application/pdf',
            bytes: 8,
          })
          .expect(201);
      }
      const doc = await h.prisma.dealerDocument.findUniqueOrThrow({
        where: {
          dealerId_type: { dealerId: dealer.dealerId, type: 'GST_CERTIFICATE' },
        },
      });
      expect(doc.status).toBe(status);
      const response = await admin.post(`/v1/admin/documents/${doc.id}/verify`).send({});
      const stored = await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: doc.id } });
      expect({
        http: response.status,
        status: stored.status,
        reviewerRecorded: stored.reviewedBy !== null,
        reviewedAt: stored.reviewedAt,
        auditCount: await h.prisma.auditLog.count({
          where: { entityId: doc.id, action: 'document.verified' },
        }),
      }).toEqual({
        http: 422,
        status,
        reviewerRecorded: false,
        reviewedAt: null,
        auditCount: 0,
      });
    },
  );
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

describe('BUG-002 / VERIFY-011 — authoritative dealer approval prerequisites', () => {
  it.each(['DRAFT', 'PENDING_APPROVAL'] as const)(
    'refuses an incomplete %s dealer without membership, audit or outbox changes',
    async (status) => {
      const dealer = await fixtures.dealership(status);
      const admin = await fixtures.moderator();
      const members = await h.prisma.dealerMember.findMany({
        where: { dealerId: dealer.dealerId },
      });
      const detail = await admin.get(`/v1/admin/dealers/${dealer.dealerId}`).expect(200);
      expect(detail.body.actions.canApprove).toBe(false);

      const response = await admin.post(`/v1/admin/dealers/${dealer.dealerId}/approve`).send({});
      const state = await h.prisma.dealer.findUniqueOrThrow({
        where: { id: dealer.dealerId },
        include: { documents: true },
      });
      expect(
        await h.prisma.dealerMember.findMany({ where: { dealerId: dealer.dealerId } }),
      ).toEqual(members);
      const publicProfile = await h.agent().get(`/v1/dealers/${dealer.slug}`);
      expect({
        http: response.status,
        status: state.status,
        approvedAt: state.approvedAt,
        publicProfile: publicProfile.status,
        documentStatuses: state.documents.map((doc) => doc.status),
        approvalAudits: await h.prisma.auditLog.count({
          where: { dealerId: dealer.dealerId, action: 'dealer.approved' },
        }),
        approvalEvents: await h.prisma.outboxEvent.count({
          where: { aggregateId: dealer.dealerId, eventType: 'DealerApproved' },
        }),
      }).toEqual({
        http: 422,
        status,
        approvedAt: null,
        publicProfile: 404,
        documentStatuses: ['REQUIRED', 'REQUIRED', 'REQUIRED'],
        approvalAudits: 0,
        approvalEvents: 0,
      });
    },
  );
});

describe('BUG-NEW-004 — suspension and reinstatement cannot bypass approval', () => {
  it.each(['suspend', 'reinstate'] as const)(
    'refuses %s of an unapproved DRAFT dealer',
    async (action) => {
      const dealer = await fixtures.dealership('DRAFT');
      const admin = await fixtures.moderator();
      const response = await admin
        .post(`/v1/admin/dealers/${dealer.dealerId}/${action}`)
        .send(action === 'suspend' ? { reason: 'Invalid transition probe.' } : {});
      const state = await h.prisma.dealer.findUniqueOrThrow({
        where: { id: dealer.dealerId },
      });
      expect({
        http: response.status,
        status: state.status,
        approvedAt: state.approvedAt,
        suspendedAt: state.suspendedAt,
        auditCount: await h.prisma.auditLog.count({
          where: {
            dealerId: dealer.dealerId,
            action: action === 'suspend' ? 'dealer.suspended' : 'dealer.reinstated',
          },
        }),
      }).toEqual({
        http: 422,
        status: 'DRAFT',
        approvedAt: null,
        suspendedAt: null,
        auditCount: 0,
      });
    },
  );

  it('refuses a historically suspended dealer that was never approved', async () => {
    const dealer = await fixtures.dealership('DRAFT');
    await h.prisma.dealer.update({
      where: { id: dealer.dealerId },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });
    const admin = await fixtures.moderator();
    const response = await admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/reinstate`)
      .send({})
      .expect(422);
    expect(response.body.code).toBe('DEALER_NOT_APPROVED');
    const stored = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
    expect(stored.status).toBe('SUSPENDED');
    expect(stored.approvedAt).toBeNull();
  });
});

describe('BUG-002 — complete application, capability and history regression', () => {
  it('approves a real uploaded/reviewed application once, preserving membership and audit actors', async () => {
    const f = await application();
    const members = await h.prisma.dealerMember.findMany({
      where: { dealerId: f.dealer.dealerId },
    });
    await h.agent().get(`/v1/dealers/${f.dealer.slug}`).expect(404);
    await f.dealer.agent.get('/v1/dealer/vehicles').expect(200);
    const vehicle = await f.dealer.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: `TN23AP${String(9000 + applicationSequence)}` })
      .expect(201);
    const blocked = await f.dealer.agent
      .post(`/v1/dealer/vehicles/${vehicle.body.id}/submit`)
      .expect(403);
    expect(blocked.body.code).toBe('DEALER_NOT_ACTIVE');
    const detail = await f.admin.get(`/v1/admin/dealers/${f.dealer.dealerId}`).expect(200);
    expect(detail.body.actions.canApprove).toBe(true);
    await f.admin.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(200);
    const stored = await h.prisma.dealer.findUniqueOrThrow({
      where: { id: f.dealer.dealerId },
      include: { documents: true },
    });
    expect(stored.status).toBe('ACTIVE');
    expect(stored.approvedAt).toBeInstanceOf(Date);
    expect(stored.documents).toHaveLength(3);
    expect(stored.documents.every((doc) => doc.status === 'VERIFIED' && doc.reviewedBy)).toBe(true);
    expect(
      await h.prisma.dealerMember.findMany({ where: { dealerId: f.dealer.dealerId } }),
    ).toEqual(members);
    const audit = await h.prisma.auditLog.findMany({
      where: { dealerId: f.dealer.dealerId, action: 'dealer.approved' },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorType: 'ADMIN',
      before: { status: 'PENDING_APPROVAL' },
      after: { status: 'ACTIVE', creditsGranted: 0 },
    });
    expect(audit[0]?.actorId).toBe(stored.documents[0]?.reviewedBy);
    expect(audit[0]?.createdAt).toBeInstanceOf(Date);
    expect(
      await h.prisma.outboxEvent.count({
        where: { aggregateId: stored.id, eventType: 'DealerApproved' },
      }),
    ).toBe(1);
    await f.dealer.agent.get('/v1/dealer/vehicles').expect(200);
    const draft = await h.prisma.listing.findUniqueOrThrow({
      where: { vehicleId: String(vehicle.body.id) },
    });
    expect(draft.status).toBe('DRAFT');
    await f.dealer.agent
      .patch(`/v1/dealer/vehicles/${vehicle.body.id}`)
      .send(COMPLETE_VEHICLE)
      .expect(200);
    await f.dealer.agent.post(`/v1/dealer/vehicles/${vehicle.body.id}/submit`).expect(200);
    await h.agent().get(`/v1/dealers/${f.dealer.slug}`).expect(200);
    const repeated = await f.admin
      .post(`/v1/admin/dealers/${stored.id}/approve`)
      .send({})
      .expect(422);
    expect(repeated.body.code).toBe('ALREADY_ACTIVE');
    await h.drainEmails();
    const count = await h.prisma.notificationDelivery.count({
      where: { dealerId: stored.id, template: 'dealer.application.approved', status: 'SENT' },
    });
    expect(count).toBe(1);
    await h.drainEmails();
    expect(
      await h.prisma.notificationDelivery.count({
        where: { dealerId: stored.id, template: 'dealer.application.approved', status: 'SENT' },
      }),
    ).toBe(1);
  });

  it('refuses uploaded documents that an Admin has not verified', async () => {
    const f = await application(false);
    const response = await f.admin
      .post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`)
      .send({})
      .expect(422);
    expect(response.body.code).toBe('DOCUMENTS_NOT_VERIFIED');
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.dealer.dealerId } })).status,
    ).toBe('PENDING_APPROVAL');
  });

  it('can approve a submitted application with verified required documents and no yard photograph', async () => {
    const f = await application();
    await h.prisma.dealer.update({
      where: { id: f.dealer.dealerId },
      data: { coverMediaId: null },
    });
    const detail = await f.admin.get(`/v1/admin/dealers/${f.dealer.dealerId}`).expect(200);
    expect(detail.body.actions.canApprove).toBe(true);
    await f.admin.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(200);
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.dealer.dealerId } })).status,
    ).toBe('ACTIVE');
  });

  it.each(['gstin', 'pan'] as const)(
    'refuses an otherwise verified application with missing %s and a misleading status',
    async (field) => {
      const f = await application();
      await h.prisma.dealer.update({ where: { id: f.dealer.dealerId }, data: { [field]: null } });
      const detail = await f.admin.get(`/v1/admin/dealers/${f.dealer.dealerId}`).expect(200);
      expect(detail.body.actions.canApprove).toBe(false);
      const response = await f.admin
        .post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`)
        .send({})
        .expect(422);
      expect(response.body.code).toBe('PROFILE_INCOMPLETE');
      expect(
        await h.prisma.auditLog.count({
          where: { dealerId: f.dealer.dealerId, action: 'dealer.approved' },
        }),
      ).toBe(0);
      await h.agent().get(`/v1/dealers/${f.dealer.slug}`).expect(404);
    },
  );

  it('refuses legacy VERIFIED rows that have no uploaded filename', async () => {
    const f = await application();
    await h.prisma.dealerDocument.update({
      where: { id: f.documents[0] },
      data: { fileName: null },
    });
    const response = await f.admin
      .post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`)
      .send({})
      .expect(422);
    expect(response.body.code).toBe('DOCUMENTS_NOT_VERIFIED');
  });

  it('refuses a legacy VERIFIED filename whose stored object is missing', async () => {
    const f = await application();
    await h.prisma.dealerDocument.update({
      where: { id: f.documents[0] },
      data: { id: randomUUID() },
    });
    const response = await f.admin.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({});
    const stored = await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.dealer.dealerId } });
    expect({
      http: response.status,
      status: stored.status,
      approvedAt: stored.approvedAt,
      auditCount: await h.prisma.auditLog.count({
        where: { entityId: stored.id, action: 'dealer.approved' },
      }),
      events: await h.prisma.outboxEvent.count({
        where: { aggregateId: stored.id, eventType: 'DealerApproved' },
      }),
    }).toEqual({
      http: 422,
      status: 'PENDING_APPROVAL',
      approvedAt: null,
      auditCount: 0,
      events: 0,
    });
    expect(response.body.code).toBe('DOCUMENT_UPLOAD_MISSING');
  });

  it('requires fresh owner identity completeness', async () => {
    const f = await application();
    await h.prisma.user.update({ where: { id: f.dealer.userId }, data: { fullName: null } });
    const response = await f.admin
      .post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`)
      .send({})
      .expect(422);
    expect(response.body.code).toBe('PROFILE_INCOMPLETE');
  });

  it('keeps an approved dealer and its original approval history through suspension and reinstatement', async () => {
    const f = await application();
    await f.admin.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(200);
    const before = await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.dealer.dealerId } });
    await f.admin
      .post(`/v1/admin/dealers/${before.id}/suspend`)
      .send({ reason: 'Lifecycle regression fixture.' })
      .expect(200);
    await f.dealer.agent.get('/v1/dealer/vehicles').expect(401);
    await h.agent().get(`/v1/dealers/${f.dealer.slug}`).expect(404);
    await f.admin.post(`/v1/admin/dealers/${before.id}/reinstate`).send({}).expect(200);
    const after = await h.prisma.dealer.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.approvedAt).toEqual(before.approvedAt);
    expect(after.suspendedAt).toBeNull();
    expect(after.status).toBe('ACTIVE');
    await f.dealer.agent.get('/v1/dealer/vehicles').expect(200);
    await h.agent().get(`/v1/dealers/${f.dealer.slug}`).expect(200);
    expect(
      await h.prisma.auditLog.count({ where: { dealerId: before.id, action: 'dealer.approved' } }),
    ).toBe(1);
  });
});

describe('BUG-002 / VERIFY-012 — serialized Admin decisions', () => {
  it.each(['approval', 'changes', 'document rejection'] as const)(
    're-reads state after %s wins the dealer lock queue',
    async (first) => {
      const f = await application();
      const { holder, observer } = await holdDealer(f.dealer.dealerId);
      let held = true;
      const pending: Promise<unknown>[] = [];
      try {
        const approve = () =>
          f.admin
            .post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`)
            .send({})
            .then((r) => r);
        const firstResponse =
          first === 'approval'
            ? approve()
            : first === 'changes'
              ? f.admin
                  .post(`/v1/admin/dealers/${f.dealer.dealerId}/request-changes`)
                  .send({ reason: 'Review the address again.' })
                  .then((r) => r)
              : f.admin
                  .post(`/v1/admin/documents/${f.documents[0]}/reject`)
                  .send({ reason: 'Review the uploaded proof.' })
                  .then((r) => r);
        pending.push(firstResponse);
        await waitForDealerWaiters(observer, 1);
        const secondResponse = approve();
        pending.push(secondResponse);
        await waitForDealerWaiters(observer, 2);
        await holder.query('COMMIT');
        held = false;
        const [one, two] = await Promise.all([firstResponse, secondResponse]);
        expect(one.status).toBe(200);
        expect(two.status).toBe(422);
        expect(two.body.code).toBe(first === 'approval' ? 'ALREADY_ACTIVE' : 'NOT_UNDER_REVIEW');
        const state = await h.prisma.dealer.findUniqueOrThrow({
          where: { id: f.dealer.dealerId },
        });
        expect(state.status).toBe(first === 'approval' ? 'ACTIVE' : 'DRAFT');
        const approvals = first === 'approval' ? 1 : 0;
        expect(
          await h.prisma.auditLog.count({
            where: { dealerId: state.id, action: 'dealer.approved' },
          }),
        ).toBe(approvals);
        expect(
          await h.prisma.outboxEvent.count({
            where: { aggregateId: state.id, eventType: 'DealerApproved' },
          }),
        ).toBe(approvals);
      } finally {
        if (held) await holder.query('ROLLBACK');
        await Promise.allSettled(pending);
        await holder.end();
        await observer.end();
      }
    },
  );
});

describe('BUG-002 — adversarial Admin authorization', () => {
  it('denies anonymous, dealer and cross-dealer callers, forged fields and invalid IDs', async () => {
    const f = await application();
    const another = await fixtures.dealership();
    const manager = await fixtures.member(another, 'MANAGER');
    const staff = await fixtures.member(another, 'STAFF');
    for (const agent of [h.agent(), f.dealer.agent, another.agent, manager.agent, staff.agent]) {
      await agent.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(401);
    }
    await f.admin.post('/v1/admin/dealers/not-an-id/approve').send({}).expect(400);
    await f.admin
      .post('/v1/admin/dealers/00000000-0000-4000-8000-000000000000/approve')
      .send({})
      .expect(404);
    await f.admin
      .post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`)
      .send({ dealerId: another.dealerId, status: 'ACTIVE' })
      .expect(400);
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.dealer.dealerId } })).status,
    ).toBe('PENDING_APPROVAL');
    expect(
      await h.prisma.auditLog.count({
        where: { dealerId: f.dealer.dealerId, action: 'dealer.approved' },
      }),
    ).toBe(0);
  });

  it('honors a role downgrade, logout/login and seat revocation on an existing Admin cookie', async () => {
    const f = await application();
    const email = `approval.role.${String(applicationSequence)}@example.com`;
    await f.admin.post('/v1/admin/access').send({ email, adminRole: 'MODERATOR' }).expect(201);
    h.google.claims = {
      subject: `approval-role-${String(applicationSequence)}`,
      email,
      emailVerified: true,
      name: 'Approval Role Fixture',
    };
    const moderator = h.agent();
    await h.signInAdmin(moderator);
    await moderator.get(`/v1/admin/dealers/${f.dealer.dealerId}`).expect(200);
    await f.admin.post('/v1/admin/access').send({ email, adminRole: 'SUPPORT' }).expect(201);
    await moderator.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(403);
    await moderator.post('/v1/auth/admin/logout').expect(204);
    await moderator.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(401);
    await h.signInAdmin(moderator);
    await moderator.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(403);
    const user = await h.prisma.user.findUniqueOrThrow({ where: { email } });
    await f.admin.delete(`/v1/admin/access/${user.id}`).expect(204);
    await moderator.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(401);
    await h.signInAdmin(moderator);
    await moderator.post(`/v1/admin/dealers/${f.dealer.dealerId}/approve`).send({}).expect(401);
    const state = await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.dealer.dealerId } });
    expect(state.status).toBe('PENDING_APPROVAL');
    expect(state.approvedAt).toBeNull();
    expect(
      await h.prisma.outboxEvent.count({
        where: { aggregateId: state.id, eventType: 'DealerApproved' },
      }),
    ).toBe(0);
  });
});
