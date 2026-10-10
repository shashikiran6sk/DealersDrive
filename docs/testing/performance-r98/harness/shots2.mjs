import { chromium } from 'playwright-core';
const BASE = 'http://localhost:3000',
  PROXY = 'http://localhost:4001/__latency';
const proxy = (s) => fetch(PROXY, { method: 'POST', body: JSON.stringify(s) });
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await b.newContext({ viewport: { width: 1280, height: 760 } });
const p = await ctx.newPage();
await proxy({ baseMs: 100, rules: [] });
await p.goto(`${BASE}/cars?page=3`);
await p.waitForTimeout(3000);
await proxy({ baseMs: 2500, rules: [] });
const card = p.locator('article h3 a[href^="/car/"]').nth(2);
await card.scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await card.click();
await p.waitForTimeout(90);
await p.screenshot({ path: 'shot-car-card-pending.png' });
await p.waitForTimeout(700);
await p.screenshot({ path: 'shot-car-skeleton.png' });
await p.waitForTimeout(6000);
await p.screenshot({ path: 'shot-car-loaded.png' });
// mobile console tab bar pending
await proxy({ baseMs: 100, rules: [] });
const m = await b.newContext({
  viewport: { width: 390, height: 800 },
  isMobile: true,
  storageState: await ctx.storageState(),
});
const mp = await m.newPage();
await mp.goto(`${BASE}/login`);
await mp.locator('#customer-phone').fill('9840012345');
await mp.getByRole('button', { name: 'Send OTP' }).first().click();
await mp.locator('#otp').click();
await mp.keyboard.type('123456');
await mp
  .getByRole('button', { name: /Verify and sign in/ })
  .first()
  .click();
await mp.waitForURL((u) => !u.pathname.startsWith('/login'));
await mp.goto(`${BASE}/dealer`);
await mp.waitForTimeout(2500);
await proxy({ baseMs: 2500, rules: [] });
await mp.locator('nav.fixed a', { hasText: 'Leads' }).click();
await mp.waitForTimeout(400);
await mp.screenshot({ path: 'shot-mobile-console-pending.png' });
await proxy({ baseMs: 150, rules: [] });
await b.close();
