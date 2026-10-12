import { randomUUID } from 'node:crypto';

import { PORTFOLIO_PHOTO_LIMIT } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { portfolioKey } from '../src/modules/dealers/dealer-storage-keys.js';
import { createLocalStorage } from '../src/platform/storage/local.adapter.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * #299 — dealer portfolio photographs. Optional, never identity evidence, and
 * moderated: a new or replacement photograph is private and PENDING until a
 * reviewer approves it. An approved photograph stays public until the
 * replacement for it is approved, and then the two swap in one transaction.
 *
 * Carries forward the guarantee of the yard-photo suite it replaces
 * (BUG-NEW-009): a dealership photograph is public only while the dealership is
 * ACTIVE.
 */

const storage = createLocalStorage();
const JPEG = Buffer.from('\xff\xd8\xff a fixture forecourt photograph', 'binary');
const OTHER_JPEG = Buffer.from('\xff\xd8\xff a replacement photograph', 'binary');

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let reviewer: request.Agent;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'portfolio');
  reviewer = await fixtures.staff('MODERATOR');
});

afterAll(async () => {
  await h.close();
});

function presign(dealer: Dealership, extra: Record<string, unknown> = {}, body: Buffer = JPEG) {
  return dealer.agent
    .post('/v1/dealer/portfolio/presign')
    .send({ fileName: 'forecourt.jpg', mimeType: 'image/jpeg', bytes: body.length, ...extra });
}

async function upload(
  dealer: Dealership,
  options: { replacesId?: string; body?: Buffer; caption?: string } = {},
): Promise<string> {
  const body = options.body ?? JPEG;
  const presigned = await presign(
    dealer,
    options.replacesId ? { replacesId: options.replacesId } : {},
    body,
  ).expect(201);
  const url = new URL(String(presigned.body.uploadUrl));
  await dealer.agent
    .put(url.pathname + url.search)
    .set('Content-Type', 'image/jpeg')
    .send(body)
    .expect(200);
  const committed = await dealer.agent
    .post('/v1/dealer/portfolio/commit')
    .send({
      mediaId: presigned.body.mediaId,
      ...(options.replacesId ? { replacesId: options.replacesId } : {}),
      ...(options.caption ? { caption: options.caption } : {}),
    })
    .expect(201);
  return String(committed.body.id);
}

async function mediaOf(photoId: string): Promise<string> {
  return (await h.prisma.dealerPortfolioPhoto.findUniqueOrThrow({ where: { id: photoId } }))
    .mediaId;
}

function served(mediaId: string) {
  return h.agent().get(`/media/by-media/${mediaId}/640.webp`);
}

async function publicPortfolio(slug: string): Promise<string[]> {
  const profile = await h.agent().get(`/v1/dealers/${slug}`).expect(200);
  return (profile.body.portfolio as { url: string }[]).map((photo) => photo.url);
}

