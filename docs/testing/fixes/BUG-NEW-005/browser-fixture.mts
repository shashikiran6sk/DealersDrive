import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { env } from '../../../../apps/api/src/config/env.js';
import { createSessionService } from '../../../../apps/api/src/modules/auth/session.service.js';
import { createAuthHarness, createFakeGoogle } from '../../../../apps/api/tests/auth-harness.js';
import { marketplaceFixtures } from '../../../../apps/api/tests/marketplace-fixtures.js';
assert.equal(env.NODE_ENV, 'test');
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname));
assert.equal(env.PHONE_OTP_DRIVER, 'fake');
assert.equal(env.JOBS_ENABLED, false);
const h = await createAuthHarness(createFakeGoogle());
const fixtures = marketplaceFixtures(h, `new005-browser-${Date.now().toString(36)}`);
const sessions = createSessionService(h.prisma);
const apiUrl = new URL(env.API_BASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(apiUrl.hostname));
assert.ok(apiUrl.port);
await new Promise<void>((resolve, reject) =>
  h.server.close((error) => (error ? reject(error) : resolve())),
);
await new Promise<void>((resolve) => {
  h.server.listen(Number(apiUrl.port), resolve);
});
const pdf = await readFile(new URL('../BUG-002/browser-document.pdf', import.meta.url));
const jpeg = await readFile(new URL('../BUG-002/browser-yard.jpg', import.meta.url));
const existing = await h.prisma.dealer.findMany({
  where: { pan: { startsWith: 'PURGE' } },
  select: { pan: true },
});
let applicationSequence =
  Math.max(4000, ...existing.map((row) => Number(row.pan?.slice(5, 9)) || 0)) - 1000;
async function application(verify = true) {
  const dealer = await fixtures.dealership('DRAFT');
  const admin = await fixtures.moderator();
  applicationSequence += 1;
  const number = String(1000 + applicationSequence);
  await dealer.agent
    .patch('/v1/dealer/onboarding')
    .send({ gstin: `33PURGE${number}B1ZX`, pan: `PURGE${number}B` })
    .expect(200);
  const documents: string[] = [];
  for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
    const presigned = await dealer.agent
      .post('/v1/dealer/documents/presign')
      .send({ type, fileName: 'verification.pdf', mimeType: 'application/pdf', bytes: pdf.length })
      .expect(201);
    const url = new URL(String(presigned.body.uploadUrl));
    await dealer.agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'application/pdf')
      .send(pdf)
      .expect(200);
    await dealer.agent
      .post(`/v1/dealer/documents/${type}/commit`)
      .send({ documentId: presigned.body.documentId })
      .expect(200);
    documents.push(String(presigned.body.documentId));
  }
  const cover = await dealer.agent
    .post('/v1/dealer/yard-photo/presign')
    .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: jpeg.length })
    .expect(201);
  const url = new URL(String(cover.body.uploadUrl));
  await dealer.agent
    .put(url.pathname + url.search)
    .set('Content-Type', 'image/jpeg')
    .send(jpeg)
    .expect(200);
  await dealer.agent
    .post('/v1/dealer/yard-photo/commit')
    .send({ mediaId: cover.body.mediaId })
    .expect(200);
  await dealer.agent.post('/v1/dealer/submit').expect(200);
  if (verify) {
    for (const id of documents) {
      await admin.post(`/v1/admin/documents/${id}/verify`).send({}).expect(200);
    }
  }
  return { dealer, admin, documents };
}

const cases = [];
for (const width of [1440, 768, 390]) {
  const ready = await application();
  const adminUser = await h.prisma.user.findUniqueOrThrow({
    where: { email: env.adminAllowlist[0] },
  });
  const adminSession = await sessions.issue({ userId: adminUser.id, scope: 'ADMIN' });
  const ownerSession = await sessions.issue({ userId: ready.dealer.userId, scope: 'DEALER' });
  const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: ready.dealer.dealerId } });
  cases.push({
    width,
    id: dealer.id,
    slug: dealer.slug,
    brandName: dealer.brandName,
    ownerToken: ownerSession.token,
    adminToken: adminSession.token,
    adminUserId: adminUser.id,
    documents: ready.documents,
  });
}
const stale = await application();
const adminUser = await h.prisma.user.findUniqueOrThrow({
  where: { email: env.adminAllowlist[0] },
});
const staleSession = await sessions.issue({ userId: adminUser.id, scope: 'ADMIN' });
const staleDealer = await h.prisma.dealer.findUniqueOrThrow({
  where: { id: stale.dealer.dealerId },
});
const address = h.server.address();
assert.ok(address && typeof address !== 'string');
await writeFile(
  '/tmp/dd-new005-browser-private.json',
  JSON.stringify({
    apiPort: address.port,
    cases,
    stale: {
      id: staleDealer.id,
      slug: staleDealer.slug,
      brandName: staleDealer.brandName,
      adminToken: staleSession.token,
      documentId: stale.documents[0],
    },
  }),
  { mode: 0o600 },
);
console.log(
  'Isolated rejection browser fixtures ready; sessions are private and outside the repository.',
);
process.on('SIGTERM', () => {
  void h.close().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  void h.close().then(() => process.exit(0));
});
