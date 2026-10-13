import { chromium } from 'playwright-core';
const BASE = 'http://localhost:3000',
  PROXY = 'http://localhost:4001/__latency';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await b.newContext();
const p = await ctx.newPage();
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
await p.goto(`${BASE}/dealer`);
await p.waitForTimeout(3000);
await fetch(PROXY, { method: 'DELETE' });
for (const label of ['Enquiries', 'Inventory', 'Dealer profile']) {
  const ev = [];
  let t0 = 0;
  const onReq = (r) => {
    if (r.headers()['rsc']) ev.push(['req-start', Date.now() - t0]);
  };
  const onResp = (r) => {
    if (r.request().headers()['rsc']) ev.push(['resp-headers', Date.now() - t0]);
  };
  const onFin = (r) => {
    if (r.headers()['rsc']) ev.push(['req-end', Date.now() - t0]);
  };
  p.on('request', onReq);
  p.on('response', onResp);
  p.on('requestfinished', onFin);
  t0 = Date.now();
  await p.locator('aside nav a', { hasText: label }).click();
  let sk = null,
    ct = null;
  while (Date.now() - t0 < 3000 && ct === null) {
    const st = await p.evaluate(() => ({
      sk: !!document.querySelector('main [data-loading]'),
      h: document.querySelector('main h1')?.textContent,
    }));
    const n = Date.now() - t0;
    if (sk === null && st.sk) sk = n;
    if (sk !== null && !st.sk) ct = n;
    await p.waitForTimeout(5);
  }
  console.log(label, JSON.stringify(ev), 'skeleton', sk, 'content', ct);
  p.off('request', onReq);
  p.off('response', onResp);
  p.off('requestfinished', onFin);
  await p.waitForTimeout(800);
}
const log = (await (await fetch(PROXY)).json()).log;
console.log('API', log.map((x) => `${x.method} ${x.url} ${x.ms}`).join('\n'));
await b.close();