describe('submitting a portfolio photograph', () => {
  it('creates it PENDING and private: not served, not on the public page', async () => {
    const dealer = await fixtures.dealership();
    const id = await upload(dealer, { caption: 'Forecourt' });

    const mine = await dealer.agent.get('/v1/dealer/portfolio').expect(200);
    expect(mine.body.data).toEqual([
      expect.objectContaining({ id, status: 'PENDING', caption: 'Forecourt' }),
    ]);
    expect(mine.body.data[0].previewUrl).toBeTruthy();
    await served(await mediaOf(id)).expect(404);
    expect(await publicPortfolio(dealer.slug)).toEqual([]);
    const audit = await h.prisma.auditLog.findFirst({
      where: { entityId: id, action: 'portfolio.photo_submitted' },
    });
    expect(audit).not.toBeNull();
  });

  it('refuses bytes that are not the declared image and deletes the object', async () => {
    const dealer = await fixtures.dealership();
    const pdf = Buffer.from('%PDF-1.4 pretending to be a photograph');
    const presigned = await presign(dealer, {}, pdf).expect(201);
    const url = new URL(String(presigned.body.uploadUrl));
    await dealer.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/jpeg')
      .send(pdf)
      .expect(200);

    const response = await dealer.agent
      .post('/v1/dealer/portfolio/commit')
      .send({ mediaId: presigned.body.mediaId })
      .expect(422);

    expect(response.body.code).toBe('PORTFOLIO_CONTENT_MISMATCH');
    const media = await h.prisma.media.findUniqueOrThrow({
      where: { id: String(presigned.body.mediaId) },
    });
    expect(media.status).toBe('FAILED');
    expect(await storage.head(media.storageKey)).toBeNull();
    expect(
      await h.prisma.dealerPortfolioPhoto.count({ where: { dealerId: dealer.dealerId } }),
    ).toBe(0);
  });

  it('refuses a commit with no uploaded object', async () => {
    const dealer = await fixtures.dealership();
    const presigned = await presign(dealer).expect(201);

    const response = await dealer.agent
      .post('/v1/dealer/portfolio/commit')
      .send({ mediaId: presigned.body.mediaId })
      .expect(422);

    expect(response.body.code).toBe('UPLOAD_MISSING');
  });

  it('commits the same upload once, however often it is retried', async () => {
    const dealer = await fixtures.dealership();
    const presigned = await presign(dealer).expect(201);
    const url = new URL(String(presigned.body.uploadUrl));
    await dealer.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);
    const first = await dealer.agent
      .post('/v1/dealer/portfolio/commit')
      .send({ mediaId: presigned.body.mediaId })
      .expect(201);
    const second = await dealer.agent
      .post('/v1/dealer/portfolio/commit')
      .send({ mediaId: presigned.body.mediaId })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(
      await h.prisma.dealerPortfolioPhoto.count({ where: { dealerId: dealer.dealerId } }),
    ).toBe(1);
  });

  it('rejects a GIF, an oversized file and a path in the name at the schema', async () => {
    const dealer = await fixtures.dealership();

    await presign(dealer, { mimeType: 'image/gif' }).expect(400);
    await presign(dealer, { bytes: 10 * 1024 * 1024 + 1 }).expect(400);
    await presign(dealer, { fileName: '../../etc/passwd.jpg' }).expect(400);
    await presign(dealer, { dealerId: randomUUID() }).expect(400);
  });

  it('caps the portfolio, counting pending and approved photographs', async () => {
    const dealer = await fixtures.dealership();
    for (let i = 0; i < PORTFOLIO_PHOTO_LIMIT; i += 1) await upload(dealer);

    const response = await presign(dealer).expect(409);

    expect(response.body.code).toBe('PORTFOLIO_FULL');
    expect((await dealer.agent.get('/v1/dealer/portfolio').expect(200)).body.canAdd).toBe(false);
  });

  it('is an owner-only action', async () => {
    const dealer = await fixtures.dealership();
    const manager = await fixtures.member(dealer, 'MANAGER');

    await manager.agent.get('/v1/dealer/portfolio').expect(403);
    await presign(manager).expect(403);
  });
});

describe('moderation', () => {
  it('publishes an approved photograph and serves it while the dealership is ACTIVE', async () => {
    const dealer = await fixtures.dealership();
    const id = await upload(dealer);

    const decision = await reviewer.post(`/v1/admin/portfolio/${id}/approve`).send({}).expect(200);

    expect(decision.body).toEqual({ id, status: 'APPROVED', replacedId: null });
    const mediaId = await mediaOf(id);
    await served(mediaId).expect(200);
    expect(await publicPortfolio(dealer.slug)).toEqual([expect.stringContaining(mediaId)]);
    const profile = await h.agent().get(`/v1/dealers/${dealer.slug}`).expect(200);
    expect(profile.body.coverUrl).toContain(mediaId);
  });

  it('rejects with a reason the dealer sees, and never publishes it', async () => {
    const dealer = await fixtures.dealership();
    const id = await upload(dealer);

    await reviewer
      .post(`/v1/admin/portfolio/${id}/reject`)
      .send({ reason: 'This is a photograph of a document, not the dealership.' })
      .expect(200);

    const mine = await dealer.agent.get('/v1/dealer/portfolio').expect(200);
    expect(mine.body.data[0]).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'This is a photograph of a document, not the dealership.',
    });
    await served(await mediaOf(id)).expect(404);
  });

  it('decides a photograph once', async () => {
    const dealer = await fixtures.dealership();
    const id = await upload(dealer);
    await reviewer.post(`/v1/admin/portfolio/${id}/approve`).send({}).expect(200);

    const again = await reviewer
      .post(`/v1/admin/portfolio/${id}/reject`)
      .send({ reason: 'Changed my mind about this one.' })
      .expect(409);

    expect(again.body.code).toBe('PORTFOLIO_PHOTO_DECIDED');
  });

  it('lists the queue only for reviewers', async () => {
    const dealer = await fixtures.dealership();
    const id = await upload(dealer);
    const support = await fixtures.staff('SUPPORT');

    const queue = await reviewer.get('/v1/admin/portfolio').expect(200);
    expect(queue.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id, dealerId: dealer.dealerId, status: 'PENDING' }),
      ]),
    );
    await support.get('/v1/admin/portfolio').expect(403);
    await support.post(`/v1/admin/portfolio/${id}/approve`).send({}).expect(403);
    await reviewer.get('/v1/admin/portfolio?status=APPROVED').expect(400);
  });

  it('takes an approved photograph down and stops serving it', async () => {
    const dealer = await fixtures.dealership();
    const id = await upload(dealer);
    await reviewer.post(`/v1/admin/portfolio/${id}/approve`).send({}).expect(200);
    const mediaId = await mediaOf(id);

    await reviewer
      .post(`/v1/admin/portfolio/${id}/take-down`)
      .send({ reason: 'Shows a customer number plate.' })
      .expect(200);

    await served(mediaId).expect(404);
    expect(await publicPortfolio(dealer.slug)).toEqual([]);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: id, action: 'portfolio.photo_taken_down' },
      }),
    ).toBe(1);
  });
});

