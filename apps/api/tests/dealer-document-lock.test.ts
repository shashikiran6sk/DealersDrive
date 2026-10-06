import type { DealerDocType } from '@prisma/client';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { documentKey } from '../src/modules/dealers/dealer-storage-keys.js';
import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';

/**
 * ORIG-BUG-004. Once a dealership has left DRAFT, the KYC documents an admin
 * reviewed are the evidence the approval rests on. Asking for an upload URL
 * used to delete the VERIFIED object and reset the row to UPLOADING, and
 * DELETE reset it to REQUIRED — while the dealer stayed ACTIVE with no
 * re-review. Outside DRAFT a dealer may only fill a slot that is empty,
 * rejected or mid-upload.
 */

const storage = createLocalStorage();
const DOC_TYPES: DealerDocType[] = ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'];
const PDF = Buffer.from('%PDF-1.4');

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let sequence = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'document-lock');
});

afterAll(async () => {
  await h.close();
});

async function upload(agent: request.Agent, type: DealerDocType) {
  const presigned = await agent
    .post('/v1/dealer/documents/presign')
    .send({ type, fileName: 'kyc.pdf', mimeType: 'application/pdf', bytes: PDF.length })
    .expect(201);
  const url = new URL(String(presigned.body.uploadUrl));
  await agent
    .put(url.pathname + url.search)
    .set('Content-Type', 'application/pdf')
    .send(PDF)
    .expect(200);
  return String(presigned.body.documentId);
}

async function application(stage: 'PENDING_APPROVAL' | 'ACTIVE') {
  const dealer = await fixtures.dealership('DRAFT');
  const admin = await fixtures.moderator();
  sequence += 1;
  const number = String(2000 + sequence);
  await dealer.agent
    .patch('/v1/dealer/onboarding')
    .send({ gstin: `33DLOCK${number}B1ZX`, pan: `DLOCK${number}B` })
    .expect(200);
  for (const type of DOC_TYPES) {
    const documentId = await upload(dealer.agent, type);
    await dealer.agent.post(`/v1/dealer/documents/${type}/commit`).send({ documentId }).expect(200);
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
  await dealer.agent.post('/v1/dealer/submit').expect(200);
  if (stage === 'ACTIVE') {
    for (const doc of await rows(dealer.dealerId)) {
      await admin.post(`/v1/admin/documents/${doc.id}/verify`).send({}).expect(200);
    }
    await admin.post(`/v1/admin/dealers/${dealer.dealerId}/approve`).send({}).expect(200);
  }
  return { dealer, admin };
}

async function rows(dealerId: string) {
  return h.prisma.dealerDocument.findMany({ where: { dealerId }, orderBy: { type: 'asc' } });
}

async function snapshot(dealerId: string) {
  const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealerId } });
  const docs = await rows(dealerId);
  return {
    dealerStatus: dealer.status,
    documents: await Promise.all(
      docs.map(async (doc) => ({
        id: doc.id,
        type: doc.type,
        status: doc.status,
        fileName: doc.fileName,
        stored: (await storage.head(documentKey(dealer.slug, doc.type, doc.id))) !== null,
      })),
    ),
  };
}

