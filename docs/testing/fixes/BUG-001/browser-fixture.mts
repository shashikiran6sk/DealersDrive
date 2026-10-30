import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { env } from '../../../../apps/api/src/config/env.js';
import { createSessionService } from '../../../../apps/api/src/modules/auth/session.service.js';
import { createAuthHarness, createFakeGoogle } from '../../../../apps/api/tests/auth-harness.js';
import { marketplaceFixtures } from '../../../../apps/api/tests/marketplace-fixtures.js';

assert.equal(env.NODE_ENV, 'test');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname));
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
assert.equal(env.PHONE_OTP_DRIVER, 'fake');
assert.equal(env.JOBS_ENABLED, false);
const h = await createAuthHarness(createFakeGoogle());
const stamp = Date.now().toString(36);
const fixtures = marketplaceFixtures(h, `bug001-browser-${stamp}`);
const owner = await fixtures.dealership();
const sessions = createSessionService(h.prisma);
const ownerSession = await sessions.issue({ userId: owner.userId, scope: 'DEALER' });
const cases = [];
for (const width of [1440, 768, 390]) {
  for (const outcome of ['withdrawal', 'acceptance']) {
    let phone: string;
    do {
      phone = `944${String(randomInt(1_000_000, 10_000_000))}`;
    } while (
      await h.prisma.user.findUnique({ where: { phone: `+91${phone}` }, select: { id: true } })
    );
    const customer = h.agent();
    const proved = await customer
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:browser-${stamp}-${String(cases.length)}`,
      })
      .expect(200);
    const created = await customer
      .post('/v1/auth/sign-up/customer')
      .send({
        signUpToken: proved.body.signUpToken,
        fullName: `Invitation Browser Fixture ${String(cases.length)}`,
      })
      .expect(201);
    const userId = String(created.body.customer.id);
    const invited = await owner.agent
      .post('/v1/dealer/team/invitations')
      .send({ phone, role: 'STAFF' })
      .expect(201);
    const session = await sessions.issue({ userId, scope: 'CUSTOMER' });
    cases.push({
      width,
      outcome,
      userId,
      phone,
      invitationId: String(invited.body.id),
      token: session.token,
    });
  }
}
const address = h.server.address();
assert.ok(address && typeof address !== 'string');
await writeFile(
  '/tmp/dd-bug001-browser-private.json',
  JSON.stringify({
    apiPort: address.port,
    owner: { dealerId: owner.dealerId, userId: owner.userId, token: ownerSession.token },
    cases,
  }),
  { mode: 0o600 },
);
console.log(
  'Isolated invitation browser fixture ready; private sessions saved outside the repository.',
);
process.on('SIGTERM', () => {
  void h.close().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  void h.close().then(() => process.exit(0));
});
