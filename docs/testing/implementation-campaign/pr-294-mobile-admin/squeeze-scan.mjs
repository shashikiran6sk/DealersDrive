import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [S] = process.argv.slice(2);
const b = await chromium.launch();
const res = {};
const ctx = await b.newContext();
await ctx.addCookies([
  {
    name: 'dd_admin_session',
    value: readFileSync(`${S}/tok-google-super`, 'utf8').trim(),
    domain: 'localhost',
    path: '/',
  },
]);
const pages = [
  '/admin',
  '/admin/dealers',
  '/admin/listings',
  '/admin/support',
  '/admin/enquiries',
  '/admin/config',
  '/admin/members',
  '/admin/notifications',
  '/admin/profile/security',
];
for (const w of [320, 360, 390]) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: 800 });
  for (const path of pages) {
    await p.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' });
    const squeezed = await p.evaluate(() =>
      [
        ...document.querySelectorAll(
          'main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main select, main textarea',
        ),
      ]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.width < 80 && getComputedStyle(el).visibility !== 'hidden';
        })
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}[name=${el.getAttribute('name')}] ${Math.round(el.getBoundingClientRect().width)}px`,
        ),
    );
    if (squeezed.length) res[`${w}${path}`] = squeezed;
  }
  await p.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
