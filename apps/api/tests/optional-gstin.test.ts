import { randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuthHarness, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';
let h: AuthHarness;
let f: ReturnType<typeof marketplaceFixtures>;
let admin: request.Agent;
beforeAll(async () => {
  h = await createAuthHarness();
  f = marketplaceFixtures(h, 'optional-gstin');
  admin = await f.moderator();
});
afterAll(async () => h.close());
let seq = 0;
function gstin() {
  seq++;
  return `33OPTGS${String(2000 + seq)}Q1Z5`;
}
describe('optional GSTIN API and stored invariant', () => {
  it('clearing tax identity revokes genuine verification and retains protected evidence bytes', async () => {
    const d = await f.dealership('DRAFT');
    await d.agent
      .patch('/v1/dealer/onboarding')
      .send({ pan: 'TAXRV4321Q', gstin: gstin() })
      .expect(200);
    const pdf = Buffer.from('%PDF-1.4 protected synthetic tax evidence');
    let certificateId = '';
    for (const type of ['PAN_CARD', 'ADDRESS_PROOF', 'GST_CERTIFICATE']) {
      const r = await d.agent
        .post('/v1/dealer/documents/presign')
        .send({ type, fileName: 'synthetic.pdf', mimeType: 'application/pdf', bytes: pdf.length })
        .expect(201);
      const u = new URL(r.body.uploadUrl);
      await d.agent
        .put(u.pathname + u.search)
        .set('Content-Type', 'application/pdf')
        .send(pdf)
        .expect(200);
      await d.agent
        .post(`/v1/dealer/documents/${type}/commit`)
        .send({ documentId: r.body.documentId })
        .expect(200);
      await admin.post(`/v1/admin/documents/${r.body.documentId}/verify`).send({}).expect(200);
      if (type === 'GST_CERTIFICATE') certificateId = r.body.documentId;
    }
    await d.agent.post('/v1/dealer/submit').expect(200);
    await admin.post(`/v1/admin/dealers/${d.dealerId}/approve`).send({}).expect(200);
    const assessment = {
      representativeIdentity: 'Protected synthetic representative case',
      representativeAuthority: 'Synthetic authority reviewed case',
      businessExistence: 'Synthetic business record review case',
      contactValidation: 'Actual local proved contact identities',
      businessType: 'REGISTERED_VEHICLE_DEALER',
      classificationEvidence: 'Synthetic reviewed classification case',
      regulatoryOutcome: 'CHECKED_VALID',
      regulatoryEvidence: 'Synthetic checked authorization case',
      gstOutcome: 'CHECKED_VALID',
      gstEvidence: 'Synthetic checked registration case',
    };
    await admin
      .post(`/v1/admin/dealers/${d.dealerId}/verification`)
      .send({ status: 'IN_REVIEW', expectedVersion: 0 })
      .expect(200);
    await admin
      .post(`/v1/admin/dealers/${d.dealerId}/verification`)
      .send({ status: 'VERIFIED', expectedVersion: 1, assessment })
      .expect(200);
    const detail = await admin.get(`/v1/admin/dealers/${d.dealerId}`).expect(200);
    const certificateUrl = detail.body.documents.find(
      (doc: { id: string }) => doc.id === certificateId,
    ).viewUrl;
    await admin.patch(`/v1/admin/dealers/${d.dealerId}`).send({ gstin: null }).expect(200);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    expect(row.status).toBe('ACTIVE');
    expect(row.verificationStatus).toBe('REVOKED');
    expect(row.gstin).toBeNull();
    const u = new URL(certificateUrl);
    await admin.get(u.pathname + u.search).expect(200);
    expect(
      (await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: certificateId } })).fileName,
    ).toBe('synthetic.pdf');
    const profile = await h.agent().get(`/v1/dealers/${d.slug}`).expect(200);
    expect(profile.body.isVerified).toBe(false);
    expect(profile.body.contact.some((entry: { key: string }) => entry.key === 'gstin')).toBe(
      false,
    );
  });

  it('supports sales-assisted creation without GSTIN and clearing a supplied value', async () => {
    const email = `synthetic-gstin-sales-${randomUUID()}@example.test`;
    await admin.post('/v1/admin/members').send({ email, role: 'SALES_REP' }).expect(201);
    h.google.claims = {
      subject: email,
      email,
      emailVerified: true,
      name: 'Synthetic Sales Representative',
    };
    const sales = h.agent();
    await h.signInAdmin(sales);
    const phone = '9600001111';
    const proof = await sales
      .post('/v1/sales/dealers/phone/verify')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:${randomUUID()}`,
        consent: true,
      })
      .expect(200);
    const created = await sales
      .post('/v1/sales/dealers')
      .send({
        phoneTicket: proof.body.phoneTicket,
        contactName: 'Synthetic Assisted Owner',
        email: `synthetic-assisted-${randomUUID()}@example.test`,
        legalName: `Synthetic Assisted GST ${randomUUID()}`,
        addressLine: '18, Synthetic Road',
        city: 'Katpadi',
        district: 'Vellore',
        state: 'Tamil Nadu',
        pincode: '632007',
        mapsUrl: 'https://maps.app.goo.gl/fixture',
        specialities: ['Hatchbacks'],
        gstin: null,
      })
      .expect(201);
    const id = created.body.id;
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id } })).gstin).toBeNull();
    await sales.patch(`/v1/sales/dealers/${id}`).send({ gstin: gstin() }).expect(200);
    await sales.patch(`/v1/sales/dealers/${id}`).send({ gstin: '' }).expect(200);
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id } })).gstin).toBeNull();
  });

  it('submits and approves a no-GST dealer after its two applicable uploaded documents are reviewed', async () => {
    const d = await f.dealership('DRAFT');
    await d.agent
      .patch('/v1/dealer/onboarding')
      .send({ pan: 'NOGST1234Q', gstin: null })
      .expect(200);
    const pdf = Buffer.from('%PDF-1.4 synthetic local evidence');
    for (const type of ['PAN_CARD', 'ADDRESS_PROOF']) {
      const r = await d.agent
        .post('/v1/dealer/documents/presign')
        .send({ type, fileName: 'synthetic.pdf', mimeType: 'application/pdf', bytes: pdf.length })
        .expect(201);
      const url = new URL(r.body.uploadUrl);
      await d.agent
        .put(url.pathname + url.search)
        .set('Content-Type', 'application/pdf')
        .send(pdf)
        .expect(200);
      await d.agent
        .post(`/v1/dealer/documents/${type}/commit`)
        .send({ documentId: r.body.documentId })
        .expect(200);
      await admin.post(`/v1/admin/documents/${r.body.documentId}/verify`).send({}).expect(200);
    }
    await d.agent.post('/v1/dealer/submit').expect(200);
    const detail = await admin.get(`/v1/admin/dealers/${d.dealerId}`).expect(200);
    expect(detail.body.actions.canApprove).toBe(true);
    const refused = await admin
      .post(`/v1/admin/dealers/${d.dealerId}/approve`)
      .send({})
      .expect(422);
    expect(refused.body.code).toBe('GST_APPLICABILITY_REVIEW_REQUIRED');
    await admin
      .post(`/v1/admin/dealers/${d.dealerId}/approve`)
      .send({ gstNotRequiredReview: 'Synthetic tax applicability review case QA-GST-11.' })
      .expect(200);

    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).status).toBe(
      'ACTIVE',
    );
    expect(
      (
        await h.prisma.dealerDocument.findUniqueOrThrow({
          where: { dealerId_type: { dealerId: d.dealerId, type: 'GST_CERTIFICATE' } },
        })
      ).status,
    ).toBe('REQUIRED');
  });

  it.each([null, '', ' \t\n'])('accepts absence %j and stores null', async (value) => {
    const d = await f.dealership('DRAFT');
    const r = await d.agent.patch('/v1/dealer/onboarding').send({ gstin: value }).expect(200);
    expect(r.body.gstin).toBeNull();
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).gstin,
    ).toBeNull();
  });
  it('normalizes supplied values, preserves omitted patches and permits clearing in draft', async () => {
    const d = await f.dealership('DRAFT');
    const tax = gstin();
    await d.agent
      .patch('/v1/dealer/onboarding')
      .send({ gstin: ` \t${tax.toLowerCase()}\n ` })
      .expect(200);
    await d.agent.patch('/v1/dealer/onboarding').send({ tagline: null }).expect(200);
    expect((await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).gstin).toBe(
      tax,
    );
    await d.agent.patch('/v1/dealer/onboarding').send({ gstin: '' }).expect(200);
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).gstin,
    ).toBeNull();
  });
  it.each(['bad', '33OPTGS1234Q0Z5', 42])('rejects invalid supplied value %j', async (value) => {
    const d = await f.dealership('DRAFT');
    await d.agent.patch('/v1/dealer/onboarding').send({ gstin: value }).expect(400);
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } })).gstin,
    ).toBeNull();
  });
  it('rejects canonical/case duplicates with a GSTIN field error', async () => {
    const a = await f.dealership('DRAFT'),
      b = await f.dealership('DRAFT');
    const tax = gstin();
    await a.agent.patch('/v1/dealer/onboarding').send({ gstin: tax }).expect(200);
    const r = await b.agent
      .patch('/v1/dealer/onboarding')
      .send({ gstin: ` ${tax.toLowerCase()} ` })
      .expect(409);
    expect(r.body.code).toBe('GSTIN_ALREADY_REGISTERED');
    expect(r.body.errors[0].field).toBe('body.gstin');
  });
  it('serializes duplicate tax assignment through the actual database unique index', async () => {
    const a = await f.dealership('DRAFT'),
      b = await f.dealership('DRAFT');
    const tax = gstin();
    const responses = await Promise.all([
      a.agent.patch('/v1/dealer/onboarding').send({ gstin: tax }),
      b.agent.patch('/v1/dealer/onboarding').send({ gstin: tax }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(responses.find((r) => r.status === 409)?.body.code).toBe('GSTIN_ALREADY_REGISTERED');
    expect(await h.prisma.dealer.count({ where: { gstin: tax } })).toBe(1);
  });
  it('allows admin clearing but preserves owner identity and stored optional certificate', async () => {
    const d = await f.dealership();
    const tax = gstin();
    await h.prisma.dealer.update({ where: { id: d.dealerId }, data: { gstin: tax } });
    const doc = await h.prisma.dealerDocument.findUniqueOrThrow({
      where: { dealerId_type: { dealerId: d.dealerId, type: 'GST_CERTIFICATE' } },
    });
    await h.prisma.dealerDocument.update({
      where: { id: doc.id },
      data: { fileName: 'synthetic-certificate.pdf', status: 'UPLOADED' },
    });
    await admin.patch(`/v1/admin/dealers/${d.dealerId}`).send({ gstin: null }).expect(200);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    expect(row.gstin).toBeNull();
    expect(row.status).toBe('ACTIVE');
    expect(
      (
        await h.prisma.dealerMember.findFirstOrThrow({
          where: { dealerId: d.dealerId, role: 'OWNER' },
        })
      ).userId,
    ).toBe(d.userId);
    expect(
      (await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: doc.id } })).fileName,
    ).toBe('synthetic-certificate.pdf');
  });
  it('cannot weaken the active dealer self-edit boundary or forge verification', async () => {
    const d = await f.dealership();
    await d.agent.patch('/v1/dealer').send({ gstin: null }).expect(400);
    await admin
      .patch(`/v1/admin/dealers/${d.dealerId}`)
      .send({ gstin: null, verificationStatus: 'VERIFIED' })
      .expect(400);
  });
  it('database refuses malformed/case-varied raw writes and accepts multiple nulls', async () => {
    const a = await f.dealership(),
      b = await f.dealership();
    await expect(
      h.prisma.dealer.update({ where: { id: a.dealerId }, data: { gstin: 'bad' } }),
    ).rejects.toThrow(/check constraint/);
    await expect(
      h.prisma.dealer.update({ where: { id: a.dealerId }, data: { gstin: gstin().toLowerCase() } }),
    ).rejects.toThrow(/check constraint/);
    await h.prisma.dealer.update({ where: { id: a.dealerId }, data: { gstin: null } });
    await h.prisma.dealer.update({ where: { id: b.dealerId }, data: { gstin: null } });
    expect(
      await h.prisma.dealer.count({ where: { id: { in: [a.dealerId, b.dealerId] }, gstin: null } }),
    ).toBe(2);
  });
  it('omits GSTIN and GST certificate from universal completeness while retaining PAN', async () => {
    const d = await f.dealership('DRAFT');
    const r = await d.agent.get('/v1/dealer/completeness').expect(200);
    const missing = r.body.steps.flatMap((step: { missing: string[] }) => step.missing);
    expect(missing).not.toContain('gstin');
    expect(missing).not.toContain('GST_CERTIFICATE');
    expect(missing).toContain('pan');
    expect(missing).toContain('PAN_CARD');
    await d.agent.patch('/v1/dealer/onboarding').send({ gstin: gstin() }).expect(200);
    const withTax = await d.agent.get('/v1/dealer/completeness').expect(200);
    expect(withTax.body.steps.flatMap((step: { missing: string[] }) => step.missing)).toContain(
      'GST_CERTIFICATE',
    );
  });
});
