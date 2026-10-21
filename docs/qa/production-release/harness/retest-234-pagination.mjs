// PR #234 independent pagination probe: rows forced to an identical createdAt.
import * as h from './lib.mjs';
import * as w from './world.mjs';
const r = h.recorder('retest-234-pagination');
const admin = await h.admin();
const D = await w.onboard('R234Pager');
await w.approveDealer(admin, D.dealerId);
const cars = [];
for (let i = 0; i < 5; i++) cars.push(await w.published(D, admin));
const cust = await h.customer('R234 Buyer');
for (const c of cars) await cust.put(`/v1/saved-vehicles/${c.slug}`);
for (const c of cars)
  await cust.post('/v1/enquiries', {
    listingSlug: c.slug,
    message: 'Is this car still available for a test drive?',
  });
const T = '2026-10-04 10:00:00.000';
await h.q(`UPDATE saved_vehicles SET "createdAt"=$1 WHERE "customerId"=$2`, [T, cust.userId]);
await h.q(`UPDATE enquiries SET "createdAt"=$1 WHERE "customerId"=$2`, [T, cust.userId]);
await h.q(`UPDATE vehicles SET "createdAt"=$1 WHERE "dealerId"=$2`, [T, D.dealerId]);
async function walk(actor, path) {
  const seen = [];
  let cursor = null;
  let pages = 0;
  do {
    const res = await actor.get(
      `${path}${path.includes('?') ? '&' : '?'}limit=2${cursor ? `&cursor=${cursor}` : ''}`,
    );
    if (res.status !== 200) return { error: `${res.status} ${res.json?.code}`, seen, pages };
    seen.push(...res.json.data.map((x) => x.id ?? x.vehicle?.slug ?? x.vehicle?.id));
    cursor = res.json.page?.nextCursor ?? null;
    pages++;
  } while (cursor && pages < 20);
  return { seen, pages, unique: new Set(seen).size };
}
for (const [id, actor, path, expect] of [
  ['R234-saved-ties', cust, '/v1/saved-vehicles', 5],
  ['R234-customer-enquiries-ties', cust, '/v1/enquiries', 5],
  ['R234-dealer-inbox-ties', D, '/v1/dealer/enquiries', 5],
  ['R234-dealer-inventory-ties (BUG-NEW-007, not in #234 scope)', D, '/v1/dealer/vehicles', 5],
]) {
  await h.check(r, id, async () => {
    const o = await walk(actor, path);
    r.ev({ path, ...o });
    if (o.error) throw new Error(o.error);
    if (o.seen.length === expect && o.unique === expect)
      return { note: `${expect} tied rows, ${o.pages} pages of 2, each seen once` };
    return {
      status: 'FAIL',
      note: `expected ${expect} tied rows; walked ${o.seen.length} (${o.unique} unique) in ${o.pages} pages`,
    };
  });
}
r.save();
