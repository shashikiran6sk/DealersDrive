import { documentCategoryOf, type DocumentCommitInput } from '@dealers-drive/contracts';
import type { DealerDocType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import { GSTIN_CHANGED_REASON } from '../src/modules/dealers/dealers.messages.js';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { submitDocument, uploadDocument } from './document-uploads.js';
import { createAuthHarness, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';
import { proveEmail } from './sales-kit.js';
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

/**
 * **L7** — the GSTIN is entered with the GST certificate. Presign, `PUT` and
 * commit one document, sending `gstin` with the commit when it is given, and
 * hand back the commit response unasserted.
 */
async function commit(
  agent: request.Agent,
  type: DealerDocType,
  gstinValue?: unknown,
  base = '/v1/dealer',
) {
  const category = documentCategoryOf(type);
  if (category === 'SUPPORTING') throw new Error(`${type} is not a selectable proof`);
  const documentId = await uploadDocument(agent, base, { category, type });
  const response = await agent
    .post(`${base}/documents/${category}/commit`)
    .send({ documentId, ...(gstinValue === undefined ? {} : { gstin: gstinValue }) });
  return { documentId, response };
}

async function stored(dealerId: string) {
  return h.prisma.dealer.findUniqueOrThrow({ where: { id: dealerId } });
}

/** Submitted, approved and Dealer Verified through the real routes, with `tax` on the certificate. */
async function verifiedDealership(tax: string) {
  const d = await f.dealership('DRAFT');
  let certificateId = '';
  for (const type of ['PAN_CARD', 'GST_CERTIFICATE'] as const) {
    const { documentId, response } = await commit(
      d.agent,
      type,
      type === 'GST_CERTIFICATE' ? tax : undefined,
    );
    expect(response.status).toBe(200);
    await admin.post(`/v1/admin/documents/${documentId}/verify`).send({}).expect(200);
    if (type === 'GST_CERTIFICATE') certificateId = documentId;
  }
  await d.agent.post('/v1/dealer/submit').expect(200);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/approve`).send({}).expect(200);
  await admin
    .post(`/v1/admin/dealers/${d.dealerId}/verification`)
    .send({ status: 'IN_REVIEW', expectedVersion: 0 })
    .expect(200);
  await admin
    .post(`/v1/admin/dealers/${d.dealerId}/verification`)
    .send({ status: 'VERIFIED', expectedVersion: 1 })
    .expect(200);
  return { d, certificateId };
}

async function salesRep(): Promise<request.Agent> {
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
  return sales;
}

async function assistedDraft(sales: request.Agent, phone: string) {
  const proof = await sales
    .post('/v1/sales/dealers/phone/verify')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:${randomUUID()}`,
      consent: true,
    })
    .expect(200);
  const { emailTicket } = await proveEmail(
    h,
    sales,
    `synthetic-assisted-${randomUUID()}@example.test`,
  );
  const created = await sales
    .post('/v1/sales/dealers')
    .send({
      phoneTicket: proof.body.phoneTicket,
      emailTicket,
      contactName: 'Synthetic Assisted Owner',
      legalName: `Synthetic Assisted GST ${randomUUID()}`,
      addressLine: '18, Synthetic Road',
      city: 'Katpadi',
      district: 'Vellore',
      state: 'Tamil Nadu',
      pincode: '632007',
      mapsUrl: 'https://maps.app.goo.gl/fixture',
      specialities: ['Hatchbacks'],
    })
    .expect(201);
  return String(created.body.id);
}

