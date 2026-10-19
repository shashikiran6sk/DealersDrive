import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const { Client } = createRequire(
  new URL('../../../../../../apps/api/package.json', import.meta.url),
)('pg');
const fixtures = JSON.parse(await readFile('/tmp/dd-bug005-browser-private.json', 'utf8'));
const cases = fixtures.cases.filter((c) => c.mode === 'fixed');
assert.equal(cases.length, 3);
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
const db = new Client({ connectionString: database.href });
await db.connect();
try {
  const constraints = (
    await db.query(
      "SELECT count(*)::int AS total,count(*) FILTER(WHERE NOT convalidated)::int AS unvalidated FROM pg_constraint WHERE contype='f'",
    )
  ).rows[0];
  assert.equal(constraints.unvalidated, 0);
  const results = [];
  for (const f of cases) {
    const member = (
      await db.query(
        'SELECT status,"removedBy","removedAt","dealerId","userId" FROM dealer_members WHERE id=$1',
        [f.memberId],
      )
    ).rows[0];
    assert.equal(member.status, 'REMOVED');
    assert.equal(member.removedBy, f.ownerId);
    assert.equal(member.dealerId, f.dealerId);
    assert.equal(member.userId, f.managerId);
    assert.ok(member.removedAt);
    const resource = (
      await db.query(
        'SELECT l.status,l."dealerId",v."dealerId" AS "vehicleDealer" FROM listings l JOIN vehicles v ON v.id=l."vehicleId" WHERE l.id=$1 AND v.id=$2',
        [f.listingId, f.vehicleId],
      )
    ).rows[0];
    assert.equal(resource.status, 'DRAFT');
    assert.equal(resource.dealerId, f.dealerId);
    assert.equal(resource.vehicleDealer, f.dealerId);
    const state = (
      await db.query(
        'SELECT (SELECT count(*)::int FROM saved_vehicles WHERE "customerId"=$1) AS saved,(SELECT count(*)::int FROM enquiries WHERE "customerId"=$1) AS enquiries,(SELECT count(*)::int FROM audit_logs WHERE "entityId"=$2) AS "listingAudits",(SELECT count(*)::int FROM outbox_events WHERE "aggregateId"=$2) AS "listingEvents"',
        [f.managerId, f.listingId],
      )
    ).rows[0];
    assert.deepEqual(state, { saved: 1, enquiries: 1, listingAudits: 0, listingEvents: 0 });
    const audit = (
      await db.query('SELECT "actorId" FROM audit_logs WHERE "entityId"=$1 AND action=$2', [
        f.memberId,
        'member.removed',
      ])
    ).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actorId, f.ownerId);
    results.push({
      width: f.width,
      membership: member.status,
      removedAtPresent: true,
      removedByOwner: true,
      listing: resource.status,
      ownershipMatches: true,
      removalAuditActor: 'OWNER',
      ...state,
    });
  }
  const report = {
    bug: 'BUG-005',
    testedCommit: '69cfc0d1bd95d10ff1fbab66fbbaaaf8b6d42aed',
    environment: 'isolated certification PostgreSQL16; fake providers',
    result: 'PASS',
    scope:
      'Read-only final DB check; detailed before/after snapshots retained in browser and integration assertions',
    constraints,
    cases: results,
  };
  await writeFile(
    new URL('../final-db.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} finally {
  await db.end();
}
