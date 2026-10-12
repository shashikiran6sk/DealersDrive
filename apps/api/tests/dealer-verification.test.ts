import { randomUUID } from 'node:crypto';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuthHarness, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';
import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { documentKey } from '../src/modules/dealers/dealer-storage-keys.js';
import { createDealerVerificationService } from '../src/modules/admin/dealer-verification.service.js';
import { createAuditService } from '../src/platform/audit/audit.service.js';
import { env } from '../src/config/env.js';
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let admin: request.Agent;
let reviewerId: string;
const storage = createLocalStorage();
beforeAll(async () => {
  h = await createAuthHarness();
  fixtures = marketplaceFixtures(h, 'verification');
  admin = await fixtures.moderator();
  reviewerId = (await h.prisma.user.findUniqueOrThrow({ where: { email: env.adminAllowlist[0] } }))
    .id;
});
afterAll(async () => h.close());
async function candidate(gstin = false) {
  const d = await fixtures.dealership();
  await h.prisma.dealer.update({
    where: { id: d.dealerId },
    data: {
      pan: `VRFYX${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}Q`,
      ...(gstin
        ? { gstin: `33VRFYX${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}Q1Z1` }
        : {}),
    },
  });
  for (const [category, type] of [
    ['PERSONAL_IDENTITY', 'PAN_CARD'],
    ['BUSINESS_IDENTITY', gstin ? 'GST_CERTIFICATE' : 'UDYAM'],
  ] as const) {
    const doc = await h.prisma.dealerDocument.upsert({
      where: { dealerId_category: { dealerId: d.dealerId, category } },
      create: { dealerId: d.dealerId, category, type },
      update: { type },
    });
    await storage.put(
      documentKey(d.slug, type, doc.id),
      Buffer.from('%PDF-1.4 synthetic protected evidence'),
      'application/pdf',
    );
    await h.prisma.dealerDocument.update({
      where: { id: doc.id },
      data: {
        status: 'VERIFIED',
        fileName: 'synthetic.pdf',
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    });
  }
  return d;
}
function decision(
  id: string,
  status: string,
  expectedVersion: number,
  extra: Record<string, unknown> = {},
) {
  return admin
    .post(`/v1/admin/dealers/${id}/verification`)
    .send({ status, expectedVersion, ...extra });
}
async function inReview(id: string) {
  await decision(id, 'IN_REVIEW', 0).expect(200);
}
async function verified(id: string) {
  await inReview(id);
  return decision(id, 'VERIFIED', 1).expect(200);
}
async function publicProfile(slug: string) {
  return (await h.agent().get(`/v1/dealers/${slug}`).expect(200)).body as { isVerified: boolean };
}
describe('explicit dealer verification independent of yard ownership', () => {
  it('does not turn an approved dealer into a verified dealer automatically', async () => {
    const d = await candidate();
    expect((await publicProfile(d.slug)).isVerified).toBe(false);
    const review = await admin.get(`/v1/admin/dealers/${d.dealerId}/verification`).expect(200);
    expect(review.body).toMatchObject({ status: 'NOT_VERIFIED', version: 0, history: [] });
    expect(review.body.transitions).not.toContain('VERIFIED');
  });
  it('verifies with no yard and publishes only safe metadata', async () => {
    const d = await candidate();
    const review = await verified(d.dealerId);
    expect(review.body).toMatchObject({ status: 'VERIFIED', version: 2, reviewerId });
    expect(review.body.verifiedAt).toBeTruthy();
    expect(review.body.history).toHaveLength(2);
    expect(review.body.history[0]).not.toHaveProperty('assessment');
    const profile = await h.agent().get(`/v1/dealers/${d.slug}`).expect(200);
    expect(profile.body.isVerified).toBe(true);
    const publicText = JSON.stringify(profile.body);
    for (const secret of [
      'representativeIdentity',
      'synthetic.pdf',
      'classificationEvidence',
      'reviewerId',
      'pan',
      'documents',
      'gstEvidence',
    ])
      expect(publicText).not.toContain(`"${secret}"`);
    const business = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    const directory = await h
      .agent()
      .get('/v1/dealers')
      .query({ q: business.brandName })
      .expect(200);
    expect(
      directory.body.data.find((row: { slug: string }) => row.slug === d.slug).isVerified,
    ).toBe(true);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    expect(row.coverMediaId).toBeNull();
  });
  it('yard photographs alone never assign verification', async () => {
    const d = await candidate();
    const photo = await h.prisma.media.create({
      data: {
        dealerId: d.dealerId,
        ownerType: 'DEALER_COVER',
        storageKey: `${d.slug}/yard.jpg`,
        mimeType: 'image/jpeg',
        bytes: 8,
        status: 'READY',
      },
    });
    await h.prisma.dealer.update({ where: { id: d.dealerId }, data: { coverMediaId: photo.id } });
    expect((await publicProfile(d.slug)).isVerified).toBe(false);
  });
  it('rejects and reopens review without changing approval, then revokes with history', async () => {
    const d = await candidate();
    await decision(d.dealerId, 'PENDING', 0).expect(200);
    await decision(d.dealerId, 'REJECTED', 1, {
      reason: 'Synthetic evidence needs correction',
    }).expect(200);
    await decision(d.dealerId, 'IN_REVIEW', 2).expect(200);
    await decision(d.dealerId, 'VERIFIED', 3).expect(200);
    await decision(d.dealerId, 'REVOKED', 4, {
      reason: 'Synthetic business evidence was withdrawn',
    }).expect(200);
    expect((await publicProfile(d.slug)).isVerified).toBe(false);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    expect(row.status).toBe('ACTIVE');
    expect(row.verificationVerifiedAt).toBeNull();
  });
  it('serializes concurrent decisions and rejects stale version', async () => {
    const d = await candidate();
    const results = await Promise.all([
      decision(d.dealerId, 'PENDING', 0),
      decision(d.dealerId, 'IN_REVIEW', 0),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).verificationVersion,
    ).toBe(1);
  });
  it('refuses skipping review, a forged field and the retired free-text assessment', async () => {
    const d = await candidate();
    await decision(d.dealerId, 'VERIFIED', 0).expect(409);
    await inReview(d.dealerId);
    await decision(d.dealerId, 'VERIFIED', 1, { isVerified: true }).expect(400);
    await decision(d.dealerId, 'VERIFIED', 1, {
      assessment: { representativeIdentity: 'Synthetic protected identity case 1' },
    }).expect(400);
  });
  it.each(['DRAFT', 'PENDING_APPROVAL', 'SUSPENDED', 'REJECTED', 'CLOSED'] as const)(
    'cannot grant a verified badge to %s dealership',
    async (status) => {
      const d = await candidate();
      await h.prisma.dealer.update({ where: { id: d.dealerId }, data: { status } });
      await inReview(d.dealerId);
      const r = await decision(d.dealerId, 'VERIFIED', 1);
      expect(r.body.code).toBe('DEALER_NOT_APPROVED');
    },
  );
  it('requires verified contact values matching the actual owner', async () => {
    const d = await candidate();
    await inReview(d.dealerId);
    await h.prisma.dealer.update({
      where: { id: d.dealerId },
      data: { contactPhone: '+919000007777' },
    });
    const r = await decision(d.dealerId, 'VERIFIED', 1);
    expect(r.body.code).toBe('CONTACT_NOT_VERIFIED');
    await h.prisma.user.update({ where: { id: d.userId }, data: { emailVerifiedAt: null } });
    expect((await decision(d.dealerId, 'VERIFIED', 1)).body.code).toBe(
      'CONTACT_NOT_VERIFIED',
    );
  });
  it('requires actual reviewed documents, metadata and stored objects', async () => {
    const d = await candidate();
    await inReview(d.dealerId);
    const doc = await h.prisma.dealerDocument.findUniqueOrThrow({
      where: { dealerId_category: { dealerId: d.dealerId, category: 'PERSONAL_IDENTITY' } },
    });
    await h.prisma.dealerDocument.update({ where: { id: doc.id }, data: { reviewedAt: null } });
    expect((await decision(d.dealerId, 'VERIFIED', 1)).body.code).toBe(
      'VERIFICATION_DOCUMENTS_REQUIRED',
    );
    await h.prisma.dealerDocument.update({
      where: { id: doc.id },
      data: { reviewedAt: new Date() },
    });
    await storage.delete(documentKey(d.slug, doc.type, doc.id));
    expect((await decision(d.dealerId, 'VERIFIED', 1)).body.code).toBe(
      'VERIFICATION_DOCUMENT_MISSING',
    );
  });
  it('verifies a GSTIN holder on its reviewed GST certificate, with no typed attestation', async () => {
    const d = await candidate(true);
    await inReview(d.dealerId);
    await decision(d.dealerId, 'VERIFIED', 1).expect(200);
  });
  it('blocks anonymous/dealer/support actors and keeps reviewer history private', async () => {
    const d = await candidate();
    await h.agent().get(`/v1/admin/dealers/${d.dealerId}/verification`).expect(401);
    await d.agent
      .post(`/v1/admin/dealers/${d.dealerId}/verification`)
      .send({ status: 'IN_REVIEW', expectedVersion: 0 })
      .expect(401);
    const u = await h.prisma.user.create({
      data: {
        email: `support-verification-${randomUUID()}@example.test`,
        roles: { create: { role: 'ADMIN' } },
      },
    });
    await h.prisma.adminMember.create({
      data: { userId: u.id, role: 'SUPPORT', status: 'ACTIVE' },
    });
    h.google.claims = { subject: `support-${u.id}`, email: u.email!, emailVerified: true };
    const a = h.agent();
    await h.signInAdmin(a);
    await a.get(`/v1/admin/dealers/${d.dealerId}/verification`).expect(403);
    await a
      .post(`/v1/admin/dealers/${d.dealerId}/verification`)
      .send({ status: 'IN_REVIEW', expectedVersion: 0 })
      .expect(403);
    const detail = await a.get(`/v1/admin/dealers/${d.dealerId}`).expect(200);
    expect(detail.body.pan).toBeNull();
    expect(
      detail.body.documents.every(
        (doc: { viewUrl: string | null; fileName: string | null }) =>
          doc.viewUrl === null && doc.fileName === null,
      ),
    ).toBe(true);
  });
  it('rejects self-review by dealership staff with an admin seat', async () => {
    const d = await candidate();
    await h.prisma.dealerMember.create({
      data: { dealerId: d.dealerId, userId: reviewerId, role: 'STAFF', permissions: [] },
    });
    await decision(d.dealerId, 'IN_REVIEW', 0).expect(403);
  });
  it('rejects review by the assisting representative even after an admin promotion', async () => {
    const d = await candidate();
    const member = await h.prisma.adminMember.findUniqueOrThrow({ where: { userId: reviewerId } });
    await h.prisma.dealer.update({
      where: { id: d.dealerId },
      data: {
        onboardingSource: 'ASSISTED',
        assistedByMemberId: member.id,
        assistedConsentAt: new Date(),
        contactPhoneVerifiedAt: new Date(),
      },
    });
    await decision(d.dealerId, 'IN_REVIEW', 0).expect(403);
  });
  it('revokes after core evidence changes while preserving business activation', async () => {
    const d = await candidate();
    await verified(d.dealerId);
    await admin
      .patch(`/v1/admin/dealers/${d.dealerId}`)
      .send({ legalName: `Changed ${d.dealerId}` })
      .expect(200);
    expect((await publicProfile(d.slug)).isVerified).toBe(false);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    expect(row.status).toBe('ACTIVE');
    expect(row.verificationStatus).toBe('REVOKED');
    const review = await admin.get(`/v1/admin/dealers/${d.dealerId}/verification`).expect(200);
    expect(review.body.history[0].reason).toContain('identity');
  });
  it('revokes on rejecting applicable reviewed documentation', async () => {
    const d = await candidate();
    await verified(d.dealerId);
    const doc = await h.prisma.dealerDocument.findUniqueOrThrow({
      where: { dealerId_category: { dealerId: d.dealerId, category: 'PERSONAL_IDENTITY' } },
    });
    await admin
      .post(`/v1/admin/documents/${doc.id}/reject`)
      .send({ reason: 'Synthetic evidence no longer readable' })
      .expect(200);
    expect((await publicProfile(d.slug)).isVerified).toBe(false);
  });
  it('suspension suppresses the public verified listing independently of review status', async () => {
    const d = await candidate();
    await verified(d.dealerId);
    await admin
      .post(`/v1/admin/dealers/${d.dealerId}/suspend`)
      .send({ reason: 'Synthetic suspension for review' })
      .expect(200);
    await h.agent().get(`/v1/dealers/${d.slug}`).expect(404);
    const business = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    const directory = await h
      .agent()
      .get('/v1/dealers')
      .query({ q: business.brandName })
      .expect(200);
    expect(directory.body.data.some((r: { slug: string }) => r.slug === d.slug)).toBe(false);
  });
  it('refuses nonexistent IDs and an invalid transition without changing records', async () => {
    await admin.get(`/v1/admin/dealers/${randomUUID()}/verification`).expect(404);
    await decision(randomUUID(), 'IN_REVIEW', 0).expect(404);
    const d = await candidate();
    await decision(d.dealerId, 'REVOKED', 0, { reason: 'Synthetic unsupported transition' }).expect(
      409,
    );
  });
  it('checks stored evidence without holding the shared admin lock or the dealer row', async () => {
    const d = await candidate();
    await inReview(d.dealerId);
    const reviewer = await h.prisma.user.findUniqueOrThrow({ where: { id: reviewerId } });
    const observed: { adminLockFree: boolean; dealerRowFree: boolean }[] = [];
    let serial: Promise<unknown> = Promise.resolve();
    const probing = {
      ...storage,
      async head(key: string) {
        const turn = serial.then(() =>
          h.prisma.$transaction(async (tx) => {
            const [lock] = await tx.$queryRaw<{ free: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(hashtext('admin_members:manage')) AS free`;
            const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "dealers" WHERE "id" = ${d.dealerId}::uuid FOR UPDATE SKIP LOCKED`;
            return { adminLockFree: lock?.free === true, dealerRowFree: rows.length === 1 };
          }),
        );
        serial = turn;
        observed.push(await turn);
        return storage.head(key);
      },
    };
    const service = createDealerVerificationService({
      prisma: h.prisma,
      audit: createAuditService(h.prisma),
      storage: probing,
    });
    await service.decide(
      {
        kind: 'ADMIN',
        userId: reviewer.id,
        email: reviewer.email!,
        adminRole: 'SUPER_ADMIN',
        permissions: ['admin:dealer:approve'],
      },
      d.dealerId,
      { expectedVersion: 1, status: 'VERIFIED' },
    );
    expect(observed.length).toBeGreaterThan(0);
    expect(observed.every((o) => o.adminLockFree && o.dealerRowFree)).toBe(true);
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).verificationStatus,
    ).toBe('VERIFIED');
  });
  it('refuses, as a reload conflict, evidence that changes after its stored objects were checked', async () => {
    const d = await candidate();
    await inReview(d.dealerId);
    const reviewer = await h.prisma.user.findUniqueOrThrow({ where: { id: reviewerId } });
    let changed = false;
    const racing = {
      ...storage,
      async head(key: string) {
        if (!changed) {
          changed = true;
          await h.prisma.dealerDocument.updateMany({
            where: { dealerId: d.dealerId, type: 'PAN_CARD' },
            data: { fileName: 'replaced.pdf', reviewedAt: new Date(Date.now() + 1000) },
          });
        }
        return storage.head(key);
      },
    };
    const service = createDealerVerificationService({
      prisma: h.prisma,
      audit: createAuditService(h.prisma),
      storage: racing,
    });
    await expect(
      service.decide(
        {
          kind: 'ADMIN',
          userId: reviewer.id,
          email: reviewer.email!,
          adminRole: 'SUPER_ADMIN',
          permissions: ['admin:dealer:approve'],
        },
        d.dealerId,
        { expectedVersion: 1, status: 'VERIFIED' },
      ),
    ).rejects.toMatchObject({ code: 'VERIFICATION_CHANGED' });
    const after = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    expect(after).toMatchObject({ verificationStatus: 'IN_REVIEW', verificationVersion: 1 });
  });
  it.each(['missing', 'disabled', 'suspended', 'user_suspended', 'role', 'deleted'] as const)(
    'rechecks %s reviewer admission inside the transaction',
    async (kind) => {
      const d = await candidate();
      const actor = await h.prisma.user.create({
        data: {
          email: `reviewer-${randomUUID()}@example.test`,
          status: kind === 'user_suspended' ? 'SUSPENDED' : 'ACTIVE',
          roles: {
            create: { role: 'ADMIN', status: kind === 'suspended' ? 'SUSPENDED' : 'ACTIVE' },
          },
        },
      });
      if (kind !== 'missing')
        await h.prisma.adminMember.create({
          data: {
            userId: actor.id,
            role: kind === 'role' ? 'SUPPORT' : 'MODERATOR',
            status: kind === 'disabled' ? 'DISABLED' : 'ACTIVE',
          },
        });
      if (kind === 'deleted') await h.prisma.user.delete({ where: { id: actor.id } });
      const service = createDealerVerificationService({
        prisma: h.prisma,
        audit: createAuditService(h.prisma),
        storage,
      });
      await expect(
        service.decide(
          {
            kind: 'ADMIN',
            userId: actor.id,
            email: actor.email!,
            adminRole: 'MODERATOR',
            permissions: ['admin:dealer:approve'],
          },
          d.dealerId,
          { expectedVersion: 0, status: 'IN_REVIEW' },
        ),
      ).rejects.toThrow(/review access/);
      expect(
        (await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } }))
          .verificationVersion,
      ).toBe(0);
    },
  );
});
