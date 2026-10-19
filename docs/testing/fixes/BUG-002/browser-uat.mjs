import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const require = createRequire(new URL('../../../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const fixture = JSON.parse(await fs.readFile('/tmp/dd-bug002-browser-private.json', 'utf8'));
const base = process.env.WEB_BASE_URL ?? 'http://localhost:3005';
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
async function state(id) {
  const row = await db.query('SELECT status,"approvedAt" FROM dealers WHERE id=$1', [id]);
  const audit = await db.query(
    'SELECT "actorId",before,after,"createdAt" FROM audit_logs WHERE "entityId"=$1 AND action=\'dealer.approved\'',
    [id],
  );
  const docs = await db.query(
    'SELECT status,"reviewedBy","reviewedAt" FROM dealer_documents WHERE "dealerId"=$1',
    [id],
  );
  const event = await db.query(
    'SELECT count(*) FROM outbox_events WHERE "aggregateId"=$1 AND "eventType"=\'DealerApproved\'',
    [id],
  );
  return {
    row: row.rows[0],
    audit: audit.rows,
    docs: docs.rows,
    events: Number(event.rows[0].count),
  };
}
try {
  for (const f of fixture.cases) {
    const admin = await context(f.adminToken, f.width),
      owner = await context(f.ownerToken, f.width);
    const page = await admin.newPage(),
      ownerPage = await owner.newPage();
    await page.goto(`${base}/admin/dealers/${f.id}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: f.brandName, exact: true }).waitFor();
    await page.locator('img').first().waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('img')).every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    await page.locator('#approvalConfirm').fill(`approve ${f.brandName.toLowerCase()}`);
    assert.equal(
      await page.getByRole('button', { name: 'Approve dealer', exact: true }).isDisabled(),
      true,
    );
    assert.equal((await admin.request.get(`${api}/v1/dealers/${f.slug}`)).status(), 404);
    const draft = await admin.request.post(`${api}/v1/admin/dealers/${f.draftId}/approve`, {
      data: {},
    });
    assert.equal(draft.status(), 422);
    assert.equal((await state(f.draftId)).row.status, 'DRAFT');
    await ownerPage.goto(`${base}/dealer`, { waitUntil: 'domcontentloaded' });
    await ownerPage.getByRole('heading').first().waitFor();
    await page.screenshot({
      path: `${dir}/before-uploaded-unverified-${f.width}.png`,
      fullPage: true,
    });
    for (let i = 3; i > 0; i--) {
      assert.equal(await page.getByRole('button', { name: 'Verify', exact: true }).count(), i);
      await page.getByRole('button', { name: 'Verify', exact: true }).first().click();
      await page
        .getByRole('button', { name: 'Verify', exact: true })
        .last()
        .waitFor({ state: i === 1 ? 'detached' : 'visible' });
      await page.waitForFunction(
        (expected) =>
          Array.from(document.querySelectorAll('button')).filter(
            (b) => b.textContent.trim() === 'Verify',
          ).length === expected,
        i - 1,
      );
    }
    await page.locator('#approvalConfirm').fill(`approve ${f.brandName.toLowerCase()}`);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('button')).some(
        (b) => b.textContent.trim() === 'Approve dealer' && !b.disabled,
      ),
    );
    assert.equal(
      await page.getByRole('button', { name: 'Approve dealer', exact: true }).isEnabled(),
      true,
    );
    await page.getByRole('button', { name: 'Approve dealer', exact: true }).click();
    await page.getByText('Dealer approved.', { exact: true }).waitFor();
    await page
      .getByRole('button', { name: 'Approve dealer', exact: true })
      .waitFor({ state: 'detached' });
    await page.screenshot({ path: `${dir}/after-approved-${f.width}.png`, fullPage: true });
    const stored = await state(f.id);
    assert.equal(stored.row.status, 'ACTIVE');
    assert.ok(stored.row.approvedAt);
    assert.equal(stored.audit.length, 1);
    assert.equal(stored.audit[0].actorId, f.adminUserId);
    assert.equal(stored.audit[0].before.status, 'PENDING_APPROVAL');
    assert.equal(stored.audit[0].after.status, 'ACTIVE');
    assert.equal(stored.events, 1);
    assert.equal(stored.docs.length, 3);
    assert.ok(
      stored.docs.every(
        (d) => d.status === 'VERIFIED' && d.reviewedBy === f.adminUserId && d.reviewedAt,
      ),
    );
    assert.equal(
      (await admin.request.post(`${api}/v1/admin/dealers/${f.id}/approve`, { data: {} })).status(),
      422,
    );
    await ownerPage.reload({ waitUntil: 'domcontentloaded' });
    const session = await owner.request.get(`${api}/v1/auth/me`);
    assert.equal(session.status(), 200);
    assert.equal((await session.json()).dealer.status, 'ACTIVE');
    const publicPage = await browser.newPage({ viewport: { width: f.width, height: 900 } });
    const response = await publicPage.goto(`${base}/dealers/${f.slug}`, {
      waitUntil: 'domcontentloaded',
    });
    assert.equal(response.status(), 200);
    await publicPage.getByRole('heading', { name: f.brandName, exact: true }).waitFor();
    await publicPage.screenshot({
      path: `${dir}/after-public-profile-${f.width}.png`,
      fullPage: true,
    });
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    results.push({
      scenario: 'uploaded→verified→approved; draft denial; replay; owner refresh; public profile',
      viewport: f.width,
      result: 'PASS',
      api: { draftApproval: 422, publicBefore: 404, publicAfter: 200, replay: 422 },
      database: {
        status: 'ACTIVE',
        verifiedDocuments: 3,
        approvalAudits: 1,
        approvalEvents: 1,
        actorMatches: true,
        approvalTimestamp: true,
      },
      layout,
      layoutResult:
        layout.scrollWidth <= layout.viewport ? 'PASS' : 'FAIL — tracked separately as BUG-008',
    });
    await admin.close();
    await owner.close();
    await publicPage.close();
  }
  const f = fixture.stale,
    c = await context(f.adminToken, 1440),
    page = await c.newPage();
  await page.goto(`${base}/admin/dealers/${f.id}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: f.brandName, exact: true }).waitFor();
  await page.locator('#approvalConfirm').fill(`approve ${f.brandName.toLowerCase()}`);
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('button')).some(
      (b) => b.textContent.trim() === 'Approve dealer' && !b.disabled,
    ),
  );
  assert.equal(
    await page.getByRole('button', { name: 'Approve dealer', exact: true }).isEnabled(),
    true,
  );
  assert.equal(
    (
      await c.request.post(`${api}/v1/admin/documents/${f.documentId}/reject`, {
        data: { reason: 'Please upload a legible replacement' },
      })
    ).status(),
    200,
  );
  await page.getByRole('button', { name: 'Approve dealer', exact: true }).click();
  await page.getByText('Only a submitted application can be approved.', { exact: true }).waitFor();
  const rejected = await state(f.id);
  assert.equal(rejected.row.status, 'DRAFT');
  assert.equal(rejected.audit.length, 0);
  assert.equal(rejected.events, 0);
  await page.screenshot({ path: `${dir}/after-stale-admin-denied.png`, fullPage: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.getByRole('button', { name: 'Approve dealer', exact: true }).count(), 0);
  results.push({
    scenario: 'existing ready Admin tab after document rejection',
    result: 'PASS',
    api: { documentRejection: 200, staleApproval: 422 },
    database: { status: 'DRAFT', approvalAudits: 0, approvalEvents: 0 },
  });
  await c.close();
} catch (error) {
  results.push({ result: 'BLOCKED', error: String(error) });
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    `${dir}/browser.json`,
    JSON.stringify(
      {
        environment:
          'Chromium / production Next build / real cookie resolver / local PostgreSQL / fake external identity providers',
        baseSha: process.env.TESTED_SHA ?? 'uncommitted changes on 1f38a13',
        results,
        humanUat: 'PENDING',
      },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
  await db.end();
  console.log(JSON.stringify(results));
}