describe('safe replacement', () => {
  async function approved(dealer: Dealership): Promise<string> {
    const id = await upload(dealer);
    await reviewer.post(`/v1/admin/portfolio/${id}/approve`).send({}).expect(200);
    return id;
  }

  it('keeps the approved photograph public until its replacement is approved, then swaps', async () => {
    const dealer = await fixtures.dealership();
    const original = await approved(dealer);
    const originalMedia = await mediaOf(original);

    const replacement = await upload(dealer, { replacesId: original, body: OTHER_JPEG });
    const replacementMedia = await mediaOf(replacement);

    await served(originalMedia).expect(200);
    await served(replacementMedia).expect(404);
    expect(await publicPortfolio(dealer.slug)).toEqual([expect.stringContaining(originalMedia)]);

    const decision = await reviewer
      .post(`/v1/admin/portfolio/${replacement}/approve`)
      .send({})
      .expect(200);

    expect(decision.body.replacedId).toBe(original);
    await served(replacementMedia).expect(200);
    await served(originalMedia).expect(404);
    expect(await publicPortfolio(dealer.slug)).toEqual([expect.stringContaining(replacementMedia)]);
    const rows = await h.prisma.dealerPortfolioPhoto.findMany({
      where: { dealerId: dealer.dealerId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((row) => [row.status, row.position])).toEqual([
      ['REMOVED', 0],
      ['APPROVED', 0],
    ]);
  });

  it('leaves the approved photograph in place when the replacement is rejected', async () => {
    const dealer = await fixtures.dealership();
    const original = await approved(dealer);
    const replacement = await upload(dealer, { replacesId: original });

    await reviewer
      .post(`/v1/admin/portfolio/${replacement}/reject`)
      .send({ reason: 'Blurred; please retake the photograph.' })
      .expect(200);

    await served(await mediaOf(original)).expect(200);
    expect(await publicPortfolio(dealer.slug)).toHaveLength(1);
  });

  it('still counts an approved replacement against the limit', async () => {
    const dealer = await fixtures.dealership();
    const original = await approved(dealer);
    const replacement = await upload(dealer, { replacesId: original, body: OTHER_JPEG });
    await reviewer.post(`/v1/admin/portfolio/${replacement}/approve`).send({}).expect(200);
    for (let i = 1; i < PORTFOLIO_PHOTO_LIMIT; i += 1) await upload(dealer);

    const response = await presign(dealer).expect(409);

    expect(response.body.code).toBe('PORTFOLIO_FULL');
    const mine = await dealer.agent.get('/v1/dealer/portfolio').expect(200);
    expect(mine.body.canAdd).toBe(false);
    expect(mine.body.data[0]).toMatchObject({ id: replacement, status: 'APPROVED' });
  });

  it('allows one waiting replacement per photograph, and only of an approved one', async () => {
    const dealer = await fixtures.dealership();
    const original = await approved(dealer);
    await upload(dealer, { replacesId: original });
    const pending = await upload(dealer);

    const second = await presign(dealer, { replacesId: original }).expect(201);
    const url = new URL(String(second.body.uploadUrl));
    await dealer.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);
    const duplicate = await dealer.agent
      .post('/v1/dealer/portfolio/commit')
      .send({ mediaId: second.body.mediaId, replacesId: original })
      .expect(409);
    expect(duplicate.body.code).toBe('PORTFOLIO_REPLACEMENT_PENDING');

    const third = await presign(dealer, { replacesId: pending }).expect(201);
    const thirdUrl = new URL(String(third.body.uploadUrl));
    await dealer.agent
      .put(thirdUrl.pathname + thirdUrl.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);
    const notApproved = await dealer.agent
      .post('/v1/dealer/portfolio/commit')
      .send({ mediaId: third.body.mediaId, replacesId: pending })
      .expect(409);
    expect(notApproved.body.code).toBe('PORTFOLIO_REPLACE_TARGET');
  });

  it('refuses to replace another dealership’s photograph', async () => {
    const mine = await fixtures.dealership();
    const theirs = await fixtures.dealership();
    const target = await approved(theirs);

    const presigned = await presign(mine, { replacesId: target }).expect(201);
    const url = new URL(String(presigned.body.uploadUrl));
    await mine.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);

    await mine.agent
      .post('/v1/dealer/portfolio/commit')
      .send({ mediaId: presigned.body.mediaId, replacesId: target })
      .expect(409);
    await mine.agent.delete(`/v1/dealer/portfolio/${target}`).expect(404);
    await served(await mediaOf(target)).expect(200);
  });

  it('keeps a waiting replacement as a new photograph when the dealer removes the original', async () => {
    const dealer = await fixtures.dealership();
    const original = await approved(dealer);
    const replacement = await upload(dealer, { replacesId: original });

    await dealer.agent.delete(`/v1/dealer/portfolio/${original}`).expect(204);

    const row = await h.prisma.dealerPortfolioPhoto.findUniqueOrThrow({
      where: { id: replacement },
    });
    expect({ status: row.status, replacesId: row.replacesId }).toEqual({
      status: 'PENDING',
      replacesId: null,
    });
    await served(await mediaOf(original)).expect(404);
  });
});

