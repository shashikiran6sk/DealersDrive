import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const require = createRequire(new URL('../../../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const privateFixture = JSON.parse(await fs.readFile('/tmp/dd-bug004-browser-private.json', 'utf8'));
const mode = process.env.BUG004_MODE ?? 'fixed';
assert.ok(['baseline', 'fixed'].includes(mode));
const base = process.env.WEB_BASE_URL ?? 'http://localhost:3009';
const api = process.env.API_BASE_URL ?? 'http://localhost:4014';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(api).hostname));
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
const dir = fileURLToPath(new URL('.', import.meta.url));
const db = new Client({ connectionString: database.toString() });
await db.connect();
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const results = [];
async function context(width, token) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  if (token)
    await ctx.addCookies([
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
  return ctx;
}
async function snapshot(f) {
  const dealer = await db.query(
    'SELECT status,"approvedAt","creditBalance" FROM dealers WHERE id=$1',
    [f.dealerId],
  );
  const listings = await db.query(
    'SELECT id,status,"publishedAt" FROM listings WHERE "dealerId"=$1 ORDER BY id',
    [f.dealerId],
  );
  const saved = await db.query(
    'SELECT id,"listingId","createdAt" FROM saved_vehicles WHERE "customerId"=$1 ORDER BY id',
    [f.customerId],
  );
  const enquiries = await db.query(
    'SELECT id,status,"listingId","createdAt" FROM enquiries WHERE "customerId"=$1 ORDER BY id',
    [f.customerId],
  );
  const members = await db.query(
    'SELECT id,status,role,"userId" FROM dealer_members WHERE "dealerId"=$1 ORDER BY id',
    [f.dealerId],
  );
  return {
    dealer: dealer.rows[0],
    listings: listings.rows,
    saved: saved.rows,
    enquiries: enquiries.rows,
    members: members.rows,
  };
}
try {
  for (const f of mode === 'baseline' ? privateFixture.cases.slice(0, 1) : privateFixture.cases) {
    const before = await snapshot(f);
    assert.equal(before.dealer.status, 'ACTIVE');
    const admin = await context(f.width, privateFixture.adminToken);
    const customer = await context(f.width, f.customerToken);
    const anon = await context(f.width);
    const adminPage = await admin.newPage();
    const carPage = await anon.newPage();
    const imagePage = await anon.newPage();
    const savedPage = await customer.newPage();
    const car = f.cars.find((c) => c.status === 'ACTIVE');
    assert.ok(car);
    const mediaUrl = `${api}/media/by-media/${car.mediaIds[0]}/640.webp`;
    await carPage.goto(`${base}/car/${car.slug}`, { waitUntil: 'networkidle' });
    await carPage.waitForFunction(() =>
      [...document.querySelectorAll('main img')].some(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    await carPage.screenshot({ path: `${dir}/${mode}-before-car-${f.width}.png`, fullPage: false });
    const firstImage = await imagePage.goto(mediaUrl, { waitUntil: 'networkidle' });
    assert.equal(firstImage.status(), 200);
    await imagePage.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0);
    await imagePage.screenshot({
      path: `${dir}/${mode}-before-image-${f.width}.png`,
      fullPage: false,
    });
    if (mode === 'fixed') assert.equal(firstImage.headers()['cache-control'], 'no-store');
    await savedPage.goto(`${base}/saved`, { waitUntil: 'networkidle' });
    await savedPage.getByRole('heading', { name: 'Saved cars', exact: true }).waitFor();
    await adminPage.goto(`${base}/admin/dealers/${f.dealerId}`, { waitUntil: 'networkidle' });
    await adminPage.locator('#suspendReason').fill('Isolated public media browser verification');
    await adminPage.getByRole('button', { name: 'Suspend', exact: true }).click();
    await adminPage.getByRole('button', { name: 'Reinstate dealer', exact: true }).waitFor();
    assert.equal((await snapshot(f)).dealer.status, 'SUSPENDED');
    const listing = await anon.request.get(`${api}/v1/vehicles/${car.slug}`);
    assert.equal(listing.status(), 404);
    const direct = await anon.request.get(mediaUrl);
    assert.equal(direct.status(), mode === 'fixed' ? 404 : 200);
    const refreshed = await imagePage.reload({ waitUntil: 'networkidle' });
    assert.equal(refreshed.status(), mode === 'fixed' ? 404 : 200);
    await imagePage.screenshot({
      path: `${dir}/${mode}-suspended-image-${f.width}.png`,
      fullPage: false,
    });
    const pageRefresh = await carPage.reload({ waitUntil: 'networkidle' });
    await carPage.screenshot({
      path: `${dir}/${mode}-suspended-car-${f.width}.png`,
      fullPage: false,
    });
    await savedPage.reload({ waitUntil: 'networkidle' });
    assert.equal(await savedPage.locator('main article').count(), 2);
    assert.equal(await savedPage.locator('main article img').count(), 0);
    await savedPage.screenshot({
      path: `${dir}/${mode}-suspended-saved-${f.width}.png`,
      fullPage: false,
    });
    const yard = await anon.request.get(`${api}/media/by-media/${f.yardMediaId}/640.webp`);
    const profile = await anon.request.get(`${api}/v1/dealers/${f.slug}`);
    assert.equal(profile.status(), 404);
    await adminPage.locator('#reinstateNote').fill('Isolated media reinstatement verification');
    await adminPage.getByRole('button', { name: 'Reinstate dealer', exact: true }).click();
    await adminPage.getByRole('button', { name: 'Suspend', exact: true }).waitFor();
    const recovered = await snapshot(f);
    assert.equal(recovered.dealer.status, 'ACTIVE');
    assert.equal(recovered.dealer.approvedAt.toISOString(), before.dealer.approvedAt.toISOString());
    assert.equal(recovered.dealer.creditBalance, before.dealer.creditBalance);
    for (const key of ['listings', 'saved', 'enquiries', 'members'])
      assert.deepEqual(recovered[key], before[key]);
    assert.equal((await anon.request.get(`${api}/v1/vehicles/${car.slug}`)).status(), 200);
    assert.equal((await imagePage.reload({ waitUntil: 'networkidle' })).status(), 200);
    await imagePage.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0);
    await imagePage.screenshot({
      path: `${dir}/${mode}-reinstated-image-${f.width}.png`,
      fullPage: false,
    });
    const trail = await db.query(
      'SELECT "actorId",action FROM audit_logs WHERE "entityId"=$1 AND action IN (\'dealer.suspended\',\'dealer.reinstated\') ORDER BY id DESC LIMIT 2',
      [f.dealerId],
    );
    assert.equal(trail.rowCount, 2);
    assert.ok(trail.rows.every((row) => row.actorId === privateFixture.adminUserId));
    results.push({
      width: f.width,
      result: mode === 'fixed' ? 'PASS' : 'FAIL reproduced',
      listingDuringSuspension: listing.status(),
      imageDuringSuspension: direct.status(),
      sameTabImageRefresh: refreshed.status(),
      imageCacheBefore: firstImage.headers()['cache-control'],
      reinstatedImage: 200,
      databaseRelationshipsPreserved: 'PASS',
      customerSavedHistory: 'PASS',
      adminAuditActor: 'PASS',
      publicCarPageRefreshDuringSuspension: pageRefresh.status(),
      adjacentYardImageDuringSuspension: yard.status(),
      adjacentPublicDealerDuringSuspension: profile.status(),
    });
    await admin.close();
    await customer.close();
    await anon.close();
  }
  const report = {
    mode,
    testedSha: process.env.TESTED_SHA,
    result: mode === 'fixed' ? 'PASS' : 'FAIL reproduced',
    results,
    humanUat: 'PENDING',
    scope:
      'Vehicle media authorization and browser refresh; adjacent page-cache/yard observations retained separately',
  };
  await fs.writeFile(`${dir}/browser-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await db.end();
}
