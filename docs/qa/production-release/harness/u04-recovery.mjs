// RECOVERY-002 / RECOVERY-003 / RECOVERY-009 in the browser. A web instance (CERT_WEB_PROXIED,
// default :3003) reaches the API only through a TCP proxy this script runs (:4010 → CERT_API),
// so the API can be made unreachable mid-journey and brought back, exactly as a dropped
// network or a crashed API task would look to the web tier.
import { createServer, connect } from 'node:net';

import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('recovery-browser');
const WEB = process.env.CERT_WEB_PROXIED ?? 'http://localhost:3003';
const PROXY_PORT = Number(process.env.CERT_PROXY_PORT ?? 4010);
const upstream = new URL(h.API);
let cut = false;
const sockets = new Set();
const proxy = createServer((client) => {
  if (cut) return client.destroy();
  const server = connect(Number(upstream.port), upstream.hostname);
  sockets.add(client).add(server);
  client.pipe(server).pipe(client);
  const close = () => {
    client.destroy();
    server.destroy();
    sockets.delete(client);
    sockets.delete(server);
  };
  client.on('error', close).on('close', close);
  server.on('error', close).on('close', close);
});
await new Promise((res) => proxy.listen(PROXY_PORT, '127.0.0.1', res));
const setCut = (value) => {
  cut = value;
  if (value) for (const s of sockets) s.destroy();
};

const admin = await h.admin();
const D = await w.onboard('RecoveryMotors');
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);

