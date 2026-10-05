import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const PROXY = 'http://localhost:4001/__latency';
const OUT = process.argv[2] ?? 'result.json';
const results = {};

async function proxy(state) {
  await fetch(PROXY, { method: 'POST', body: JSON.stringify(state) });
}
async function proxyLog(clear = false) {
  const r = await fetch(PROXY, { method: clear ? 'DELETE' : 'GET' });
  return (await r.json()).log;
}

function trackRequests(page) {
  const list = [];
  page.on('request', (req) => {
    const h = req.headers();
    list.push({
      t: Date.now(),
      method: req.method(),
      url: req.url().replace(BASE, ''),
      action: Boolean(h['next-action']),
      rsc: Boolean(h['rsc']),
      req,
    });
  });
  page.on('requestfinished', (req) => {
    const item = list.find((x) => x.req === req);
    if (item) item.ms = Date.now() - item.t;
  });
  return list;
}
const summarise = (list) =>
  list
    .filter(
      (x) =>
        x.action ||
        x.rsc ||
        x.url.startsWith('/api/') ||
        x.method !== 'GET' ||
        !/\.(js|css|png|jpg|webp|woff2|svg|ico)/.test(x.url),
    )
    .map(({ method, url, action, rsc, ms }) => ({
      method,
      url: url.slice(0, 90),
      action,
      rsc,
      ms,
    }));

async function signIn(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('#customer-phone').fill('9840012345');
  await page.getByRole('button', { name: 'Send OTP' }).first().click();
  await page.locator('#otp').click();
  await page.keyboard.type('123456');
  await page
    .getByRole('button', { name: /Verify and sign in/ })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await page.close();
  return context;
}

async function headerTimeline(page, path) {
  const samples = [];
  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: 'commit' });
  const end = t0 + 6000;
  while (Date.now() < end) {
    const s = await page
      .evaluate(() => {
        const header = document.querySelector('header');
        if (!header) return 'none';
        const visible = (el) =>
          Boolean(el) &&
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility !== 'hidden';
        if (visible(header.querySelector('button[aria-haspopup="menu"]'))) return 'avatar';
        if (
          [...header.querySelectorAll('a')].some(
            (a) => a.textContent.trim() === 'Login' && visible(a),
          )
        )
          return 'login';
        if (visible(header.querySelector('[data-auth-placeholder]'))) return 'placeholder';
        return 'empty';
      })
      .catch(() => 'nav');
    const last = samples.at(-1);
    if (!last || last.s !== s) samples.push({ s, at: Date.now() - t0 });
    await page.waitForTimeout(20);
  }
  return samples;
}

