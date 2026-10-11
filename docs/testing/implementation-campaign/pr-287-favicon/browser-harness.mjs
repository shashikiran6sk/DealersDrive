import { chromium } from 'playwright-core';
const out = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' in {} ? undefined : undefined });
const res = [];
for (const w of [320, 390, 768, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  const failed = [];
  p.on('response', r => { if (r.status() >= 400 && /\.(ico|png|woff2|css|js)/.test(r.url())) failed.push(r.status()+' '+r.url()); });
  await p.goto('http://localhost:3100/this-page-does-not-exist', { waitUntil: 'networkidle' });
  const fonts = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f=>f.status==='loaded').map(f => f.family + ' ' + f.weight); });
  const ff = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const icons = await p.evaluate(() => [...document.querySelectorAll('link[rel~=icon],link[rel=apple-touch-icon]')].map(l=>l.getAttribute('href')));
  await p.screenshot({ path: `${out}/notfound-${w}.png` });
  res.push({ width: w, loadedFonts: fonts, bodyFontFamily: ff, horizontalOverflow: overflow, icons, failedAssets: failed });
  await p.close();
}
const p = await b.newPage(); const r = await p.goto('http://localhost:3100/icon.png'); res.push({ iconPng: r.status(), type: r.headers()['content-type'] });
console.log(JSON.stringify(res, null, 1)); await b.close();
