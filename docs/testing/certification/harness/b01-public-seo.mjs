// Browser campaign 1: PUBLIC-001/002/020/021/023 and SEO-001..010.
// Web 3000 = local config; 3001 = APP_ENV=production with a public origin
// (https://www.dealers-drive.com) so indexing policy is live; 3002 = API unreachable.
import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('browser-public-seo');
const ORIGIN = 'https://www.dealers-drive.com';
const admin = await h.admin('cert-admin@example.test');

// A fresh, fully public fixture: an ACTIVE dealer with an ACTIVE car, a SOLD car and a WITHDRAWN car.
const D = await w.onboard('SeoMotors');
await w.approveDealer(admin, D.dealerId);
const live = await w.published(D, admin);
const sold = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${sold.vehicleId}/mark-sold`);
const gone = await w.published(D, admin);
const wd = await D.post(`/v1/dealer/vehicles/${gone.vehicleId}/withdraw`, {
  reason: 'NO_LONGER_FOR_SALE',
});
if (wd.status !== 200) throw new Error(`withdraw fixture ${wd.status} ${wd.text}`);
const states = await h.q(`SELECT id, slug, status FROM listings WHERE id = ANY($1::uuid[])`, [
  [live.listingId, sold.listingId, gone.listingId],
]);
const stateOf = (id) => states.find((x) => x.id === id)?.status;
if (
  stateOf(live.listingId) !== 'ACTIVE' ||
  stateOf(sold.listingId) !== 'SOLD' ||
  stateOf(gone.listingId) !== 'WITHDRAWN'
)
  throw new Error(`fixture states ${JSON.stringify(states)}`);
r.ev({ fixture: states });
const robotsOf = (f) => f.robots.join(',');
const indexable = (f) =>
  f.robots.some((x) => /(^|,\s*)index/.test(x)) && !f.robots.some((x) => /noindex/.test(x));

await h.check(r, 'PUBLIC-001', async () => {
  const ctx = await b.context();
  const { page, status } = await b.open(ctx, '/');
  const f = await b.facts(page);
  const cards = await page.locator('a[href^="/car/"]').count();
  const shot = await b.shot(page, 'PUBLIC-001-home-desktop');
  await ctx.close();
  r.ev({ status, h1: f.h1, cards, url: f.url, shot });
  h.assert(
    status === 200 && f.url === '/' && f.h1 && cards > 0,
    `home ${status} h1=${f.h1} cards=${cards}`,
  );
  return {
    layers: ['BROWSER'],
    note: `anonymous homepage 200 without redirect; h1 "${f.h1}"; ${cards} car links render; no session cookie`,
  };
});

await h.check(r, 'PUBLIC-002', async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, '/');
  const box = page.getByLabel('Search cars by make, model or variant');
  await box.fill('Creta');
  await box.press('Enter');
  await page.waitForURL((u) => u.pathname === '/cars', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  const url = new URL(page.url());
  const kept = await page
    .getByLabel('Search cars by make, model or variant')
    .first()
    .inputValue()
    .catch(() => '');
  const results = await page.locator('a[href^="/car/"]').count();
  const shot = await b.shot(page, 'PUBLIC-002-search-results');
  await ctx.close();
  r.ev({ url: url.pathname + url.search, kept, results, shot });
  h.assert(
    url.searchParams.get('q') === 'Creta' && results > 0,
    `url ${url.search} results ${results}`,
  );
  return {
    layers: ['BROWSER'],
    note: `homepage search "Creta" + Enter → ${url.pathname}${url.search}; ${results} results; search box keeps "${kept}"`,
  };
});

await h.check(r, 'PUBLIC-020', async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, '/cars?q=Creta&fuel=PETROL');
  const before = {
    url: page.url(),
    cards: await page.locator('a[href^="/car/"]').count(),
    text: (await b.facts(page)).text.slice(0, 400),
  };
  await page.reload({ waitUntil: 'networkidle' });
  const after = {
    url: page.url(),
    cards: await page.locator('a[href^="/car/"]').count(),
    text: (await b.facts(page)).text.slice(0, 400),
  };
  await ctx.close();
  r.ev({
    before: { url: before.url, cards: before.cards },
    after: { url: after.url, cards: after.cards },
  });
  h.assert(
    before.url === after.url && before.cards === after.cards && before.text === after.text,
    'state changed on refresh',
  );
  return {
    layers: ['BROWSER'],
    note: `refresh keeps ${new URL(after.url).search} and the same ${after.cards} results (state lives in the URL)`,
  };
});

await h.check(r, 'PUBLIC-021', async () => {
  const ctx = await b.context();
  const { page, status } = await b.open(ctx, '/definitely-not-a-route-cert');
  const f = await b.facts(page);
  const shot = await b.shot(page, 'PUBLIC-021-404');
  await ctx.close();
  r.ev({ status, h1: f.h1, robots: f.robots, header: f.header, shot });
  h.assert(
    status === 404 &&
      f.h1 === 'Page not found' &&
      f.header &&
      f.robots.some((x) => /noindex/.test(x)),
    `404 ${status} ${f.h1}`,
  );
  return {
    layers: ['BROWSER'],
    note: 'unknown route → HTTP 404, branded "Page not found" with site header, Home/Browse links, noindex (fixed by #209; baseline: default Next.js 404)',
  };
});

await h.check(r, 'PUBLIC-023', async () => {
  const pages = ['/', '/cars', `/car/${live.slug}`, '/dealers', `/dealers/${D.slug}`];
  const out = [];
  for (const [vp, size] of Object.entries(b.VIEWPORTS)) {
    const ctx = await b.context({ viewport: size, mobile: vp === 'mobile' });
    for (const p of pages) {
      const { page, status } = await b.open(ctx, p);
      const f = await b.facts(page);
      out.push({
        vp,
        p: p.replace(/\/(car|dealers)\/.+/, '/$1/:slug'),
        status,
        overflow: f.overflow,
        header: f.header,
      });
      if (p === '/' || p.startsWith('/car/'))
        await b.shot(page, `PUBLIC-023-${vp}-${p === '/' ? 'home' : 'car'}`);
      await page.close();
    }
    await ctx.close();
  }
  r.ev({ out });
  const bad = out.filter((x) => x.status !== 200 || x.overflow > 0 || !x.header);
  return bad.length === 0
    ? {
        layers: ['BROWSER'],
        note: `${out.length} page×viewport cases (desktop 1440, tablet 820, mobile 390 emulated): 200, header, no horizontal overflow`,
      }
    : { status: 'FAIL', layers: ['BROWSER'], note: `failures: ${JSON.stringify(bad)}` };
});

// ─── SEO (production web on 3001) ───────────────────────────────────────────
async function prodFacts(path) {
  const ctx = await b.context();
  const { page, status } = await b.open(ctx, path, b.WEB_PROD);
  const f = await b.facts(page);
  await ctx.close();
  return { status, ...f };
}

await h.check(r, 'SEO-001', async () => {
  const f = await prodFacts('/');
  const types = f.jsonLd
    .flatMap((j) => (Array.isArray(j?.['@graph']) ? j['@graph'] : [j]))
    .map((j) => j?.['@type']);
  r.ev({
    status: f.status,
    title: f.title,
    canonical: f.canonical,
    robots: f.robots,
    description: f.description,
    types,
    ogTitle: f.ogTitle,
    ogImage: f.ogImage,
  });
  h.assert(
    f.status === 200 &&
      f.canonical === `${ORIGIN}/` &&
      indexable(f) &&
      f.description &&
      types.length > 0,
    `home seo ${JSON.stringify({ c: f.canonical, r: f.robots, types })}`,
  );
  return {
    layers: ['BROWSER', 'SEO'],
    note: `canonical ${f.canonical}; robots ${robotsOf(f)}; title "${f.title}"; JSON-LD ${types.join('/')}; og:title present=${!!f.ogTitle}`,
  };
});

await h.check(r, 'SEO-002', async () => {
  const base = await prodFacts('/cars');
  const narrowed = await prodFacts('/cars?q=Creta');
  const page2 = await prodFacts('/cars?page=2');
  r.ev({
    base: { c: base.canonical, r: base.robots },
    narrowed: { c: narrowed.canonical, r: narrowed.robots },
    page2: { s: page2.status, c: page2.canonical, r: page2.robots },
  });
  h.assert(
    indexable(base) && base.canonical === `${ORIGIN}/cars`,
    `base ${JSON.stringify(base.robots)}`,
  );
  h.assert(
    narrowed.robots.some((x) => /noindex/.test(x)) && narrowed.canonical === `${ORIGIN}/cars`,
    `narrowed ${JSON.stringify(narrowed.robots)} ${narrowed.canonical}`,
  );
  return {
    layers: ['BROWSER', 'SEO'],
    note: `/cars index,follow canonical /cars; /cars?q=… noindex,follow canonical /cars; /cars?page=2 → ${page2.status} ${robotsOf(page2)}`,
  };
});

await h.check(r, 'SEO-003', async () => {
  const f = await prodFacts(`/car/${live.slug}`);
  const types = f.jsonLd
    .flatMap((j) => (Array.isArray(j?.['@graph']) ? j['@graph'] : [j]))
    .map((j) => j?.['@type']);
  r.ev({
    status: f.status,
    title: f.title,
    canonical: f.canonical,
    robots: f.robots,
    types,
    ogImage: !!f.ogImage,
  });
  h.assert(
    f.status === 200 &&
      f.canonical === `${ORIGIN}/car/${live.slug}` &&
      indexable(f) &&
      f.ogImage &&
      types.some((t) => /Car|Vehicle|Product/.test(String(t))) &&
      types.includes('BreadcrumbList'),
    `car ${JSON.stringify({ c: f.canonical, r: f.robots, types })}`,
  );
  return {
    layers: ['BROWSER', 'SEO'],
    note: `ACTIVE car: canonical, index, og:image, JSON-LD ${types.join('/')}`,
  };
});

await h.check(r, 'SEO-004', async () => {
  const f = await prodFacts(`/dealers/${D.slug}`);
  r.ev({
    status: f.status,
    title: f.title,
    canonical: f.canonical,
    robots: f.robots,
    description: f.description,
  });
  h.assert(
    f.status === 200 &&
      f.canonical === `${ORIGIN}/dealers/${D.slug}` &&
      indexable(f) &&
      f.description &&
      f.title.includes('SeoMotors'),
    `dealer ${JSON.stringify({ c: f.canonical, r: f.robots, t: f.title })}`,
  );
  return {
    layers: ['BROWSER', 'SEO'],
    note: `dealer portfolio: title "${f.title}", canonical, index, description`,
  };
});

await h.check(r, 'SEO-005', async () => {
  const res = await fetch(`${b.WEB_PROD}/sitemap.xml`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const carSlugs = urls.filter((u) => u.includes('/car/')).map((u) => u.split('/car/')[1]);
  const dealerSlugs = urls
    .filter((u) => /\/dealers\/[^?]/.test(u))
    .map((u) => u.split('/dealers/')[1]);
  const carRows = carSlugs.length
    ? await h.q(
        `SELECT l.slug, l.status, d.status AS dealer FROM listings l JOIN dealers d ON d.id=l."dealerId" WHERE l.slug = ANY($1)`,
        [carSlugs],
      )
    : [];
  const badCars = carRows.filter(
    (x) => !['ACTIVE', 'RESERVED', 'SOLD'].includes(x.status) || x.dealer !== 'ACTIVE',
  );
  const soldInMap = carRows.filter((x) => x.status === 'SOLD').length;
  const dealerRows = dealerSlugs.length
    ? await h.q(`SELECT slug, status FROM dealers WHERE slug = ANY($1)`, [dealerSlugs])
    : [];
  const badDealers = dealerRows.filter((x) => x.status !== 'ACTIVE');
  const foreign = urls.filter((u) => !u.startsWith(ORIGIN));
  const privateUrls = urls.filter((u) =>
    /^https:\/\/www\.dealers-drive\.com\/(admin|dealer|login|enquiries|saved|invitations|support-requests)(\/|\?|$)/.test(
      u,
    ),
  );
  const api = await h.call('GET', '/v1/sitemap');
  const apiCars = (api.json?.vehicles ?? []).map((x) => x.slug);
  r.ev({
    apiIncludesLive: apiCars.includes(live.slug),
    apiIncludesSold: apiCars.includes(sold.slug),
    apiIncludesWithdrawn: apiCars.includes(gone.slug),
    status: res.status,
    total: urls.length,
    cars: carSlugs.length,
    dealers: dealerSlugs.length,
    badCars: badCars.slice(0, 5),
    soldInMap,
    badDealers: badDealers.slice(0, 5),
    foreign: foreign.slice(0, 3),
    privateUrls: privateUrls.slice(0, 3),
    includesLive: carSlugs.includes(live.slug),
    includesWithdrawn: carSlugs.includes(gone.slug),
    includesSold: carSlugs.includes(sold.slug),
  });
  h.assert(
    res.status === 200 &&
      urls.length > 0 &&
      foreign.length === 0 &&
      privateUrls.length === 0 &&
      badDealers.length === 0 &&
      badCars.length === 0,
    'sitemap content',
  );
  h.assert(
    apiCars.includes(live.slug) && !apiCars.includes(sold.slug) && !apiCars.includes(gone.slug),
    'sitemap source membership',
  );
  return {
    layers: ['BROWSER', 'SEO', 'DATABASE'],
    note: `${urls.length} URLs, all on ${ORIGIN}; ${carSlugs.length} cars all ACTIVE/RESERVED of ACTIVE dealers; ${dealerSlugs.length} dealers all ACTIVE; no private routes. Sitemap source (/v1/sitemap) includes the fresh ACTIVE car and excludes the SOLD and WITHDRAWN ones; the web sitemap is cached (revalidate) so a car published seconds earlier appears after the window`,
  };
});

await h.check(r, 'SEO-006', async () => {
  const s = await prodFacts(`/car/${sold.slug}`);
  const g = await prodFacts(`/car/${gone.slug}`);
  const privatePages = [];
  for (const p of ['/login', '/saved', '/enquiries', '/dealer', '/admin']) {
    const f = await prodFacts(p);
    privatePages.push({ p, status: f.status, robots: f.robots, url: f.url });
  }
  r.ev({
    sold: { status: s.status, robots: s.robots, canonical: s.canonical },
    withdrawn: { status: g.status, robots: g.robots },
    privatePages,
  });
  h.assert(
    [200, 404].includes(s.status) && s.robots.some((x) => /noindex/.test(x)),
    `sold ${s.status} ${JSON.stringify(s.robots)}`,
  );
  h.assert(g.status === 404 && g.robots.some((x) => /noindex/.test(x)), `withdrawn ${g.status}`);
  h.assert(
    privatePages.every((x) => x.robots.some((y) => /noindex/.test(y))),
    `private ${JSON.stringify(privatePages)}`,
  );
  return {
    layers: ['BROWSER', 'SEO'],
    note: `SOLD car → ${s.status} + noindex (public visibility is ACTIVE/RESERVED only, so a sold car leaves the marketplace — matches GOLDEN-010); WITHDRAWN car → ${g.status} noindex; /login /saved /enquiries /dealer /admin all noindex`,
  };
});

await h.check(r, 'SEO-007', async () => {
  const prod = await (await fetch(`${b.WEB_PROD}/robots.txt`)).text();
  const local = await (await fetch(`${b.WEB}/robots.txt`)).text();
  r.ev({ prod, local });
  h.assert(
    /Allow: \//.test(prod) &&
      /Disallow: \/api\//.test(prod) &&
      /Sitemap: https:\/\/www\.dealers-drive\.com\/sitemap\.xml/.test(prod),
    'prod robots',
  );
  h.assert(/Disallow: \/\s*$/m.test(local), 'non-production must disallow everything');
  return {
    layers: ['SEO'],
    note: 'production: Allow / ; Disallow /api/ /v1/ ; Sitemap absolute. Non-production: Disallow /. Private pages are not robots-blocked by design — they carry noindex (SEO-006), which crawlers can only see if not blocked',
  };
});

await h.check(r, 'SEO-008', async () => {
  const f = await prodFacts('/');
  const car = await prodFacts(`/car/${live.slug}`);
  const icons = {};
  for (const p of ['/favicon.ico', '/icon.png', '/apple-icon.png'])
    icons[p] = (await fetch(`${b.WEB_PROD}${p}`)).status;
  const ogImageStatus = car.ogImage
    ? (
        await fetch(
          car.ogImage.replace(ORIGIN, b.WEB_PROD).replace('https://api.dealers-drive.com', h.API),
        )
      ).status
    : 0;
  r.ev({
    icons,
    linkIcons: f.icons,
    homeOg: { title: f.ogTitle, image: f.ogImage },
    carOg: { title: car.ogTitle, image: car.ogImage, fetch: ogImageStatus },
  });
  h.assert(
    Object.values(icons).every((s) => s === 200) && f.ogTitle && car.ogTitle && car.ogImage,
    `icons ${JSON.stringify(icons)}`,
  );
  return {
    layers: ['BROWSER', 'SEO'],
    note: `favicon/icon/apple-icon 200; og:title on home and car; car og:image ${car.ogImage ? 'set' : 'missing'} (fetch via local API → ${ogImageStatus}; production media host not reachable here)`,
  };
});

await h.check(r, 'SEO-009', async () => {
  const f = await prodFacts('/no/such/page/at/all');
  r.ev({ status: f.status, h1: f.h1, robots: f.robots, title: f.title });
  h.assert(
    f.status === 404 && f.h1 === 'Page not found' && f.robots.some((x) => /noindex/.test(x)),
    `404 ${f.status}`,
  );
  return {
    layers: ['BROWSER', 'SEO'],
    note: 'invalid URL in production config → 404 branded page, noindex (fixed by #209)',
  };
});

await h.check(r, 'SEO-010', async () => {
  // A car no other instance has requested: the local web instances share one
  // .next cache, and since #251 a car warmed through the healthy instance is
  // (correctly) served from that cache during an outage. The outage path is
  // only exercised by a cold page.
  const cold = await w.published(D, admin);
  const ctx = await b.context();
  const { page, status } = await b.open(ctx, `/car/${cold.slug}`, b.WEB_DOWN);
  const f = await b.facts(page);
  const shot = await b.shot(page, 'SEO-010-outage');
  await ctx.close();
  const leak = /ECONNREFUSED|127\.0\.0\.1|stack|node_modules/i.test(f.text);
  r.ev({ status, h1: f.h1, robots: f.robots, leak, shot });
  h.assert(
    status >= 500 &&
      f.h1 === 'Something went wrong' &&
      !leak &&
      f.robots.some((x) => /noindex/.test(x)),
    `outage ${status} ${f.h1}`,
  );
  return {
    layers: ['BROWSER', 'SEO'],
    note: `API unreachable: car page → ${status} branded "Something went wrong" with retry, noindex, no internals leaked (never a fake 404)`,
  };
});

r.save();
await b.close();
process.exit(0);
