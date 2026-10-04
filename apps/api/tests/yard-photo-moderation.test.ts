import { randomUUID } from 'node:crypto';

import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { yardPhotoKey } from '../src/modules/dealers/dealer-storage-keys.js';
import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * ORIG-BUG-005 and BUG-NEW-009. The yard photograph fronts a dealership's
 * public portfolio, and an admin sees it when approving the application. An
 * ACTIVE dealer could replace or delete it directly through the API with no
 * review — while a tagline edit waits for a moderator — and the image went on
 * being served publicly after the dealership was suspended. Outside DRAFT the
 * photograph is now locked, and it is public only while its dealership is
 * ACTIVE and it is that dealership's current cover.
 */

const storage = createLocalStorage();
const PDF = Buffer.from('%PDF-1.4');
const JPEG = Buffer.from('\xff\xd8\xff a fixture yard photograph', 'binary');

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let admin: request.Agent;
let sequence = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'yard-moderation');
  admin = await fixtures.moderator();
});

afterAll(async () => {
  await h.close();
});

async function put(agent: request.Agent, uploadUrl: unknown, type: string, body: Buffer) {
  const url = new URL(String(uploadUrl));
  await agent
    .put(url.pathname + url.search)
    .set('Content-Type', type)
    .send(body)
    .expect(200);
}

async function uploadYard(agent: request.Agent) {
  const presigned = await agent
    .post('/v1/dealer/yard-photo/presign')
    .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
    .expect(201);
  await put(agent, presigned.body.uploadUrl, 'image/jpeg', JPEG);
  await agent
    .post('/v1/dealer/yard-photo/commit')
    .send({ mediaId: presigned.body.mediaId })
    .expect(200);
  return String(presigned.body.mediaId);
}

async function application(stage: 'PENDING_APPROVAL' | 'ACTIVE') {
  const dealer = await fixtures.dealership('DRAFT');
  sequence += 1;
  const number = String(3000 + sequence);
  await dealer.agent
    .patch('/v1/dealer/onboarding')
    .send({ gstin: `33YARDM${number}B1ZX`, pan: `YARDM${number}B` })
    .expect(200);
  for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
    const presigned = await dealer.agent
      .post('/v1/dealer/documents/presign')
      .send({ type, fileName: 'kyc.pdf', mimeType: 'application/pdf', bytes: PDF.length })
      .expect(201);
    await put(dealer.agent, presigned.body.uploadUrl, 'application/pdf', PDF);
    await dealer.agent
      .post(`/v1/dealer/documents/${type}/commit`)
      .send({ documentId: presigned.body.documentId })
      .expect(200);
  }
  const cover = await uploadYard(dealer.agent);
  await dealer.agent.post('/v1/dealer/submit').expect(200);
  if (stage === 'ACTIVE') {
    const docs = await h.prisma.dealerDocument.findMany({ where: { dealerId: dealer.dealerId } });
    for (const doc of docs) {
      await admin.post(`/v1/admin/documents/${doc.id}/verify`).send({}).expect(200);
    }
    await admin.post(`/v1/admin/dealers/${dealer.dealerId}/approve`).send({}).expect(200);
  }
  return { dealer, cover };
}

async function state(dealer: Dealership) {
  const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
  const media = row.coverMediaId
    ? await h.prisma.media.findUniqueOrThrow({ where: { id: row.coverMediaId } })
    : null;
  return {
    dealerStatus: row.status,
    coverMediaId: row.coverMediaId,
    coverStatus: media?.status ?? null,
    stored: media ? (await storage.head(media.storageKey)) !== null : false,
    covers: await h.prisma.media.count({
      where: { dealerId: dealer.dealerId, ownerType: 'DEALER_COVER' },
    }),
  };
}

function served(mediaId: string) {
  return h.agent().get(`/media/by-media/${mediaId}/640.webp`);
}

