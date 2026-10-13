import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const require = createRequire(new URL('../../../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const fixture = JSON.parse(await fs.readFile('/tmp/dd-new005-browser-private.json', 'utf8'));
const base = process.env.WEB_BASE_URL ?? 'http://localhost:3008';
const api = `http://localhost:${fixture.apiPort}`;
const dir = fileURLToPath(new URL('.', import.meta.url));
const database = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(database.pathname, '/dealersdrive_cert');
const db = new Client({ connectionString: database.toString() });
await db.connect();
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const results = [];
async function context(token, width) {
  const c = await browser.newContext({ viewport: { width, height: 900 } });
  await c.addCookies([
    {
      name: 'dd_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  return c;
}
async function counts(id) {
  const result = await db.query(
    `SELECT
    (SELECT count(*) FROM dealers WHERE id=$1)::int AS dealers,
    (SELECT count(*) FROM dealer_members WHERE "dealerId"=$1)::int AS members,
    (SELECT count(*) FROM dealer_documents WHERE "dealerId"=$1)::int AS documents,
    (SELECT count(*) FROM media WHERE "dealerId"=$1)::int AS media,
    (SELECT count(*) FROM sessions WHERE "activeDealerId"=$1)::int AS active_sessions,
    (SELECT count(*) FROM audit_logs WHERE "entityId"=$1::text AND action='dealer.rejected')::int AS rejection_audits,
    (SELECT count(*) FROM outbox_events WHERE "aggregateId"=$1::text AND "eventType"='DealerRejected')::int AS rejection_events,
    (SELECT count(*) FROM outbox_events WHERE "aggregateId"=$1::text AND "eventType"='StorageObjectsDelete')::int AS cleanup_events`,
    [id],
  );
  return result.rows[0];
}
async function openRejection(page, f) {
  await page.goto(`${base}/admin/dealers/${f.id}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: f.brandName, exact: true }).waitFor();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('img')).every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await page.getByRole('button', { name: 'Reject application…', exact: true }).click();
}
try {
  for (const f of fixture.cases) {
    const admin = await context(f.adminToken, f.width),
      owner = await context(f.ownerToken, f.width);
    const page = await admin.newPage(),
      ownerPage = await owner.newPage();
    await ownerPage.goto(`${base}/dealer`, { waitUntil: 'domcontentloaded' });
    await ownerPage.getByRole('heading').first().waitFor();
    await openRejection(page, f);
    const permanent = page.getByRole('button', {
      name: 'Reject and delete permanently',
      exact: true,
    });
    assert.equal(await permanent.isDisabled(), true);
    await page.locator('#rejectReason').fill('Invalid supporting documents');
    await page.locator('#rejectConfirm').fill('incorrect confirmation');
    assert.equal(await permanent.isDisabled(), true);
    await page.locator('#rejectConfirm').fill(f.brandName);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('button')).some(
        (button) =>
          button.textContent.trim() === 'Reject and delete permanently' && !button.disabled,
      ),
    );
    const detailResponse = await admin.request.get(`${api}/v1/admin/dealers/${f.id}`);
    assert.equal(detailResponse.status(), 200);
    const detail = await detailResponse.json();
    const readUrls = [...detail.documents.map((document) => document.viewUrl), detail.yardPhotoUrl];
    assert.equal(readUrls.length, 4);
    for (const url of readUrls) {
      assert.ok(url);
      assert.equal((await admin.request.get(url)).status(), 200);
    }
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    await page.screenshot({ path: `${dir}/before-reject-${f.width}.png`, fullPage: true });
    assert.equal((await admin.request.get(`${api}/v1/dealers/${f.slug}`)).status(), 404);
    await permanent.click();
    await page.waitForURL(`${base}/admin/dealers`);
    for (const url of readUrls) assert.equal((await admin.request.get(url)).status(), 404);
    const state = await counts(f.id);
    assert.deepEqual(state, {
      dealers: 0,
      members: 0,
      documents: 0,
      media: 0,
      active_sessions: 0,
      rejection_audits: 1,
      rejection_events: 1,
      cleanup_events: 1,
    });
    const history = await db.query(
      'SELECT "actorId",after FROM audit_logs WHERE "entityId"=$1::text AND action=\'dealer.rejected\'',
      [f.id],
    );
    assert.equal(history.rows[0].actorId, f.adminUserId);
    assert.equal(history.rows[0].after.objectsDeleteRequested, 4);
    assert.equal(
      (
        await admin.request.post(`${api}/v1/admin/dealers/${f.id}/reject`, {
          data: { reason: 'Invalid supporting documents' },
        })
      ).status(),
      404,
    );
    assert.equal((await owner.request.get(`${api}/v1/dealer`)).status(), 401);
    assert.equal((await admin.request.get(`${api}/v1/dealers/${f.slug}`)).status(), 404);
    await ownerPage.reload({ waitUntil: 'domcontentloaded' });
    await ownerPage.waitForURL(/\/dealer\/onboarding/);
    await ownerPage.screenshot({
      path: `${dir}/after-owner-onboarding-${f.width}.png`,
      fullPage: true,
    });
    results.push({
      scenario: 'confirmed-rejection-and-existing-owner-tab',
      width: f.width,
      result: 'PASS',
      db: state,
      immutableActor: 'PASS',
      confirmation: 'PASS',
      replayHttp: 404,
      ownerHttp: 401,
      publicHttp: 404,
      layout,
      knownBug008Overflow: layout.scrollWidth > layout.viewport,
    });
    await admin.close();
    await owner.close();
  }
  const f = fixture.stale;
  const admin = await context(f.adminToken, 1440),
    page = await admin.newPage();
  await openRejection(page, f);
  await page.locator('#rejectReason').fill('Invalid supporting documents');
  await page.locator('#rejectConfirm').fill(f.brandName);
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('button')).some(
      (button) => button.textContent.trim() === 'Reject and delete permanently' && !button.disabled,
    ),
  );
  await page.screenshot({ path: `${dir}/before-stale-rejection.png`, fullPage: true });
  assert.equal(
    (await admin.request.post(`${api}/v1/admin/dealers/${f.id}/approve`, { data: {} })).status(),
    200,
  );
  await page.getByRole('button', { name: 'Reject and delete permanently', exact: true }).click();
  await page
    .getByText(
      'An approved dealership is suspended, not rejected. Suspension is reversible; this is not.',
      { exact: true },
    )
    .waitFor();
  assert.equal(page.url(), `${base}/admin/dealers/${f.id}`);
  const state = await counts(f.id);
  assert.equal(state.dealers, 1);
  assert.equal(state.documents, 3);
  assert.equal(state.media, 1);
  assert.equal(state.members, 1);
  assert.equal(state.rejection_audits, 0);
  assert.equal(state.rejection_events, 0);
  assert.equal(state.cleanup_events, 0);
  const row = await db.query('SELECT status,"approvedAt" FROM dealers WHERE id=$1', [f.id]);
  assert.equal(row.rows[0].status, 'ACTIVE');
  assert.ok(row.rows[0].approvedAt);
  assert.equal((await admin.request.get(`${api}/v1/dealers/${f.slug}`)).status(), 200);
  await page.screenshot({ path: `${dir}/after-stale-rejection-denied.png`, fullPage: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Suspend', exact: true }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Reject application…', exact: true }).count(),
    0,
  );
  await page.screenshot({ path: `${dir}/after-stale-refresh-active.png`, fullPage: true });
  results.push({
    scenario: 'stale-admin-rejection-after-approval',
    result: 'PASS',
    state: 'ACTIVE',
    db: state,
    publicHttp: 200,
    refreshedControls: 'PASS',
  });
  await admin.close();
  await fs.writeFile(
    `${dir}/browser.json`,
    JSON.stringify(
      {
        testedSha: process.env.TESTED_SHA,
        environment:
          'isolated local Chromium / real cookie API / PostgreSQL / inert uploads / fake providers / recording mailer',
        result: 'PASS',
        cases: results,
        humanUat: 'PENDING',
        mobileLayout: 'BUG-008 remains separately open; functional checks only',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({ result: 'PASS', scenarios: results.length, viewports: [1440, 768, 390] }),
  );
} finally {
  await browser.close();
  await db.end();
}