describe('BUG-NEW-009 carried forward — public only while the dealership is ACTIVE', () => {
  it('stops serving while suspended and serves again on reinstatement', async () => {
    const dealer = await fixtures.dealership();
    const id = await upload(dealer);
    await reviewer.post(`/v1/admin/portfolio/${id}/approve`).send({}).expect(200);
    const mediaId = await mediaOf(id);
    const superAdmin = await fixtures.moderator();

    await superAdmin
      .post(`/v1/admin/dealers/${dealer.dealerId}/suspend`)
      .send({ reason: 'Suspended for a portfolio visibility check.' })
      .expect(200);
    const suspended = await served(mediaId);
    await superAdmin.post(`/v1/admin/dealers/${dealer.dealerId}/reinstate`).send({}).expect(200);
    const reinstated = await served(mediaId);

    expect({
      suspended: suspended.status,
      cacheControl: suspended.headers['cache-control'],
      reinstated: reinstated.status,
    }).toEqual({ suspended: 404, cacheControl: 'no-store', reinstated: 200 });
  });

  it('does not serve an approved photograph of a dealership that is not yet ACTIVE', async () => {
    const draft = await fixtures.dealership('DRAFT');
    const id = await upload(draft);
    await reviewer.post(`/v1/admin/portfolio/${id}/approve`).send({}).expect(200);

    await served(await mediaOf(id)).expect(404);
  });

  it('never serves a media row under a portfolio key that no approved row names', async () => {
    const dealer = await fixtures.dealership();
    const mediaId = randomUUID();
    const key = portfolioKey(dealer.slug, mediaId);
    await h.prisma.media.create({
      data: {
        id: mediaId,
        dealerId: dealer.dealerId,
        ownerType: 'DEALER_PORTFOLIO',
        storageKey: key,
        mimeType: 'image/jpeg',
        bytes: JPEG.length,
        fileName: 'stray.jpg',
        status: 'READY',
      },
    });
    await storage.put(key, JPEG, 'image/jpeg');

    await served(mediaId).expect(404);
  });
});
