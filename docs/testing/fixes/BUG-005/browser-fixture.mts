import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

import { env } from '../../../../apps/api/src/config/env.js';
import { createSessionService } from '../../../../apps/api/src/modules/auth/session.service.js';
import { createAuthHarness, createFakeGoogle } from '../../../../apps/api/tests/auth-harness.js';
import { createApprovalKit } from '../../../../apps/api/tests/approval-kit.js';
import {
  COMPLETE_VEHICLE,
  marketplaceFixtures,
} from '../../../../apps/api/tests/marketplace-fixtures.js';

assert.equal(env.NODE_ENV, 'test');
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(env.STORAGE_DRIVER, 'local');
assert.equal(env.PHONE_OTP_DRIVER, 'fake');
assert.equal(env.JOBS_ENABLED, false);
const api = new URL(env.API_BASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(api.hostname));
const h = await createAuthHarness(createFakeGoogle());
await new Promise<void>((resolve, reject) =>
  h.server.close((error) => (error ? reject(error) : resolve())),
);
await new Promise<void>((resolve) => h.server.listen(Number(api.port), resolve));
const privateFile = '/tmp/dd-bug005-browser-private.json';
if (process.env.BUG005_REUSE !== 'true') {
  const sessions = createSessionService(h.prisma);
  const fixtures = marketplaceFixtures(h, `bug005-${Date.now().toString(36)}`);
  const admin = await fixtures.moderator();
  const kit = createApprovalKit(h, admin);
  const cases = [];
  let plate = 8100 + Math.floor(Math.random() * 800);
  const publicOwner = await fixtures.dealership();
  plate += 1;
  const published = await kit.published(publicOwner, `KL41MC${String(plate)}`);
  for (const [mode, width] of [
    ['baseline', 1440],
    ['fixed', 1440],
    ['fixed', 768],
    ['fixed', 390],
  ] as const) {
    const owner = await fixtures.dealership();
    const manager = await fixtures.member(owner, 'MANAGER');
    const user = await h.prisma.user.findUniqueOrThrow({ where: { id: manager.userId } });
    const member = await h.prisma.dealerMember.findFirstOrThrow({
      where: { dealerId: owner.dealerId, userId: manager.userId },
    });
    const ownerSession = await sessions.issue({ userId: owner.userId, scope: 'DEALER' });
    const managerSession = await sessions.issue({ userId: manager.userId, scope: 'DEALER' });
    const customer = h.agent();
    assert.ok(user.phone);
    const phone = user.phone.slice(-10);
    await customer
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:personal-history-${mode}-${String(width)}`,
      })
      .expect(200);
    const personalSession = await sessions.issue({ userId: manager.userId, scope: 'CUSTOMER' });
    await customer.put(`/v1/saved-vehicles/${published.slug}`).expect(200);
    await customer
      .post('/v1/enquiries')
      .send({ listingSlug: published.slug, message: 'Isolated member browser history' })
      .expect(201);
    plate += 1;
    const created = await manager.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: `KL41MC${String(plate)}` })
      .expect(201);
    const vehicleId = String(created.body.id);
    const ready = await manager.agent
      .patch(`/v1/dealer/vehicles/${vehicleId}`)
      .send(COMPLETE_VEHICLE)
      .expect(200);
    assert.equal(ready.body.listing.canSubmit, true);
    cases.push({
      mode,
      width,
      dealerId: owner.dealerId,
      ownerId: owner.userId,
      managerId: manager.userId,
      memberId: member.id,
      vehicleId,
      listingId: String(ready.body.listing.id),
      ownerToken: ownerSession.token,
      managerToken: managerSession.token,
      personalToken: personalSession.token,
    });
  }
  await writeFile(privateFile, JSON.stringify({ cases }), { mode: 0o600 });
} else {
  const existing: unknown = JSON.parse(await readFile(privateFile, 'utf8'));
  assert.ok(existing && typeof existing === 'object' && 'cases' in existing);
}
console.log('Inert member fixture ready; private sessions remain outside Git.');
process.on('SIGTERM', () => {
  void h.close().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  void h.close().then(() => process.exit(0));
});
