// PR #235 independent media-visibility probe across suspension and reinstatement.
import * as h from './lib.mjs';
import * as w from './world.mjs';
const r = h.recorder('retest-235-media');
const admin = await h.admin();
const D = await w.onboard('R235Media');
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
const img = await h
  .one(
    `SELECT m.id FROM media m JOIN vehicle_images vi ON vi."mediaId"=m.id JOIN listings l ON l."vehicleId"=vi."vehicleId" WHERE l.id=$1 AND m.status='READY' LIMIT 1`,
    [car.listingId],
  )
  .catch(async () =>
    h.one(
      `SELECT m.id FROM media m WHERE m."dealerId"=$1 AND m."ownerType"='VEHICLE' AND m.status='READY' LIMIT 1`,
      [D.dealerId],
    ),
  );
const yard = await h.one(`SELECT "coverMediaId" AS id FROM dealers WHERE id=$1`, [D.dealerId]);
async function get(id) {
  const res = await fetch(`${h.API}/media/by-media/${id}/640.webp`);
  await res.arrayBuffer();
  return { status: res.status, cache: res.headers.get('cache-control') };
}
const s0 = { car: await get(img.id), yard: await get(yard.id) };
const sus = await admin.post(`/v1/admin/dealers/${D.dealerId}/suspend`, {
  reason: 'Media retest suspension',
});
const s1 = {
  car: await get(img.id),
  yard: await get(yard.id),
  carPage: (await h.call('GET', `/v1/vehicles/${car.slug}`)).status,
  dealerPage: (await h.call('GET', `/v1/dealers/${D.slug}`)).status,
};
const re = await admin.post(`/v1/admin/dealers/${D.dealerId}/reinstate`, {});
const s2 = { car: await get(img.id), yard: await get(yard.id) };
r.ev(sus, re, { before: s0, suspended: s1, reinstated: s2 });
await h.check(r, 'R235-vehicle-image-follows-dealer-status', async () => {
  h.assert(
    s0.car.status === 200 && s0.car.cache === 'no-store',
    `before ${JSON.stringify(s0.car)}`,
  );
  h.assert(
    sus.status === 200 && s1.car.status === 404 && s1.car.cache === 'no-store',
    `suspended ${JSON.stringify(s1.car)}`,
  );
  h.assert(re.status === 200 && s2.car.status === 200, `reinstated ${JSON.stringify(s2.car)}`);
  return {
    note: `vehicle image 200 → (suspend) 404 → (reinstate) 200, Cache-Control no-store throughout; car API ${s1.carPage}, dealer API ${s1.dealerPage} while suspended`,
  };
});
await h.check(r, 'R235-yard-photo-while-suspended (BUG-NEW-009, not in #235 scope)', async () =>
  s1.yard.status === 200
    ? {
        status: 'FAIL',
        note: `suspended dealer's yard photo still served 200 (dealer profile API ${s1.dealerPage}) — BUG-NEW-009 confirmed`,
      }
    : { note: `yard photo ${s1.yard.status} while suspended` },
);
r.save();
