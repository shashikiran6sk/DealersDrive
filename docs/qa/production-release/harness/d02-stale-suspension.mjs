// BUG-NEW-010 regression timing: how long a warmed car page and dealer page stay public
// after an out-of-band (API-direct) dealer suspension. The console path revalidates at
// once (#243); the out-of-band path relies on the page dropping out of the cache (#251).
import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('stale-suspension');
const admin = await h.admin();
const LIMIT_S = Number(process.env.CERT_STALE_LIMIT_S ?? 600);

await h.check(r, 'BUG-NEW-010-timing', async () => {
  const D = await w.onboard('StaleTiming');
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
    await status(`/dealers/${D.slug}`),
  ];
  const t0 = Date.now();
  const sus = await admin.post(`/v1/admin/dealers/${D.dealerId}/suspend`, {
    reason: 'Stale page timing probe',
  });
  const api = (await h.call('GET', `/v1/vehicles/${car.slug}`)).status;
  const samples = [];
  let carGone = null;
  let dealerGone = null;
  while ((carGone === null || dealerGone === null) && Date.now() - t0 < LIMIT_S * 1000) {
    const c = await status(`/car/${car.slug}`);
    const d = await status(`/dealers/${D.slug}`);
    const s = Math.round((Date.now() - t0) / 1000);
    samples.push(`${s}s car ${c} dealer ${d}`);
    if (carGone === null && c === 404) carGone = s;
    if (dealerGone === null && d === 404) dealerGone = s;
    await b.sleep(10000);
  }
  r.ev({
    carHttpStatusAfter: await httpStatus(`/car/${car.slug}`),
    warm,
    suspend: sus.status,
    api,
    carGoneAfterS: carGone,
    dealerGoneAfterS: dealerGone,
    samples: samples.filter((_, i) => i % 3 === 0 || i === samples.length - 1),
  });
  const note = `API ${api} at once; warmed car page 404 after ${carGone ?? `>${LIMIT_S}`} s, dealer page after ${dealerGone ?? `>${LIMIT_S}`} s (out-of-band suspension; console path is immediate, #243)`;
  if (carGone === null || dealerGone === null)
    return { status: 'FAIL', layers: ['BROWSER', 'API'], note };
  return { layers: ['BROWSER', 'API'], note };
});
r.save();
await b.close();
await h.pool.end();