describe('ORIG-BUG-005 — the yard photograph is locked once a dealership leaves DRAFT', () => {
  it('refuses a new upload URL for an ACTIVE dealer and creates nothing', async () => {
    const { dealer } = await application('ACTIVE');
    const before = await state(dealer);

    const response = await dealer.agent
      .post('/v1/dealer/yard-photo/presign')
      .send({ fileName: 'swap.jpg', mimeType: 'image/jpeg', bytes: JPEG.length });

    expect({ http: response.status, code: response.body.code }).toEqual({
      http: 409,
      code: 'YARD_PHOTO_LOCKED',
    });
    expect(await state(dealer)).toEqual(before);
  });

  it('refuses to commit a replacement for an ACTIVE dealer and keeps the approved cover', async () => {
    const { dealer, cover } = await application('ACTIVE');
    const slug = (await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } })).slug;
    const swapId = randomUUID();
    await h.prisma.media.create({
      data: {
        id: swapId,
        dealerId: dealer.dealerId,
        ownerType: 'DEALER_COVER',
        storageKey: yardPhotoKey(slug, swapId),
        mimeType: 'image/jpeg',
        bytes: JPEG.length,
        fileName: 'swap.jpg',
        warnings: [],
        status: 'PENDING',
      },
    });
    await storage.put(yardPhotoKey(slug, swapId), JPEG, 'image/jpeg');
    const before = await state(dealer);

    const response = await dealer.agent
      .post('/v1/dealer/yard-photo/commit')
      .send({ mediaId: swapId });

    expect({ http: response.status, code: response.body.code }).toEqual({
      http: 409,
      code: 'YARD_PHOTO_LOCKED',
    });
    expect(await state(dealer)).toEqual(before);
    expect(before.coverMediaId).toBe(cover);
  });

  it('refuses to delete the cover of an ACTIVE dealer and keeps serving it', async () => {
    const { dealer, cover } = await application('ACTIVE');
    const before = await state(dealer);

    const response = await dealer.agent.delete('/v1/dealer/yard-photo');

    expect({ http: response.status, code: response.body.code }).toEqual({
      http: 409,
      code: 'YARD_PHOTO_LOCKED',
    });
    expect(await state(dealer)).toEqual(before);
    await served(cover).expect(200);
  });

  it('refuses to swap the photograph while the application is under review', async () => {
    const { dealer } = await application('PENDING_APPROVAL');
    const before = await state(dealer);

    const presign = await dealer.agent
      .post('/v1/dealer/yard-photo/presign')
      .send({ fileName: 'swap.jpg', mimeType: 'image/jpeg', bytes: JPEG.length });
    const removal = await dealer.agent.delete('/v1/dealer/yard-photo');

    expect([presign.status, removal.status]).toEqual([409, 409]);
    expect(await state(dealer)).toEqual(before);
  });

  it('still lets a DRAFT dealer replace and remove the photograph', async () => {
    const dealer = await fixtures.dealership('DRAFT');
    const first = await uploadYard(dealer.agent);
    const second = await uploadYard(dealer.agent);

    expect((await state(dealer)).coverMediaId).toBe(second);
    expect((await h.prisma.media.findUniqueOrThrow({ where: { id: first } })).status).toBe(
      'ORPHAN',
    );

    await dealer.agent.delete('/v1/dealer/yard-photo').expect(204);
    expect((await state(dealer)).coverMediaId).toBeNull();
  });
});

describe('BUG-NEW-009 — the yard photograph is public only while its dealership is', () => {
  it('stops serving the cover while the dealership is suspended, and serves it again on reinstatement', async () => {
    const { dealer, cover } = await application('ACTIVE');
    await served(cover).expect(200);

    await admin
      .post(`/v1/admin/dealers/${dealer.dealerId}/suspend`)
      .send({ reason: 'Suspended for a yard photograph visibility check.' })
      .expect(200);
    const suspended = await served(cover);

    await admin.post(`/v1/admin/dealers/${dealer.dealerId}/reinstate`).send({}).expect(200);
    const reinstated = await served(cover);

    expect({
      suspended: suspended.status,
      cacheControl: suspended.headers['cache-control'],
      reinstated: reinstated.status,
    }).toEqual({ suspended: 404, cacheControl: 'no-store', reinstated: 200 });
  });

  it('does not serve the cover of a dealership that has not been approved', async () => {
    const draft = await fixtures.dealership('DRAFT');
    const draftCover = await uploadYard(draft.agent);
    const { cover: pendingCover } = await application('PENDING_APPROVAL');

    expect([(await served(draftCover)).status, (await served(pendingCover)).status]).toEqual([
      404, 404,
    ]);
  });
});