describe('optional GSTIN API and stored invariant', () => {
  it('clearing tax identity revokes genuine verification and retains protected evidence bytes', async () => {
    const { d, certificateId } = await verifiedDealership(gstin());
    const detail = await admin.get(`/v1/admin/dealers/${d.dealerId}`).expect(200);
    const certificateUrl = detail.body.documents.find(
      (doc: { id: string }) => doc.id === certificateId,
    ).viewUrl;
    await admin.patch(`/v1/admin/dealers/${d.dealerId}`).send({ gstin: null }).expect(200);
    const row = await stored(d.dealerId);
    expect(row.status).toBe('ACTIVE');
    expect(row.verificationStatus).toBe('REVOKED');
    expect(row.gstin).toBeNull();
    const u = new URL(certificateUrl);
    await admin.get(u.pathname + u.search).expect(200);
    expect(
      (await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: certificateId } })).fileName,
    ).toBe('proof.pdf');
    const profile = await h.agent().get(`/v1/dealers/${d.slug}`).expect(200);
    expect(profile.body.isVerified).toBe(false);
    expect(profile.body.contact.some((entry: { key: string }) => entry.key === 'gstin')).toBe(
      false,
    );
  });

  it('creates a sales-assisted dealership with no GSTIN, which the business proof then sets and clears', async () => {
    const sales = await salesRep();
    const id = await assistedDraft(sales, '9600001111');
    const base = `/v1/sales/dealers/${id}`;
    expect((await stored(id)).gstin).toBeNull();

    const tax = gstin();
    const set = await commit(sales, 'GST_CERTIFICATE', tax.toLowerCase(), base);
    expect(set.response.status).toBe(200);
    expect((await stored(id)).gstin).toBe(tax);

    const refused = await commit(sales, 'UDYAM', gstin(), base);
    expect(refused.response.status).toBe(422);
    expect(refused.response.body.code).toBe('GSTIN_NEEDS_GST_CERTIFICATE');
    expect((await stored(id)).gstin).toBe(tax);

    const cleared = await commit(sales, 'UDYAM', undefined, base);
    expect(cleared.response.status).toBe(200);
    expect((await stored(id)).gstin).toBeNull();
  });

  it('submits and approves a no-GST dealer after its two applicable uploaded documents are reviewed', async () => {
    const d = await f.dealership('DRAFT');
    for (const type of ['PAN_CARD', 'UDYAM'] as const) {
      const { documentId, response } = await commit(d.agent, type);
      expect(response.status).toBe(200);
      await admin.post(`/v1/admin/documents/${documentId}/verify`).send({}).expect(200);
    }
    await d.agent.post('/v1/dealer/submit').expect(200);
    const detail = await admin.get(`/v1/admin/dealers/${d.dealerId}`).expect(200);
    expect(detail.body.actions.canApprove).toBe(true);
    await admin.post(`/v1/admin/dealers/${d.dealerId}/approve`).send({}).expect(200);

    expect((await stored(d.dealerId)).status).toBe('ACTIVE');
    expect(
      (
        await h.prisma.dealerDocument.findUniqueOrThrow({
          where: { dealerId_category: { dealerId: d.dealerId, category: 'BUSINESS_IDENTITY' } },
        })
      ).type,
    ).toBe('UDYAM');
  });

  it('is not a field of the onboarding form', async () => {
    const d = await f.dealership('DRAFT');
    const refused = await d.agent
      .patch('/v1/dealer/onboarding')
      .send({ gstin: gstin() })
      .expect(400);
    expect(refused.body.errors).toEqual([
      expect.objectContaining({ field: 'body.gstin', code: 'UNRECOGNIZED_KEY' }),
    ]);
    expect((await stored(d.dealerId)).gstin).toBeNull();
  });

  it.each([null, '', ' \t\n', undefined])(
    'a GST certificate committed with %j records no GSTIN',
    async (value) => {
      const d = await f.dealership('DRAFT');
      expect((await commit(d.agent, 'GST_CERTIFICATE', gstin())).response.status).toBe(200);
      const { response } = await commit(d.agent, 'GST_CERTIFICATE', value);
      expect(response.status).toBe(200);
      expect((await stored(d.dealerId)).gstin).toBeNull();
    },
  );

  it('normalizes the GSTIN on the certificate, and an unrelated edit leaves it alone', async () => {
    const d = await f.dealership('DRAFT');
    const tax = gstin();
    const { response } = await commit(d.agent, 'GST_CERTIFICATE', ` \t${tax.toLowerCase()}\n `);
    expect(response.status).toBe(200);
    await d.agent.patch('/v1/dealer/onboarding').send({ tagline: null }).expect(200);
    expect((await stored(d.dealerId)).gstin).toBe(tax);
    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { dealerId: d.dealerId, action: 'document.submitted' },
    });
    expect(audit.after).toMatchObject({ type: 'GST_CERTIFICATE', gstinChanged: true });
  });

  it('clears the GSTIN when another business proof replaces the certificate', async () => {
    const d = await f.dealership('DRAFT');
    expect((await commit(d.agent, 'GST_CERTIFICATE', gstin())).response.status).toBe(200);
    expect((await commit(d.agent, 'UDYAM')).response.status).toBe(200);
    expect((await stored(d.dealerId)).gstin).toBeNull();
  });

  it('leaves the GSTIN alone when a personal identity proof is committed', async () => {
    const d = await f.dealership('DRAFT');
    const tax = gstin();
    expect((await commit(d.agent, 'GST_CERTIFICATE', tax)).response.status).toBe(200);
    expect((await commit(d.agent, 'PAN_CARD')).response.status).toBe(200);
    expect((await stored(d.dealerId)).gstin).toBe(tax);
  });

  it.each(['PAN_CARD', 'UDYAM'] as const)(
    'refuses a GSTIN with a %s, and changes nothing',
    async (type) => {
      const d = await f.dealership('DRAFT');
      const tax = gstin();
      expect((await commit(d.agent, 'GST_CERTIFICATE', tax)).response.status).toBe(200);
      const { documentId, response } = await commit(d.agent, type, gstin());
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('GSTIN_NEEDS_GST_CERTIFICATE');
      expect(response.body.errors?.[0]).toMatchObject({
        field: 'body.gstin',
        code: 'GSTIN_NEEDS_GST_CERTIFICATE',
      });
      expect((await stored(d.dealerId)).gstin).toBe(tax);
      expect(
        (await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: documentId } })).status,
      ).toBe('UPLOADING');
      expect(
        await h.prisma.auditLog.count({
          where: { entityId: documentId, action: 'document.submitted' },
        }),
      ).toBe(0);
    },
  );

  it.each(['bad', '33OPTGS1234Q0Z5', 42])('rejects invalid supplied value %j', async (value) => {
    const d = await f.dealership('DRAFT');
    const { response } = await commit(d.agent, 'GST_CERTIFICATE', value);
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.errors)).toContain('body.gstin');
    expect((await stored(d.dealerId)).gstin).toBeNull();
  });

  it('rejects canonical/case duplicates with a GSTIN field error', async () => {
    const a = await f.dealership('DRAFT'),
      b = await f.dealership('DRAFT');
    const tax = gstin();
    expect((await commit(a.agent, 'GST_CERTIFICATE', tax)).response.status).toBe(200);
    const { documentId, response } = await commit(
      b.agent,
      'GST_CERTIFICATE',
      ` ${tax.toLowerCase()} `,
    );
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('GSTIN_ALREADY_REGISTERED');
    expect(response.body.errors[0].field).toBe('body.gstin');
    expect((await stored(b.dealerId)).gstin).toBeNull();
    expect(
      (await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: documentId } })).status,
    ).toBe('UPLOADING');
  });

  it('lets a dealership re-commit a certificate with its own GSTIN', async () => {
    const d = await f.dealership('DRAFT');
    const tax = gstin();
    expect((await commit(d.agent, 'GST_CERTIFICATE', tax)).response.status).toBe(200);
    const again = await commit(d.agent, 'GST_CERTIFICATE', tax);
    expect(again.response.status).toBe(200);
    expect((await stored(d.dealerId)).gstin).toBe(tax);
    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { entityId: again.documentId, action: 'document.submitted' },
    });
    expect(audit.after).not.toHaveProperty('gstinChanged');
  });

  it('serializes duplicate tax assignment through the actual database unique index', async () => {
    const a = await f.dealership('DRAFT'),
      b = await f.dealership('DRAFT');
    const tax = gstin();
    const ids = await Promise.all(
      [a, b].map((d: Dealership) =>
        uploadDocument(d.agent, '/v1/dealer', {
          category: 'BUSINESS_IDENTITY',
          type: 'GST_CERTIFICATE',
        }),
      ),
    );
    const bodies: DocumentCommitInput[] = ids.map((documentId) => ({ documentId, gstin: tax }));
    const responses = await Promise.all([
      a.agent.post('/v1/dealer/documents/BUSINESS_IDENTITY/commit').send(bodies[0]),
      b.agent.post('/v1/dealer/documents/BUSINESS_IDENTITY/commit').send(bodies[1]),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(responses.find((r) => r.status === 409)?.body.code).toBe('GSTIN_ALREADY_REGISTERED');
    expect(await h.prisma.dealer.count({ where: { gstin: tax } })).toBe(1);
  });

  /**
   * A Dealer Verified business whose business proof is replaced. Through the
   * routes alone the slot is reopened by an admin rejection, which revokes the
   * badge on its own; the slot is reopened directly here so that what is
   * asserted is the commit's own invalidation when the GSTIN moves.
   */
  it('revokes Dealer Verified when a new certificate changes the GSTIN', async () => {
    const { d, certificateId } = await verifiedDealership(gstin());
    await h.prisma.dealerDocument.update({
      where: { id: certificateId },
      data: { status: 'REJECTED', rejectionReason: 'Synthetic: superseded certificate.' },
    });
    const replacement = gstin();
    const { documentId, response } = await commit(d.agent, 'GST_CERTIFICATE', replacement);
    expect(response.status).toBe(200);

    const row = await stored(d.dealerId);
    expect(row).toMatchObject({
      status: 'ACTIVE',
      gstin: replacement,
      verificationStatus: 'REVOKED',
      verificationVersion: 3,
    });
    const personal = await h.prisma.dealerDocument.findUniqueOrThrow({
      where: { dealerId_category: { dealerId: d.dealerId, category: 'PERSONAL_IDENTITY' } },
    });
    expect(personal.status).toBe('UPLOADED');
    const decided = await h.prisma.auditLog.findFirstOrThrow({
      where: { dealerId: d.dealerId, action: 'dealer.verification.decided' },
      orderBy: { createdAt: 'desc' },
    });
    expect(decided.after).toMatchObject({ status: 'REVOKED', reason: GSTIN_CHANGED_REASON });
    const submitted = await h.prisma.auditLog.findFirstOrThrow({
      where: { entityId: documentId, action: 'document.submitted' },
    });
    expect(submitted.after).toMatchObject({ gstinChanged: true });
    expect((await h.agent().get(`/v1/dealers/${d.slug}`).expect(200)).body.isVerified).toBe(false);
  });

  it('keeps Dealer Verified when a new certificate carries the same GSTIN', async () => {
    const tax = gstin();
    const { d, certificateId } = await verifiedDealership(tax);
    await h.prisma.dealerDocument.update({
      where: { id: certificateId },
      data: { status: 'REJECTED', rejectionReason: 'Synthetic: unreadable scan.' },
    });
    const { response } = await commit(d.agent, 'GST_CERTIFICATE', tax);
    expect(response.status).toBe(200);
    expect(await stored(d.dealerId)).toMatchObject({ gstin: tax, verificationStatus: 'VERIFIED' });
  });

  it('allows admin clearing but preserves owner identity and stored optional certificate', async () => {
    const d = await f.dealership();
    const tax = gstin();
    await h.prisma.dealer.update({ where: { id: d.dealerId }, data: { gstin: tax } });
    const doc = await h.prisma.dealerDocument.findUniqueOrThrow({
      where: { dealerId_category: { dealerId: d.dealerId, category: 'BUSINESS_IDENTITY' } },
    });
    await h.prisma.dealerDocument.update({
      where: { id: doc.id },
      data: { fileName: 'synthetic-certificate.pdf', status: 'UPLOADED' },
    });
    await admin.patch(`/v1/admin/dealers/${d.dealerId}`).send({ gstin: null }).expect(200);
    const row = await stored(d.dealerId);
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
  it('omits GSTIN and the GST certificate from universal completeness, asking for one proof per category', async () => {
    const d = await f.dealership('DRAFT');
    const r = await d.agent.get('/v1/dealer/completeness').expect(200);
    const missing = r.body.steps.flatMap((step: { missing: string[] }) => step.missing);
    expect(missing).not.toContain('gstin');
    expect(missing).not.toContain('GST_CERTIFICATE');
    expect(missing).not.toContain('pan');
    expect(missing).toEqual(expect.arrayContaining(['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY']));
    await submitDocument(d.agent, '/v1/dealer', { category: 'BUSINESS_IDENTITY', type: 'UDYAM' });
    await admin.patch(`/v1/admin/dealers/${d.dealerId}`).send({ gstin: gstin() }).expect(200);
    const withTax = await d.agent.get('/v1/dealer/completeness').expect(200);
    expect(withTax.body.steps.flatMap((step: { missing: string[] }) => step.missing)).toContain(
      'GST_CERTIFICATE',
    );
  });
});
