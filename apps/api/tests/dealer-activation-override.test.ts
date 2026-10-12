import { MANUAL_ACTIVATION_DISCLAIMER_VERSION } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { submitDocumentSet } from './document-uploads.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * #299 — the controlled manual activation. A Super admin may activate a
 * dealership that has not completed the document review, with an acknowledged
 * disclaimer and a recorded justification. It never verifies a document, never
 * grants Dealer Verified, and can be withdrawn.
 */

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let superAdmin: request.Agent;

const JUSTIFICATION =
  'Owner identity and yard confirmed in person by the field team; policy exception OPS-2026-114 approved.';
const GST_REVIEW = 'No GST registration required: turnover below threshold, case GST-OPS-114.';

function overrideBody(extra: Record<string, unknown> = {}) {
  return {
    acknowledgedDisclaimer: MANUAL_ACTIVATION_DISCLAIMER_VERSION,
    justification: JUSTIFICATION,
    gstNotRequiredReview: GST_REVIEW,
    ...extra,
  };
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'activation-override');
  superAdmin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

async function dealer(status: 'DRAFT' | 'PENDING_APPROVAL' = 'DRAFT'): Promise<Dealership> {
  return fixtures.dealership(status);
}

async function row(id: string) {
  return h.prisma.dealer.findUniqueOrThrow({ where: { id }, include: { documents: true } });
}

describe('an authorized manual activation', () => {
  it('activates a draft without documents, recording who, when and why, and verifies nothing', async () => {
    const d = await dealer();
    const response = await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ACTIVE',
      activation: {
        method: 'MANUAL_OVERRIDE',
        methodLabel: 'Manual activation — documents not verified',
        justification: JUSTIFICATION,
        outstanding: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'],
      },
    });
    const stored = await row(d.dealerId);
    expect(stored).toMatchObject({
      status: 'ACTIVE',
      activationMethod: 'MANUAL_OVERRIDE',
      activationOverrideReason: JUSTIFICATION,
      verificationStatus: 'NOT_VERIFIED',
      creditBalance: 0,
    });
    expect(stored.activationOverrideAt).toBeInstanceOf(Date);
    expect(stored.documents.every((doc) => doc.status === 'REQUIRED')).toBe(true);

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { dealerId: d.dealerId, action: 'dealer.activation_overridden' },
    });
    expect(audit.after).toMatchObject({
      activationMethod: 'MANUAL_OVERRIDE',
      disclaimerVersion: MANUAL_ACTIVATION_DISCLAIMER_VERSION,
      justification: JUSTIFICATION,
      outstanding: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'],
      gstNotRequiredReview: GST_REVIEW,
    });
    expect(
      await h.prisma.outboxEvent.count({
        where: { aggregateId: d.dealerId, eventType: 'DealerApproved' },
      }),
    ).toBe(1);
  });

  it('shows the dealership publicly without the Dealer Verified badge, and refuses the badge without documents', async () => {
    const d = await dealer('PENDING_APPROVAL');
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(200);

    const page = await h.agent().get(`/v1/dealers/${d.slug}`).expect(200);
    expect(page.body.isVerified).toBe(false);

    const detail = await superAdmin.get(`/v1/admin/dealers/${d.dealerId}`).expect(200);
    expect(detail.body.activation.outstanding).toEqual(['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY']);
    expect(detail.body.actions).toMatchObject({
      canOverrideActivation: false,
      canRevokeOverride: true,
    });

    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/verification`)
      .send({ expectedVersion: 0, status: 'IN_REVIEW' })
      .expect(200);
    const badge = await superAdmin.post(`/v1/admin/dealers/${d.dealerId}/verification`).send({
      expectedVersion: 1,
      status: 'VERIFIED',
    });
    expect(badge.status).toBeGreaterThanOrEqual(400);
    expect((await row(d.dealerId)).verificationStatus).not.toBe('VERIFIED');
  });

  it('becomes a standard activation once both categories are later verified', async () => {
    const d = await dealer();
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(200);
    await submitDocumentSet(d.agent, '/v1/dealer', [
      { category: 'PERSONAL_IDENTITY', type: 'PASSPORT' },
      { category: 'BUSINESS_IDENTITY', type: 'UDYAM' },
    ]);
    for (const doc of (await row(d.dealerId)).documents) {
      await superAdmin.post(`/v1/admin/documents/${doc.id}/verify`).send({}).expect(200);
    }
    expect((await row(d.dealerId)).activationMethod).toBe('STANDARD');
    expect(
      await h.prisma.auditLog.count({
        where: { dealerId: d.dealerId, action: 'dealer.activation_standardised' },
      }),
    ).toBe(1);
  });
});

describe('who may use it', () => {
  it.each(['MODERATOR', 'SUPPORT'] as const)('refuses a %s, and changes nothing', async (role) => {
    const d = await dealer();
    const staff = await fixtures.staff(role);
    await staff
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(403);
    expect((await row(d.dealerId)).status).toBe('DRAFT');
  });

  it('refuses the Super admin who assisted the dealership', async () => {
    const d = await dealer();
    const member = await h.prisma.adminMember.findFirstOrThrow({
      where: { user: { email: env.adminAllowlist[0] ?? '' } },
    });
    await h.prisma.dealer.update({
      where: { id: d.dealerId },
      data: { onboardingSource: 'ASSISTED', assistedByMemberId: member.id },
    });
    const refused = await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(403);
    expect(refused.body.code).toBe('SELF_REVIEW_FORBIDDEN');
  });
});

describe('what it requires', () => {
  it.each([
    ['no justification', { justification: undefined }],
    ['a justification too short to mean anything', { justification: 'Approved.' }],
    ['no acknowledged disclaimer', { acknowledgedDisclaimer: undefined }],
    ['an outdated disclaimer version', { acknowledgedDisclaimer: 'manual-activation-2020-01-01' }],
    ['a dealerId in the body', { dealerId: '11111111-1111-4111-8111-111111111111' }],
  ])('refuses %s with a 400', async (_label, change) => {
    const d = await dealer();
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody(change))
      .expect(400);
    expect((await row(d.dealerId)).status).toBe('DRAFT');
  });

  it('still requires the GST applicability review when no GSTIN is on file', async () => {
    const d = await dealer();
    const refused = await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody({ gstNotRequiredReview: undefined }))
      .expect(422);
    expect(refused.body.code).toBe('GST_APPLICABILITY_REVIEW_REQUIRED');
  });
});

describe('when policy blocks it', () => {
  it('refuses while business details are incomplete', async () => {
    const d = await dealer();
    await h.prisma.dealer.update({ where: { id: d.dealerId }, data: { addressLine: null } });
    const refused = await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'ACTIVATION_OVERRIDE_BLOCKED' });
    expect(refused.body.detail).toMatch(/business details/);
  });

  it('refuses while a submitted document stands rejected', async () => {
    const d = await dealer();
    await submitDocumentSet(d.agent, '/v1/dealer', [
      { category: 'PERSONAL_IDENTITY', type: 'PASSPORT' },
    ]);
    const doc = (await row(d.dealerId)).documents.find(
      (item) => item.category === 'PERSONAL_IDENTITY',
    );
    await superAdmin
      .post(`/v1/admin/documents/${String(doc?.id)}/reject`)
      .send({ reason: 'Expired passport copy.' })
      .expect(200);
    const refused = await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(409);
    expect(refused.body.detail).toMatch(/rejected/);
  });

  it('sends a fully verified application to standard approval instead', async () => {
    const d = await dealer();
    await submitDocumentSet(d.agent, '/v1/dealer', [
      { category: 'PERSONAL_IDENTITY', type: 'PASSPORT' },
      { category: 'BUSINESS_IDENTITY', type: 'UDYAM' },
    ]);
    for (const doc of (await row(d.dealerId)).documents) {
      await superAdmin.post(`/v1/admin/documents/${doc.id}/verify`).send({}).expect(200);
    }
    const refused = await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(409);
    expect(refused.body.detail).toMatch(/standard approval/);
  });

  it('refuses a repeated override of an already active dealership', async () => {
    const d = await dealer();
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(200);
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(409);
    expect(
      await h.prisma.auditLog.count({
        where: { dealerId: d.dealerId, action: 'dealer.activation_overridden' },
      }),
    ).toBe(1);
  });

  it('refuses a suspended dealership, which is reinstated rather than overridden', async () => {
    const d = await dealer();
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(200);
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/suspend`)
      .send({ reason: 'Suspended pending a field check.' })
      .expect(200);
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(409);
    expect((await row(d.dealerId)).status).toBe('SUSPENDED');
  });
});

