// Agent UAT walk-through: journeys driven the way a person drives them — taps, typing,
// scrolling, refresh, Back/Forward, a second tab, a double tap, invalid input — at phone,
// tablet and desktop sizes. Every step is screenshotted and its observable facts recorded;
// the screenshots are then reviewed by eye and the review is written into AGENT-UAT.md.
import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('agent-uat');
const admin = await h.admin();
const log = [];
async function step(page, journey, name, fn) {
  const t = Date.now();
  let outcome = 'ok';
  let detail = '';
  try {
    detail = (await fn()) ?? '';
  } catch (error) {
    outcome = 'error';
    detail = String(error.message).split('\n')[0].slice(0, 200);
  }
  const shot = await b
    .shot(page, `UAT-${journey}-${String(log.length + 1).padStart(2, '0')}-${name}`)
    .catch(() => null);
  const overflow = await page
    .evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    .catch(() => null);
  log.push({ journey, step: name, outcome, detail, ms: Date.now() - t, overflow, shot });
  console.log(`${outcome === 'ok' ? '✓' : '✗'} ${journey} ${name} ${detail}`.slice(0, 220));
}

// ─── fixture: one live dealership with three cars, one reserved ─────────────────
const D = await w.onboard('UatMotors');
await w.approveDealer(admin, D.dealerId);
const cars = [];
for (const [i, details] of [
  { ...w.COMPLETE_VEHICLE, make: 'Hyundai', model: 'Creta', variant: 'SX(O)' },
  {
    ...w.COMPLETE_VEHICLE,
    make: 'Tata',
    model: 'Nexon',
    variant: 'XZ+',
    fuelType: 'DIESEL',
    pricePaise: 95000000,
  },
  {
    ...w.COMPLETE_VEHICLE,
    make: 'Maruti Suzuki',
    model: 'Swift',
    variant: 'ZXi',
    bodyType: 'HATCHBACK',
    pricePaise: 62000000,
    transmission: 'MANUAL',
  },
].entries()) {
  cars.push(await w.published(D, admin, { ...details, description: `UAT fixture car ${i + 1}` }));
}
await D.post(`/v1/dealer/vehicles/${cars[2].vehicleId}/reserve`);
const staff = await w.addMember(D, 'STAFF', 'Uat Staff');

