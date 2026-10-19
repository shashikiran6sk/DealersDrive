// BUG-NEW-010 residual: suspend through the Admin API directly (no web action,
// so no tag revalidation) and poll the warmed car and dealer pages.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as b from '../../certification/harness/bkit.mjs';
import * as h from '../../certification/harness/lib.mjs';
import * as w from '../../certification/harness/world.mjs';

const label = process.env.PROBE_LABEL ?? 'run';
const capSeconds = Number(process.env.PROBE_CAP ?? 240);
const admin = await h.admin('cert-admin@example.test');
const D = await w.onboard('StaleProbe');
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
const status = async (p) => (await fetch(`${b.WEB}${p}`)).status;
const warm = { car: [await status(`/car/${car.slug}`), await status(`/car/${car.slug}`)], dealer: [await status(`/dealers/${D.slug}`), await status(`/dealers/${D.slug}`)] };
const sus = await admin.post(`/v1/admin/dealers/${D.dealerId}/suspend`, { reason: 'Out-of-band suspension probe' });
const api = (await h.call('GET', `/v1/vehicles/${car.slug}`)).status;
const t0 = Date.now();
const samples = [];
let carGoneAt = null;
let dealerGoneAt = null;
while ((Date.now() - t0) / 1000 < capSeconds && (carGoneAt === null || dealerGoneAt === null)) {
  const s = Math.round((Date.now() - t0) / 1000);
  const c = await status(`/car/${car.slug}`);
  const d = await status(`/dealers/${D.slug}`);
  samples.push({ s, car: c, dealer: d });
  if (c === 404 && carGoneAt === null) carGoneAt = s;
  if (d === 404 && dealerGoneAt === null) dealerGoneAt = s;
  await b.sleep(10_000);
}
const summary = { label, path: 'POST /v1/admin/dealers/:id/suspend (direct API)', suspend: sus.status, api, warm, carGoneAfterSeconds: carGoneAt, dealerGoneAfterSeconds: dealerGoneAt, capSeconds, samples };
console.log(JSON.stringify({ ...summary, samples: samples.length }, null, 1));
writeFileSync(resolve(process.env.CERT_RESULTS_DIR ?? '.', `probe-${label}.json`), JSON.stringify(summary, null, 2) + '\n');
await b.close();
process.exit(0);
