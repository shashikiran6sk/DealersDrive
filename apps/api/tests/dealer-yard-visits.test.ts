import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * #299 — internal yard visits. What staff found at a dealership, with their
 * photographs, kept as private operational evidence. Never served publicly,
 * never required, never a route to Dealer Verified, and a dealership without a
 * physical yard is recorded as such rather than penalised.
 */

const JPEG = Buffer.from('\xff\xd8\xff a fixture yard-visit photograph', 'binary');

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let reviewer: request.Agent;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'yard-visits');
  reviewer = await fixtures.staff('MODERATOR');
});

afterAll(async () => {
  await h.close();
});

function base(dealer: Dealership): string {
  return `/v1/admin/dealers/${dealer.dealerId}/yard-visits`;
}

async function visit(dealer: Dealership, body: Record<string, unknown> = {}): Promise<string> {
  const created = await reviewer
    .post(base(dealer))
    .send({ visitedOn: '2026-10-01', outcome: 'YARD_CONFIRMED', ...body })
    .expect(201);
  return String(created.body.id);
}

async function photo(dealer: Dealership, visitId: string, body = JPEG) {
  const presigned = await reviewer
    .post(`${base(dealer)}/${visitId}/photos/presign`)
    .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: body.length })
    .expect(201);
  const url = new URL(String(presigned.body.uploadUrl));
  await reviewer
    .put(url.pathname + url.search)
    .set('Content-Type', 'image/jpeg')
    .send(body)
    .expect(200);
  return {
    mediaId: String(presigned.body.mediaId),
    commit: () =>
      reviewer
        .post(`${base(dealer)}/${visitId}/photos/commit`)
        .send({ mediaId: presigned.body.mediaId }),
  };
}

describe('recording a yard visit', () => {
  it('records the outcome, audits it, and counts it on the dealer detail', async () => {
    const dealer = await fixtures.dealership();

    const id = await visit(dealer, { notes: 'Twelve cars on the forecourt.' });

    const list = await reviewer.get(base(dealer)).expect(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        id,
        visitedOn: '2026-10-01',
        outcome: 'YARD_CONFIRMED',
        notes: 'Twelve cars on the forecourt.',
        photos: [],
      }),
    ]);
    expect(list.body.data[0].recordedBy).toEqual(expect.any(String));
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: id, action: 'dealer.yard_visit_recorded' },
      }),
    ).toBe(1);
    const detail = await reviewer.get(`/v1/admin/dealers/${dealer.dealerId}`).expect(200);
    expect(detail.body.yardVisitCount).toBe(1);
  });

  it('records a dealership that trades without a physical yard, without penalty', async () => {
    const dealer = await fixtures.dealership();
    const before = await h.agent().get(`/v1/dealers/${dealer.slug}`).expect(200);

    await visit(dealer, { outcome: 'NO_PHYSICAL_YARD' });

    const after = await h.agent().get(`/v1/dealers/${dealer.slug}`).expect(200);
    expect(after.body.isVerified).toBe(before.body.isVerified);
    const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.dealerId } });
    expect(row.status).toBe('ACTIVE');
  });

  it('refuses a future date, an unknown outcome and an unknown field', async () => {
    const dealer = await fixtures.dealership();

    await reviewer
      .post(base(dealer))
      .send({ visitedOn: '2999-01-01', outcome: 'YARD_CONFIRMED' })
      .expect(400);
    await reviewer
      .post(base(dealer))
      .send({ visitedOn: '2026-10-01', outcome: 'GREAT' })
      .expect(400);
    await reviewer
      .post(base(dealer))
      .send({ visitedOn: '2026-10-01', outcome: 'YARD_CONFIRMED', public: true })
      .expect(400);
  });

  it('is for reviewers only, never support staff or the dealer', async () => {
    const dealer = await fixtures.dealership();
    const support = await fixtures.staff('SUPPORT');

    await support.get(base(dealer)).expect(403);
    await support
      .post(base(dealer))
      .send({ visitedOn: '2026-10-01', outcome: 'YARD_CONFIRMED' })
      .expect(403);
    const denied = await dealer.agent.get(base(dealer));
    expect([401, 403]).toContain(denied.status);
  });
});

describe('yard-visit photographs', () => {
  it('stores them privately: signed reads for reviewers, never the public media path', async () => {
    const dealer = await fixtures.dealership();
    const id = await visit(dealer);
    const uploaded = await photo(dealer, id);

    const committed = await uploaded.commit().expect(200);

    expect(committed.body.photos).toEqual([
      expect.objectContaining({ mediaId: uploaded.mediaId, url: expect.any(String) }),
    ]);
    await h.agent().get(`/media/by-media/${uploaded.mediaId}/640.webp`).expect(404);
    const signed = new URL(String(committed.body.photos[0].url));
    const read = await h
      .agent()
      .get(signed.pathname + signed.search)
      .expect(200);
    expect(read.headers['cache-control']).toBe('private, no-store');

    await reviewer.get(base(dealer)).expect(200);
    expect(
      await h.prisma.auditLog.count({
        where: { dealerId: dealer.dealerId, action: 'dealer.yard_visits.viewed' },
      }),
    ).toBeGreaterThan(0);
    const profile = await h.agent().get(`/v1/dealers/${dealer.slug}`).expect(200);
    expect(JSON.stringify(profile.body)).not.toContain(uploaded.mediaId);
  });

  it('refuses bytes that are not the declared image', async () => {
    const dealer = await fixtures.dealership();
    const id = await visit(dealer);
    const uploaded = await photo(dealer, id, Buffer.from('%PDF-1.4 not a photograph'));

    const response = await uploaded.commit().expect(422);

    expect(response.body.code).toBe('YARD_VISIT_PHOTO_MISMATCH');
    expect(await h.prisma.dealerYardVisitPhoto.count({ where: { visitId: id } })).toBe(0);
  });

  it('commits the same upload once', async () => {
    const dealer = await fixtures.dealership();
    const id = await visit(dealer);
    const uploaded = await photo(dealer, id);

    await uploaded.commit().expect(200);
    const again = await uploaded.commit().expect(200);

    expect(again.body.photos).toHaveLength(1);
  });

  it('keeps a visit to its own dealership', async () => {
    const mine = await fixtures.dealership();
    const theirs = await fixtures.dealership();
    const theirVisit = await visit(theirs);

    await reviewer
      .post(`${base(mine)}/${theirVisit}/photos/presign`)
      .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(404);
  });
});
