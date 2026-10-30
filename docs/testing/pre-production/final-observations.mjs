import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { chromium } from '/opt/codex/runtimes/cua/lib/node_modules/playwright-core/index.mjs';
const root = new URL('./', import.meta.url);
const fixture = JSON.parse(await fs.readFile('/tmp/dd-cert-browser-private.json', 'utf8'));
const golden = JSON.parse(await fs.readFile('/tmp/dd-cert-golden-private.json', 'utf8'));
const sha = 'd6ae115359c4d0ae7ab0fd5115336291666cbb08';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addCookies([
  {
    name: 'dd_session',
    value: fixture.adminCookie,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  },
]);
const page = await context.newPage();
page.setDefaultTimeout(10000);
const rows = [];
try {
  await page.goto('http://localhost:3000/admin/enquiries');
  await page.getByPlaceholder('Customer, mobile, dealer, car or plate').fill('TN22QA8196');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForURL('**q=TN22QA8196**');
  await page.locator('a[href^="/admin/enquiries/"]').first().click();
  await page.getByText('Mobile golden journey lead.', { exact: true }).waitFor();
  const text = await page.locator('body').innerText();
  const foundActors = ['Certification Staff', 'Certification Manager'].filter((actor) =>
    text.includes(actor),
  );
  await page.screenshot({
    path: new URL('evidence/admin/golden-enquiry-history.png', root).pathname,
    fullPage: true,
  });
  rows.push({
    id: 'ADMIN-BROWSER-history',
    status: foundActors.length === 2 ? 'PASS' : 'FAIL',
    observed: { foundActors, screenshot: 'evidence/admin/golden-enquiry-history.png' },
    sha,
  });
} catch (error) {
  rows.push({ id: 'ADMIN-BROWSER-history', status: 'BLOCKED', reason: error.message, sha });
}
await page.goto('http://localhost:3000/admin/enquiries');
await page.getByRole('heading', { name: 'Enquiries', exact: true }).waitFor();
const widths = await page.evaluate(() => ({
  width: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
}));
rows.push({
  id: 'UI-DISC-002',
  canonical: ['BROWSER-009'],
  status: widths.scrollWidth > widths.width ? 'FAIL' : 'PASS',
  observed: widths,
  sha,
});
await context.close();
await browser.close();
await fs.writeFile(
  new URL('evidence/admin/final-browser.json', root),
  JSON.stringify(rows, null, 2) + '\n',
);

const samples = [];
for (const path of [
  '/',
  '/cars',
  `/car/${golden.car.slug}`,
  '/dealers',
  '/robots.txt',
  '/sitemap.xml',
]) {
  const timings = [];
  let status;
  let html;
  for (let i = 0; i < 6; i++) {
    const start = performance.now();
    const response = await fetch(`http://localhost:3000${path}`);
    status = response.status;
    html = await response.text();
    timings.push(performance.now() - start);
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const observation = {
    path,
    http: status,
    samples: timings.map((n) => Math.round(n * 100) / 100),
    median_ms: Math.round(sorted[3]),
    max_ms: Math.round(sorted.at(-1)),
    bytes: Buffer.byteLength(html),
  };
  if (!path.endsWith('.txt') && !path.endsWith('.xml'))
    Object.assign(observation, {
      title: html.match(/<title>(.*?)<\/title>/)?.[1],
      hasDescription: /name="description"/.test(html),
      canonical: html.match(/rel="canonical" href="([^"]*)"/)?.[1],
      jsonLdBlocks: (html.match(/application\/ld\+json/g) || []).length,
    });
  else
    Object.assign(observation, {
      containsLoopbackOrigin: /localhost|127\.0\.0\.1/.test(html),
      content: html.slice(0, 5000),
    });
  samples.push(observation);
}
await fs.writeFile(
  new URL('evidence/public/local-http-observations.json', root),
  JSON.stringify(
    {
      sha,
      scope: 'Single-process loopback synthetic smoke; not a load test or production SLA',
      samples,
    },
    null,
    2,
  ) + '\n',
);
const pg = createRequire(new URL('../../../apps/api/package.json', import.meta.url))('pg');
const client = new pg.Client({
  connectionString: 'postgresql://dealersdrive@localhost:5432/dealersdrive_cert',
});
await client.connect();
const snapshot = {
  sha,
  database: 'dealersdrive_cert',
  capturedAt: new Date().toISOString(),
  counts: {},
  statuses: {},
};
for (const table of [
  'users',
  'dealers',
  'dealer_members',
  'dealer_invitations',
  'vehicles',
  'listings',
  'enquiries',
  'saved_vehicles',
  'audit_logs',
])
  snapshot.counts[table] = (await client.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;
for (const table of ['dealers', 'dealer_members', 'listings', 'enquiries'])
  snapshot.statuses[table] = (
    await client.query(
      `SELECT status, count(*)::int n FROM ${table} GROUP BY status ORDER BY status`,
    )
  ).rows;
snapshot.unvalidatedForeignKeys = (
  await client.query(
    "SELECT count(*)::int n FROM pg_constraint WHERE contype='f' AND NOT convalidated",
  )
).rows[0].n;
snapshot.orphanEnquiries = (
  await client.query(
    'SELECT count(*)::int n FROM enquiries e LEFT JOIN users u ON e."customerId"=u.id LEFT JOIN listings l ON e."listingId"=l.id LEFT JOIN dealers d ON e."dealerId"=d.id WHERE u.id IS NULL OR l.id IS NULL OR d.id IS NULL',
  )
).rows[0].n;
snapshot.orphanListings = (
  await client.query(
    'SELECT count(*)::int n FROM listings l LEFT JOIN vehicles v ON l."vehicleId"=v.id LEFT JOIN dealers d ON l."dealerId"=d.id WHERE v.id IS NULL OR d.id IS NULL',
  )
).rows[0].n;
const enquiry = (
  await client.query(
    'SELECT status, "contactedAt" IS NOT NULL AS "hasContactTime", "closedAt" IS NOT NULL AS "hasCloseTime", "contactedById" IS NOT NULL AS "hasContactActor", "closedById" IS NOT NULL AS "hasCloseActor" FROM enquiries WHERE "listingId"=$1',
    [golden.car.listingId],
  )
).rows;
snapshot.mobileGoldenEnquiry = enquiry;
await client.end();
await fs.writeFile(
  new URL('evidence/concurrency/final-database-snapshot.json', root),
  JSON.stringify(snapshot, null, 2) + '\n',
);
console.log(
  'Recorded Admin browser history, widths, local HTTP samples and aggregate DB integrity.',
);
