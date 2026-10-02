import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createAuthHarness } from '../../../apps/api/tests/auth-harness.js';
import { createSessionService } from '../../../apps/api/src/modules/auth/session.service.js';
import { env } from '../../../apps/api/src/config/env.js';

assert.equal(new URL(env.DATABASE_URL).hostname, 'localhost');
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
const h = await createAuthHarness();
const sessions = createSessionService(h.prisma);
const fixtures = {};
for (const [role, phone] of [
  ['OWNER', '9000081010'],
  ['MANAGER', '9000081011'],
  ['STAFF', '9000081012'],
]) {
  const user = await h.prisma.user.findFirstOrThrow({ where: { phone: { endsWith: phone } } });
  const issued = await sessions.issue({ userId: user.id, scope: 'CUSTOMER' });
  fixtures[role] = { token: issued.token, name: user.fullName };
}
await writeFile('/tmp/dd-cert-role-browser-private.json', JSON.stringify(fixtures), {
  mode: 0o600,
});
console.log(
  'Three isolated customer-scope fixtures issued; authentication is setup, not a UAT result.',
);
await h.close();
