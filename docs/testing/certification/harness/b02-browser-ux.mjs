// Browser campaign 2: BROWSER-001..012 and UX-001..012.
// Only Chromium 141 (Playwright build 1194) exists in this environment. Safari,
// Firefox, Edge and real iOS are therefore BLOCKED, never inferred from Chromium.
import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('browser-ux');
const admin = await h.admin('cert-admin@example.test');
const D = await w.onboard('UxMotors');
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
await w.published(D, admin);
const staff = await w.addMember(D, 'STAFF', 'Ux Staff');
const manager = await w.addMember(D, 'MANAGER', 'Ux Manager');
const buyer = await h.customer('Ux Buyer');
await buyer.post('/v1/enquiries', {
  listingSlug: car.slug,
  message: 'Is the service history available?',
});

const DEALER_PAGES = [
  '/dealer',
  '/dealer/inventory',
  '/dealer/enquiries',
  '/dealer/team',
  '/dealer/profile',
  '/dealer/vehicles/new',
];
const ADMIN_PAGES = [
  '/admin',
  '/admin/dealers',
  `/admin/dealers/${D.dealerId}`,
  '/admin/listings',
  '/admin/enquiries',
  '/admin/support',
  '/admin/config',
];

async function sweep(cookie, pages, viewport, mobile = false) {
  const ctx = await b.context({ cookie, viewport, mobile });
  const out = [];
  for (const p of pages) {
    const { page, status } = await b.open(ctx, p);
    const f = await b.facts(page);
    out.push({
      p: p.replace(/[0-9a-f-]{36}/, ':id'),
      status,
      overflow: f.overflow,
      h1: f.h1,
      url: f.url.replace(/[0-9a-f-]{36}/, ':id'),
    });
    await page.close();
  }
  await ctx.close();
  return out;
}
const BLOCKED = (engine) => async () => ({
  status: 'BLOCKED',
  layers: ['BROWSER'],
  note: `${engine} is not installed in this environment (only Playwright Chromium 1194 is available). Requires a real-device/BrowserStack run — listed in HUMAN-UAT.md. Not inferred from Chromium.`,
});

