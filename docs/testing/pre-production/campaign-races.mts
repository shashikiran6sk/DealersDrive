import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createAuthHarness } from '../../../apps/api/tests/auth-harness.js';
import { COMPLETE_VEHICLE } from '../../../apps/api/tests/marketplace-fixtures.js';
import { env } from '../../../apps/api/src/config/env.js';

assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
const fixture = JSON.parse(await readFile('/tmp/dd-cert-browser-private.json', 'utf8'));
const h = await createAuthHarness();
const pg = createRequire(new URL('../../../apps/api/package.json', import.meta.url))('pg');
const owner = h.agent();
const manager = h.agent();
for (const [agent, phone] of [
  [owner, '9000081010'],
  [manager, '9000081011'],
] as const) {
  await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:races-${phone}` })
    .expect(200);
}
const rows: unknown[] = [];
const draft = await manager
  .post('/v1/dealer/vehicles')
  .send({ registrationNumber: 'TN22QA8192' })
  .expect(201);
await manager.patch(`/v1/dealer/vehicles/${draft.body.id}`).send(COMPLETE_VEHICLE).expect(200);
const listing = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId: draft.body.id } });
const blocker = new pg.Client({ connectionString: env.DATABASE_URL });
const observer = new pg.Client({ connectionString: env.DATABASE_URL });
await blocker.connect();
await observer.connect();
await blocker.query('BEGIN');
await blocker.query('SELECT id FROM listings WHERE id=$1 FOR UPDATE', [listing.id]);
let request: Promise<unknown> | undefined;
try {
  let completed = false;
  const pending = manager.post(`/v1/dealer/vehicles/${draft.body.id}/submit`).then((r) => {
    completed = true;
    return r;
  });
  request = pending;
  let waiting = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    const activity = await observer.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname='dealersdrive_cert' AND wait_event_type='Lock' AND query ILIKE '%listings%'",
    );
    if (activity.rows[0].n > 0) {
      waiting = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(waiting && !completed, 'Must observe the real listing row-lock wait before revoking.');
  await owner.delete(`/v1/dealer/team/members/${fixture.managerMembership}`).expect(204);
  await blocker.query('COMMIT');
  const response = await pending;
  const final = await h.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
  const member = await h.prisma.dealerMember.findUniqueOrThrow({
    where: { id: fixture.managerMembership },
  });
  const deniedNext = await manager.get('/v1/dealer/vehicles');
  rows.push({
    id: 'AUTH-DISC-001',
    canonical: ['CONCURRENCY-007', 'CROSS-019'],
    title: 'Revocation before a blocked submission commits',
    status: response.status >= 400 && final.status === 'DRAFT' ? 'PASS' : 'FAIL',
    observed: {
      lockWaitProven: true,
      revocationHttp: 204,
      member: member.status,
      submissionHttp: response.status,
      listing: final.status,
      nextDealerRequest: deniedNext.status,
    },
    sha: process.env.GIT_SHA,
  });
} catch (error) {
  rows.push({
    id: 'AUTH-DISC-001',
    canonical: ['CONCURRENCY-007', 'CROSS-019'],
    status: 'BLOCKED',
    reason: error instanceof Error ? error.message : 'Harness error',
    sha: process.env.GIT_SHA,
  });
} finally {
  await blocker.query('ROLLBACK');
  await blocker.end();
  await observer.end();
  if (request) await request;
}
// Rejoin using the actual invitation acceptance; preserve removed-before-commit evidence above.
const invite = await owner
  .post('/v1/dealer/team/invitations')
  .send({ phone: '9000081011', role: 'MANAGER' })
  .expect(201);
await manager.post(`/v1/invitations/${invite.body.id}/accept`).expect(200);
await writeFile(
  new URL('./evidence/concurrency/revocation-in-flight.json', import.meta.url),
  JSON.stringify(rows, null, 2) + '\n',
);
console.log(rows);
await h.close();
