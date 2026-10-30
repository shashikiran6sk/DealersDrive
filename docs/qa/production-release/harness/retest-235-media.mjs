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
// #289/#299: the yard cover is optional; an approved portfolio photograph is the dealer image.
const yardBytes = await w.jpeg(41, 1200, 900);
const yp = await D.post('/v1/dealer/portfolio/presign', {
  fileName: 'yard.jpg',
  mimeType: 'image/jpeg',
  bytes: yardBytes.length,
});
await w.upload(yp.json, yardBytes, 'image/jpeg');
await D.post('/v1/dealer/portfolio/commit', { mediaId: yp.json.mediaId });
const photo = await h.one(`SELECT id FROM dealer_portfolio_photos WHERE "mediaId"=$1`, [
  yp.json.mediaId,
]);
await admin.post(`/v1/admin/portfolio/${photo.id}/approve`, {});
const yard = { id: yp.json.mediaId };
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
    // R108 (#266): a served public image is `no-cache` + ETag; a denial stays `no-store`.
    s0.car.status === 200 && s0.car.cache === 'no-cache',
    `before ${JSON.stringify(s0.car)}`,
  );
  h.assert(
    sus.status === 200 && s1.car.status === 404 && s1.car.cache === 'no-store',
    `suspended ${JSON.stringify(s1.car)}`,
  );
  h.assert(re.status === 200 && s2.car.status === 200, `reinstated ${JSON.stringify(s2.car)}`);
  return {
    note: `vehicle image 200 no-cache → (suspend) 404 no-store → (reinstate) 200; car API ${s1.carPage}, dealer API ${s1.dealerPage} while suspended`,
  };
});
await h.check(r, 'R235-yard-photo-while-suspended (BUG-NEW-009, not in #235 scope)', async () =>
  s0.yard.status !== 200
    ? {
        status: 'FAIL',
        note: `approved portfolio photo not served before suspension (${s0.yard.status})`,
      }
    : s1.yard.status === 200
      ? {
          status: 'FAIL',
          note: `suspended dealer's yard photo still served 200 (dealer profile API ${s1.dealerPage}) — BUG-NEW-009 confirmed`,
        }
      : { note: `yard photo ${s1.yard.status} while suspended` },
);
r.save();
