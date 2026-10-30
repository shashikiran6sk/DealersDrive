import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

import { env } from '../../../../apps/api/src/config/env.js';
import { createSessionService } from '../../../../apps/api/src/modules/auth/session.service.js';
import { createLocalStorage } from '../../../../apps/api/src/platform/storage/local.adapter.js';
import { createApprovalKit } from '../../../../apps/api/tests/approval-kit.js';
import { createAuthHarness, createFakeGoogle } from '../../../../apps/api/tests/auth-harness.js';
import { marketplaceFixtures } from '../../../../apps/api/tests/marketplace-fixtures.js';

assert.equal(env.NODE_ENV, 'test');
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(env.STORAGE_DRIVER, 'local');
assert.equal(env.PHONE_OTP_DRIVER, 'fake');
assert.equal(env.JOBS_ENABLED, false);
const api = new URL(env.API_BASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(api.hostname));
assert.equal(new URL(env.MEDIA_BASE_URL).origin, api.origin);
const h = await createAuthHarness(createFakeGoogle());
await new Promise<void>((resolve, reject) => h.server.close(error => error ? reject(error) : resolve()));
await new Promise<void>(resolve => h.server.listen(Number(api.port), resolve));
const privateFile = '/tmp/dd-bug004-browser-private.json';
if (process.env.BUG004_REUSE !== 'true') {
  const storage = createLocalStorage();
  const sessions = createSessionService(h.prisma);
  const jpeg = await readFile(new URL('../BUG-002/browser-yard.jpg', import.meta.url));
  const fixtures = marketplaceFixtures(h, `bug004-${Date.now().toString(36)}`);
  const admin = await fixtures.moderator();
  const adminUser = await h.prisma.user.findUniqueOrThrow({ where: { email: env.adminAllowlist[0] } });
  const adminSession = await sessions.issue({ userId: adminUser.id, scope: 'ADMIN' });
  const kit = createApprovalKit(h, admin);
  const existing = await h.prisma.vehicle.findMany({ where: { registrationNumber: { startsWith: 'KL41PB' } }, select: { registrationNumber: true } });
  let plate = Math.max(6200, ...existing.map(row => Number(row.registrationNumber.slice(6))));
  const cases = [];
  for (const width of [1440, 768, 390]) {
    const owner = await fixtures.dealership();
    const ownerSession = await sessions.issue({ userId: owner.userId, scope: 'DEALER' });
    const customer = h.agent();
    const phone = `98276${String(plate + 1).padStart(5, '0')}`;
    const proof = await customer.post('/v1/auth/sign-in/phone/customer').send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:media-browser-${String(width)}` }).expect(200);
    const joined = await customer.post('/v1/auth/sign-up/customer').send({ signUpToken: proof.body.signUpToken, fullName: 'Media Browser Fixture' }).expect(201);
    const customerId = String(joined.body.customer.id);
    const customerSession = await sessions.issue({ userId: customerId, scope: 'CUSTOMER' });
    const cars = [];
    for (const status of ['ACTIVE', 'RESERVED'] as const) {
      plate += 1;
      const car = await kit.published(owner, `KL41PB${String(plate)}`);
      for (const id of car.mediaIds) {
        const media = await h.prisma.media.findUniqueOrThrow({ where: { id } });
        await storage.put(media.storageKey, jpeg, 'image/jpeg');
        await h.prisma.media.update({ where: { id }, data: { bytes: jpeg.length } });
      }
      await customer.put(`/v1/saved-vehicles/${car.slug}`).expect(200);
      await customer.post('/v1/enquiries').send({ listingSlug: car.slug, message: 'Isolated media browser fixture' }).expect(201);
      if (status === 'RESERVED') await owner.agent.post(`/v1/dealer/vehicles/${car.vehicleId}/reserve`).expect(200);
      cars.push({ ...car, status });
    }
    const yard = await owner.agent.post('/v1/dealer/yard-photo/presign').send({ fileName: 'fixture-yard.jpg', mimeType: 'image/jpeg', bytes: jpeg.length }).expect(201);
    const yardUpload = new URL(String(yard.body.uploadUrl));
    await h.agent().put(yardUpload.pathname + yardUpload.search).set('Content-Type', 'image/jpeg').send(jpeg).expect(200);
    await owner.agent.post('/v1/dealer/yard-photo/commit').send({ mediaId: yard.body.mediaId }).expect(200);
    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: owner.dealerId } });
    cases.push({ width, dealerId: owner.dealerId, slug: owner.slug, brandName: dealer.brandName, ownerToken: ownerSession.token, customerId, customerToken: customerSession.token, yardMediaId: String(yard.body.mediaId), cars });
  }
  await writeFile(privateFile, JSON.stringify({ adminToken: adminSession.token, adminUserId: adminUser.id, cases }), { mode: 0o600 });
} else {
  const existing: unknown = JSON.parse(await readFile(privateFile, 'utf8'));
  assert.ok(existing && typeof existing === 'object' && 'cases' in existing);
}
console.log('Inert media fixture ready; private sessions remain outside Git.');
process.on('SIGTERM', () => { void h.close().then(() => process.exit(0)); });
process.on('SIGINT', () => { void h.close().then(() => process.exit(0)); });
