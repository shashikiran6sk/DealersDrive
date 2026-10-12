import { DOC_CATEGORY_TYPES } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { documentKey } from '../src/modules/dealers/dealer-storage-keys.js';
import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import {
  PDF,
  submitDocument,
  submitDocumentSet,
  uploadDocument,
  type Slot,
} from './document-uploads.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * #299 — two evidence categories. Personal Identity Proof and Business Identity
 * Proof, one document each, chosen from the owner-approved lists, uploaded to
 * private storage, read back and checked against the declared type, and
 * reviewed per category.
 */

const storage = createLocalStorage();
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let moderator: request.Agent;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'doc-categories');
  moderator = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

async function draft(): Promise<Dealership> {
  return fixtures.dealership('DRAFT');
}

async function slot(dealerId: string, category: Slot['category']) {
  return h.prisma.dealerDocument.findUniqueOrThrow({
    where: { dealerId_category: { dealerId, category } },
  });
}

async function stored(dealer: Dealership, category: Slot['category']): Promise<boolean> {
  const row = await slot(dealer.dealerId, category);
  return (await storage.head(documentKey(dealer.slug, row.type, row.id))) !== null;
}

describe('registration does not need documents', () => {
  it('creates a draft with two empty slots and lets the dealer resume it later', async () => {
    const dealer = await draft();

    const documents = await dealer.agent.get('/v1/dealer/documents').expect(200);
    expect(documents.body.slots.map((row: { document: unknown }) => row.document)).toEqual([
      null,
      null,
    ]);
    expect(documents.body.gaps).toEqual(['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY']);

    const state = await dealer.agent.get('/v1/dealer/completeness').expect(200);
    expect(state.body.steps[1].complete).toBe(true);
    expect(state.body.steps[2].missing).toEqual(['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY']);
    expect(
      (await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } })).status,
    ).toBe('DRAFT');
  });

  it('refuses to submit without one proof per category, naming what is missing', async () => {
    const dealer = await draft();
    await submitDocument(dealer.agent, '/v1/dealer', {
      category: 'PERSONAL_IDENTITY',
      type: 'PASSPORT',
    });

    const refused = await dealer.agent.post('/v1/dealer/submit').expect(422);
    expect(refused.body.errors.map((entry: { field: string }) => entry.field)).toEqual([
      'BUSINESS_IDENTITY',
    ]);
  });
});

describe('each listed document can be uploaded', () => {
  it.each(DOC_CATEGORY_TYPES.PERSONAL_IDENTITY)('personal proof %s', async (type) => {
    const dealer = await draft();
    await submitDocument(dealer.agent, '/v1/dealer', { category: 'PERSONAL_IDENTITY', type });
    const row = await slot(dealer.dealerId, 'PERSONAL_IDENTITY');
    expect(row).toMatchObject({
      type,
      status: 'UPLOADED',
      submissionCount: 1,
      mimeType: 'application/pdf',
    });
    expect(await stored(dealer, 'PERSONAL_IDENTITY')).toBe(true);
  });

  it.each(
    DOC_CATEGORY_TYPES.BUSINESS_IDENTITY.filter((type) => type !== 'OTHER_BUSINESS_CERTIFICATE'),
  )('business proof %s', async (type) => {
    const dealer = await draft();
    await submitDocument(dealer.agent, '/v1/dealer', { category: 'BUSINESS_IDENTITY', type });
    expect((await slot(dealer.dealerId, 'BUSINESS_IDENTITY')).type).toBe(type);
  });

  it('accepts another government certificate only with a description, which is stored', async () => {
    const dealer = await draft();
    const other = { category: 'BUSINESS_IDENTITY', type: 'OTHER_BUSINESS_CERTIFICATE' } as const;
    await dealer.agent
      .post('/v1/dealer/documents/presign')
      .send({ ...other, fileName: 'licence.pdf', mimeType: 'application/pdf', bytes: PDF.length })
      .expect(400);

    await submitDocument(dealer.agent, '/v1/dealer', other, {
      description: 'Municipal dealer licence issued by Vellore Corporation',
    });
    expect((await slot(dealer.dealerId, 'BUSINESS_IDENTITY')).description).toBe(
      'Municipal dealer licence issued by Vellore Corporation',
    );
  });

  it('accepts a JPEG and a PNG scan as well as a PDF', async () => {
    const dealer = await draft();
    await submitDocument(
      dealer.agent,
      '/v1/dealer',
      { category: 'PERSONAL_IDENTITY', type: 'DRIVING_LICENCE' },
      {
        body: JPEG,
        mimeType: 'image/jpeg',
        fileName: 'licence.jpg',
      },
    );
    await submitDocument(
      dealer.agent,
      '/v1/dealer',
      { category: 'BUSINESS_IDENTITY', type: 'UDYAM' },
      {
        body: PNG,
        mimeType: 'image/png',
        fileName: 'udyam.png',
      },
    );
    const documents = await dealer.agent.get('/v1/dealer/documents').expect(200);
    expect(documents.body.requirementMet).toBe(true);
  });
});

