// PR #238 retest: Admin routes must not overflow horizontally at phone widths.
// Uses an inert operator (cert-admin@example.test) so no real address appears in screenshots.
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from '/tmp/claude-0/-home-user-DealersDrive/848a9c63-ad81-5cc0-b3a9-85ca40f2be4d/scratchpad/pw/node_modules/playwright/index.mjs';
import * as h from './lib.mjs';
const r = h.recorder(process.env.B238_AREA ?? 'retest-238-admin-mobile');
const WEB = process.env.CERT_WEB ?? 'http://localhost:3000';
const OUT = process.env.B238_OUT;
mkdirSync(OUT, { recursive: true });
const EMAIL = 'cert-admin@example.test';
let u = (await h.q(`SELECT id FROM users WHERE email=$1`, [EMAIL]))[0];
if (!u) {
  u = { id: randomUUID() };
  await h.q(
    `INSERT INTO users (id, "fullName", email, status, "isPlatformAdmin", "adminRole", "emailVerifiedAt", "createdAt") VALUES ($1,'Cert Operator',$2,'ACTIVE',true,'SUPER_ADMIN',now(),now())`,
    [u.id, EMAIL],
  );
  await h.q(`INSERT INTO user_roles (id, "userId", role, status) VALUES ($1,$2,'ADMIN','ACTIVE')`, [
    randomUUID(),
    u.id,
  ]);
}
const cookie = (await h.mintSession(u.id, 'ADMIN')).split('=')[1];
const dealer = await h.one(
  `SELECT id FROM dealers WHERE status='ACTIVE' ORDER BY "createdAt" DESC LIMIT 1`,
);
const listing = await h.one(
  `SELECT id FROM listings WHERE status='PENDING_REVIEW' ORDER BY "updatedAt" DESC LIMIT 1`,
);
const routes = [
  '/admin',
  '/admin/dealers',
  `/admin/dealers/${dealer.id}`,
  '/admin/listings',
  `/admin/listings/${listing.id}`,
  '/admin/enquiries',
  '/admin/support',
  '/admin/config',
];
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const results = [];
for (const width of [320, 390, 768, 1024, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
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
  const page = await ctx.newPage();
  for (const route of routes) {
    const resp = await page.goto(WEB + route, { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      signOut: !!Array.from(document.querySelectorAll('button')).find((b) =>
        /sign out/i.test(b.textContent),
      ),
      h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    }));
    const ok = resp.status() === 200 && m.sw <= m.cw && m.signOut;
    results.push({
      route: route.replace(/[0-9a-f-]{36}/, ':id'),
      width,
      status: resp.status(),
      ...m,
      ok,
    });
    if (width <= 390 || width === 1440)
      await page.screenshot({
        path: `${OUT}/${route.replace(/\//g, '_').replace(/[0-9a-f-]{36}/, 'id')}-${width}.png`,
        fullPage: false,
      });
  }
  await ctx.close();
}
await browser.close();
r.ev({ results });
await h.check(r, 'R238-admin-no-horizontal-overflow', async () => {
  const bad = results.filter((x) => !x.ok);
  return bad.length === 0
    ? {
        layers: ['BROWSER'],
        note: `${results.length} route×width cases (8 Admin routes × 320/390/768/1024/1440): HTTP 200, scrollWidth ≤ clientWidth, Sign out visible`,
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER'],
        note: `${bad.length}/${results.length} overflow or fail: ${JSON.stringify(bad.map((b) => `${b.route}@${b.width}:${b.status}:${b.sw}/${b.cw}`))}`,
      };
});
r.save();
process.exit(0);
