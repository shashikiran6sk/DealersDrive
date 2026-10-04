import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

import { env } from '../../../../apps/api/src/config/env.js';
import { createSessionService } from '../../../../apps/api/src/modules/auth/session.service.js';
import { createLocalStorage } from '../../../../apps/api/src/platform/storage/local.adapter.js';
import { createAuthHarness, createFakeGoogle } from '../../../../apps/api/tests/auth-harness.js';
import { createApprovalKit } from '../../../../apps/api/tests/approval-kit.js';
import { marketplaceFixtures } from '../../../../apps/api/tests/marketplace-fixtures.js';

assert.equal(env.NODE_ENV, 'test');
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname));
assert.equal(env.STORAGE_DRIVER, 'local');
assert.equal(env.PHONE_OTP_DRIVER, 'fake');
assert.equal(env.JOBS_ENABLED, false);
assert.equal(env.adminAllowlist[0], 'cert-admin@example.test');
const api = new URL(env.API_BASE_URL);
assert.equal(api.hostname, 'localhost');
const h = await createAuthHarness(createFakeGoogle());
await new Promise<void>((resolve, reject) =>
  h.server.close((error) => (error ? reject(error) : resolve())),
);
await new Promise<void>((resolve) => h.server.listen(Number(api.port), resolve));
const privateFile = '/tmp/dd-bug008-browser-private.json';
if (process.env.BUG008_REUSE !== 'true') {
  const fixtures = marketplaceFixtures(h, `bug008-${Date.now().toString(36)}`);
  const admin = await fixtures.moderator();
  const sessions = createSessionService(h.prisma);
  const adminUser = await h.prisma.user.findUniqueOrThrow({
    where: { email: env.adminAllowlist[0] },
  });
  const adminSession = await sessions.issue({ userId: adminUser.id, scope: 'ADMIN' });
  const owner = await fixtures.dealership();
  const ownerSession = await sessions.issue({ userId: owner.userId, scope: 'DEALER' });
  const kit = createApprovalKit(h, admin);
  const car = await kit.published(owner, `KL41MO${String(Date.now()).slice(-4)}`);
  const jpeg = await readFile(new URL('../BUG-002/browser-yard.jpg', import.meta.url));
  for (const id of car.mediaIds) {
    const media = await h.prisma.media.findUniqueOrThrow({ where: { id } });
    await createLocalStorage().put(media.storageKey, jpeg, 'image/jpeg');
    await h.prisma.media.update({ where: { id }, data: { bytes: jpeg.length } });
  }
  const customer = h.agent();
  const phone = `98008${String(Date.now()).slice(-5)}`;
  const proof = await customer
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:mobile-admin` })
    .expect(200);
  const joined = await customer
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proof.body.signUpToken, fullName: 'Admin Mobile Customer Fixture' })
    .expect(201);
  const customerSession = await sessions.issue({
    userId: String(joined.body.customer.id),
    scope: 'CUSTOMER',
  });
  const enquiry = await customer
    .post('/v1/enquiries')
    .send({ listingSlug: car.slug, message: 'Admin mobile regression fixture' })
    .expect(201);
  await customer.put(`/v1/saved-vehicles/${car.slug}`).expect(200);
  await writeFile(
    privateFile,
    JSON.stringify({
      adminToken: adminSession.token,
      adminUserId: adminUser.id,
      ownerToken: ownerSession.token,
      customerToken: customerSession.token,
      customerId: String(joined.body.customer.id),
      dealerId: owner.dealerId,
      car,
      enquiryId: String(enquiry.body.id),
    }),
    { mode: 0o600 },
  );
}
console.log('Isolated Admin mobile fixture ready; private sessions outside Git.');
process.on('SIGTERM', () => {
  void h.close().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  void h.close().then(() => process.exit(0));
});
