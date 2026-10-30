import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, S] = process.argv.slice(2); const b = await chromium.launch(); const res = { login: {}, admin: {} };
for (const w of [320, 360, 390, 428, 768, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 860 } });
  await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  const customerAdmin = await p.getByRole('link', { name: /admin/i }).count();
  await p.screenshot({ path: `${out}/login-customer-${w}.png` });
  await p.getByRole('tab', { name: 'Dealer' }).click();
  const link = p.getByRole('link', { name: 'Admin Login' });
  const box = await link.boundingBox();
  const trouble = await p.getByRole('link', { name: /trouble signing in/i }).boundingBox();
  await p.screenshot({ path: `${out}/login-dealer-${w}.png` });
  const r = { customerTabAdminLinks: customerAdmin, dealerTabAdminLinks: await link.count(), belowSupport: !!(box && trouble && box.y > trouble.y), tapHeight: box?.height, overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
  if (w === 390) {
    await link.focus(); r.keyboardFocusable = await link.evaluate((el) => el === document.activeElement);
    await p.keyboard.press('Enter'); await p.waitForURL('**/admin/login'); r.navigatedTo = new URL(p.url()).pathname;
    await p.goBack(); await p.waitForLoadState('networkidle'); r.afterBack = new URL(p.url()).pathname + new URL(p.url()).search;
  }
  res.login[w] = r; await p.close();
}
const ctx = await b.newContext({ viewport: { width: 320, height: 800 } });
await ctx.addCookies([{ name: 'dd_admin_session', value: readFileSync(`${S}/tok-google-super`, 'utf8').trim(), domain: 'localhost', path: '/' }]);
for (const w of [320, 390]) {
  const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: 800 });
  for (const path of ['/admin', '/admin/dealers', '/admin/listings', '/admin/support', '/admin/enquiries', '/admin/config', '/admin/profile/security']) {
    const resp = await p.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' });
    res.admin[`${w}${path}`] = { status: resp?.status(), path: new URL(p.url()).pathname, overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
    if (w === 320) await p.screenshot({ path: `${out}/admin${path.replaceAll('/', '-')}-${w}.png` });
  }
  await p.close();
}
console.log(JSON.stringify(res, null, 1)); await b.close();