// ─── A · phone (390×844, touch): discover → car → gallery → save → sign in → enquire ───
{
  const ctx = await b.context({ viewport: b.VIEWPORTS.mobile, mobile: true });
  const page = await ctx.newPage();
  await step(page, 'A-mobile-buyer', 'home', async () => {
    await page.goto(`${b.WEB}/`, { waitUntil: 'networkidle' });
    return `h1 "${await page.locator('h1').first().textContent()}"`;
  });
  await step(page, 'A-mobile-buyer', 'search-creta', async () => {
    const box = page.getByRole('combobox').or(page.getByRole('searchbox')).first();
    await box.tap();
    await box.fill('Creta');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/cars/);
    await page.waitForLoadState('networkidle');
    return page.url().replace(b.WEB, '');
  });
  await step(page, 'A-mobile-buyer', 'filters-sheet', async () => {
    await page
      .getByRole('button', { name: /filters/i })
      .first()
      .tap();
    await b.sleep(500);
    const dialog = page.getByRole('dialog');
    return `filters dialog visible ${await dialog.isVisible().catch(() => false)}`;
  });
  await step(page, 'A-mobile-buyer', 'filters-close', async () => {
    await page.keyboard.press('Escape');
    await b.sleep(300);
    return `dialog closed ${!(await page
      .getByRole('dialog')
      .isVisible()
      .catch(() => false))}`;
  });
  await step(page, 'A-mobile-buyer', 'open-car', async () => {
    await page.goto(`${b.WEB}/car/${cars[0].slug}`, { waitUntil: 'networkidle' });
    return `title "${await page.title()}"`;
  });
  await step(page, 'A-mobile-buyer', 'gallery-swipe', async () => {
    const img = page.locator('main img').first();
    const box = await img.boundingBox();
    const before = await page
      .locator('main')
      .innerText()
      .then((t) => t.match(/\d+\s*\/\s*\d+/)?.[0] ?? null);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2).catch(() => null);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await b.sleep(500);
    const after = await page
      .locator('main')
      .innerText()
      .then((t) => t.match(/\d+\s*\/\s*\d+/)?.[0] ?? null);
    return `counter ${before} → ${after}`;
  });
  await step(page, 'A-mobile-buyer', 'gallery-fullscreen', async () => {
    const open = page
      .getByRole('button', { name: /full ?screen|view all|enlarge|open photo|photo 1/i })
      .first();
    if (await open.count()) await open.tap();
    else await page.locator('main img').first().tap();
    await b.sleep(600);
    const dlg = page.getByRole('dialog');
    const visible = await dlg.isVisible().catch(() => false);
    if (visible) await page.keyboard.press('Escape');
    return `lightbox ${visible ? 'opened and closed with Escape' : 'not opened by tap'}`;
  });
  await step(page, 'A-mobile-buyer', 'save-anonymous', async () => {
    await page
      .getByRole('button', { name: /^save /i })
      .first()
      .tap();
    await page.waitForURL(/\/login/, { timeout: 8000 });
    return `redirected to ${new URL(page.url()).pathname}${new URL(page.url()).search.slice(0, 60)}`;
  });
  const phone = b.freshPhone('93');
  await step(page, 'A-mobile-buyer', 'otp-sign-up', async () => {
    await b.uiLogin(page, {
      phone,
      name: 'Uat Buyer',
      returnTo: new URL(page.url()).searchParams.get('returnTo') ?? '/',
    });
    return `back on ${new URL(page.url()).pathname}`;
  });
  await step(page, 'A-mobile-buyer', 'saved-after-login', async () => {
    const user = await h.one(`SELECT id FROM users WHERE phone=$1`, [phone]);
    const saved = await h.one(`SELECT count(*)::int n FROM saved_vehicles WHERE "customerId"=$1`, [
      user.id,
    ]);
    return `saved rows ${saved.n}`;
  });
  await step(page, 'A-mobile-buyer', 'enquire-dialog', async () => {
    await page.goto(`${b.WEB}/car/${cars[0].slug}`, { waitUntil: 'networkidle' });
    await page
      .getByRole('button', { name: /enquire/i })
      .first()
      .tap();
    await b.sleep(500);
    const msg = page.locator('textarea[name=message]');
    await msg.tap();
    await msg.fill('Is the car available this weekend for a test drive?');
    return `message field visible ${await msg.isVisible()}`;
  });
  await step(page, 'A-mobile-buyer', 'enquire-double-tap', async () => {
    const send = page.getByRole('button', { name: 'Send enquiry' });
    await Promise.all([send.tap(), send.tap().catch(() => null)]);
    await page.waitForLoadState('networkidle');
    await b.sleep(800);
    const user = await h.one(`SELECT id FROM users WHERE phone=$1`, [phone]);
    const n = await h.one(`SELECT count(*)::int n FROM enquiries WHERE "customerId"=$1`, [user.id]);
    return `enquiry rows after a double tap: ${n.n}`;
  });
  await step(page, 'A-mobile-buyer', 'my-enquiries', async () => {
    await page.goto(`${b.WEB}/enquiries`, { waitUntil: 'networkidle' });
    return `lists the Creta ${(await page.getByText(/Creta/).count()) > 0}`;
  });
  await step(page, 'A-mobile-buyer', 'reserved-card', async () => {
    await page.goto(`${b.WEB}/dealers/${D.slug}`, { waitUntil: 'networkidle' });
    const reserved = await page.getByText(/reserved/i).count();
    return `reserved badge(s) on the dealer page ${reserved}`;
  });
  await step(page, 'A-mobile-buyer', 'back-forward', async () => {
    // History traversal inside the app is client-side: wait for the URL, not a network lull.
    await page.goBack({ waitUntil: 'commit' });
    await page.waitForURL(/\/enquiries/, { timeout: 15000 });
    const back = new URL(page.url()).pathname;
    await page.goForward({ waitUntil: 'commit' });
    await page.waitForURL(/\/dealers\//, { timeout: 15000 });
    return `back → ${back}, forward → ${new URL(page.url()).pathname}`;
  });
  await ctx.close();
}

// ─── B · phone: invalid input and recovery ─────────────────────────────────────
{
  const ctx = await b.context({ viewport: b.VIEWPORTS.mobile, mobile: true });
  const page = await ctx.newPage();
  await step(page, 'B-mobile-invalid', 'login-short-number', async () => {
    await page.goto(`${b.WEB}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[name=phone]:visible').first().fill('98765');
    await page.getByRole('button', { name: 'Send OTP' }).first().tap();
    await b.sleep(400);
    const err = await page.locator('[aria-invalid=true]').count();
    return `aria-invalid fields ${err}; message "${(
      await page
        .getByText(/10-digit/)
        .first()
        .textContent()
        .catch(() => '')
    )?.trim()}"`;
  });
  await step(page, 'B-mobile-invalid', 'unknown-car-url', async () => {
    const res = await page.goto(`${b.WEB}/car/a-car-that-never-existed`, {
      waitUntil: 'networkidle',
    });
    return `HTTP ${res.status()} title "${await page.title()}" h1 "${await page
      .locator('h1')
      .first()
      .textContent()
      .catch(() => '')}"`;
  });
  await step(page, 'B-mobile-invalid', 'refresh-on-filtered-search', async () => {
    await page.goto(`${b.WEB}/cars?fuel=diesel&sort=price_asc`, { waitUntil: 'networkidle' });
    const before = page.url();
    await page.reload({ waitUntil: 'networkidle' });
    return `URL kept ${before === page.url()}`;
  });
  await ctx.close();
}

