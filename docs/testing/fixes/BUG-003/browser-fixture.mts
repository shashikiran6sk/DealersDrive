import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../../../apps/api/src/config/env.js';
import { createSessionService } from '../../../../apps/api/src/modules/auth/session.service.js';
import { createApprovalKit } from '../../../../apps/api/tests/approval-kit.js';
import { createAuthHarness, createFakeGoogle } from '../../../../apps/api/tests/auth-harness.js';
import { marketplaceFixtures } from '../../../../apps/api/tests/marketplace-fixtures.js';

assert.equal(env.NODE_ENV, 'test');
const db = new URL(env.DATABASE_URL);
assert.equal(db.pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(db.hostname));
assert.equal(env.PHONE_OTP_DRIVER, 'fake');
assert.equal(env.STORAGE_DRIVER, 'local');
assert.equal(env.JOBS_ENABLED, false);
const api = new URL(env.API_BASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(api.hostname));
assert.ok(api.port);
assert.equal(new URL(env.MEDIA_BASE_URL).origin, api.origin);
const h = await createAuthHarness(createFakeGoogle());
await new Promise<void>((resolve, reject) =>
  h.server.close((error) => (error ? reject(error) : resolve())),
);
await new Promise<void>((resolve) => h.server.listen(Number(api.port), resolve));
const privateFile = '/tmp/dd-bug003-browser-private.json';
if (process.env.BUG003_REUSE === 'true') {
  const existing: unknown = JSON.parse(await readFile(privateFile, 'utf8'));
  assert.ok(existing && typeof existing === 'object' && 'apiPort' in existing);
  assert.equal(existing.apiPort, Number(api.port));
} else {
  const label = `bug003-browser-${Date.now().toString(36)}`;
  const fixtures = marketplaceFixtures(h, label);
  const owner = await fixtures.dealership();
  const admin = await fixtures.moderator();
  const kit = createApprovalKit(h, admin);
  const buyer = h.agent();
  const phone = `98274${String(Date.now()).slice(-5)}`;
  const proved = await buyer
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:${label}`,
    })
    .expect(200);
  const signed = await buyer
    .post('/v1/auth/sign-up/customer')
    .send({
      signUpToken: proved.body.signUpToken,
      fullName: 'Pagination Fixture',
    })
    .expect(201);
  const customerId = String(signed.body.customer.id);
  const plates = await h.prisma.vehicle.findMany({
    where: { registrationNumber: { startsWith: 'KL41PJ' } },
    select: { registrationNumber: true },
  });
  const first = Math.max(5000, ...plates.map((row) => Number(row.registrationNumber.slice(6)))) + 1;
  const jpeg = await readFile(new URL('../BUG-002/browser-yard.jpg', import.meta.url));
  for (let n = 0; n < 51; n += 1) {
    const car = await kit.published(owner, `KL41PJ${String(first + n)}`);
    await buyer.put(`/v1/saved-vehicles/${car.slug}`).expect(200);
    await buyer
      .post('/v1/enquiries')
      .send({
        listingSlug: car.slug,
        message: `Pagination fixture ${String(n + 1).padStart(2, '0')}`,
      })
      .expect(201);
    const media = await h.prisma.media.findMany({ where: { id: { in: car.mediaIds } } });
    for (const row of media) {
      const file = path.resolve(env.STORAGE_LOCAL_DIR, row.storageKey);
      assert.ok(file.startsWith(path.resolve(env.STORAGE_LOCAL_DIR) + path.sep));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, jpeg);
    }
  }
  const at = new Date('2026-10-02T09:00:00.123Z');
  await h.prisma.savedVehicle.updateMany({ where: { customerId }, data: { createdAt: at } });
  await h.prisma.enquiry.updateMany({ where: { customerId }, data: { createdAt: at } });
  const sessions = createSessionService(h.prisma);
  const customerSession = await sessions.issue({ userId: customerId, scope: 'CUSTOMER' });
  const ownerSession = await sessions.issue({ userId: owner.userId, scope: 'DEALER' });
  await writeFile(
    privateFile,
    JSON.stringify({
      apiPort: Number(api.port),
      customerId,
      dealerId: owner.dealerId,
      customerToken: customerSession.token,
      ownerToken: ownerSession.token,
      rows: 51,
      createdAt: at.toISOString(),
    }),
    { mode: 0o600 },
  );
}
console.log('Isolated pagination fixture ready; private sessions remain outside the repository.');
process.on('SIGTERM', () => {
  void h.close().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  void h.close().then(() => process.exit(0));
});
