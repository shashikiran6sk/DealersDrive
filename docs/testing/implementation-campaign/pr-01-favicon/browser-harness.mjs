import { chromium } from '/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const stage = process.argv[2];
const output = `/tmp/dd-campaign-evidence/docs/testing/implementation-campaign/pr-01-favicon/${stage}`;
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const masks = (page) => [
  page.getByText(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/),
  page.getByText(/\+91[0-9 -]{10,}/),
];
if (stage === 'before') {
  await context.route('**/icon.png*', async (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: await readFile('/tmp/dd-campaign-before-icon.png'),
    }),
  );
  await context.route('**/favicon.ico*', async (route) =>
    route.fulfill({
      contentType: 'image/x-icon',
      body: await readFile('/tmp/dd-campaign-before-favicon.ico'),
    }),
  );
}
const results = [];
for (const route of ['/', '/dealers', '/admin', '/admin/login', '/login', '/dealer/login']) {
  const page = await context.newPage();
  const response = await page.goto(`http://127.0.0.1:3001${route}`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, `${route} response`);
  const icons = await page
    .locator('link[rel="icon"]')
    .evaluateAll((links) => links.map((l) => l.href));
  assert(icons.some((url) => new URL(url).pathname === '/favicon.ico'));
  assert(icons.some((url) => new URL(url).pathname === '/icon.png'));
  const fetched = [];
  for (const url of icons) {
    const asset = await context.request.get(url);
    assert.equal(asset.status(), 200, `${route} icon ${url}`);
    fetched.push({
      path: new URL(url).pathname,
      status: asset.status(),
      cacheControl: asset.headers()['cache-control'],
    });
  }
  const name = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, mask: masks(page) });
  results.push({
    route,
    finalPath: new URL(page.url()).pathname,
    status: response.status(),
    icons: fetched,
  });
  await page.close();
}
const page = await context.newPage();
const file =
  stage === 'before'
    ? '/tmp/dd-campaign-before-favicon.ico'
    : '/Users/shashikiran/Development/dealers-drive/apps/web/src/app/favicon.ico';
const ico = await readFile(file);
const frames = [];
for (let i = 0; i < ico.readUInt16LE(4); i++) {
  const pos = 6 + i * 16;
  const width = ico[pos] || 256;
  const length = ico.readUInt32LE(pos + 8);
  const offset = ico.readUInt32LE(pos + 12);
  frames.push({
    width,
    src: `data:image/png;base64,${ico.subarray(offset, offset + length).toString('base64')}`,
  });
}
for (const theme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: theme });
  await page.setContent(
    `<html><body style="margin:0;padding:32px;background:${theme === 'light' ? '#f4f4f4' : '#242424'};color:${theme === 'light' ? '#111' : '#fff'};font:16px sans-serif"><h1>${stage} — actual ICO frames</h1><p>Native 16 / 32 / 48 pixel assets and magnified nearest-neighbor previews.</p>${frames.map((f) => `<div style="display:flex;gap:32px;align-items:center;margin:24px 0"><span>${f.width} × ${f.width}</span><img src="${f.src}" width="${f.width}" height="${f.width}"><img src="${f.src}" width="128" height="128" style="image-rendering:pixelated"></div>`).join('')}</body></html>`,
  );
  await page.screenshot({ path: `${output}/ico-frames-${theme}.png` });
}
await page.close();
await context.close();
const viewports = [];
for (const width of [320, 360, 390, 768, 1280]) {
  const hidpi = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: width === 390 ? 2 : 1,
  });
  const mobile = await hidpi.newPage();
  await mobile.goto('http://127.0.0.1:3001', { waitUntil: 'networkidle' });
  const font = await mobile.evaluate(async () => {
    await document.fonts.ready;
    const family = getComputedStyle(document.body).fontFamily;
    return {
      family,
      loaded: document.fonts.check(`400 16px ${family.split(',')[0]}`),
      requests: performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.endsWith('.woff2'))
        .map((entry) => new URL(entry.name).pathname),
    };
  });
  assert.equal(font.loaded, true);
  assert(font.family.toLowerCase().includes('manrope'));
  assert(font.requests.length > 0);
  assert((await mobile.locator('img[alt="Dealers Drive"]').count()) > 0);
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, `No document overflow at ${width}`);
  const logo = await mobile.locator('header img[alt="Dealers Drive"]').first().getAttribute('src');
  assert.equal(logo, '/brand/dealers-drive-dark.png');
  await mobile.screenshot({
    path: `${output}/home-${width}${width === 390 ? '-hidpi' : ''}.png`,
    fullPage: true,
    mask: masks(mobile),
  });
  viewports.push({ width, dpr: width === 390 ? 2 : 1, overflow, logo, font });
  await hidpi.close();
}
await writeFile(
  `${output}/browser-results.json`,
  JSON.stringify(
    {
      stage,
      engine: browser.version(),
      frames: frames.map((f) => f.width),
      routes: results,
      viewports,
      note: 'ICO previews display decoded implementation assets; page screenshots come from the local production build with email/phone text masked. Before-stage icon requests replay actual main assets. Headless screenshots do not capture browser tab chrome.',
    },
    null,
    2,
  ),
);
await browser.close();
console.log(
  `${stage}: six routes and their icon responses passed; light/dark frame previews and high-DPI mobile captured.`,
);
