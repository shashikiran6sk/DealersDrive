import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, S] = process.argv.slice(2);
const b = await chromium.launch();
const res = {};
for (const w of [320, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Open Main menu' }).click();
  const d = p.getByRole('dialog');
  await d.waitFor();
  res[`public-${w}`] = {
    accessibleName: await d
      .getAttribute('aria-labelledby')
      .then(async (id) => (id ? await p.locator(`#${id}`).textContent() : null)),
    visibleMainHeading: await d
      .locator('h1,h2,h3')
      .filter({ hasText: /^Main$/ })
      .evaluateAll(
        (els) =>
          els.filter((e) => e.offsetParent !== null && !e.classList.contains('sr-only')).length,
      ),
    links: await d.getByRole('link').allInnerTexts(),
    adminLinks: await d.getByRole('link', { name: /admin/i }).count(),
    closeButton: await d.getByRole('button', { name: /close/i }).count(),
  };
  await p.screenshot({ path: `${out}/public-drawer-${w}.png` });
  await d.getByRole('button', { name: /close/i }).first().click();
  res[`public-${w}`].closed = (await p.getByRole('dialog').count()) === 0;
  await p.close();
}
const p = await b.newPage({ viewport: { width: 390, height: 800 } });
await p.goto('http://localhost:3000/login?as=dealer', { waitUntil: 'networkidle' });
res.dealerTabAdminLogin = await p.getByRole('link', { name: 'Admin Login' }).count();
const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
await ctx.addCookies([
  {
    name: 'dd_admin_session',
    value: readFileSync(`${S}/tok-super-admin`, 'utf8').trim(),
    domain: 'localhost',
    path: '/',
  },
]);
const a = await ctx.newPage();
await a.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
const trig = a.getByRole('button', { name: /open .*menu/i }).first();
if (await trig.count()) {
  await trig.click();
  const ad = a.getByRole('dialog');
  await ad.waitFor();
  res.adminDrawerLinks = (await ad.getByRole('link').allInnerTexts()).length;
  await a.screenshot({ path: `${out}/admin-drawer-390.png` });
}
console.log(JSON.stringify(res, null, 1));
await b.close();
