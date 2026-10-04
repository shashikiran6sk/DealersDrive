import { chromium } from '/tmp/claude-0/-home-user-DealersDrive/848a9c63-ad81-5cc0-b3a9-85ca40f2be4d/scratchpad/pw/node_modules/playwright/index.mjs';
import * as h from '/home/user/wt-evidence/docs/testing/certification/harness/lib.mjs';
const u = await h.one(`SELECT id FROM users WHERE email='cert-admin@example.test'`);
const cookie = (await h.mintSession(u.id, 'ADMIN')).split('=')[1];
const dealer = await h.one(
  `SELECT id, "brandName" FROM dealers WHERE status='ACTIVE' ORDER BY "createdAt" DESC LIMIT 1`,
);
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await b.newContext({ viewport: { width: 320, height: 900 } });
await ctx.addCookies([
  {
    name: 'dd_session',
    value: cookie,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  },
]);
const p = await ctx.newPage();
await p.goto(`http://localhost:3000/admin/dealers/${dealer.id}`, { waitUntil: 'networkidle' });
const wide = await p.evaluate(() =>
  [...document.querySelectorAll('body *')]
    .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
    .map((e) => ({
      tag: e.tagName,
      cls: (e.className?.toString?.() ?? '').slice(0, 90),
      right: Math.round(e.getBoundingClientRect().right),
      w: Math.round(e.getBoundingClientRect().width),
      text: (e.textContent ?? '').trim().slice(0, 50),
    }))
    .slice(0, 12),
);
console.log(dealer.brandName);
console.log(JSON.stringify(wide, null, 1));
await b.close();
process.exit(0);