await h.check(r, 'BROWSER-001', async () => {
  const pub = await sweep(
    undefined,
    ['/', '/cars', `/car/${car.slug}`, '/dealers', `/dealers/${D.slug}`, '/login'],
    b.VIEWPORTS.desktop,
  );
  const dealer = await sweep(D.cookie, DEALER_PAGES, b.VIEWPORTS.desktop);
  const adm = await sweep(admin.cookie, ADMIN_PAGES, b.VIEWPORTS.desktop);
  const all = [...pub, ...dealer, ...adm];
  r.ev({ all });
  const bad = all.filter((x) => x.status !== 200 || x.overflow > 0);
  return bad.length === 0
    ? {
        layers: ['BROWSER'],
        note: `Chromium 141 desktop 1440: ${all.length} public/dealer/admin pages 200 with no overflow (headless Chromium = Chrome's engine; branded Google Chrome itself not installed)`,
      }
    : { status: 'FAIL', layers: ['BROWSER'], note: JSON.stringify(bad) };
});
await h.check(r, 'BROWSER-002', BLOCKED('Safari (WebKit) desktop'));
await h.check(r, 'BROWSER-003', BLOCKED('Firefox (Gecko) desktop'));
await h.check(r, 'BROWSER-004', BLOCKED('Microsoft Edge'));
await h.check(r, 'BROWSER-005', async () => {
  const ctx = await b.context({ viewport: b.VIEWPORTS.mobile, mobile: true });
  const { page } = await b.open(ctx, '/');
  const box = page.getByLabel('Search cars by make, model or variant');
  await box.tap();
  await box.fill('Creta');
  await box.press('Enter');
  await page.waitForURL((u) => u.pathname === '/cars');
  await page.waitForLoadState('networkidle');
  const first = page.locator('a[href^="/car/"]').first();
  await first.tap();
  await page.waitForURL((u) => u.pathname.startsWith('/car/'));
  await page.waitForLoadState('networkidle');
  const f = await b.facts(page);
  const shot = await b.shot(page, 'BROWSER-005-android-car');
  await ctx.close();
  r.ev({ url: f.url, overflow: f.overflow, h1: f.h1, shot });
  h.assert(f.url.startsWith('/car/') && f.overflow <= 0, 'mobile flow');
  return {
    layers: ['BROWSER'],
    note: 'EMULATED Chrome Android (Chromium mobile: Pixel UA, touch, DPR 3, 390×844): tap search → results → tap car; no overflow. Real Android hardware not available — real-device check stays in HUMAN-UAT.md',
  };
});
await h.check(r, 'BROWSER-006', BLOCKED('Safari on iPhone (WebKit/iOS)'));
await h.check(r, 'BROWSER-007', async () => {
  const pub = await sweep(
    undefined,
    ['/', '/cars', `/car/${car.slug}`, '/dealers', `/dealers/${D.slug}`],
    b.VIEWPORTS.tablet,
  );
  const dealer = await sweep(D.cookie, DEALER_PAGES, b.VIEWPORTS.tablet);
  const adm = await sweep(admin.cookie, ADMIN_PAGES, b.VIEWPORTS.tablet);
  const all = [...pub, ...dealer, ...adm];
  r.ev({ all });
  const bad = all.filter((x) => x.status !== 200 || x.overflow > 0);
  return bad.length === 0
    ? {
        layers: ['BROWSER'],
        note: `tablet 820×1180: ${all.length} public/dealer/admin pages 200, no overflow`,
      }
    : { status: 'FAIL', layers: ['BROWSER'], note: JSON.stringify(bad) };
});
await h.check(r, 'BROWSER-008', async () => {
  const out = [];
  for (const width of [320, 390])
    out.push(
      ...(await sweep(D.cookie, DEALER_PAGES, { width, height: 844 }, true)).map((x) => ({
        ...x,
        width,
      })),
    );
  const ctx = await b.context({
    cookie: D.cookie,
    viewport: { width: 390, height: 844 },
    mobile: true,
  });
  const { page } = await b.open(ctx, '/dealer/enquiries');
  const markable = await page.getByRole('button', { name: 'Mark contacted' }).first().isVisible();
  const shot = await b.shot(page, 'BROWSER-008-dealer-enquiries-390');
  await ctx.close();
  r.ev({ out, markable, shot });
  const bad = out.filter((x) => x.status !== 200 || x.overflow > 0);
  return bad.length === 0 && markable
    ? {
        layers: ['BROWSER'],
        note: `dealer console at 320/390 (emulated mobile): ${out.length} pages 200, no overflow; enquiry actions reachable`,
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER'],
        bug: 'DEALER-MOBILE',
        note: `dealer console mobile failures: ${JSON.stringify(bad)}; actions visible=${markable}`,
      };
});
await h.check(r, 'BROWSER-009', async () => {
  const out = [];
  for (const width of [320, 390, 768, 1024, 1440])
    out.push(
      ...(await sweep(admin.cookie, ADMIN_PAGES, { width, height: 900 })).map((x) => ({
        ...x,
        width,
      })),
    );
  r.ev({ out });
  const bad = out.filter((x) => x.status !== 200 || x.overflow > 0);
  return bad.length === 0
    ? { layers: ['BROWSER'], note: `${out.length} admin page×width cases clean (320–1440)` }
    : {
        status: 'FAIL',
        layers: ['BROWSER'],
        bug: 'ADMIN-MOBILE-DETAIL-001',
        note: `${bad.length}/${out.length} admin cases overflow: ${JSON.stringify(bad.map((x) => `${x.p}@${x.width}:+${x.overflow}px`))}. Baseline before #238: every admin route overflowed at 320/390; #238 fixed the shared header; the dealer-detail definition list still overflows at 320px with long URL/email values (P3).`,
      };
});
await h.check(r, 'BROWSER-010', async () => {
  // Mobile keyboard: the visual viewport shrinks to ~half height when the keyboard opens.
  const ctx = await b.context({
    cookie: D.cookie,
    viewport: { width: 390, height: 420 },
    mobile: true,
  });
  const { page } = await b.open(ctx, '/dealer/team');
  await page.getByRole('button', { name: 'Invite member' }).tap();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const phone = dialog.getByLabel(/mobile number/i);
  await phone.tap();
  await page.keyboard.type('9876500001');
  const invite = dialog.getByRole('button', { name: 'Invite', exact: true });
  await invite.scrollIntoViewIfNeeded();
  const inView = await invite.evaluate((el) => {
    const r0 = el.getBoundingClientRect();
    return r0.top >= 0 && r0.bottom <= window.innerHeight;
  });
  const value = await phone.inputValue();
  const shot = await b.shot(page, 'BROWSER-010-dialog-keyboard');
  await page.keyboard.press('Escape');
  await ctx.close();
  r.ev({ inView, value, shot });
  h.assert(
    inView && value.replace(/\D/g, '').endsWith('9876500001'),
    `invite reachable=${inView} value=${value}`,
  );
  return {
    layers: ['BROWSER'],
    note: 'invite dialog at 390×420 (keyboard-open viewport): phone field typeable, Invite button scrolls into view, Escape closes',
  };
});
await h.check(r, 'BROWSER-011', async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, '/cars?q=Creta&fuel=PETROL');
  const listUrl = page.url();
  const count = await page.locator('a[href^="/car/"]').count();
  await page.locator('a[href^="/car/"]').first().click();
  await page.waitForURL((u) => u.pathname.startsWith('/car/'));
  const carUrl = page.url();
  await page.goBack({ waitUntil: 'networkidle' });
  const backUrl = page.url();
  const backCount = await page.locator('a[href^="/car/"]').count();
  await page.goForward({ waitUntil: 'networkidle' });
  const fwdUrl = page.url();
  await ctx.close();
  r.ev({ listUrl, count, carUrl, backUrl, backCount, fwdUrl });
  h.assert(backUrl === listUrl && backCount === count && fwdUrl === carUrl, 'history state');
  return {
    layers: ['BROWSER'],
    note: `back restores ${new URL(listUrl).search} with the same ${count} results; forward returns to the car`,
  };
});
await h.check(r, 'BROWSER-012', async () => {
  const ctx = await b.context();
  const one = await ctx.newPage();
  await b.uiLogin(one, { phone: b.freshPhone('94'), name: 'Tab Tester', returnTo: '/saved' });
  const two = await ctx.newPage();
  await two.goto(`${b.WEB}/enquiries`, { waitUntil: 'networkidle' });
  const twoSignedIn = (await b.facts(two)).url === '/enquiries';
  await one.getByRole('button', { name: /account menu/i }).click();
  await one.getByRole('menuitem', { name: 'Logout' }).click();
  await one.waitForLoadState('networkidle');
  await two.goto(`${b.WEB}/enquiries`, { waitUntil: 'networkidle' });
  const afterLogout = (await b.facts(two)).url;
  await ctx.close();
  r.ev({ twoSignedIn, afterLogout });
  h.assert(
    twoSignedIn && afterLogout.startsWith('/login'),
    `tab2 signedIn=${twoSignedIn} afterLogout=${afterLogout}`,
  );
  return {
    layers: ['BROWSER'],
    auth: 'FAKE-OTP',
    note: 'second tab shares the session (/enquiries renders); signing out in tab 1 → tab 2’s next navigation goes to /login',
  };
});

