import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createAuthHarness } from '../../../apps/api/tests/auth-harness.js';
import { env } from '../../../apps/api/src/config/env.js';
import { COMPLETE_VEHICLE } from '../../../apps/api/tests/marketplace-fixtures.js';
import { createLocalStorage } from '../../../apps/api/src/platform/storage/local.adapter.js';

assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
const fixture = JSON.parse(await readFile('/tmp/dd-cert-browser-private.json', 'utf8'));
const h = await createAuthHarness();
const rows: unknown[] = [];
let counter = 0;
async function login(phone: string) {
  const agent = h.agent();
  await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:followup-${++counter}`,
    })
    .expect(200);
  return agent;
}
async function check(id: string, canonical: string[], title: string, run: () => Promise<unknown>) {
  try {
    rows.push({
      id,
      canonical,
      title,
      status: 'PASS',
      observed: await run(),
      sha: process.env.GIT_SHA,
    });
    console.log(id, 'PASS');
  } catch (error) {
    rows.push({
      id,
      canonical,
      title,
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unexpected error',
      sha: process.env.GIT_SHA,
    });
    console.log(id, 'FAIL');
  }
}
const owner = await login('9000081010');
const manager = await login('9000081011');
const removedStaff = await login('9000081012');
const admin = h.agent();
h.google.claims = {
  subject: 'followup-admin',
  email: env.adminAllowlist[0]!,
  emailVerified: true,
  name: 'Certification Admin',
};
await h.signInAdmin(admin);

await check(
  'API-FOLLOWUP-001',
  [
    'MEMBER-019',
    'MEMBER-020',
    'MEMBER-022',
    'MEMBER-023',
    'MEMBER-024',
    'MEMBER-026',
    'MEMBER-027',
    'IDENTITY-010',
    'IDENTITY-011',
    'CROSS-015',
    'CROSS-024',
    'CROSS-025',
    'DATA-001',
  ],
  'Removed staff remains a customer and preserves saved/enquiry/draft records',
  async () => {
    await removedStaff.get('/v1/dealer/vehicles').expect(401);
    await removedStaff.get('/v1/auth/customer/me').expect(200);
    const saved = await removedStaff.get('/v1/saved-vehicles').expect(200);
    const enquiries = await removedStaff.get('/v1/enquiries').expect(200);
    assert.equal(saved.body.data.length, 1);
    assert.equal(enquiries.body.data.length, 1);
    const member = await h.prisma.dealerMember.findUniqueOrThrow({
      where: { id: fixture.staffMembership },
    });
    const draft = await h.prisma.vehicle.findFirstOrThrow({
      where: {
        dealerId: fixture.dealerA,
        createdBy: member.userId,
        registrationNumber: 'TN22QA8190',
      },
    });
    assert.equal(draft.dealerId, fixture.dealerA);
    return { dealerHttp: 401, customerHttp: 200, saved: 1, enquiries: 1, draftPreserved: true };
  },
);
// Rejoin via the actual invitation flow, explicitly separate from revocation evidence.
const invitation = await owner
  .post('/v1/dealer/team/invitations')
  .send({ phone: '9000081012', role: 'STAFF' })
  .expect(201);
await removedStaff.post(`/v1/invitations/${invitation.body.id}/accept`).expect(200);
await check(
  'API-FOLLOWUP-002',
  ['API-SEC-003', 'STAFF-005', 'STAFF-006', 'STAFF-007', 'STAFF-008'],
  'STAFF is forbidden on the actual listing routes',
  async () => {
    const statuses = [];
    for (const action of ['submit', 'reserve', 'mark-sold', 'withdraw']) {
      const r = await removedStaff
        .post(`/v1/dealer/vehicles/${fixture.car.vehicleId}/${action}`)
        .send(action === 'withdraw' ? { reason: 'OTHER', note: 'Certification.' } : {});
      statuses.push(r.status);
      assert.equal(r.status, 403);
    }
    return { statuses };
  },
);
await check(
  'SEC-DISC-002',
  [],
  'Suspended dealer cannot continue delivering listing media publicly',
  async () => {
    const path = `/media/by-media/${fixture.other.mediaIds[0]}/640.webp`;
    await h.agent().get(path).expect(200);
    await admin
      .post(`/v1/admin/dealers/${fixture.dealerB}/suspend`)
      .send({ reason: 'Media visibility probe.' })
      .expect(200);
    const response = await h.agent().get(path);
    const listing = await h.agent().get(`/v1/vehicles/${fixture.other.slug}`);
    rows.push({
      id: 'SEC-DISC-002-OBSERVED',
      status: 'OBSERVATION',
      canonical: [],
      observed: { listingHttp: listing.status, publicMediaHttp: response.status },
      sha: process.env.GIT_SHA,
    });
    await admin.post(`/v1/admin/dealers/${fixture.dealerB}/reinstate`).send({}).expect(200);
    assert.equal(
      response.status,
      404,
      `listing HTTP ${listing.status}, public media HTTP ${response.status}`,
    );
    return { status: response.status };
  },
);

await check(
  'DATA-DISC-003',
  [],
  'Dealer enquiry pagination preserves records with equal timestamps',
  async () => {
    const dealerB = await login('9000081020');
    await h.prisma.enquiry.updateMany({
      where: { dealerId: fixture.dealerB },
      data: { createdAt: new Date('2026-10-02T01:00:00Z') },
    });
    const first = await dealerB.get('/v1/dealer/enquiries?limit=1').expect(200);
    const second = await dealerB
      .get('/v1/dealer/enquiries')
      .query({ limit: 1, cursor: first.body.page.nextCursor })
      .expect(200);
    assert.equal(
      second.body.data.length,
      1,
      `DB has at least 4 tied records; page 1 has ${first.body.data.length}; page 2 has ${second.body.data.length}`,
    );
    return { secondPage: second.body.data.length };
  },
);

await check(
  'AUTH-DISC-001',
  ['CONCURRENCY-007', 'CROSS-019'],
  'Membership removed before a blocked listing submission commits denies the operation',
  async () => {
    const created = await manager
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: 'TN22QA8191' })
      .expect(201);
    await manager
      .patch(`/v1/dealer/vehicles/${created.body.id}`)
      .send(COMPLETE_VEHICLE)
      .expect(200);
    const listing = await h.prisma.listing.findUniqueOrThrow({
      where: { vehicleId: created.body.id },
    });
    const pg = createRequire(new URL('../../../apps/api/package.json', import.meta.url))('pg');
    const blocker = new pg.Client({ connectionString: env.DATABASE_URL });
    await blocker.connect();
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM listings WHERE id=$1 FOR UPDATE', [listing.id]);
    let completed = false;
    const request = manager.post(`/v1/dealer/vehicles/${created.body.id}/submit`).then((r) => {
      completed = true;
      return r;
    });
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      await blocker.query('SELECT pg_stat_clear_snapshot()');
      const active = await blocker.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname='dealersdrive_cert' AND wait_event_type='Lock' AND query ILIKE '%listings%'",
      );
      if (active.rows[0].n > 0) {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (!waiting || completed) {
      await blocker.query('ROLLBACK');
      await blocker.end();
      await request;
      throw new Error('Harness did not observe the lock wait; no revocation performed.');
    }
    await owner.delete(`/v1/dealer/team/members/${fixture.managerMembership}`).expect(204);
    await blocker.query('COMMIT');
    await blocker.end();
    const response = await request;
    const final = await h.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    const member = await h.prisma.dealerMember.findUniqueOrThrow({
      where: { id: fixture.managerMembership },
    });
    rows.push({
      id: 'AUTH-DISC-001-OBSERVED',
      status: 'OBSERVATION',
      canonical: [],
      observed: {
        lockWaitProven: waiting,
        membership: member.status,
        mutationHttp: response.status,
        listing: final.status,
      },
      sha: process.env.GIT_SHA,
    });
    assert.ok(
      response.status >= 400 && final.status === 'DRAFT',
      `Membership ${member.status}; blocked request completed HTTP ${response.status}; listing became ${final.status}`,
    );
    return { status: response.status };
  },
);

await writeFile(
  new URL('./evidence/security/followup-probes.json', import.meta.url),
  JSON.stringify(rows, null, 2) + '\n',
);
await h.close();
