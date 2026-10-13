// PR #209 retest: branded 404, outage classification, BFF safety, noindex.
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , WEB, OUT, CAR, DEALER, MODE] = process.argv;
const results = [];
const rec = (id, ok, detail) => {
  results.push({ id, ok, ...detail });
  console.log(ok ? 'PASS' : 'FAIL', id, JSON.stringify(detail));
};
const LEAK =
  /ECONNREFUSED|127\.0\.0\.1:4999|localhost:4999|stack|at Object\.|SECRET-CANARY|node_modules/i;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
async function visit(path, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const resp = await page.goto(WEB + path, { waitUntil: 'networkidle' });
  const info = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    robots: [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content),
    title: document.title,
    header: !!document.querySelector('header'),
    brand:
      document.body.innerText.includes('Dealers-Drive') ||
      document.body.innerText.includes('Dealers Drive'),
    homeLink: !!document.querySelector('main a[href="/"]'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    text: document.body.innerText.slice(0, 4000),
  }));
  return { ctx, page, status: resp.status(), info };
}

if (MODE === 'normal') {
  for (const [id, path, expectH1] of [
    ['unknown-route', '/this-route-does-not-exist-209', 'Page not found'],
    ['nested-unknown', '/cars/x/y/z/not-a-route', 'Page not found'],
    ['missing-car', '/car/no-such-car-slug-209', null],
    ['missing-dealer', '/dealers/no-such-dealer-slug-209', null],
  ]) {
    for (const w of [1440, 768, 390]) {
      const { ctx, page, status, info } = await visit(path, w);
      await page.screenshot({ path: `${OUT}/${id}-${w}.png`, fullPage: true });
      const ok =
        status === 404 &&
        info.header &&
        info.brand &&
        info.robots.some((r) => /noindex/.test(r)) &&
        info.overflow <= 0 &&
        (!expectH1 || info.h1 === expectH1) &&
        info.homeLink;
      rec(`${id}@${w}`, ok, {
        status,
        h1: info.h1,
        robots: info.robots,
        header: info.header,
        overflow: info.overflow,
        homeLink: info.homeLink,
        title: info.title,
      });
      if (w === 390 && id === 'unknown-route') {
        await page.getByRole('link', { name: 'Go to homepage' }).click();
        const nav = await page
          .waitForURL((u) => u.pathname === '/', { timeout: 10000 })
          .then(
            () => true,
            () => false,
          );
        rec('404-home-link-navigates', nav, { url: page.url() });
      }
      await ctx.close();
    }
  }
  for (const [id, path] of [
    ['home', '/'],
    ['cars', '/cars'],
    ['car', `/car/${CAR}`],
    ['dealer', `/dealers/${DEALER}`],
    ['dealers', '/dealers'],
  ]) {
    const { ctx, status, info } = await visit(path, 1440);
    const ok =
      status === 200 &&
      info.header &&
      !info.robots.some((r) => /noindex/.test(r)) &&
      info.h1 !== 'Page not found';
    rec(`valid-${id}`, ok, { status, h1: info.h1, robots: info.robots });
    await ctx.close();
  }
  const r = await fetch(WEB + '/robots.txt');
  rec('robots-observe', r.status === 200, {
    status: r.status,
    body: (await r.text()).slice(0, 400),
  });
} else {
  // outage modes: API unreachable / 503 / 500-with-canary-detail
  for (const [id, path] of [
    ['car', `/car/${CAR}`],
    ['cars', '/cars'],
    ['dealer', `/dealers/${DEALER}`],
    ['dealers', '/dealers'],
  ]) {
    const { ctx, page, status, info } = await visit(path, 390);
    await page.screenshot({ path: `${OUT}/outage-${MODE}-${id}-390.png`, fullPage: true });
    const ok =
      status >= 500 &&
      info.h1 !== 'Page not found' &&
      /Something went wrong/.test(info.text) &&
      !LEAK.test(info.text) &&
      info.robots.some((x) => /noindex/.test(x));
    rec(`outage-${MODE}-${id}`, ok, {
      status,
      h1: info.h1,
      robots: info.robots,
      leak: LEAK.test(info.text),
    });
    await ctx.close();
  }
  const { ctx, status, info } = await visit('/', 1440);
  rec(
    `outage-${MODE}-home`,
    status === 200 && /couldn’t load these vehicles/.test(info.text) && !LEAK.test(info.text),
    { status },
  );
  await ctx.close();
  const b = await fetch(WEB + '/api/search/vehicles?search=swift');
  const body = await b.text();
  rec(
    `outage-${MODE}-bff`,
    [502, 503, 504].includes(b.status) && !LEAK.test(body) && !/Not found/.test(body),
    { status: b.status, body: body.slice(0, 300) },
  );
}
await browser.close();
fs.writeFileSync(`${OUT}/results-${MODE}.json`, JSON.stringify(results, null, 2));
console.log('TOTAL', results.length, 'FAIL', results.filter((r) => !r.ok).length);