describe('withdrawing a manual activation', () => {
  it('returns the dealership to review and takes it off the marketplace', async () => {
    const d = await dealer();
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override`)
      .send(overrideBody())
      .expect(200);
    const withdrawn = await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override/revoke`)
      .send({ reason: 'Exception expired; standard document review required.' })
      .expect(200);
    expect(withdrawn.body).toMatchObject({
      status: 'PENDING_APPROVAL',
      activation: { method: null },
    });
    expect(await row(d.dealerId)).toMatchObject({
      status: 'PENDING_APPROVAL',
      activationMethod: null,
      statusReason: 'Exception expired; standard document review required.',
    });
    await h.agent().get(`/v1/dealers/${d.slug}`).expect(404);
    expect(
      await h.prisma.auditLog.count({
        where: { dealerId: d.dealerId, action: 'dealer.activation_override_revoked' },
      }),
    ).toBe(1);
  });

  it('refuses to withdraw a standard approval, or to let a moderator withdraw anything', async () => {
    const d = await dealer();
    await h.prisma.dealer.update({
      where: { id: d.dealerId },
      data: { status: 'ACTIVE', activationMethod: 'STANDARD' },
    });
    await superAdmin
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override/revoke`)
      .send({ reason: 'Trying to withdraw a standard approval.' })
      .expect(409);
    const moderator = await fixtures.staff('MODERATOR');
    await moderator
      .post(`/v1/admin/dealers/${d.dealerId}/activation-override/revoke`)
      .send({ reason: 'Trying to withdraw a standard approval.' })
      .expect(403);
  });
});
