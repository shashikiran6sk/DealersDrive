// BUG-NEW-010 end-to-end: warm a car page, suspend the dealership through the
// Admin console (the product path, a real server action), then ask for the car
// page again. Writes a sanitized summary JSON to CERT_RESULTS_DIR.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as b from '../../certification/harness/bkit.mjs';
import * as h from '../../certification/harness/lib.mjs';
import * as w from '../../certification/harness/world.mjs';

const label = process.env.PROBE_LABEL ?? 'run';
const admin = await h.admin('cert-admin@example.test');
const D = await w.onboard('CacheProbe');
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
const status = async (path) => (await fetch(`${b.WEB}${path}`, { redirect: 'manual' })).status;

const warm = [await status(`/car/${car.slug}`), await status(`/car/${car.slug}`)];
const dealerPageWarm = await status(`/dealers/${D.slug}`);

const ctx = await b.context({ cookie: admin.cookie });
const page = await ctx.newPage();
await page.goto(`${b.WEB}/admin/dealers/${D.dealerId}`, { waitUntil: 'networkidle' });
await page.fill('#suspendReason', 'Cache probe suspension for BUG-NEW-010');
await page.getByRole('button', { name: 'Suspend', exact: true }).click();
await page.getByText('Dealer suspended and their listings withdrawn.').waitFor({ timeout: 15000 });
await ctx.close();

const api = (await h.call('GET', `/v1/vehicles/${car.slug}`)).status;
const after = [await status(`/car/${car.slug}`), await status(`/car/${car.slug}`)];
await b.sleep(65000);
const after65 = [await status(`/car/${car.slug}`), await status(`/car/${car.slug}`)];
const dealerPageAfter = await status(`/dealers/${D.slug}`);

const summary = {
  label,
  path: 'Admin console Suspend button (server action)',
  warm,
  dealerPageWarm,
  apiAfterSuspend: api,
  carPageAfterSuspend: after,
  carPageAfter65s: after65,
  dealerPageAfterSuspend: dealerPageAfter,
  verdict: after.every((s) => s === 404) ? 'PASS' : 'FAIL',
};
console.log(JSON.stringify(summary, null, 2));
const dir = process.env.CERT_RESULTS_DIR ?? '.';
writeFileSync(resolve(dir, `probe-${label}.json`), JSON.stringify(summary, null, 2) + '\n');
await b.close();
process.exit(0);
