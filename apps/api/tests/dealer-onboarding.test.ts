import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthHarness } from './auth-harness.js';
import { createAuthHarness, createFakeGoogle } from './auth-harness.js';

/** Where the local-disk adapter puts a key. `STORAGE_LOCAL_DIR` is set by the runner. */
function storagePath(key: string): string {
  return resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? '.storage-test', key);
}

/**
 * The onboarding rules that live in the **database**, and the KYC upload
 * pipeline end to end.
 *
 * These are here rather than in a unit test for the reason the vitest config
 * gives: the guarantees being checked are indexes and stored objects, and a
 * mocked Prisma or a fake `StoragePort` would test the mock. Two dealerships
 * in one city must not share a registered name, and no two anywhere may share
 * a GSTIN; both have to hold when two applications race, which is a property
 * of the unique indexes rather than of the read-then-write check in front of
 * them.
 *
 * Storage is the local-disk adapter (`STORAGE_DRIVER=local`), so a `PUT` here
 * writes a real file and `deleteDocument` has a real object to remove. The
 * presign → PUT → commit contract is identical against MinIO and R2; what
 * differs is only who signs the URL.
 */
let h: AuthHarness;

let counter = 0;
function newAccount(): void {
  counter += 1;
  h.google.claims = {
    subject: `onboarding-sub-${counter}`,
    email: `onboarding${counter}@example.com`,
    emailVerified: true,
    name: 'Test Dealer',
  };
}

function onboarding(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'R. Manikandan',
    roleTitle: 'Proprietor',
    phone: `98411${String(10000 + counter).slice(-5)}`,
    legalName: `Onboarding Motors ${counter}`,
    addressLine: '18, Gandhi Road',
    city: 'Katpadi',
    state: 'Tamil Nadu',
    pincode: '632007',
    ...overrides,
  };
}