// ─── C · dealer on a phone: OWNER and STAFF ─────────────────────────────────────
{
  const ctx = await b.context({ viewport: b.VIEWPORTS.mobile, mobile: true, cookie: D.cookie });
  const page = await ctx.newPage();
  for (const path of [
    '/dealer',
    '/dealer/inventory',
    '/dealer/enquiries',
    '/dealer/team',
    '/dealer/profile',
    '/dealer/documents',
  ]) {
    await step(page, 'C-mobile-owner', path.replace(/\//g, '_'), async () => {
      const res = await page.goto(`${b.WEB}${path}`, { waitUntil: 'networkidle' });
      return `HTTP ${res.status()} → ${new URL(page.url()).pathname} h1 "${(
        await page
          .locator('h1')
          .first()
          .textContent()
          .catch(() => '')
      )?.trim()}"`;
    });
  }
  await step(page, 'C-mobile-owner', 'nav-drawer', async () => {
    await page.goto(`${b.WEB}/dealer`, { waitUntil: 'networkidle' });
    const menu = page.getByRole('button', { name: /menu|navigation/i }).first();
    if (await menu.count()) await menu.tap();
    await b.sleep(500);
    return `drawer/dialog open ${await page
      .getByRole('dialog')
      .isVisible()
      .catch(() => false)}`;
  });
  await ctx.close();
  const sctx = await b.context({
    viewport: b.VIEWPORTS.mobile,
    mobile: true,
    cookie: staff.cookie,
  });
  const sp = await sctx.newPage();
  await step(sp, 'C-mobile-staff', 'switch-to-dealer', async () => {
    await sp.goto(`${b.WEB}/dealer`, { waitUntil: 'networkidle' });
    return `→ ${new URL(sp.url()).pathname} h1 "${(
      await sp
        .locator('h1')
        .first()
        .textContent()
        .catch(() => '')
    )?.trim()}"`;
  });
  await step(sp, 'C-mobile-staff', 'team-denied', async () => {
    await sp.goto(`${b.WEB}/dealer/team`, { waitUntil: 'networkidle' });
    return `→ ${new URL(sp.url()).pathname}; Invite buttons ${await sp.getByRole('button', { name: /invite/i }).count()}`;
  });
  await sctx.close();
}

// ─── D · admin at tablet and phone sizes ───────────────────────────────────────
for (const [label, viewport] of [
  ['tablet', b.VIEWPORTS.tablet],
  ['mobile', b.VIEWPORTS.mobile],
]) {
  const ctx = await b.context({ viewport, cookie: admin.cookie, mobile: label === 'mobile' });
  const page = await ctx.newPage();
  for (const path of [
    '/admin',
    '/admin/dealers',
    `/admin/dealers/${D.dealerId}`,
    '/admin/listings',
    '/admin/enquiries',
    '/admin/support',
    '/admin/members',
  ]) {
    await step(page, `D-admin-${label}`, path.replace(/\//g, '_').slice(0, 40), async () => {
      const res = await page.goto(`${b.WEB}${path}`, { waitUntil: 'networkidle' });
      return `HTTP ${res.status()} h1 "${(
        await page
          .locator('h1')
          .first()
          .textContent()
          .catch(() => '')
      )?.trim()}"`;
    });
  }
  await ctx.close();
}

// ─── E · desktop: a second tab, and a session ended elsewhere ──────────────────
{
  const buyer = await h.customer('Uat Tabs');
  const ctx = await b.context({ cookie: buyer.cookie });
  const one = await ctx.newPage();
  const two = await ctx.newPage();
  await step(one, 'E-desktop-tabs', 'tab-one-saved', async () => {
    await one.goto(`${b.WEB}/saved`, { waitUntil: 'networkidle' });
    return `h1 "${(await one.locator('h1').first().textContent())?.trim()}"`;
  });
  await step(two, 'E-desktop-tabs', 'tab-two-enquiries', async () => {
    await two.goto(`${b.WEB}/enquiries`, { waitUntil: 'networkidle' });
    return `h1 "${(await two.locator('h1').first().textContent())?.trim()}"`;
  });
  await step(one, 'E-desktop-tabs', 'logout-tab-one', async () => {
    await one.getByRole('button', { name: /account menu/i }).click();
    await one.getByRole('menuitem', { name: 'Logout' }).click();
    await one.waitForLoadState('networkidle');
    return `tab one → ${new URL(one.url()).pathname}`;
  });
  await step(two, 'E-desktop-tabs', 'tab-two-next-navigation', async () => {
    await two.goto(`${b.WEB}/enquiries`, { waitUntil: 'networkidle' });
    return `tab two → ${new URL(two.url()).pathname} h1 "${(
      await two
        .locator('h1')
        .first()
        .textContent()
        .catch(() => '')
    )?.trim()}"`;
  });
  await ctx.close();
}

r.ev({
  steps: log.length,
  errors: log.filter((x) => x.outcome !== 'ok').length,
  overflowing: log
    .filter((x) => (x.overflow ?? 0) > 0)
    .map((x) => `${x.journey}/${x.step} +${x.overflow}px`),
});
const { writeFileSync, mkdirSync } = await import('node:fs');
const { resolve } = await import('node:path');
mkdirSync(resolve(h.CERT, 'EVIDENCE', 'agent-uat'), { recursive: true });
writeFileSync(
  resolve(h.CERT, 'EVIDENCE', 'agent-uat', 'steps.json'),
  `${JSON.stringify(log, null, 2)}\n`,
);
r.save();
await b.close();
await h.pool.end();
