import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const require = createRequire(new URL('../../../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const fixtures = JSON.parse(await fs.readFile('/tmp/dd-bug005-browser-private.json', 'utf8'));
const mode = process.env.BUG005_MODE ?? 'fixed';
assert.ok(['baseline', 'fixed'].includes(mode));
const base = process.env.WEB_BASE_URL ?? 'http://localhost:3009';
const api = process.env.API_BASE_URL ?? 'http://localhost:4014';
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.pathname, '/dealersdrive_cert');
for (const url of [base, api, database.href])
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
const dir = fileURLToPath(new URL('.', import.meta.url));
const db = new Client({ connectionString: database.href });
const observer = new Client({ connectionString: database.href });
await db.connect();
await observer.connect();
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const results = [];
async function context(width, value) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  ctx.setDefaultTimeout(15000);
  await ctx.addCookies([
    {
      name: 'dd_session',
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  return ctx;
}
async function state(f) {
  const vehicle = (await observer.query('SELECT * FROM vehicles WHERE id=$1', [f.vehicleId]))
    .rows[0];
  const listing = (await observer.query('SELECT * FROM listings WHERE id=$1', [f.listingId]))
    .rows[0];
  const saved = (
    await observer.query(
      'SELECT id,"listingId","createdAt" FROM saved_vehicles WHERE "customerId"=$1 ORDER BY id',
      [f.managerId],
    )
  ).rows;
  const enquiries = (
    await observer.query(
      'SELECT id,status,"listingId","createdAt" FROM enquiries WHERE "customerId"=$1 ORDER BY id',
      [f.managerId],
    )
  ).rows;
  const audit = (
    await observer.query(
      'SELECT id,action,"actorId" FROM audit_logs WHERE "entityId"=$1 ORDER BY id',
      [f.listingId],
    )
  ).rows;
  const outbox = (
    await observer.query(
      'SELECT id,"eventType","aggregateId" FROM outbox_events WHERE "aggregateId"=$1 ORDER BY id',
      [f.listingId],
    )
  ).rows;
  return { vehicle, listing, saved, enquiries, audit, outbox };
}
try {
  for (const f of fixtures.cases.filter((f) => f.mode === mode)) {
    const owner = await context(f.width, f.ownerToken);
    const manager = await context(f.width, f.managerToken);
    const personal = await context(f.width, f.personalToken);
    const ownerPage = await owner.newPage();
    const managerPage = await manager.newPage();
    await ownerPage.goto(`${base}/dealer/team`, { waitUntil: 'networkidle' });
    await managerPage.goto(`${base}/dealer/vehicles/${f.vehicleId}/edit?step=review`, {
      waitUntil: 'networkidle',
    });
    const submit = managerPage.getByRole('button', { name: 'Submit for review', exact: true });
    assert.equal(await submit.isEnabled(), true);
    await submit.scrollIntoViewIfNeeded();
    await managerPage.screenshot({ path: `${dir}/${mode}-before-submit-${f.width}.png` });
    await ownerPage.getByRole('button', { name: 'Remove', exact: true }).click();
    const confirm = ownerPage.getByRole('button', { name: 'Remove from team', exact: true });
    await confirm.waitFor();
    const before = await state(f);
    assert.equal(before.listing.status, 'DRAFT');
    await db.query('BEGIN');
    const holderPid = Number((await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    await db.query('SELECT id FROM listings WHERE id=$1 FOR UPDATE', [f.listingId]);
    try {
      const actionResponse = managerPage.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          r.url().includes(`/dealer/vehicles/${f.vehicleId}/edit`),
      );
      await submit.click();
      let waiterPid;
      const deadline = Date.now() + 3500;
      while (Date.now() < deadline) {
        const wait = await observer.query(
          "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type='Lock' AND query ILIKE '%listings%' AND $1::int=ANY(pg_blocking_pids(pid))",
          [holderPid],
        );
        if (wait.rows.length) {
          waiterPid = Number(wait.rows[0].pid);
          break;
        }
        await pause(10);
      }
      assert.ok(waiterPid, 'Actual server write must be waiting on the independent listing lock');
      await confirm.click();
      const removalDeadline = Date.now() + 2000;
      let removed;
      while (Date.now() < removalDeadline) {
        removed = (
          await observer.query(
            'SELECT status,"removedBy","removedAt" FROM dealer_members WHERE id=$1',
            [f.memberId],
          )
        ).rows[0];
        if (removed.status === 'REMOVED') break;
        await pause(10);
      }
      assert.equal(removed.status, 'REMOVED');
      assert.equal(removed.removedBy, f.ownerId);
      assert.ok(removed.removedAt);
      assert.equal((await state(f)).listing.status, 'DRAFT');
      await db.query('COMMIT');
      const action = await actionResponse;
      if (mode === 'fixed')
        await managerPage.waitForFunction(
          () =>
            document.body.innerText.includes('You must be signed in to do that.') ||
            document.body.innerText.includes('Something went wrong') ||
            !location.pathname.includes('/vehicles/'),
          undefined,
          { timeout: 15000 },
        );
      else await managerPage.waitForLoadState('networkidle');
      const after = await state(f);
      assert.equal(after.listing.status, mode === 'fixed' ? 'DRAFT' : 'PENDING_REVIEW');
      for (const key of mode === 'fixed'
        ? ['vehicle', 'listing', 'audit', 'outbox', 'saved', 'enquiries']
        : ['saved', 'enquiries'])
        assert.deepEqual(after[key], before[key]);
      await managerPage.screenshot({ path: `${dir}/${mode}-after-submit-${f.width}.png` });
      await ownerPage.getByRole('dialog').waitFor({ state: 'hidden' });
      await ownerPage.screenshot({ path: `${dir}/${mode}-removed-team-${f.width}.png` });
      const direct = await manager.request.post(`${api}/v1/dealer/vehicles/${f.vehicleId}/submit`);
      assert.equal(direct.status(), 401);
      const refreshed = await managerPage.reload({ waitUntil: 'networkidle' });
      assert.ok(!managerPage.url().includes(`/vehicles/${f.vehicleId}/edit`));
      await managerPage.screenshot({ path: `${dir}/${mode}-refreshed-access-${f.width}.png` });
      const personalPage = await personal.newPage();
      await personalPage.goto(`${base}/saved`, { waitUntil: 'networkidle' });
      await personalPage.getByRole('heading', { name: 'Saved cars', exact: true }).waitFor();
      assert.equal(await personalPage.locator('main article').count(), before.saved.length);
      await personalPage.screenshot({ path: `${dir}/${mode}-personal-saved-${f.width}.png` });
      assert.equal((await personal.request.get(`${api}/v1/auth/customer/me`)).status(), 200);
      assert.equal((await personal.request.get(`${api}/v1/enquiries`)).status(), 200);
      const removalAudit = await observer.query(
        'SELECT "actorId" FROM audit_logs WHERE "entityId"=$1 AND action=$2',
        [f.memberId, 'member.removed'],
      );
      assert.equal(removalAudit.rowCount, 1);
      assert.equal(removalAudit.rows[0].actorId, f.ownerId);
      const geometry = await personalPage.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      results.push({
        mode,
        width: f.width,
        lockWaitProven: true,
        membership: removed.status,
        removedByOwner: true,
        listingBefore: before.listing.status,
        listingAfter: after.listing.status,
        actionHttp: action.status(),
        directAfterRemovalHttp: direct.status(),
        refreshHttp: refreshed.status(),
        redirectedAwayFromVehicle: true,
        resourcesAndHistoryPreserved: mode === 'fixed',
        savedCount: after.saved.length,
        enquiryCount: after.enquiries.length,
        removalAuditActor: 'OWNER',
        personalAccountHttp: 200,
        geometry,
      });
    } finally {
      await db.query('ROLLBACK');
    }
    await Promise.all([owner.close(), manager.close(), personal.close()]);
  }
  const report = {
    bug: 'BUG-005',
    canonicalTests: ['CONCURRENCY-007', 'CROSS-019'],
    mode,
    cases: results,
    productCommit:
      mode === 'fixed'
        ? '69cfc0d1bd95d10ff1fbab66fbbaaaf8b6d42aed'
        : 'parent-equivalent loaded vehicle service before BUG-005',
    interpretation:
      mode === 'fixed'
        ? 'Scoped queued submission/removal browser UAT PASS; full certification and human UAT pending'
        : 'Original queued mutation defect reproduced; baseline FAIL retained',
  };
  await fs.writeFile(`${dir}/browser-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await db.end();
  await observer.end();
}