describe('what an upload is refused for', () => {
  const presign = (dealer: Dealership, body: Record<string, unknown>) =>
    dealer.agent.post('/v1/dealer/documents/presign').send({
      category: 'PERSONAL_IDENTITY',
      type: 'PASSPORT',
      fileName: 'p.pdf',
      mimeType: 'application/pdf',
      bytes: 100,
      ...body,
    });

  it.each([
    ['a missing document type', { type: undefined }],
    ['a type from the other category', { type: 'UDYAM' }],
    ['the legacy address proof', { category: 'SUPPORTING', type: 'ADDRESS_PROOF' }],
    ['an invented type', { type: 'CRICKET_CLUB_CARD' }],
    ['an invalid MIME type', { mimeType: 'image/gif', fileName: 'p.gif' }],
    ['an unsupported extension', { fileName: 'p.exe' }],
    ['a file over 5 MB', { bytes: 5 * 1024 * 1024 + 1 }],
    ['a path in the file name', { fileName: '../../secrets.pdf' }],
    ['a dealerId in the body', { dealerId: '11111111-1111-4111-8111-111111111111' }],
  ])('%s is a 400 that names the field', async (_label, change) => {
    const dealer = await draft();
    const response = await presign(dealer, change).expect(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('refuses content that is not what it was declared as, deletes it and empties the slot', async () => {
    const dealer = await draft();
    const documentId = await uploadDocument(
      dealer.agent,
      '/v1/dealer',
      { category: 'PERSONAL_IDENTITY', type: 'PASSPORT' },
      { body: Buffer.from('<html>!!'), fileName: 'passport.pdf' },
    );
    const refused = await dealer.agent
      .post('/v1/dealer/documents/PERSONAL_IDENTITY/commit')
      .send({ documentId })
      .expect(422);
    expect(refused.body.code).toBe('DOCUMENT_CONTENT_MISMATCH');
    const row = await slot(dealer.dealerId, 'PERSONAL_IDENTITY');
    expect(row).toMatchObject({ status: 'REQUIRED', fileName: null });
    expect(await storage.head(documentKey(dealer.slug, 'PASSPORT', documentId))).toBeNull();
  });

  it('refuses a JPEG uploaded as a PDF', async () => {
    const dealer = await draft();
    const documentId = await uploadDocument(
      dealer.agent,
      '/v1/dealer',
      { category: 'BUSINESS_IDENTITY', type: 'UDYAM' },
      { body: JPEG },
    );
    await dealer.agent
      .post('/v1/dealer/documents/BUSINESS_IDENTITY/commit')
      .send({ documentId })
      .expect(422);
  });

  it('leaves an interrupted upload unsubmitted, so it neither counts nor reaches review', async () => {
    const dealer = await draft();
    const presigned = await dealer.agent
      .post('/v1/dealer/documents/presign')
      .send({
        category: 'PERSONAL_IDENTITY',
        type: 'PASSPORT',
        fileName: 'p.pdf',
        mimeType: 'application/pdf',
        bytes: PDF.length,
      })
      .expect(201);
    const missing = await dealer.agent
      .post('/v1/dealer/documents/PERSONAL_IDENTITY/commit')
      .send({ documentId: presigned.body.documentId })
      .expect(422);
    expect(missing.body.code).toBe('UPLOAD_MISSING');
    expect(
      (await dealer.agent.get('/v1/dealer/completeness').expect(200)).body.steps[2].missing,
    ).toContain('PERSONAL_IDENTITY');
    expect((await slot(dealer.dealerId, 'PERSONAL_IDENTITY')).status).toBe('UPLOADING');
  });
});

describe('replacing, deleting and committing twice', () => {
  it('treats a second commit of the same upload as a no-op', async () => {
    const dealer = await draft();
    const slotRef = { category: 'PERSONAL_IDENTITY', type: 'VOTER_ID' } as const;
    const documentId = await submitDocument(dealer.agent, '/v1/dealer', slotRef);
    await dealer.agent
      .post('/v1/dealer/documents/PERSONAL_IDENTITY/commit')
      .send({ documentId })
      .expect(200);
    expect((await slot(dealer.dealerId, 'PERSONAL_IDENTITY')).submissionCount).toBe(1);
  });

  it('replaces a document with another type in the same category and deletes the old object', async () => {
    const dealer = await draft();
    const first = await submitDocument(dealer.agent, '/v1/dealer', {
      category: 'BUSINESS_IDENTITY',
      type: 'UDYAM',
    });
    await submitDocument(dealer.agent, '/v1/dealer', {
      category: 'BUSINESS_IDENTITY',
      type: 'TRADE_LICENSE',
    });

    const rows = await h.prisma.dealerDocument.findMany({
      where: { dealerId: dealer.dealerId, category: 'BUSINESS_IDENTITY' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'TRADE_LICENSE', submissionCount: 2 });
    expect(await storage.head(documentKey(dealer.slug, 'UDYAM', first))).toBeNull();
  });

  it('deletes a document in a draft, emptying the slot and the object', async () => {
    const dealer = await draft();
    const id = await submitDocument(dealer.agent, '/v1/dealer', {
      category: 'PERSONAL_IDENTITY',
      type: 'PASSPORT',
    });
    await dealer.agent.delete('/v1/dealer/documents/PERSONAL_IDENTITY').expect(204);
    expect((await slot(dealer.dealerId, 'PERSONAL_IDENTITY')).status).toBe('REQUIRED');
    expect(await storage.head(documentKey(dealer.slug, 'PASSPORT', id))).toBeNull();
    await dealer.agent.delete('/v1/dealer/documents/PERSONAL_IDENTITY').expect(204);
  });
});

describe('ownership', () => {
  it('404s a commit of another dealership’s upload, and changes nothing', async () => {
    const owner = await draft();
    const other = await draft();
    const documentId = await uploadDocument(owner.agent, '/v1/dealer', {
      category: 'PERSONAL_IDENTITY',
      type: 'PASSPORT',
    });

    await other.agent
      .post('/v1/dealer/documents/PERSONAL_IDENTITY/commit')
      .send({ documentId })
      .expect(404);
    expect((await slot(owner.dealerId, 'PERSONAL_IDENTITY')).status).toBe('UPLOADING');
  });

  it('only the owner can upload: a staff member is refused', async () => {
    const owner = await draft();
    const staff = await fixtures.member(owner, 'STAFF');
    await staff.agent
      .post('/v1/dealer/documents/presign')
      .send({
        category: 'PERSONAL_IDENTITY',
        type: 'PASSPORT',
        fileName: 'p.pdf',
        mimeType: 'application/pdf',
        bytes: 8,
      })
      .expect(403);
  });

  it('serves documents to a reviewer only through a short-lived signed URL, never to the public', async () => {
    const dealer = await draft();
    await submitDocumentSet(dealer.agent, '/v1/dealer', [
      { category: 'PERSONAL_IDENTITY', type: 'PASSPORT' },
      { category: 'BUSINESS_IDENTITY', type: 'UDYAM' },
    ]);
    const detail = await moderator.get(`/v1/admin/dealers/${dealer.dealerId}`).expect(200);
    const urls: string[] = detail.body.documents.map((doc: { viewUrl: string }) => doc.viewUrl);
    expect(urls).toHaveLength(2);
    for (const url of urls) expect(url).toMatch(/expires|signature|X-Amz|sig=/i);

    const support = await fixtures.staff('SUPPORT');
    const redacted = await support.get(`/v1/admin/dealers/${dealer.dealerId}`).expect(200);
    for (const doc of redacted.body.documents) {
      expect(doc).toMatchObject({ viewUrl: null, fileName: null, description: null });
    }
    const unauthenticated = await h.agent().get(`/v1/dealers/${dealer.slug}`);
    expect(JSON.stringify(unauthenticated.body)).not.toContain('documents/');
  });
});

describe('admin review, per category', () => {
  async function submitted() {
    const dealer = await draft();
    await submitDocumentSet(dealer.agent, '/v1/dealer', [
      { category: 'PERSONAL_IDENTITY', type: 'VOTER_ID' },
      { category: 'BUSINESS_IDENTITY', type: 'SHOP_ESTABLISHMENT' },
    ]);
    await dealer.agent.post('/v1/dealer/submit').expect(200);
    return {
      dealer,
      personal: await slot(dealer.dealerId, 'PERSONAL_IDENTITY'),
      business: await slot(dealer.dealerId, 'BUSINESS_IDENTITY'),
    };
  }

  it('approves the personal proof and rejects the business proof independently, with a reason and history', async () => {
    const { dealer, personal, business } = await submitted();

    await moderator.post(`/v1/admin/documents/${personal.id}/verify`).send({}).expect(200);
    const rejected = await moderator
      .post(`/v1/admin/documents/${business.id}/reject`)
      .send({ reason: 'The certificate number is not legible.' })
      .expect(200);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', dealerReturnedToDraft: true });

    expect((await slot(dealer.dealerId, 'PERSONAL_IDENTITY')).status).toBe('VERIFIED');
    expect(await slot(dealer.dealerId, 'BUSINESS_IDENTITY')).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'The certificate number is not legible.',
    });

    const dealerView = await dealer.agent.get('/v1/dealer/documents').expect(200);
    expect(dealerView.body.slots[1].document).toMatchObject({
      status: 'REJECTED',
      action: 'Resubmit',
      rejectionReason: 'The certificate number is not legible.',
    });

    const detail = await moderator.get(`/v1/admin/dealers/${dealer.dealerId}`).expect(200);
    expect(
      detail.body.documentHistory.map((entry: { action: string; category: string }) => [
        entry.action,
        entry.category,
      ]),
    ).toEqual([
      ['REJECTED', 'BUSINESS_IDENTITY'],
      ['VERIFIED', 'PERSONAL_IDENTITY'],
      ['SUBMITTED', 'BUSINESS_IDENTITY'],
      ['SUBMITTED', 'PERSONAL_IDENTITY'],
    ]);
    expect(detail.body.documentHistory[0].reason).toBe('The certificate number is not legible.');
  });

  it('identifies a resubmission and reviews it afresh', async () => {
    const { dealer, business } = await submitted();
    await moderator
      .post(`/v1/admin/documents/${business.id}/reject`)
      .send({ reason: 'Expired certificate.' })
      .expect(200);

    await submitDocument(dealer.agent, '/v1/dealer', {
      category: 'BUSINESS_IDENTITY',
      type: 'TRADE_LICENSE',
    });
    const resubmitted = await slot(dealer.dealerId, 'BUSINESS_IDENTITY');
    expect(resubmitted).toMatchObject({
      status: 'UPLOADED',
      submissionCount: 2,
      rejectionReason: null,
    });

    await moderator.post(`/v1/admin/documents/${resubmitted.id}/verify`).send({}).expect(200);
    expect((await slot(dealer.dealerId, 'BUSINESS_IDENTITY')).status).toBe('VERIFIED');
  });

  it('refuses a duplicate verification and a rejection of an empty slot', async () => {
    const { dealer, personal } = await submitted();
    await moderator.post(`/v1/admin/documents/${personal.id}/verify`).send({}).expect(200);
    const twice = await moderator
      .post(`/v1/admin/documents/${personal.id}/verify`)
      .send({})
      .expect(422);
    expect(twice.body.code).toBe('DOCUMENT_NOT_UPLOADED');

    const other = await draft();
    const empty = await slot(other.dealerId, 'PERSONAL_IDENTITY');
    const refused = await moderator
      .post(`/v1/admin/documents/${empty.id}/reject`)
      .send({ reason: 'Nothing to review here.' })
      .expect(409);
    expect(refused.body.code).toBe('DOCUMENT_NOT_REVIEWABLE');
    expect((await slot(dealer.dealerId, 'PERSONAL_IDENTITY')).status).toBe('VERIFIED');
  });

  it('lets exactly one of two concurrent verifications of a document win', async () => {
    const { personal } = await submitted();
    const results = await Promise.all([
      moderator.post(`/v1/admin/documents/${personal.id}/verify`).send({}),
      moderator.post(`/v1/admin/documents/${personal.id}/verify`).send({}),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 422].sort());
    const row = await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: personal.id } });
    expect(['VERIFIED', 'REJECTED']).toContain(row.status);
  });

  it('refuses review to a role without document review', async () => {
    const { personal } = await submitted();
    const support = await fixtures.staff('SUPPORT');
    await support.post(`/v1/admin/documents/${personal.id}/verify`).send({}).expect(403);
    expect(
      (await h.prisma.dealerDocument.findUniqueOrThrow({ where: { id: personal.id } })).status,
    ).toBe('UPLOADED');
  });

  it('approves the dealership on a verified proof from each category, without a PAN number', async () => {
    const { dealer, personal, business } = await submitted();
    await h.prisma.dealer.update({ where: { id: dealer.dealerId }, data: { pan: null } });
    await moderator.post(`/v1/admin/documents/${personal.id}/verify`).send({}).expect(200);
    await moderator.post(`/v1/admin/documents/${business.id}/verify`).send({}).expect(200);
    await moderator.post(`/v1/admin/dealers/${dealer.dealerId}/approve`).send({}).expect(200);
    const approved = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
    expect(approved).toMatchObject({ status: 'ACTIVE', verificationStatus: 'NOT_VERIFIED' });
  });

  it('keeps document approval separate from Dealer Verified', async () => {
    const { dealer, personal, business } = await submitted();
    await moderator.post(`/v1/admin/documents/${personal.id}/verify`).send({}).expect(200);
    await moderator.post(`/v1/admin/documents/${business.id}/verify`).send({}).expect(200);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
    expect(row.verificationStatus).toBe('NOT_VERIFIED');
  });
});

