import { randomUUID } from 'node:crypto';
import { assertProgressiveReviewer } from '../src/modules/admin/progressive-review.service.js';
import type { AdminPrincipal } from '../src/modules/auth/auth.facade.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { env } from '../src/config/env.js';
let h: AuthHarness;
let n = 0;
let admin: ReturnType<AuthHarness['agent']>;
const plan = {
  classification: 'INTERMEDIARY_REVIEWED',
  classificationReference: 'Protected synthetic case: intermediary applicability reviewed.',
  requiredDocuments: ['ADDRESS_PROOF'],
  gstRequirement: 'NOT_REQUIRED_REVIEWED',
  gstReference: 'Protected synthetic case: GST non-requirement reviewed.',
  representativeIdentityReference: 'Protected synthetic case: representative identity checked.',
  representativeAuthorityReference: 'Protected synthetic case: authority checked.',
  businessExistenceReference: 'Protected synthetic case: business existence checked.',
  regulatoryOutcome: 'NOT_APPLICABLE_REVIEWED',
  regulatoryReference: 'Protected synthetic case: regulatory non-applicability reviewed.',
};
beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  h.google.claims = {
    subject: 'progressive-super',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
    name: 'Synthetic Reviewer',
  };
  admin = h.agent();
  await h.signInAdmin(admin);
});
afterAll(async () => h.close());
async function pending() {
  n++;
  h.google.claims = {
    subject: `progressive-${n}`,
    email: `progressive-${n}@example.test`,
    emailVerified: true,
    name: 'Synthetic Representative',
  };
  const agent = h.agent();
  await h.signIn(agent);
  const body = {
    fullName: 'Synthetic Representative',
    phone: `90001${String(10000 + n).slice(-5)}`,
    legalName: `Progressive Business ${n}`,
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    declaration: true,
  };
  return { agent, body };
}
async function registered() {
  const fixture = await pending();
  await h.proveNumber(fixture.agent, fixture.body.phone);
  const result = await fixture.agent
    .post('/v1/auth/dealer/register')
    .send(fixture.body)
    .expect(201);
  return {
    ...fixture,
    id: result.body.dealer.id as string,
    slug: result.body.dealer.slug as string,
  };
}
async function review(id: string, overrides: Record<string, unknown> = {}) {
  const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id } });
  return admin
    .put(`/v1/admin/dealers/${id}/progressive-plan`)
    .send({ expectedVersion: dealer.progressiveVersion, plan: { ...plan, ...overrides } });
}
async function ready() {
  const f = await registered();
  await f.agent
    .patch('/v1/dealer/onboarding')
    .send({ address: { line: 'Synthetic business address', pincode: '632001' } })
    .expect(200);
  expect((await review(f.id)).status).toBe(200);
  const signed = await f.agent
    .post('/v1/dealer/documents/presign')
    .send({
      type: 'ADDRESS_PROOF',
      fileName: 'synthetic.pdf',
      mimeType: 'application/pdf',
      bytes: 8,
    })
    .expect(201);
  const url = new URL(signed.body.uploadUrl as string);
  await f.agent
    .put(url.pathname + url.search)
    .set('Content-Type', 'application/pdf')
    .send(Buffer.from('%PDF-1.4'))
    .expect(200);
  await f.agent
    .post('/v1/dealer/documents/ADDRESS_PROOF/commit')
    .send({ documentId: signed.body.documentId })
    .expect(200);
  return { ...f, docId: signed.body.documentId as string };
}
describe('progressive registration and controlled activation', () => {
  it('saves only proved essentials without fabricated marketing, tax, yard or document values', async () => {
    const f = await registered();
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.id } });
    expect(row).toMatchObject({
      status: 'DRAFT',
      tagline: null,
      gstin: null,
      pan: null,
      addressLine: null,
      coverMediaId: null,
      specialities: [],
      progressiveVersion: 0,
    });
    expect(row.progressiveRegisteredAt).toBeInstanceOf(Date);
    expect(row.progressiveConsentVersion).toBe('dealer-registration-draft-2026-10-11');
    expect(await h.prisma.dealerDocument.count({ where: { dealerId: f.id } })).toBe(0);
  });
  it('requires actual mobile proof', async () => {
    const f = await pending();
    await f.agent.post('/v1/auth/dealer/register').send(f.body).expect(422);
  });
  it('requires declared consent and rejects forged email ownership or status', async () => {
    const f = await pending();
    for (const extra of [
      { declaration: false },
      { email: 'forged@example.test' },
      { status: 'ACTIVE' },
    ])
      await f.agent
        .post('/v1/auth/dealer/register')
        .send({ ...f.body, ...extra })
        .expect(400);
  });
  it('rejects an anonymous registration', async () => {
    const f = await pending();
    await h.agent().post('/v1/auth/dealer/register').send(f.body).expect(401);
  });
  it('does not let a dealer register a second business through this endpoint', async () => {
    const f = await registered();
    await f.agent.post('/v1/auth/dealer/register').send(f.body).expect(403);
  });
  it('saves and resumes partial details without demanding every document', async () => {
    const f = await registered();
    await f.agent
      .patch('/v1/dealer/onboarding')
      .send({ address: { line: 'Partial synthetic address' } })
      .expect(200);
    const profile = await f.agent.get('/v1/dealer').expect(200);
    expect(profile.body.address.line).toBe('Partial synthetic address');
    const state = await f.agent.get('/v1/dealer/progressive').expect(200);
    expect(state.body.requiredDocuments).toEqual([]);
    expect(state.body.canSubmit).toBe(false);
    await f.agent.post('/v1/dealer/submit').expect(422);
  });
  it('restricts applicable classification decisions to authorized admins', async () => {
    const f = await registered();
    await f.agent
      .put(`/v1/admin/dealers/${f.id}/progressive-plan`)
      .send({ expectedVersion: 0, plan })
      .expect(401);
  });
  it('rejects uncertain/invalid applicable authorization and missing GST certificate requirements', async () => {
    const f = await registered();
    expect((await review(f.id, { classification: 'REGISTERED_VEHICLE_DEALER' })).status).toBe(400);
    expect((await review(f.id, { gstRequirement: 'REQUIRED' })).status).toBe(400);
  });
  it('records safe progress metadata without disclosing case evidence or KYC', async () => {
    const f = await registered();
    expect((await review(f.id)).status).toBe(200);
    const state = await f.agent.get('/v1/dealer/progressive').expect(200);
    expect(state.body.classificationReviewed).toBe(true);
    expect(state.body.requiredDocuments).toEqual(['ADDRESS_PROOF']);
    expect(JSON.stringify(state.body)).not.toMatch(
      /Protected synthetic|reviewerId|identityHash|pan|gstReference/,
    );
  });
  it('serializes concurrent plan decisions using an application version', async () => {
    const f = await registered();
    const responses = await Promise.all([
      admin.put(`/v1/admin/dealers/${f.id}/progressive-plan`).send({ expectedVersion: 0, plan }),
      admin.put(`/v1/admin/dealers/${f.id}/progressive-plan`).send({ expectedVersion: 0, plan }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it('invalidates the reviewed plan when material identity evidence changes', async () => {
    const f = await registered();
    expect((await review(f.id)).status).toBe(200);
    await f.agent
      .patch('/v1/dealer/onboarding')
      .send({ address: { line: 'Changed synthetic address' } })
      .expect(200);
    expect(
      (await f.agent.get('/v1/dealer/progressive').expect(200)).body.classificationReviewed,
    ).toBe(false);
    await f.agent.post('/v1/dealer/submit').expect(422);
  });
  it('does not allow typed replacement email to alter proved ownership', async () => {
    const f = await registered();
    await f.agent
      .patch('/v1/dealer/onboarding')
      .send({ contact: { email: 'forged@example.test' } })
      .expect(409);
  });
  it('allows a reviewed non-GST intermediary without PAN or yard when not applicable', async () => {
    const f = await ready();
    const complete = await f.agent.get('/v1/dealer/completeness').expect(200);
    expect(complete.body.canSubmit).toBe(true);
    await f.agent.post('/v1/dealer/submit').expect(200);
    await admin.post(`/v1/admin/dealers/${f.id}/approve`).send({}).expect(422);
    await admin.post(`/v1/admin/documents/${f.docId}/verify`).send({}).expect(200);
    await admin.post(`/v1/admin/dealers/${f.id}/approve`).send({}).expect(200);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.id } });
    expect(row).toMatchObject({ status: 'ACTIVE', gstin: null, pan: null, coverMediaId: null });
    await admin
      .patch(`/v1/admin/dealers/${f.id}`)
      .send({ legalName: 'Changed activated identity' })
      .expect(409);
  });
  it('blocks activation if a proved contact is subsequently missing', async () => {
    const f = await ready();
    await f.agent.post('/v1/dealer/submit').expect(200);
    await admin.post(`/v1/admin/documents/${f.docId}/verify`).send({}).expect(200);
    const member = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: f.id, role: 'OWNER' },
    });
    await h.prisma.user.update({ where: { id: member.userId }, data: { phoneVerifiedAt: null } });
    await admin.post(`/v1/admin/dealers/${f.id}/approve`).send({}).expect(422);
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.id } })).status).toBe(
      'PENDING_APPROVAL',
    );
  });
  it('keeps an unactivated business out of public detail endpoints', async () => {
    const f = await registered();
    await h.agent().get(`/v1/public/dealers/${f.slug}`).expect(404);
  });
  it('rejects missing files even after stored metadata is marked reviewed', async () => {
    const f = await ready();
    await f.agent.post('/v1/dealer/submit').expect(200);
    await h.prisma.dealerDocument.update({
      where: { id: f.docId },
      data: { status: 'VERIFIED', reviewedBy: null, reviewedAt: null },
    });
    await admin.post(`/v1/admin/dealers/${f.id}/approve`).send({}).expect(422);
  });
});