await h.check(r, 'RECOVERY-002', async () => {
  const vehicleId = await w.draft(D);
  const before = await h.one(`SELECT "kilometersDriven" AS km FROM vehicles WHERE id=$1`, [
    vehicleId,
  ]);
  const ctx = await b.context({ cookie: D.cookie });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/dealer/vehicles/${vehicleId}/edit?step=details`, {
    waitUntil: 'networkidle',
  });
  await page.locator('#kilometersDriven').fill('31313');
  setCut(true);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await b.sleep(4000);
  const textDown = await page.locator('main').innerText();
  const falseSuccess = /Draft saved/.test(textDown);
  const shownError = /could not be saved|try again|something went wrong|unavailable/i.test(
    textDown,
  );
  await b.shot(page, 'RECOVERY-002-save-while-api-down');
  const during = await h.one(`SELECT "kilometersDriven" AS km FROM vehicles WHERE id=$1`, [
    vehicleId,
  ]);
  setCut(false);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForLoadState('networkidle');
  await b.sleep(1500);
  const after = await h.one(`SELECT "kilometersDriven" AS km FROM vehicles WHERE id=$1`, [
    vehicleId,
  ]);
  const textUp = await page.locator('main').innerText();
  await ctx.close();
  r.ev({
    kmBefore: before.km,
    kmWhileDown: during.km,
    kmAfterRetry: after.km,
    falseSuccess,
    shownError,
    savedAfterRetry: /Draft saved/.test(textUp) || after.km === 31313,
  });
  return !falseSuccess && shownError && during.km === before.km && after.km === 31313
    ? {
        layers: ['BROWSER', 'RECOVERY', 'DATABASE'],
        note: 'Save draft with the API unreachable shows an error (no “Draft saved”), nothing is written; the same click after the API returns saves the edit',
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER', 'RECOVERY'],
        note: JSON.stringify({
          falseSuccess,
          shownError,
          before: before.km,
          during: during.km,
          after: after.km,
        }),
      };
});

await h.check(r, 'RECOVERY-003', async () => {
  const phone = b.freshPhone('91');
  const ctx = await b.context();
  const page = await ctx.newPage();
  await page.goto(`${WEB}/login?returnTo=${encodeURIComponent(`/car/${car.slug}?enquire=1`)}`, {
    waitUntil: 'networkidle',
  });
  const user = await h.customer('Recovery Buyer', phone);
  await ctx.addCookies([
    {
      name: 'dd_session',
      value: user.cookie.split('=')[1],
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(`${WEB}/car/${car.slug}?enquire=1`, { waitUntil: 'networkidle' });
  await page.locator('textarea[name=message]').fill('Recovery probe — is it available?');
  setCut(true);
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await b.sleep(4000);
  const textDown = await page.locator('main').innerText();
  const falseSuccess =
    /enquiry (has been )?sent|we.ve sent|sent to/i.test(textDown) &&
    !/could not|try again/i.test(textDown);
  await b.shot(page, 'RECOVERY-003-enquiry-while-api-down');
  const rowsDown = (
    await h.one(`SELECT count(*)::int n FROM enquiries WHERE "customerId"=$1`, [user.userId])
  ).n;
  setCut(false);
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.waitForLoadState('networkidle');
  await b.sleep(1500);
  await page
    .getByRole('button', { name: 'Send enquiry' })
    .click()
    .catch(() => null);
  await b.sleep(1500);
  const rowsUp = (
    await h.one(`SELECT count(*)::int n FROM enquiries WHERE "customerId"=$1`, [user.userId])
  ).n;
  await ctx.close();
  r.ev({ falseSuccess, rowsWhileDown: rowsDown, rowsAfterRetry: rowsUp });
  return !falseSuccess && rowsDown === 0 && rowsUp === 1
    ? {
        layers: ['BROWSER', 'RECOVERY', 'DATABASE'],
        note: 'Send enquiry with the API unreachable reports no success and writes nothing; retrying after recovery (twice) leaves exactly one enquiry',
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER', 'RECOVERY'],
        note: JSON.stringify({ falseSuccess, rowsDown, rowsUp }),
      };
});

await h.check(r, 'RECOVERY-009', async () => {
  const buyer = await h.customer('Refresh Buyer');
  const ctx = await b.context({ cookie: buyer.cookie });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/car/${car.slug}?enquire=1`, { waitUntil: 'networkidle' });
  await page
    .locator('textarea[name=message]')
    .fill('Typed, then the page was refreshed before sending.');
  await page.reload({ waitUntil: 'networkidle' });
  const rowsAfterRefresh = (
    await h.one(`SELECT count(*)::int n FROM enquiries WHERE "customerId"=$1`, [buyer.userId])
  ).n;
  const formBack = await page
    .locator('textarea[name=message]')
    .isVisible()
    .catch(() => false);
  const vehicleId = await w.draft(D);
  const dctx = await b.context({ cookie: D.cookie });
  const dp = await dctx.newPage();
  await dp.goto(`${WEB}/dealer/vehicles/${vehicleId}/edit?step=details`, {
    waitUntil: 'networkidle',
  });
  await dp.locator('#kilometersDriven').fill('42424');
  await dp.getByRole('button', { name: 'Save draft' }).click();
  await dp.waitForLoadState('networkidle');
  await b.sleep(1000);
  await dp.reload({ waitUntil: 'networkidle' });
  const kmShown = await dp
    .locator('#kilometersDriven')
    .inputValue()
    .catch(() => null);
  await ctx.close();
  await dctx.close();
  r.ev({
    enquiryRowsAfterRefresh: rowsAfterRefresh,
    enquiryFormAfterRefresh: formBack,
    draftKmAfterSaveAndRefresh: kmShown,
  });
  return rowsAfterRefresh === 0 && formBack && kmShown?.replace(/\D/g, '') === '42424'
    ? {
        layers: ['BROWSER', 'DATABASE'],
        note: 'refreshing a half-typed enquiry sends nothing and the form returns; a saved draft shows its saved value after refresh',
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER'],
        note: JSON.stringify({ rowsAfterRefresh, formBack, kmShown }),
      };
});

setCut(false);
r.save();
proxy.close();
for (const s of sockets) s.destroy();
await b.close();
await h.pool.end();