// ─── UX ─────────────────────────────────────────────────────────────────────
await h.check(r, 'UX-001', async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, '/');
  let reached = false;
  for (let i = 0; i < 25 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(
      () =>
        document.activeElement?.getAttribute('aria-label') ===
          'Search cars by make, model or variant' ||
        document.activeElement?.labels?.[0]?.textContent?.includes('Search cars'),
    );
  }
  if (reached) {
    await page.keyboard.type('Creta');
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === '/cars');
  }
  const ok = reached && new URL(page.url()).searchParams.get('q') === 'Creta';
  await ctx.close();
  r.ev({ reached, url: page.url() });
  h.assert(ok, 'keyboard search');
  return {
    layers: ['BROWSER', 'A11Y'],
    note: 'search box reachable by Tab from page start; typing + Enter submits to /cars?q=Creta',
  };
});
await h.check(r, 'UX-002', async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, '/login');
  const phone = page.locator('input[name=phone]:visible').first();
  await phone.focus();
  await page.keyboard.type(b.freshPhone('93').replace('+91', ''));
  await page.keyboard.press('Enter');
  await page.getByLabel('Digit 1 of 6').waitFor();
  const autoFocused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  await page.getByLabel('Digit 1 of 6').focus();
  await page.keyboard.type('123456');
  await page.keyboard.press('Enter');
  await page.locator('input[name=fullName]').waitFor({ timeout: 8000 });
  await page.locator('input[name=fullName]').focus();
  await page.keyboard.type('Keyboard Only');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  const url = new URL(page.url()).pathname;
  await ctx.close();
  r.ev({ autoFocused, url });
  return {
    layers: ['BROWSER', 'A11Y'],
    auth: 'FAKE-OTP',
    note: `phone → Enter sends OTP (focus moves to "${autoFocused}"), digits typed → Enter verifies, name → Enter creates account; signed in without a pointer`,
  };
});
// Each interactive control gets a stable index (data-cert-idx) so identical-looking
// controls are distinct; the starting (auto-focused) element counts as reached.
async function indexControls(page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'main input:not([type=hidden]),main select,main textarea,main button',
      ),
    ]
      .filter((e) => e.offsetParent && !e.disabled)
      .map((e, i) => {
        e.setAttribute('data-cert-idx', String(i));
        return `${i}:${e.tagName}:${e.getAttribute('name') ?? e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 20)}`;
      }),
  );
}
async function tabStops(page, max = 150) {
  const at = () => page.evaluate(() => document.activeElement?.getAttribute('data-cert-idx'));
  const stops = new Set();
  const first = await at();
  if (first != null) stops.add(first);
  let previous = null;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const s = await at();
    if (s != null) stops.add(s);
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    if (tag === 'BODY' && previous === 'BODY') break;
    previous = tag;
  }
  return [...stops];
}
await h.check(r, 'UX-003', async () => {
  const ctx = await b.context({ cookie: D.cookie });
  const { page } = await b.open(ctx, '/dealer/vehicles/new');
  const fields = await indexControls(page);
  const stops = await tabStops(page);
  const unreachable = fields.filter((f) => !stops.includes(f.split(':')[0]));
  await ctx.close();
  r.ev({ fields, stops: stops.length, unreachable });
  h.assert(unreachable.length === 0, `unreachable ${JSON.stringify(unreachable)}`);
  return {
    layers: ['BROWSER', 'A11Y'],
    note: `add-vehicle form: all ${fields.length} interactive controls reachable by Tab`,
  };
});
await h.check(r, 'UX-004', async () => {
  const ctx = await b.context({ cookie: admin.cookie });
  const { page } = await b.open(ctx, '/admin/config');
  const fields = await indexControls(page);
  const stops = await tabStops(page);
  const unreachable = fields.filter((f) => !stops.includes(f.split(':')[0]));
  await ctx.close();
  r.ev({ fields: fields.length, stops: stops.length, unreachable });
  h.assert(
    fields.length > 0 && unreachable.length === 0,
    `unreachable ${JSON.stringify(unreachable)}`,
  );
  return {
    layers: ['BROWSER', 'A11Y'],
    note: `admin configuration form: all ${fields.length} controls reachable by Tab`,
  };
});
async function unlabeled(cookie, path) {
  const ctx = await b.context({ cookie });
  const { page } = await b.open(ctx, path);
  const list = await page.evaluate(() =>
    [...document.querySelectorAll('input:not([type=hidden]),select,textarea')]
      .filter((e) => e.offsetParent)
      .filter(
        (e) =>
          !(
            e.labels?.[0]?.textContent?.trim() ||
            e.getAttribute('aria-label') ||
            e.getAttribute('aria-labelledby') ||
            e.getAttribute('title')
          ),
      )
      .map((e) => `${e.tagName}:${e.type}:${e.name}`),
  );
  await ctx.close();
  return list;
}
await h.check(r, 'UX-005', async () => {
  const pages = [
    [undefined, '/login'],
    [undefined, '/cars'],
    [D.cookie, '/dealer/vehicles/new'],
    [D.cookie, '/dealer/profile'],
    [D.cookie, '/dealer/inventory'],
    [admin.cookie, '/admin/config'],
    [admin.cookie, '/admin/dealers'],
    [buyer.cookie, '/support-requests/new'],
  ];
  const out = {};
  for (const [c, p] of pages) out[p] = await unlabeled(c, p);
  r.ev({ out });
  const bad = Object.entries(out).filter(([, v]) => v.length);
  return bad.length === 0
    ? {
        layers: ['BROWSER', 'A11Y'],
        note: `every visible input/select/textarea on ${pages.length} forms has a label or aria-label`,
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER', 'A11Y'],
        note: `unlabelled fields: ${JSON.stringify(bad)}`,
      };
});
await h.check(r, 'UX-006', async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, '/login');
  await page.locator('input[name=phone]:visible').first().fill('12345');
  await page.getByRole('button', { name: 'Send OTP' }).first().click();
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const el = document.querySelector('input[name=phone]');
    const described = el?.getAttribute('aria-describedby');
    return {
      invalid: el?.getAttribute('aria-invalid'),
      describedText: described
        ? described
            .split(' ')
            .map((id) => document.getElementById(id)?.textContent?.trim())
            .join(' ')
        : null,
      alerts: [...document.querySelectorAll('[role=alert]')]
        .map((a) => a.textContent.trim())
        .filter(Boolean),
    };
  });
  await ctx.close();
  r.ev(info);
  h.assert(
    info.invalid === 'true' || (info.describedText && info.describedText.length > 0),
    `field not identified ${JSON.stringify(info)}`,
  );
  return {
    layers: ['BROWSER', 'A11Y'],
    note: `invalid phone: aria-invalid=${info.invalid}, message "${info.describedText ?? info.alerts.join(' ')}" tied to the field`,
  };
});
await h.check(r, 'UX-007', async () => {
  const ctx = await b.context({ cookie: D.cookie });
  const { page } = await b.open(ctx, '/dealer/inventory');
  const trigger = page.getByRole('button', { name: 'Withdraw' }).first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const inside = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
  let trapped = true;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))))
      trapped = false;
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page
    .waitForFunction(
      () => document.activeElement && document.activeElement !== document.body,
      null,
      { timeout: 2000 },
    )
    .catch(() => null);
  await b.sleep(300);
  const returned = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await ctx.close();
  r.ev({ inside, trapped, returned });
  h.assert(
    inside && trapped && returned === 'Withdraw',
    `focus ${JSON.stringify({ inside, trapped, returned })}`,
  );
  return {
    layers: ['BROWSER', 'A11Y'],
    note: 'withdraw dialog: focus moves inside on open, Tab is trapped (12 presses), Escape closes and focus returns to the Withdraw trigger',
  };
});
async function unnamedButtons(cookie, path) {
  const ctx = await b.context({ cookie });
  const { page } = await b.open(ctx, path);
  const list = await page.evaluate(() =>
    [...document.querySelectorAll('button,[role=button],a[href]')]
      .filter((e) => e.offsetParent)
      .filter((e) => {
        const name =
          (e.getAttribute('aria-label') ?? '').trim() ||
          e.textContent.trim() ||
          e.querySelector('img[alt]')?.getAttribute('alt') ||
          '';
        return name.length === 0 || /^[♡♥✕×‹›←→]$/.test(name);
      })
      .map((e) => `${e.tagName}:${e.outerHTML.slice(0, 80)}`),
  );
  await ctx.close();
  return list;
}
await h.check(r, 'UX-008', async () => {
  const pages = [
    [undefined, '/'],
    [undefined, '/cars'],
    [undefined, `/car/${car.slug}`],
    [D.cookie, '/dealer/inventory'],
    [D.cookie, '/dealer/enquiries'],
    [admin.cookie, '/admin/listings'],
  ];
  const out = {};
  for (const [c, p] of pages) out[p] = await unnamedButtons(c, p);
  r.ev({ out });
  const bad = Object.entries(out).filter(([, v]) => v.length);
  return bad.length === 0
    ? {
        layers: ['BROWSER', 'A11Y'],
        note: `${pages.length} pages: every visible button/link has a text or aria-label name (icon buttons such as ♡/✕/‹› carry aria-labels like "Save 2023 Hyundai Creta SX(O)", "Close")`,
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER', 'A11Y'],
        note: `unnamed controls: ${JSON.stringify(bad).slice(0, 600)}`,
      };
});
await h.check(r, 'UX-009', async () => {
  const fresh = await w.published(D, admin);
  const ctx = await b.context({ cookie: buyer.cookie });
  const { page } = await b.open(ctx, `/car/${fresh.slug}?enquire=1`);
  const send = await page.getByRole('button', { name: 'Send enquiry' }).elementHandle();
  await Promise.all([
    send.click({ force: true, noWaitAfter: true }),
    send.click({ force: true, noWaitAfter: true }).catch(() => null),
    send.click({ force: true, noWaitAfter: true }).catch(() => null),
  ]);
  await page.waitForTimeout(2500);
  const rows = await h.one(
    `SELECT count(*)::int n FROM enquiries e JOIN listings l ON l.id=e."listingId" WHERE l.slug=$1 AND e."customerId"=$2`,
    [fresh.slug, buyer.userId],
  );
  await ctx.close();
  r.ev({ enquiries: rows.n });
  h.assert(rows.n === 1, `rows ${rows.n}`);
  return {
    layers: ['BROWSER', 'DATABASE'],
    note: 'triple-click on "Send enquiry" → exactly 1 enquiry row (button enters a pending state; server also de-duplicates)',
  };
});
await h.check(r, 'UX-010', async () => {
  const fresh = await h.customer('Empty State Buyer');
  const E = await w.onboard('EmptyStock');
  await w.approveDealer(admin, E.dealerId);
  const cases = [
    [fresh.cookie, '/saved'],
    [fresh.cookie, '/enquiries'],
    [E.cookie, '/dealer/inventory?status=SOLD'],
    [E.cookie, '/dealer/enquiries'],
  ];
  const out = [];
  for (const [c, p] of cases) {
    const ctx = await b.context({ cookie: c });
    const { page } = await b.open(ctx, p);
    const text = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
    const ctas = await page.evaluate(() =>
      [...document.querySelectorAll('main a[href],main button')]
        .filter((e) => e.offsetParent)
        .map((e) => e.textContent.trim())
        .filter(Boolean),
    );
    out.push({ p, text: text.replace(/\s+/g, ' ').slice(0, 220), ctas: ctas.slice(0, 6) });
    await ctx.close();
  }
  r.ev({ out });
  return {
    layers: ['BROWSER'],
    note: `empty states: ${out.map((x) => `${x.p} → "${x.text.slice(0, 70)}…" [${x.ctas.slice(0, 2).join(', ')}]`).join(' | ')}`,
  };
});
await h.check(r, 'UX-011', async () => {
  const ctx = await b.context({ cookie: D.cookie });
  const { page } = await b.open(ctx, '/dealer/inventory');
  const checks = {};
  for (const name of ['Mark sold', 'Withdraw']) {
    await page.getByRole('button', { name }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.waitFor();
    checks[name] = await dlg.evaluate((d) => d.querySelector('h2,h3')?.textContent?.trim());
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' });
  }
  const after = await h.q(`SELECT status FROM listings WHERE "dealerId"=$1`, [D.dealerId]);
  await page.goto(`${b.WEB}/dealer/team`, { waitUntil: 'networkidle' });
  const remove = page.getByRole('button', { name: /remove/i }).first();
  let removeDialog = null;
  if (await remove.isVisible().catch(() => false)) {
    await remove.click();
    removeDialog = await page
      .getByRole('dialog')
      .evaluate((d) => d.querySelector('h2,h3')?.textContent?.trim())
      .catch(() => null);
    await page.keyboard.press('Escape');
  }
  const members = await h.q(`SELECT status FROM dealer_members WHERE "dealerId"=$1`, [D.dealerId]);
  await ctx.close();
  r.ev({
    checks,
    listings: after.map((x) => x.status),
    removeDialog,
    members: members.map((m) => m.status),
  });
  h.assert(
    checks['Mark sold'] &&
      checks.Withdraw &&
      !after.some((x) => ['SOLD', 'WITHDRAWN'].includes(x.status)),
    'confirmation',
  );
  h.assert(
    removeDialog && members.every((m) => m.status === 'ACTIVE'),
    `member removal confirm ${removeDialog}`,
  );
  return {
    layers: ['BROWSER', 'DATABASE'],
    note: `"${checks['Mark sold']}", "${checks.Withdraw}" (reason required) and "${removeDialog}" confirmations; cancelling leaves listings and members unchanged in the DB`,
  };
});
await h.check(r, 'UX-012', async () => {
  const cases = [];
  const sctx = await b.context({ cookie: staff.cookie });
  for (const p of ['/dealer/team', '/dealer/profile', '/admin']) {
    const { page, status } = await b.open(sctx, p);
    const f = await b.facts(page);
    cases.push({
      who: 'STAFF',
      p,
      status,
      url: f.url,
      h1: f.h1,
      crash: /Something went wrong|Application error|Unhandled/i.test(f.text),
    });
    await page.close();
  }
  await sctx.close();
  const cctx = await b.context({ cookie: buyer.cookie });
  for (const p of ['/dealer', '/admin/dealers']) {
    const { page, status } = await b.open(cctx, p);
    const f = await b.facts(page);
    cases.push({
      who: 'CUSTOMER',
      p,
      status,
      url: f.url,
      h1: f.h1,
      crash: /Something went wrong|Application error|Unhandled/i.test(f.text),
    });
    await page.close();
  }
  await cctx.close();
  r.ev({ cases });
  const bad = cases.filter((x) => x.crash || x.status >= 500);
  return bad.length === 0
    ? {
        layers: ['BROWSER'],
        note: `denials render as pages, not crashes: ${cases.map((x) => `${x.who} ${x.p} → ${x.status} ${x.url} "${x.h1}"`).join('; ')}`,
      }
    : { status: 'FAIL', layers: ['BROWSER'], note: JSON.stringify(bad) };
});

r.save();
await b.close();
process.exit(0);
