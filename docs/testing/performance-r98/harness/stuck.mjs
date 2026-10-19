import { chromium } from 'playwright-core';
const BASE = 'http://localhost:3000';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await b.newContext();
const p = await ctx.newPage();
const t0 = Date.now();
const ts = () => String(Date.now() - t0).padStart(6);
p.on('console', (m) => console.log(ts(), 'console', m.type(), m.text().slice(0, 200)));
p.on('pageerror', (e) => console.log(ts(), 'pageerror', e.message.slice(0, 300)));
p.on('request', (r) => {
  const h = r.headers();
  if (h['rsc'] || h['next-action'] || r.url().includes('/api/'))
    console.log(
      ts(),
      'req',
      r.method(),
      r.url().replace(BASE, '').slice(0, 80),
      h['next-action'] ? 'ACTION' : '',
      h['next-router-prefetch'] ? 'PREFETCH' : '',
    );
});
p.on('requestfinished', (r) => {
  const h = r.headers();
  if (h['rsc'] || h['next-action'] || r.url().includes('/api/'))
    console.log(ts(), 'done', r.method(), r.url().replace(BASE, '').slice(0, 80));
});
p.on('requestfailed', (r) =>
  console.log(ts(), 'FAILED', r.url().replace(BASE, '').slice(0, 80), r.failure()?.errorText),
);
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
await p.goto(`${BASE}/cars`);
await p.waitForTimeout(2500);
console.log(ts(), '=== LOGOUT');
await p.locator('header button[aria-haspopup="menu"]').click();
await p.getByRole('menuitem', { name: 'Logout' }).click();
await p.locator('header a', { hasText: 'Login' }).first().waitFor();
console.log(ts(), '=== logged out; url', p.url());
await p.waitForTimeout(1500);
console.log(ts(), '=== CLICK Dealers');
await p.locator('header nav a', { hasText: 'Dealers' }).first().click();
for (let i = 0; i < 20; i++) {
  await p.waitForTimeout(500);
  if (new URL(p.url()).pathname === '/dealers') {
    console.log(ts(), '=== navigated');
    break;
  }
}
console.log(ts(), 'final', p.url());
await b.close();
