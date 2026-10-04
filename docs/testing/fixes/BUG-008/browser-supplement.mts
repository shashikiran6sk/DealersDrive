import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

import { env } from '../../../../apps/api/src/config/env.js';
import { createSessionService } from '../../../../apps/api/src/modules/auth/session.service.js';
import { createAuthHarness, createFakeGoogle } from '../../../../apps/api/tests/auth-harness.js';

assert.equal(env.NODE_ENV, 'test');
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
assert.equal(new URL(env.API_BASE_URL).origin, 'http://localhost:4018');
assert.equal(env.JOBS_ENABLED, false);
const path = '/tmp/dd-bug008-browser-private.json';
const fixture = JSON.parse(await readFile(path, 'utf8'));
const longEmail = `${'mobile-operator-'.repeat(4).slice(0, 60)}@certification.example.test`;
const granted = await fetch(`${env.API_BASE_URL}/v1/admin/access`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: `dd_session=${fixture.adminToken}` },
  body: JSON.stringify({ email: longEmail, adminRole: 'MODERATOR' }),
});
assert.equal(granted.status, 201);
const longOperator = (await granted.json()) as { userId: string };
const h = await createAuthHarness(createFakeGoogle());
try {
  const sessions = createSessionService(h.prisma);
  const longSession = await sessions.issue({ userId: longOperator.userId, scope: 'ADMIN' });
  const logoutSession = await sessions.issue({ userId: fixture.adminUserId, scope: 'ADMIN' });
  const expiredSession = await sessions.issue({ userId: fixture.adminUserId, scope: 'ADMIN' });
  const { hashToken } = await import('../../../../apps/api/src/modules/auth/session.service.js');
  await h.prisma.session.updateMany({
    where: { tokenHash: hashToken(expiredSession.token) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await writeFile(
    path,
    JSON.stringify({
      ...fixture,
      longOperatorId: longOperator.userId,
      longAdminToken: longSession.token,
      logoutAdminToken: logoutSession.token,
      expiredAdminToken: expiredSession.token,
    }),
    { mode: 0o600 },
  );
  console.log(
    'Long-email granted seat and independent logout/expired sessions prepared; no tokens printed.',
  );
} finally {
  await h.close();
}
