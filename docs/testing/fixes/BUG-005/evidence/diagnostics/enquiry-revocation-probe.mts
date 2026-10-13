import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { setTimeout as pause } from 'node:timers/promises';

import { env } from '../../../../../../apps/api/src/config/env.js';
import {
  createAuthHarness,
  createFakeGoogle,
} from '../../../../../../apps/api/tests/auth-harness.js';
import { marketplaceFixtures } from '../../../../../../apps/api/tests/marketplace-fixtures.js';
import { createApprovalKit } from '../../../../../../apps/api/tests/approval-kit.js';

assert.equal(env.NODE_ENV, 'test');
assert.equal(env.AUTH_MODE, 'cookie');
assert.equal(env.PHONE_OTP_DRIVER, 'fake');
assert.equal(env.JOBS_ENABLED, false);
assert.equal(env.STORAGE_DRIVER, 'local');
const database = new URL(env.DATABASE_URL);
assert.equal(database.pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
const { Client } = createRequire(
  new URL('../../../../../../apps/api/package.json', import.meta.url),
)('pg');
const h = await createAuthHarness(createFakeGoogle());
const holder = new Client({ connectionString: env.DATABASE_URL });
const observer = new Client({ connectionString: env.DATABASE_URL });
await holder.connect();
await observer.connect();
let pending: Promise<{ status: number }> | undefined;
try {
  const stamp = String(Date.now());
  const fixtures = marketplaceFixtures(h, `enquiry-revoke-${stamp}`);
  const owner = await fixtures.dealership();
  const manager = await fixtures.member(owner, 'MANAGER');
  const member = await h.prisma.dealerMember.findFirstOrThrow({
    where: { dealerId: owner.dealerId, userId: manager.userId },
  });
  const admin = await fixtures.moderator();
  const car = await createApprovalKit(h, admin).published(owner, `KL41ER${stamp.slice(-4)}`);
  const customer = h.agent();
  const phone = `98273${stamp.slice(-5)}`;
  const proof = await customer
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:enquiry-revocation-${stamp}`,
    })
    .expect(200);
  await customer
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proof.body.signUpToken, fullName: 'Enquiry Authorization Fixture' })
    .expect(201);
  const receipt = await customer.post('/v1/enquiries').send({ listingSlug: car.slug }).expect(201);
  const id = String(receipt.body.id);
  const before = await h.prisma.enquiry.findUniqueOrThrow({ where: { id } });
  await holder.query('BEGIN');
  const pid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  await holder.query('SELECT id FROM enquiries WHERE id=$1 FOR UPDATE', [id]);
  let completed = false;
  pending = manager.agent
    .patch(`/v1/dealer/enquiries/${id}`)
    .send({ status: 'CLOSED' })
    .then((response) => {
      completed = true;
      return response;
    });
  let observed = false;
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const wait = await observer.query(
      "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type='Lock' AND query ILIKE '%enquiries%' AND $1::int=ANY(pg_blocking_pids(pid))",
      [pid],
    );
    if (wait.rowCount > 0) {
      observed = true;
      break;
    }
    await pause(10);
  }
  assert.ok(observed && !completed);
  await owner.agent.delete(`/v1/dealer/team/members/${member.id}`).expect(204);
  assert.equal(
    (await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: member.id } })).status,
    'REMOVED',
  );
  assert.equal(completed, false);
  await holder.query('COMMIT');
  const response = await pending;
  const after = await h.prisma.enquiry.findUniqueOrThrow({ where: { id } });
  const next = await manager.agent.get('/v1/dealer/enquiries');
  const audit = await h.prisma.auditLog.findMany({
    where: { entityId: id, action: 'enquiry.closed', actorId: manager.userId },
  });
  assert.equal(response.status, 200);
  assert.equal(after.status, 'CLOSED');
  assert.equal(after.closedById, manager.userId);
  assert.equal(next.status, 401);
  assert.equal(audit.length, 1);
  const report = {
    bug: 'BUG-NEW-012',
    severity: 'P1',
    status: 'OPEN',
    reproduced: true,
    environment:
      'isolated certification DB; actual cookie API; fake providers; current BUG005 vehicle guard applied but enquiry source unchanged from parentadeb847',
    expected: 'A revoked member cannot commit a queued privileged enquiry close',
    actual: {
      lockWaitProven: true,
      before: before.status,
      revocationHttp: 204,
      membership: 'REMOVED',
      queuedEnquiryHttp: response.status,
      after: after.status,
      closedByRemovedActor: true,
      actorAuditCount: audit.length,
      nextDealerRequest: next.status,
    },
    rootCause:
      'Enquiry service waits for its resource row and then trusts the request-entry actor permission snapshot; no current membership/role/session check at its transaction boundary',
    sourceSha256: createHash('sha256')
      .update(
        await readFile(
          new URL(
            '../../../../../../apps/api/src/modules/enquiries/enquiries.service.ts',
            import.meta.url,
          ),
        ),
      )
      .digest('hex'),
    disposition:
      'Separate high-priority stacked PR after current BUG005 final CI; no enquiry authorization implementation change in BUG005',
  };
  await writeFile(
    new URL('../enquiry-revocation-finding.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} finally {
  await holder.query('ROLLBACK');
  if (pending) await Promise.allSettled([pending]);
  await holder.end();
  await observer.end();
  await h.close();
}
