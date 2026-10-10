import { chromium } from 'playwright-core';
const BASE = 'http://localhost:3000',
  PROXY = 'http://localhost:4001/__latency';
const proxy = (s) => fetch(PROXY, { method: 'POST', body: JSON.stringify(s) });
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await b.newContext({ viewport: { width: 1280, height: 760 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 200));
});
await proxy({ baseMs: 100, rules: [] });
await p.goto(`${BASE}/login`);
await p.locator('#customer-phone').fill('9840012345');
await p.getByRole('button', { name: 'Send OTP' }).first().click();
await p.locator('#otp').click();
await p.keyboard.type('123456');
await p
  .getByRole('button', { name: /Verify and sign in/ })
  .first()
  .click();
await p.waitForURL((u) => !u.pathname.startsWith('/login'));
// 1 console: pending spinner + skeleton
await p.goto(`${BASE}/dealer`);
await p.waitForTimeout(2500);
await proxy({ baseMs: 1500, rules: [] });
await p.locator('aside nav a', { hasText: 'Inventory' }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: 'shot-console-pending.png' });
await p.waitForTimeout(3500);
await p.screenshot({ path: 'shot-console-loaded.png' });
// 2 home card click
await proxy({ baseMs: 100, rules: [] });
await p.goto(`${BASE}/`);
await p.waitForTimeout(2500);
await p
  .locator('#recently-added-heading, h2')
  .first()
  .scrollIntoViewIfNeeded()
  .catch(() => {});
await p.evaluate(() => window.scrollTo(0, 560));
await p.waitForTimeout(1500);
await proxy({ baseMs: 1500, rules: [] });
await p.locator('article h3 a[href^="/car/"]').first().click();
await p.waitForTimeout(400);
await p.screenshot({ path: 'shot-car-skeleton.png' });
await p.waitForTimeout(4500);
// 3 header placeholder on refresh, with slow account lookup
await proxy({ baseMs: 1500, rules: [] });
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/`, { waitUntil: 'commit' });
await p2.waitForTimeout(700);
await p2.screenshot({
  path: 'shot-header-placeholder.png',
  clip: { x: 0, y: 0, width: 1280, height: 90 },
});
await p2.waitForTimeout(6000);
await p2.screenshot({
  path: 'shot-header-avatar.png',
  clip: { x: 0, y: 0, width: 1280, height: 90 },
});
await proxy({ baseMs: 150, rules: [] });
console.log('console errors/warnings:', JSON.stringify(errors));
await b.close();
