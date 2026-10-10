import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const require = createRequire(new URL('../../../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const fixture = JSON.parse(await fs.readFile('/tmp/dd-bug003-browser-private.json', 'utf8'));
const base = process.env.WEB_BASE_URL ?? 'http://localhost:3009';
const database = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(database.pathname, '/dealersdrive_cert');
const mode = process.env.BUG003_MODE ?? 'fixed';
assert.ok(['baseline', 'fixed'].includes(mode));
const dir = fileURLToPath(new URL('.', import.meta.url));
const db = new Client({ connectionString: database.toString() });
await db.connect();
const saved = await db.query(
  'SELECT l.slug FROM saved_vehicles s JOIN listings l ON l.id=s."listingId" WHERE s."customerId"=$1 ORDER BY s."createdAt" DESC,s.id DESC',
  [fixture.customerId],
);
const enquiries = await db.query(
  'SELECT message FROM enquiries WHERE "customerId"=$1 AND "dealerId"=$2 ORDER BY "createdAt" DESC,id DESC',
  [fixture.customerId, fixture.dealerId],
);
assert.equal(saved.rowCount, 51);
assert.equal(enquiries.rowCount, 51);
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const results = [];
async function keysOnPage(page, collection) {
  return collection === 'saved'
    ? page
        .locator('main article h3 a[href^="/car/"]')
        .evaluateAll((links) => links.map((a) => a.getAttribute('href').split('/').at(-1)))
    : page
        .locator(
          collection === 'customer'
            ? 'ul[aria-label="Your enquiries"] > li'
            : 'ul[aria-label="Enquiries"] > li',
        )
        .evaluateAll((rows) =>
          rows.map((row) => row.textContent.match(/Pagination fixture \d+/)?.[0]),
        );
}
try {
  for (const width of mode === 'baseline' ? [1440] : [1440, 768, 390]) {
    for (const collection of ['saved', 'customer', 'inbox']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addCookies([
        {
          name: 'dd_session',
          value: collection === 'inbox' ? fixture.ownerToken : fixture.customerToken,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      const route =
        collection === 'saved'
          ? '/saved'
          : collection === 'customer'
            ? '/enquiries'
            : '/dealer/enquiries';
      const title =
        collection === 'saved'
          ? 'Saved cars'
          : collection === 'customer'
            ? 'My enquiries'
            : 'Enquiries';
      const expected =
        collection === 'saved'
          ? saved.rows.map((r) => r.slug)
          : enquiries.rows.map((r) => r.message);
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      const visited = [],
        counts = [],
        layouts = [],
        pageKeys = [],
        pageUrls = [];
      for (let n = 0; n < 5; n += 1) {
        const entries = await keysOnPage(page, collection);
        assert.ok(entries.every((entry) => typeof entry === 'string'));
        if (collection === 'saved' && entries.length > 0) {
          await page.waitForFunction(() =>
            [...document.querySelectorAll('main article img')]
              .filter((img) => {
                const rect = img.getBoundingClientRect();
                return rect.top < innerHeight && rect.bottom > 0;
              })
              .every((img) => img.complete && img.naturalWidth > 0),
          );
        }
        visited.push(...entries);
        counts.push(entries.length);
        pageKeys.push(entries);
        pageUrls.push(page.url());
        layouts.push(
          await page.evaluate(() => ({
            viewport: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          })),
        );
        await page.screenshot({ path: `${dir}/${mode}-${collection}-${width}-page${n + 1}.png` });
        const more = page.getByRole('link', { name: 'Show more', exact: true });
        if ((await more.count()) === 0) break;
        const href = await more.getAttribute('href');
        assert.ok(href?.includes('cursor='));
        await more.click();
        await page.waitForURL(base + href);
        await page.waitForLoadState('networkidle');
      }
      const complete =
        JSON.stringify(visited) === JSON.stringify(expected) && new Set(visited).size === 51;
      if (mode === 'fixed') {
        const finalUrl = page.url();
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(page.url(), finalUrl);
        assert.deepEqual(await keysOnPage(page, collection), pageKeys.at(-1));
        await page.goBack({ waitUntil: 'networkidle' });
        await page.waitForURL(pageUrls.at(-2));
        await page.waitForFunction(
          ({ kind, expectedKeys }) => {
            const keys =
              kind === 'saved'
                ? [...document.querySelectorAll('main article h3 a[href^="/car/"]')].map((a) =>
                    a.getAttribute('href').split('/').at(-1),
                  )
                : [
                    ...document.querySelectorAll(
                      kind === 'customer'
                        ? 'ul[aria-label="Your enquiries"] > li'
                        : 'ul[aria-label="Enquiries"] > li',
                    ),
                  ].map((row) => row.textContent.match(/Pagination fixture \d+/)?.[0]);
            return JSON.stringify(keys) === JSON.stringify(expectedKeys);
          },
          { kind: collection, expectedKeys: pageKeys.at(-2) },
        );
        assert.deepEqual(await keysOnPage(page, collection), pageKeys.at(-2));
      }
      results.push({
        collection,
        width,
        expectedRows: 51,
        visitedRows: visited.length,
        pages: counts,
        orderAndUniqueness: complete ? 'PASS' : 'FAIL',
        layouts,
        refresh: mode === 'fixed' ? 'PASS' : 'NOT_RUN',
        browserBack: mode === 'fixed' ? 'PASS' : 'NOT_RUN',
      });
      if (mode === 'baseline') {
        assert.equal(complete, false);
        assert.equal(counts.at(-1), 0);
      } else {
        assert.deepEqual(visited, expected);
        assert.equal(new Set(visited).size, 51);
        assert.ok(counts.at(-1) > 0);
      }
      await context.close();
    }
  }
  const report = {
    mode,
    testedSha: process.env.TESTED_SHA ?? null,
    result: mode === 'baseline' ? 'FAIL reproduced' : 'PASS',
    environment: 'built Next.js / Chromium / real cookies and API / PostgreSQL / inert fixtures',
    results,
    humanUat: 'PENDING',
  };
  await fs.writeFile(`${dir}/browser-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await db.end();
}
