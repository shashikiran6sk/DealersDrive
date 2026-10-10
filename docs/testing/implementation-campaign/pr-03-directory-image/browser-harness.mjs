import { chromium } from '/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const stage = process.argv[2] ?? 'pre-pr';
const out = `/tmp/dd-campaign-evidence/docs/testing/implementation-campaign/pr-03-directory-image/${stage}`;
await mkdir(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const results = [];
const assetPath = '/brand/dealer-directory-cover.svg';
for (const width of [320, 390, 768, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const response = await page.goto('http://127.0.0.1:3001/dealers', { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  const covers = page.getByRole('img', { name: /Standard conceptual dealership illustration/ });
  assert((await covers.count()) > 0);
  const paths = await covers.evaluateAll((elements) =>
    elements.map((el) => new URL(el.src).pathname),
  );
  assert(paths.every((path) => path === assetPath));
  const asset = await context.request.get(`http://127.0.0.1:3001${assetPath}`);
  assert.equal(asset.status(), 200);
  assert(asset.headers()['content-type'].includes('image/svg+xml'));
  assert.equal(await page.getByText('YARD VERIFIED', { exact: true }).count(), 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
  await page.screenshot({
    path: `${out}/directory-${width}.png`,
    fullPage: true,
    mask: [page.getByText(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)],
  });
  results.push({
    width,
    cards: paths.length,
    identicalAsset: true,
    assetStatus: asset.status(),
    overflow,
    yardClaimAbsent: true,
  });
  if (width === 1280) {
    const cardLink = page.locator('a[href^="/dealers/"]').first();
    const target = await cardLink.getAttribute('href');
    await cardLink.click();
    await page.waitForURL(`**${target}`);
    assert.equal(new URL(page.url()).pathname, target);
    await page.screenshot({
      path: `${out}/dealer-detail.png`,
      fullPage: true,
      mask: [
        page.getByText(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/),
        page.getByText(/\+91[0-9 -]{10,}/),
      ],
    });
  }
  await context.close();
}
const context = await browser.newContext();
const api = await context.request.get('http://127.0.0.1:4001/v1/dealers?limit=24');
assert.equal(api.status(), 200);
const data = await api.json();
assert(data.data.length > 0);
assert(data.data.every((d) => new URL(d.coverUrl).pathname === assetPath));
assert(!JSON.stringify(data).includes('primaryOwnerEmail'));
await writeFile(
  `${out}/browser-results.json`,
  JSON.stringify(
    {
      stage,
      browser: browser.version(),
      results,
      api: {
        status: api.status(),
        cards: data.data.length,
        identicalAsset: true,
        privateIdentityNotExposed: true,
      },
      note: 'Actual branch application; local synthetic fixtures. Existing yard-media authorization/gallery regressions run in automated suites; current model has one yard cover, not a multi-photo yard gallery.',
    },
    null,
    2,
  ),
);
await context.close();
await browser.close();
console.log(
  'Shared directory image, responsive geometry, card navigation and safe public API passed.',
);