async function run() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  await proxy({ baseMs: 150, rules: [] });
  const context = await signIn(browser);

  // 1. full refresh of public pages while signed in: header timeline + post-hydration requests
  for (const path of ['/', '/cars', '/dealers']) {
    const page = await context.newPage();
    const reqs = trackRequests(page);
    const timeline = await headerTimeline(page, path);
    const vitals = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return {
        ttfb: Math.round(nav.responseStart),
        fcp: Math.round(fcp?.startTime ?? -1),
        load: Math.round(nav.loadEventEnd),
      };
    });
    results[`refresh ${path}`] = {
      timeline,
      loginFlashed: timeline.some((x) => x.s === 'login'),
      vitals,
      serverActions: reqs.filter((r) => r.action).map((r) => r.ms),
      requests: summarise(reqs),
    };
    await page.close();
  }

  // 2. dealer console tab switching: click → first feedback, URL change, content
  const page = await context.newPage();
  await page.goto(`${BASE}/dealer`);
  await page.waitForLoadState('networkidle');
  const tabs = [
    ['Inventory', '/dealer/inventory', 'h1'],
    ['Enquiries', '/dealer/enquiries', 'h1'],
    ['Dealer profile', '/dealer/profile', 'h1'],
    ['Team', '/dealer/team', 'h1'],
    ['Dashboard', '/dealer', 'h1'],
    ['Inventory', '/dealer/inventory', 'h1'],
  ];
  const nav = [];
  for (const [label, path] of tabs) {
    const reqs = trackRequests(page);
    const link = page.locator('aside nav a', { hasText: label }).first();
    const before = await page.evaluate(() => document.querySelector('main')?.innerHTML.length);
    const t0 = Date.now();
    await link.click();
    let feedback = null;
    let url = null;
    let content = null;
    while (Date.now() - t0 < 15000 && (url === null || content === null || feedback === null)) {
      const st = await page.evaluate(
        ([lbl, p]) => {
          const a = [...document.querySelectorAll('aside nav a')].find((x) =>
            x.textContent.trim().startsWith(lbl),
          );
          return {
            pending:
              Boolean(a?.querySelector('[data-pending]')) ||
              a?.getAttribute('aria-busy') === 'true',
            skeleton: Boolean(document.querySelector('main [data-loading]')),
            url: location.pathname === p,
            current:
              a?.getAttribute('aria-current') === 'true' ||
              a?.getAttribute('aria-current') === 'page',
            mainLen: document.querySelector('main')?.innerHTML.length,
          };
        },
        [label, path],
      );
      const now = Date.now() - t0;
      if (feedback === null && (st.pending || st.skeleton || st.current)) feedback = now;
      if (url === null && st.url) url = now;
      if (content === null && st.url && !st.skeleton && st.mainLen !== before) content = now;
      await page.waitForTimeout(10);
    }
    nav.push({
      label,
      feedbackMs: feedback,
      urlMs: url,
      contentMs: content,
      rsc: summarise(reqs).filter((r) => r.rsc || r.action).length,
    });
  }
  results['console tab switching (150ms/API call)'] = nav;

  // 3. a slow mutation must not freeze navigation (recording 04:13-04:56)
  await proxy({
    baseMs: 150,
    rules: [{ method: 'POST', prefix: '/v1/dealer/vehicles', ms: 12000 }],
  });
  await page.goto(`${BASE}/dealer/vehicles/new`);
  await page.locator('#registrationNumber').fill('TN23AJ1245');
  const tSubmit = Date.now();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(800);
  const tClick = Date.now();
  await page.locator('aside nav a', { hasText: 'Inventory' }).first().click();
  let navigatedAfter = null;
  while (Date.now() - tClick < 20000) {
    if (
      new URL(page.url()).pathname === '/dealer/inventory' &&
      (
        await page
          .locator('main h1')
          .first()
          .textContent()
          .catch(() => '')
      ).includes('Inventory')
    ) {
      navigatedAfter = Date.now() - tClick;
      break;
    }
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(13000);
  results['slow create (12s) then click Inventory'] = {
    navigatedAfterMs: navigatedAfter,
    finalPath: new URL(page.url()).pathname,
    submittedAt: tSubmit,
  };
  await proxy({ baseMs: 150, rules: [] });

  // 4. logout from public header, then navigate; are hearts reset?
  const pub = await context.newPage();
  await pub.goto(`${BASE}/cars`);
  await pub.waitForTimeout(2500);
  const firstHeart = pub.locator('button[aria-pressed]').first();
  if ((await firstHeart.getAttribute('aria-pressed')) !== 'true') {
    await firstHeart.click();
    await pub.waitForTimeout(1500);
  }
  await pub.locator('header button[aria-haspopup="menu"]').click();
  const tLogout = Date.now();
  await pub.getByRole('menuitem', { name: 'Logout' }).click();
  await pub.locator('header a', { hasText: 'Login' }).waitFor({ timeout: 15000 });
  const loggedOutMs = Date.now() - tLogout;
  await pub.waitForTimeout(500);
  const heartsAfterLogout = await pub.locator('button[aria-pressed="true"]').count();
  const tDealers = Date.now();
  await pub.locator('header nav a', { hasText: 'Dealers' }).first().click();
  await pub.waitForURL('**/dealers', { timeout: 20000 }).catch(() => undefined);
  results['logout then navigate'] = {
    loggedOutMs,
    heartsStillPressedAfterLogout: heartsAfterLogout,
    dealersNavMs: Date.now() - tDealers,
  };

  // 6. home → car card click, with a cold API cache-miss cost (800ms per API call)
  await proxy({ baseMs: 800, rules: [] });
  const cardRuns = [];
  for (let i = 0; i < 3; i++) {
    const home = await context.newPage();
    await home.goto(`${BASE}/`);
    await home.waitForTimeout(3000);
    const cards = home.locator('article h3 a[href^="/car/"]');
    const card = cards.nth(i);
    const href = await card.getAttribute('href');
    const t0 = Date.now();
    await card.click();
    let feedback = null,
      url = null,
      content = null;
    while (Date.now() - t0 < 20000 && content === null) {
      const st = await home.evaluate(
        (h) => ({
          pending: Boolean(document.querySelector('[data-pending]')),
          skeleton: Boolean(document.querySelector('[data-loading]')),
          url: location.pathname === h,
          h1:
            Boolean(document.querySelector('main h1')) &&
            !document.querySelector('[data-loading]') &&
            location.pathname === h,
        }),
        href,
      );
      const now = Date.now() - t0;
      if (feedback === null && (st.pending || st.skeleton || st.url)) feedback = now;
      if (url === null && st.url) url = now;
      if (content === null && st.h1) content = now;
      await home.waitForTimeout(10);
    }
    cardRuns.push({ href, feedbackMs: feedback, urlMs: url, contentMs: content });
    await home.close();
  }
  results['home → car card click (800ms per API call)'] = cardRuns;
  await proxy({ baseMs: 150, rules: [] });

  // 5. API call volume: proxy log for one console full load
  await proxyLog(true);
  const p2 = await context.newPage();
  await p2.goto(`${BASE}/dealer/profile`);
  await p2.waitForTimeout(2500);
  results['API calls for full load of /dealer/profile'] = (await proxyLog()).map(
    (x) => `${x.method} ${x.url} ${x.ms}ms`,
  );

  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 1));
}

run().catch((e) => {
  console.error(e);
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  process.exit(1);
});
