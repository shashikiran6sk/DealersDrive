import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
const [out, S] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const B = 'http://localhost:3000';
const res = {};
const b = await chromium.launch();
for (const width of [390, 1280]) {
  const c = await b.newContext({ viewport: { width, height: 900 } });
  await c.addCookies([{ name: 'dd_session', value: readFileSync(`${S}/tok-l8-owner`, 'utf8').trim(), domain: 'localhost', path: '/' }]);
  const p = await c.newPage();
  await p.goto(`${B}/dealer`, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/l8-dashboard-${width}.png`, fullPage: true });
  const dash = await p.locator('main').innerText();
  res[`dashboard${width}`] = { banner: dash.includes('Upload your documents for review'), url: new URL(p.url()).pathname };
  await p.goto(`${B}/dealer/documents`, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/l8-documents-${width}.png`, fullPage: true });
  const text = await p.locator('main').innerText();
  res[`documents${width}`] = {
    url: new URL(p.url()).pathname,
    outstanding: /Personal Identity Proof/.test(text) && /Business Identity Proof/.test(text),
    withdrawn: /can have that activation withdrawn/.test(text),
    uploads: await p.getByRole('button', { name: /^Upload/ }).count(),
    overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
  };
  if (width === 1280) res.navHasDocuments = (await p.getByRole('link', { name: 'Documents' }).count()) > 0;
  await c.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