/** A signed-in agent with a dealership behind it. */
async function dealership(overrides: Record<string, unknown> = {}) {
  newAccount();
  const agent = h.agent();
  await h.signIn(agent);
  const created = await agent.post('/v1/auth/onboarding').send(onboarding(overrides)).expect(201);
  return { agent, dealerId: created.body.dealer.id as string };
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

describe('one name per city', () => {
  it('refuses a second dealership under the same name in the same city', async () => {
    const name = `Duplicate Motors ${Date.now()}`;
    await dealership({ legalName: name, city: 'Vellore' });

    newAccount();
    const second = h.agent();
    await h.signIn(second);
    const refused = await second
      .post('/v1/auth/onboarding')
      .send(onboarding({ legalName: name, city: 'Vellore' }))
      .expect(409);

    expect(refused.body.code).toBe('DEALER_NAME_TAKEN');
    // Named against the field the dealer typed, so the form can show it there,
    // and it says *where* it is taken — the name alone is not the problem.
    expect(refused.body.errors?.[0]?.field).toBe('body.legalName');
    expect(refused.body.detail).toContain('Vellore');
  });

  /**
   * The other half of the rule, and the reason it is scoped at all: "Sri
   * Balaji Motors" is a name three unrelated families use in three different
   * towns, and a global unique let the first applicant lock the other two out.
   */
  it('allows the same name in a different city', async () => {
    const name = `Sri Balaji Motors ${Date.now()}`;
    await dealership({ legalName: name, city: 'Vellore' });

    newAccount();
    const second = h.agent();
    await h.signIn(second);
    await second
      .post('/v1/auth/onboarding')
      .send(onboarding({ legalName: name, city: 'Salem' }))
      .expect(201);
  });

  /** Case is not a difference — in either field. */
  it('refuses it whatever the casing of the name or the city', async () => {
    const name = `Casing Motors ${Date.now()}`;
    await dealership({ legalName: name, city: 'Katpadi' });

    newAccount();
    const second = h.agent();
    await h.signIn(second);
    await second
      .post('/v1/auth/onboarding')
      .send(onboarding({ legalName: name.toUpperCase(), city: 'KATPADI' }))
      .expect(409);
  });

  /** The normalisation is what makes the casing case above hold at the index. */
  it('stores the city and state in one normalised form', async () => {
    const { agent } = await dealership({ city: '  hubballi  ', state: 'karnataka' });

    const profile = await agent.get('/v1/dealer').expect(200);

    expect(profile.body.address).toMatchObject({ city: 'Hubballi', state: 'Karnataka' });
  });

  /**
   * One name is asked for, and the display name is derived from it. Sending a
   * `brandName` is a 400 naming the field rather than a silent success, because
   * every input schema is `.strict()`.
   */
  it('mirrors the registered name onto the display name, and refuses a second one', async () => {
    const { agent } = await dealership();
    const profile = await agent.get('/v1/dealer').expect(200);

    expect(profile.body.brandName).toBe(profile.body.legalName);

    newAccount();
    const other = h.agent();
    await h.signIn(other);
    const refused = await other
      .post('/v1/auth/onboarding')
      .send({ ...onboarding(), brandName: 'Something Else' })
      .expect(400);

    expect(JSON.stringify(refused.body)).toContain('brandName');
  });

  it('renames a dealership through PATCH, mirror and all', async () => {
    const { agent } = await dealership();
    const renamed = `Renamed Motors ${Date.now()}`;

    const updated = await agent.patch('/v1/dealer').send({ legalName: renamed }).expect(200);

    expect(updated.body.legalName).toBe(renamed);
    expect(updated.body.brandName).toBe(renamed);
  });

  it('refuses a rename onto a name another dealership in the same city holds', async () => {
    const taken = `Taken Motors ${Date.now()}`;
    await dealership({ legalName: taken, city: 'Katpadi' });
    const { agent } = await dealership({ city: 'Katpadi' });

    const refused = await agent.patch('/v1/dealer').send({ legalName: taken }).expect(409);

    expect(refused.body.code).toBe('DEALER_NAME_TAKEN');
  });

  it('allows a rename onto a name only held in another city', async () => {
    const taken = `Elsewhere Motors ${Date.now()}`;
    await dealership({ legalName: taken, city: 'Salem' });
    const { agent } = await dealership({ city: 'Katpadi' });

    await agent.patch('/v1/dealer').send({ legalName: taken }).expect(200);
  });

  /**
   * Both fields in one submit. Checking the new name against the old city
   * would refuse a legal move — and, moving the other way, let through a
   * collision in the city being moved to.
   */
  it('checks a rename against the city the same request moves to', async () => {
    const taken = `Moving Motors ${Date.now()}`;
    await dealership({ legalName: taken, city: 'Salem' });
    const { agent } = await dealership({ city: 'Katpadi' });

    const refused = await agent
      .patch('/v1/dealer')
      .send({ legalName: taken, address: { city: 'Salem' } })
      .expect(409);

    expect(refused.body.code).toBe('DEALER_NAME_TAKEN');
  });

  /** Saving an unchanged form must not collide with the dealership saving it. */
  it('lets a dealership keep its own name', async () => {
    const { agent } = await dealership();
    const profile = await agent.get('/v1/dealer').expect(200);

    await agent.patch('/v1/dealer').send({ legalName: profile.body.legalName }).expect(200);
  });
});

describe('one dealership, one GSTIN', () => {
  const gstin = '33AABCS1429B1ZX';

  it('refuses a GSTIN another dealership already registered', async () => {
    const first = await dealership();
    await first.agent.patch('/v1/dealer').send({ gstin }).expect(200);

    const second = await dealership();
    const refused = await second.agent.patch('/v1/dealer').send({ gstin }).expect(409);

    expect(refused.body.code).toBe('GSTIN_ALREADY_REGISTERED');
    expect(refused.body.errors?.[0]?.field).toBe('body.gstin');
  });

  /**
   * A nullable column permits many NULLs in a Postgres unique index, which is
   * what makes the constraint safe to carry before every dealership has one.
   */
  it('lets any number of dealerships have no GSTIN at all', async () => {
    await dealership();
    await dealership();

    const none = await h.prisma.dealer.count({ where: { gstin: null } });
    expect(none).toBeGreaterThan(1);
  });

  it('lets a dealership re-save its own GSTIN', async () => {
    const { agent } = await dealership();
    await agent.patch('/v1/dealer').send({ gstin: '33AABCS1429B1Z5' }).expect(200);
    await agent.patch('/v1/dealer').send({ gstin: '33AABCS1429B1Z5' }).expect(200);
  });
});

/**
 * presign → PUT → commit, then delete. The point of the round trip is the
 * *object*: a document row can be reset without the bytes going anywhere, and
 * that is exactly what the baseline did — it deleted `kyc/{dealer}/{type}`,
 * the prefix the object lives under rather than the object itself.
 */
describe('KYC documents — replace and remove', () => {
  const PDF = Buffer.from('%PDF-1.4 a KYC document');

  async function upload(agent: ReturnType<AuthHarness['agent']>, type: string) {
    const presigned = await agent
      .post('/v1/dealer/documents/presign')
      .send({ type, fileName: 'gst.pdf', mimeType: 'application/pdf', bytes: PDF.length })
      .expect(201);

    await agent
      .put(
        new URL(presigned.body.uploadUrl as string).pathname +
          new URL(presigned.body.uploadUrl as string).search,
      )
      .set('Content-Type', 'application/pdf')
      .send(PDF)
      .expect(200);

    await agent
      .post(`/v1/dealer/documents/${type}/commit`)
      .send({ documentId: presigned.body.documentId })
      .expect(200);

    return presigned.body.documentId as string;
  }

  it('records an uploaded document against the checklist', async () => {
    const { agent } = await dealership();

    await upload(agent, 'GST_CERTIFICATE');

    const checklist = await agent.get('/v1/dealer/documents').expect(200);
    const row = checklist.body.data.find(
      (doc: { type: string }) => doc.type === 'GST_CERTIFICATE',
    ) as { status: string; action: string };
    expect(row.status).toBe('UPLOADED');
    expect(row.action).toBe('Replace');
  });

  it('resets the row and removes the stored object on delete', async () => {
    const { agent, dealerId } = await dealership();
    const documentId = await upload(agent, 'PAN_CARD');

    await agent.delete('/v1/dealer/documents/PAN_CARD').expect(204);

    const checklist = await agent.get('/v1/dealer/documents').expect(200);
    const row = checklist.body.data.find((doc: { type: string }) => doc.type === 'PAN_CARD') as {
      status: string;
      fileName: string | null;
    };
    expect(row.status).toBe('REQUIRED');
    expect(row.fileName).toBeNull();

    // And the bytes are gone. The row is reachable again for a fresh upload,
    // but the file behind the old one must not survive it.
    //
    // Checked on disk rather than through the port, because the bug this pins
    // was *in* the key: the baseline deleted `kyc/{dealer}/{type}`, a prefix no
    // object occupies, so every removed document stayed exactly where it was.
    expect(existsSync(storagePath(`kyc/${dealerId}/PAN_CARD/${documentId}`))).toBe(false);
  });

  /**
   * The row always exists — onboarding creates all three as REQUIRED — so
   * deleting one that was never uploaded is idempotent rather than an error.
   * There is nothing for the dealer to correct.
   */
  it('accepts a delete for a document that was never uploaded', async () => {
    const { agent } = await dealership();

    await agent.delete('/v1/dealer/documents/ADDRESS_PROOF').expect(204);
  });
});

/**
 * The yard photograph, end to end. It is required before a dealership can be
 * submitted, which is what ties this to the completeness read below it.
 */
describe('the yard photograph', () => {
  const JPEG = Buffer.from('\xff\xd8\xff a photograph of a yard', 'binary');

  async function uploadYardPhoto(agent: ReturnType<AuthHarness['agent']>) {
    const presigned = await agent
      .post('/v1/dealer/yard-photo/presign')
      .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
      .expect(201);

    const url = new URL(presigned.body.uploadUrl as string);
    await agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);

    return agent
      .post('/v1/dealer/yard-photo/commit')
      .send({ mediaId: presigned.body.mediaId })
      .expect(200);
  }

  it('reads empty before anything is uploaded', async () => {
    const { agent } = await dealership();

    const photo = await agent.get('/v1/dealer/yard-photo').expect(200);
    expect(photo.body).toMatchObject({ mediaId: null, url: null });
  });

  it('adopts an upload onto the dealership as its cover image', async () => {
    const { agent, dealerId } = await dealership();

    const committed = await uploadYardPhoto(agent);

    expect(committed.body.fileName).toBe('yard.jpg');
    expect(committed.body.url).toBeTruthy();

    const row = await h.prisma.dealer.findUnique({ where: { id: dealerId } });
    expect(row?.coverMediaId).toBe(committed.body.mediaId);
  });

  it('replaces one photograph with another, and takes the first away', async () => {
    const { agent } = await dealership();
    const first = await uploadYardPhoto(agent);
    const second = await uploadYardPhoto(agent);

    expect(second.body.mediaId).not.toBe(first.body.mediaId);

    const displaced = await h.prisma.media.findUnique({
      where: { id: first.body.mediaId as string },
    });
    expect(displaced?.status).toBe('ORPHAN');
  });

  it('removes it, and the dealership reads as incomplete again', async () => {
    const { agent } = await dealership();
    await uploadYardPhoto(agent);

    await agent.delete('/v1/dealer/yard-photo').expect(204);

    const photo = await agent.get('/v1/dealer/yard-photo').expect(200);
    expect(photo.body.mediaId).toBeNull();

    const completeness = await agent.get('/v1/dealer/completeness').expect(200);
    const documents = (completeness.body.steps as { key: string; missing: string[] }[]).find(
      (step) => step.key === 'documents',
    );
    expect(documents?.missing).toContain('YARD_PHOTO');
  });

  it('404s a delete when there is nothing to remove', async () => {
    const { agent } = await dealership();

    await agent.delete('/v1/dealer/yard-photo').expect(404);
  });

  /** A submit is refused until every part of the application is there. */
  it('is required before a dealership can be submitted', async () => {
    const { agent } = await dealership();
    await agent
      .patch('/v1/dealer')
      .send({ gstin: `33AABCS${String(1000 + counter)}B1ZX`, pan: 'AABCS1429B' })
      .expect(200);
    for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
      const presigned = await agent
        .post('/v1/dealer/documents/presign')
        .send({ type, fileName: 'doc.pdf', mimeType: 'application/pdf', bytes: 8 })
        .expect(201);
      const url = new URL(presigned.body.uploadUrl as string);
      await agent
        .put(url.pathname + url.search)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4'))
        .expect(200);
      await agent
        .post(`/v1/dealer/documents/${type}/commit`)
        .send({ documentId: presigned.body.documentId })
        .expect(200);
    }

    const refused = await agent.post('/v1/dealer/submit').expect(422);
    expect(refused.body.code).toBe('PROFILE_INCOMPLETE');
    expect(JSON.stringify(refused.body.errors)).toContain('YARD_PHOTO');

    await uploadYardPhoto(agent);
    const submitted = await agent.post('/v1/dealer/submit').expect(200);
    expect(submitted.body.status).toBe('PENDING_APPROVAL');
  });
});