describe('a legacy application keeps working', () => {
  it('approves a submitted application that holds the PAN and address-proof set', async () => {
    const dealer = await draft();
    const personal = await slot(dealer.dealerId, 'PERSONAL_IDENTITY');
    await h.prisma.dealerDocument.delete({
      where: { dealerId_category: { dealerId: dealer.dealerId, category: 'BUSINESS_IDENTITY' } },
    });
    const address = await h.prisma.dealerDocument.create({
      data: {
        dealerId: dealer.dealerId,
        category: 'SUPPORTING',
        type: 'ADDRESS_PROOF',
        status: 'REQUIRED',
      },
    });
    for (const doc of [personal, address]) {
      await storage.put(documentKey(dealer.slug, doc.type, doc.id), PDF, 'application/pdf');
      await h.prisma.dealerDocument.update({
        where: { id: doc.id },
        data: {
          status: 'UPLOADED',
          fileName: 'legacy.pdf',
          mimeType: 'application/pdf',
          bytes: PDF.length,
        },
      });
    }
    await dealer.agent.post('/v1/dealer/submit').expect(200);
    for (const doc of [personal, address]) {
      await moderator.post(`/v1/admin/documents/${doc.id}/verify`).send({}).expect(200);
    }
    await moderator.post(`/v1/admin/dealers/${dealer.dealerId}/approve`).send({}).expect(200);
  });
});
