// BUG-NEW-010 (console path, #243) regression: after an Admin suspends a dealer through the
// admin console, how soon does a warmed public car page and dealer page stop being served?
import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('console-suspension');
const admin = await h.admin();
const LIMIT_S = Number(process.env.CERT_CONSOLE_LIMIT_S ?? 120);

await h.check(r, 'BUG-NEW-010-console-timing', async () => {
  const D = await w.onboard('ConsoleSusp');
  await w.approveDealer(admin, D.dealerId);
  const car = await w.published(D, admin);
  // A page counts as gone when it no longer serves the listing/dealer: HTTP 404, or a
  // not-found document (the soft-404 of BUG-101) whose <title> is the not-found title.
  const status = async (p) => {
    const res = await fetch(`${b.WEB}${p}`, { redirect: 'manual' });
    const html = await res.text();
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
    return res.status === 404 || /not found/i.test(title) ? 404 : res.status;
  };
  const httpStatus = async (p) => (await fetch(`${b.WEB}${p}`, { redirect: 'manual' })).status;
  const warm = [
    await status(`/car/${car.slug}`),
    await status(`/car/${car.slug}`),
    await status(`/dealers/${D.slug}`),
  ];
  const ctx = await b.context({ cookie: admin.cookie });
  const page = await ctx.newPage();
  await page.goto(`${b.WEB}/admin/dealers/${D.dealerId}`, { waitUntil: 'networkidle' });
  await page.fill('#suspendReason', 'Console suspension cache timing probe');
  await page.getByRole('button', { name: 'Suspend', exact: true }).click();
  await page
    .getByText('Dealer suspended and their listings withdrawn.')
    .waitFor({ timeout: 15000 });
  await b.shot(page, 'console-suspension-confirmed');
  await ctx.close();
  const t0 = Date.now();
  const dealerRow = await h.one(`SELECT status FROM dealers WHERE id=$1`, [D.dealerId]);
  const api = (await h.call('GET', `/v1/vehicles/${car.slug}`)).status;
  const samples = [];
  let carGone = null;
  let dealerGone = null;
  while ((carGone === null || dealerGone === null) && Date.now() - t0 < LIMIT_S * 1000) {
    const c = await status(`/car/${car.slug}`);
    const d = await status(`/dealers/${D.slug}`);
    const s = Math.round((Date.now() - t0) / 100) / 10;
    samples.push(`${s}s car ${c} dealer ${d}`);
    if (carGone === null && c === 404) carGone = s;
    if (dealerGone === null && d === 404) dealerGone = s;
    await b.sleep(1000);
  }
  r.ev({
    carHttpStatusAfter: await httpStatus(`/car/${car.slug}`),
    warm,
    dealerStatus: dealerRow.status,
    api,
    carGoneAfterS: carGone,
    dealerGoneAfterS: dealerGone,
    firstSamples: samples.slice(0, 6),
    lastSample: samples.at(-1),
  });
  const note = `console suspension (DB ${dealerRow.status}, API ${api}); warmed car page 404 after ${carGone ?? `>${LIMIT_S}`} s, dealer page after ${dealerGone ?? `>${LIMIT_S}`} s; first samples ${samples.slice(0, 3).join(' | ')}`;
  const immediate = carGone !== null && carGone <= 2 && dealerGone !== null && dealerGone <= 2;
  return immediate
    ? { layers: ['BROWSER', 'API'], note }
    : { status: 'FAIL', layers: ['BROWSER', 'API'], note };
});
r.save();
await b.close();
await h.pool.end();