describe('ORIG-BUG-004 — reviewed KYC documents are locked outside DRAFT', () => {
  it('refuses to presign over a VERIFIED document of an ACTIVE dealer, and keeps the file', async () => {
    const { dealer } = await application('ACTIVE');
    const before = await snapshot(dealer.dealerId);
    expect(before.dealerStatus).toBe('ACTIVE');
    expect(before.documents.every((doc) => doc.status === 'VERIFIED' && doc.stored)).toBe(true);

    const response = await dealer.agent
      .post('/v1/dealer/documents/presign')
      .send({ type: 'PAN_CARD', fileName: 'swap.pdf', mimeType: 'application/pdf', bytes: 8 });

    expect({ http: response.status, code: response.body.code }).toEqual({
      http: 409,
      code: 'DOCUMENT_LOCKED',
    });
    expect(await snapshot(dealer.dealerId)).toEqual(before);
  });

  it('refuses to delete a VERIFIED document of an ACTIVE dealer, and keeps the file', async () => {
    const { dealer } = await application('ACTIVE');
    const before = await snapshot(dealer.dealerId);

    const response = await dealer.agent.delete('/v1/dealer/documents/GST_CERTIFICATE');

    expect({ http: response.status, code: response.body.code }).toEqual({
      http: 409,
      code: 'DOCUMENT_LOCKED',
    });
    expect(await snapshot(dealer.dealerId)).toEqual(before);
  });

  it('refuses to re-commit a VERIFIED document of an ACTIVE dealer back to UPLOADED', async () => {
    const { dealer } = await application('ACTIVE');
    const before = await snapshot(dealer.dealerId);
    const verified = before.documents.find((doc) => doc.type === 'ADDRESS_PROOF');

    const response = await dealer.agent
      .post('/v1/dealer/documents/ADDRESS_PROOF/commit')
      .send({ documentId: verified?.id });

    expect({ http: response.status, code: response.body.code }).toEqual({
      http: 409,
      code: 'DOCUMENT_LOCKED',
    });
    expect(await snapshot(dealer.dealerId)).toEqual(before);
  });

  it('refuses to swap an UPLOADED document while the application is under review', async () => {
    const { dealer } = await application('PENDING_APPROVAL');
    const before = await snapshot(dealer.dealerId);
    expect(before.dealerStatus).toBe('PENDING_APPROVAL');
    expect(before.documents.every((doc) => doc.status === 'UPLOADED' && doc.stored)).toBe(true);

    const presign = await dealer.agent
      .post('/v1/dealer/documents/presign')
      .send({ type: 'PAN_CARD', fileName: 'swap.pdf', mimeType: 'application/pdf', bytes: 8 });
    const removal = await dealer.agent.delete('/v1/dealer/documents/PAN_CARD');

    expect([presign.status, removal.status]).toEqual([409, 409]);
    expect(await snapshot(dealer.dealerId)).toEqual(before);
  });

  it('still lets an ACTIVE dealer re-upload a document an admin rejected', async () => {
    const { dealer, admin } = await application('ACTIVE');
    const rejected = (await rows(dealer.dealerId)).find((doc) => doc.type === 'PAN_CARD');
    await admin
      .post(`/v1/admin/documents/${String(rejected?.id)}/reject`)
      .send({ reason: 'The scan is unreadable.' })
      .expect(200);

    const documentId = await upload(dealer.agent, 'PAN_CARD');
    const committed = await dealer.agent
      .post('/v1/dealer/documents/PAN_CARD/commit')
      .send({ documentId });

    expect(committed.status).toBe(200);
    const after = await snapshot(dealer.dealerId);
    expect(after.dealerStatus).toBe('ACTIVE');
    expect(after.documents.find((doc) => doc.type === 'PAN_CARD')).toMatchObject({
      id: documentId,
      status: 'UPLOADED',
      stored: true,
    });
    expect(
      after.documents.filter((doc) => doc.type !== 'PAN_CARD').map((doc) => doc.status),
    ).toEqual(['VERIFIED', 'VERIFIED']);
  });

  it('still lets a DRAFT dealer replace and remove a committed document', async () => {
    const dealer = await fixtures.dealership('DRAFT');
    const first = await upload(dealer.agent, 'GST_CERTIFICATE');
    await dealer.agent
      .post('/v1/dealer/documents/GST_CERTIFICATE/commit')
      .send({ documentId: first })
      .expect(200);

    const second = await upload(dealer.agent, 'GST_CERTIFICATE');
    await dealer.agent
      .post('/v1/dealer/documents/GST_CERTIFICATE/commit')
      .send({ documentId: second })
      .expect(200);
    const replaced = await snapshot(dealer.dealerId);
    const slug = (await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } })).slug;
    expect(replaced.documents.find((doc) => doc.type === 'GST_CERTIFICATE')).toMatchObject({
      id: second,
      status: 'UPLOADED',
      stored: true,
    });
    expect(await storage.head(documentKey(slug, 'GST_CERTIFICATE', first))).toBeNull();

    await dealer.agent.delete('/v1/dealer/documents/GST_CERTIFICATE').expect(204);
    expect(
      (await snapshot(dealer.dealerId)).documents.find((doc) => doc.type === 'GST_CERTIFICATE'),
    ).toMatchObject({ status: 'REQUIRED', stored: false });
  });
});
