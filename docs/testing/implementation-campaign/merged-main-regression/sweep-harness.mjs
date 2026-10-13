import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, S] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(`${S}/sweep-ids.env`, 'utf8').trim().split('\n').map((l) => l.split('=')));
const tok = (n) => readFileSync(`${S}/tok-${n}`, 'utf8').trim();
const WEB = 'http://localhost:3000';
const roles = {
  public: { cookie: null, routes: ['/', '/cars', `/car/${env.CAR}`, '/dealers', `/dealers/${env.DSLUG}`, '/contact', '/login', '/admin/login', '/dealer/login'] },
  customer: { cookie: ['dd_session', tok('customer')], routes: ['/enquiries', '/saved', '/support-requests', '/support-requests/new'] },
  owner: { cookie: ['dd_session', tok('owner')], routes: ['/dealer', '/dealer/inventory', '/dealer/enquiries', '/dealer/profile', '/dealer/team', '/dealer/vehicles/new'] },
  sales: { cookie: ['dd_admin_session', tok('arun')], routes: ['/sales', '/sales/dealers', '/sales/dealers/new'] },
  admin: { cookie: ['dd_admin_session', tok('super-admin')], routes: ['/admin', '/admin/dealers', `/admin/dealers/${env.DID}`, '/admin/listings', `/admin/listings/${env.LID}`, '/admin/enquiries', '/admin/support', `/admin/support/${env.TID}`, '/admin/members', `/admin/members/${env.MID}`, '/admin/config', '/admin/notifications', '/admin/profile/security'] },
};
const b = await chromium.launch();
const results = [];
for (const [role, spec] of Object.entries(roles)) {
  for (const width of [390, 1280]) {
    const ctx = await b.newContext({ viewport: { width, height: 900 } });
    if (spec.cookie) await ctx.addCookies([{ name: spec.cookie[0], value: spec.cookie[1], domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    for (const route of spec.routes) {
      const errors = [];
      const bad = [];
      const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); };
      const onPageError = (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`);
      const onResponse = (r) => { if (r.status() >= 500) bad.push(`${r.status()} ${r.url().replace(WEB, '')}`); };
      page.on('console', onConsole); page.on('pageerror', onPageError); page.on('response', onResponse);
      const resp = await page.goto(WEB + route, { waitUntil: 'networkidle' }).catch((e) => ({ status: () => `ERR ${e.message.slice(0, 80)}` }));
      const finalPath = new URL(page.url()).pathname;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth).catch(() => null);
      const h1 = await page.locator('h1').first().innerText().catch(() => null);
      if (width === 390) await page.screenshot({ path: `${out}/${role}${route.replace(/[^a-z0-9]+/gi, '_')}-390.png` });
      results.push({ role, width, route: route.replace(/[0-9a-f-]{36}/, ':id'), status: resp.status(), finalPath: finalPath === route ? '=' : finalPath, overflowPx: overflow, h1, errors, server5xx: bad });
      page.off('console', onConsole); page.off('pageerror', onPageError); page.off('response', onResponse);
    }
    await ctx.close();
  }
}
await b.close();
console.log(JSON.stringify(results));