async function newAdmin(role: 'SALES_REP' | 'SUPPORT' | 'MODERATOR' = 'SALES_REP') {
  n++;
  const email = `progressive-reviewer-${n}@example.test`;
  await admin.post('/v1/admin/members').send({ email, role }).expect(201);
  h.google.claims = {
    subject: `progressive-reviewer-${n}`,
    email,
    emailVerified: true,
    name: 'Synthetic Field Representative',
  };
  const agent = h.agent();
  await h.signInAdmin(agent);
  return { agent, email };
}
async function assisted() {
  const rep = await newAdmin();
  n++;
  const phone = `90002${String(10000 + n).slice(-5)}`;
  const verified = await rep.agent
    .post('/v1/sales/dealers/phone/verify')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:progressive-${n}`,
      consent: true,
    })
    .expect(200);
  const body = {
    phoneTicket: verified.body.phoneTicket as string,
    contactName: 'Synthetic Representative',
    email: `assisted-progressive-${n}@example.test`,
    legalName: `Assisted Progressive ${n}`,
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    declaration: true,
  };
  const created = await rep.agent.post('/v1/sales/dealers/register').send(body).expect(201);
  return { ...rep, id: created.body.id as string, body, created };
}
describe('progressive role, assisted and recovery boundaries', () => {
  it('saves a minimal assisted application with unproved email and clear attribution', async () => {
    const f = await assisted();
    expect(f.created.body).toMatchObject({
      status: 'DRAFT',
      emailVerified: false,
      claimed: false,
      progressive: { classificationReviewed: false, requiredDocuments: [] },
    });
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.id } });
    expect(row).toMatchObject({
      gstin: null,
      tagline: null,
      pan: null,
      contactEmailVerifiedAt: null,
    });
    expect(row.assistedByMemberId).not.toBeNull();
  });
  it('keeps assisted phone tickets single-use and prevents arbitrary sales access', async () => {
    const f = await assisted();
    await f.agent
      .post('/v1/sales/dealers/register')
      .send({ ...f.body, legalName: 'Replayed synthetic registration' })
      .expect(422);
    const other = await newAdmin();
    await other.agent.get(`/v1/sales/dealers/${f.id}`).expect(404);
    await f.agent
      .put(`/v1/admin/dealers/${f.id}/progressive-plan`)
      .send({ expectedVersion: 0, plan })
      .expect(403);
  });
  it('saves and resumes assisted partial progress without demanding marketing fields', async () => {
    const f = await assisted();
    await f.agent
      .patch(`/v1/sales/dealers/${f.id}`)
      .send({ addressLine: 'Partial assisted address' })
      .expect(200);
    const saved = await f.agent.get(`/v1/sales/dealers/${f.id}`).expect(200);
    expect(saved.body.address.line).toBe('Partial assisted address');
    expect(saved.body.progressive.version).toBe(1);
  });
  it('does not allow support staff to decide a verification plan', async () => {
    const f = await registered();
    const support = await newAdmin('SUPPORT');
    await support.agent
      .put(`/v1/admin/dealers/${f.id}/progressive-plan`)
      .send({ expectedVersion: 0, plan })
      .expect(403);
  });
  it('refuses classification of legacy or activated businesses through this draft route', async () => {
    const f = await registered();
    await h.prisma.dealer.update({
      where: { id: f.id },
      data: { progressiveRegisteredAt: null, progressiveConsentVersion: null },
    });
    expect((await review(f.id)).status).toBe(404);
    expect((await f.agent.get('/v1/dealer/progressive').expect(200)).body).toBeNull();
  });
  it('does not allow an own-member administrator to review or activate its business', async () => {
    const f = await registered();
    const actor = await h.prisma.user.findUniqueOrThrow({
      where: { email: env.adminAllowlist[0] ?? '' },
    });
    await h.prisma.dealerMember.create({
      data: { dealerId: f.id, userId: actor.id, role: 'STAFF', permissions: [] },
    });
    expect((await review(f.id)).status).toBe(403);
  });
  it('records applicable PAN and GST evidence requirements without treating either as verified', async () => {
    const f = await registered();
    expect(
      (
        await review(f.id, {
          classification: 'REGISTERED_VEHICLE_DEALER',
          regulatoryOutcome: 'CHECKED_VALID',
          gstRequirement: 'REQUIRED',
          requiredDocuments: ['PAN_CARD', 'GST_CERTIFICATE', 'ADDRESS_PROOF'],
        })
      ).status,
    ).toBe(200);
    const state = await f.agent.get('/v1/dealer/completeness').expect(200);
    expect(
      state.body.steps.find((step: { key: string }) => step.key === 'business').missing,
    ).toEqual(expect.arrayContaining(['pan', 'gstin']));
    expect(state.body.canSubmit).toBe(false);
  });
  it('returns corrections to a resumable draft and rejects unreviewed evidence', async () => {
    const f = await ready();
    await f.agent.post('/v1/dealer/submit').expect(200);
    await admin
      .post(`/v1/admin/dealers/${f.id}/request-changes`)
      .send({ reason: 'Correct the synthetic business address.' })
      .expect(200);
    await f.agent
      .patch('/v1/dealer/onboarding')
      .send({ address: { line: 'Corrected synthetic address' } })
      .expect(200);
    expect(
      (await f.agent.get('/v1/dealer/progressive').expect(200)).body.classificationReviewed,
    ).toBe(false);
  });
  it('rejects required evidence after activation and blocks reinstatement until it is valid again', async () => {
    const f = await ready();
    await f.agent.post('/v1/dealer/submit').expect(200);
    await admin.post(`/v1/admin/documents/${f.docId}/verify`).send({}).expect(200);
    await admin.post(`/v1/admin/dealers/${f.id}/approve`).send({}).expect(200);
    expect((await review(f.id)).status).toBe(409);
    await admin
      .post(`/v1/admin/documents/${f.docId}/reject`)
      .send({ reason: 'Synthetic evidence requires renewed review.' })
      .expect(200);
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id: f.id } })).status).toBe(
      'SUSPENDED',
    );
    await admin.post(`/v1/admin/dealers/${f.id}/reinstate`).send({}).expect(409);
  });
  it('rechecks valid applicable evidence when reinstating a suspended progressive business', async () => {
    const f = await ready();
    await f.agent.post('/v1/dealer/submit').expect(200);
    await admin.post(`/v1/admin/documents/${f.docId}/verify`).send({}).expect(200);
    await admin.post(`/v1/admin/dealers/${f.id}/approve`).send({}).expect(200);
    await admin
      .post(`/v1/admin/dealers/${f.id}/suspend`)
      .send({ reason: 'Synthetic suspension for controlled recovery.' })
      .expect(200);
    await admin.post(`/v1/admin/dealers/${f.id}/reinstate`).send({}).expect(200);
  });
  it.each(['missing', 'disabled', 'sales', 'suspended', 'no-seat'] as const)(
    'rechecks the actual database reviewer instead of trusting a stale principal: %s',
    async (condition) => {
      const actor = await h.prisma.user.create({
        data: {
          id: randomUUID(),
          email: `stale-${randomUUID()}@example.test`,
          emailVerifiedAt: new Date(),
          adminMember:
            condition === 'no-seat'
              ? undefined
              : {
                  create: {
                    role: condition === 'sales' ? 'SALES_REP' : 'MODERATOR',
                    status: condition === 'disabled' ? 'DISABLED' : 'ACTIVE',
                    source: 'INVITED',
                  },
                },
          roles:
            condition === 'suspended'
              ? { create: { role: 'ADMIN', status: 'SUSPENDED' } }
              : undefined,
        },
      });
      const principal: AdminPrincipal = {
        kind: 'ADMIN',
        userId: condition === 'missing' ? randomUUID() : actor.id,
        email: actor.email ?? '',
        adminRole: 'MODERATOR',
        permissions: ['admin:dealer:approve'],
        memberId: randomUUID(),
      };
      await expect(
        h.prisma.$transaction((tx) => assertProgressiveReviewer(tx, principal)),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
});

it('serializes progressive registration against the legacy onboarding endpoint for the same proved owner', async () => {
  const f = await pending();
  await h.proveNumber(f.agent, f.body.phone);
  const { declaration: _declaration, ...essential } = f.body;
  const responses = await Promise.all([
    f.agent.post('/v1/auth/dealer/register').send(f.body),
    f.agent.post('/v1/auth/onboarding').send({
      ...essential,
      legalName: f.body.legalName + ' Legacy',
      addressLine: 'Synthetic address',
      pincode: '632001',
      mapsUrl: 'https://maps.app.goo.gl/synthetic',
      tagline: 'Synthetic business marketing text.',
      specialities: ['Used vehicles'],
    }),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
});

it('keeps progressive private documents out of unauthorized support and sales dealer payloads', async () => {
  const f = await ready();
  const support = await newAdmin('SUPPORT');
  const detail = await support.agent.get(`/v1/admin/dealers/${f.id}`).expect(200);
  expect(detail.body.pan).toBeNull();
  expect(
    detail.body.documents.every(
      (doc: { viewUrl: string | null; fileName: string | null }) =>
        doc.viewUrl === null && doc.fileName === null,
    ),
  ).toBe(true);
});
