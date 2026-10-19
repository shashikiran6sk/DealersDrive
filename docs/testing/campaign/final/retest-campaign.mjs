// Re-verification on final main of every finding the fix campaign addressed,
// each by reproduction against a running deployment rather than by reading a
// PR. SEC-DISC-001 is probed against an S3-driver API (CERT_API_S3), because
// the local driver keeps its stand-ins by design and production refuses it.
import { createHmac } from 'node:crypto';

import * as b from '../../certification/harness/bkit.mjs';
import * as h from '../../certification/harness/lib.mjs';
import * as w from '../../certification/harness/world.mjs';

const r = h.recorder('retest-campaign');
const admin = await h.admin('cert-admin@example.test');
const S3_API = process.env.CERT_API_S3 ?? 'http://localhost:4005';
const DEFAULT_SECRET = 'dealers-drive-local-upload-secret';
const forge = (key, contentType, contentLength, expiresAt) =>
  createHmac('sha256', DEFAULT_SECRET)
    .update(`${key}\n${contentType}\n${contentLength}\n${expiresAt}`)
    .digest('hex');

await h.check(r, 'CAMPAIGN-01 ORIG-BUG-001 forged stand-in links behind an S3 driver', async () => {
  const expiresAt = Date.now() + 600_000;
  const body = Buffer.from('ATTACKER-CONTROLLED-BYTES');
  const key = 'dealers/victim/documents/PAN_CARD/forged';
  const put = await fetch(
    `${S3_API}/uploads?${new URLSearchParams({ key, contentType: 'image/jpeg', contentLength: String(body.length), expiresAt: String(expiresAt), signature: forge(key, 'image/jpeg', body.length, expiresAt) })}`,
    { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body },
  );
  const read = await fetch(
    `${S3_API}/private?${new URLSearchParams({ key, expiresAt: String(expiresAt), signature: forge(key, 'read', 0, expiresAt) })}`,
  );
  const health = await fetch(`${S3_API}/health/live`).catch(() => ({ status: 0 }));
  r.ev({ forgedPut: put.status, forgedRead: read.status, s3ApiHealth: health.status });
  return put.status === 404 && read.status === 404
    ? { note: `S3-driver API: forged PUT ${put.status}, forged read ${read.status} — stand-ins not mounted` }
    : { status: 'FAIL', note: `forged PUT ${put.status}, read ${read.status}` };
});

await h.check(r, 'CAMPAIGN-02 ORIG-BUG-004 verified KYC locked for an ACTIVE dealer', async () => {
  const D = await w.onboard('CampKyc');
  await w.approveDealer(admin, D.dealerId);
  const presign = await D.post('/v1/dealer/documents/presign', {
    type: 'PAN_CARD', fileName: 'swap.pdf', mimeType: 'application/pdf', bytes: w.PDF.length,
  });
  const del = await D.del('/v1/dealer/documents/GST_CERTIFICATE');
  const rows = await h.q(`SELECT status FROM dealer_documents WHERE "dealerId"=$1`, [D.dealerId]);
  r.ev({ presign: presign.status, code: presign.json?.code, delete: del.status, statuses: rows.map((x) => x.status) });
  return presign.status === 409 && del.status === 409 && rows.every((x) => x.status === 'VERIFIED')
    ? { note: 'presign 409 DOCUMENT_LOCKED, delete 409, all three still VERIFIED' }
    : { status: 'FAIL', note: JSON.stringify({ presign: presign.status, del: del.status }) };
});

await h.check(r, 'CAMPAIGN-03 BUG-NEW-010 warmed car page after Admin suspension (console)', async () => {
  const D = await w.onboard('CampCache');
  await w.approveDealer(admin, D.dealerId);
  const car = await w.published(D, admin);
  const status = async (p) => (await fetch(`${b.WEB}${p}`)).status;
  const warm = [await status(`/car/${car.slug}`), await status(`/car/${car.slug}`)];
  const ctx = await b.context({ cookie: admin.cookie });
  const page = await ctx.newPage();
  await page.goto(`${b.WEB}/admin/dealers/${D.dealerId}`, { waitUntil: 'networkidle' });
  await page.fill('#suspendReason', 'Final-pass suspension cache check');
  await page.getByRole('button', { name: 'Suspend', exact: true }).click();
  await page.getByText('Dealer suspended and their listings withdrawn.').waitFor({ timeout: 15000 });
  await ctx.close();
  const after = [await status(`/car/${car.slug}`), await status(`/car/${car.slug}`)];
  r.ev({ warm, after });
  return after.every((s) => s === 404)
    ? { layers: ['BROWSER', 'API'], note: `warm ${warm} → after console suspension ${after}` }
    : { status: 'FAIL', layers: ['BROWSER', 'API'], note: `after ${after}` };
});

await h.check(r, 'CAMPAIGN-05 ORIG-BUG-005 + BUG-NEW-009 yard photo locked and hidden while suspended', async () => {
  const D = await w.onboard('CampYard');
  await w.approveDealer(admin, D.dealerId);
  const cover = await h.one(`SELECT "coverMediaId" AS id FROM dealers WHERE id=$1`, [D.dealerId]);
  const presign = await D.post('/v1/dealer/yard-photo/presign', { fileName: 'y.jpg', mimeType: 'image/jpeg', bytes: 10 });
  const live = (await h.call('GET', `/media/by-media/${cover.id}/640.webp`)).status;
  await admin.post(`/v1/admin/dealers/${D.dealerId}/suspend`, { reason: 'Final-pass yard visibility' });
  const suspended = (await h.call('GET', `/media/by-media/${cover.id}/640.webp`)).status;
  r.ev({ presign: presign.status, live, suspended });
  return presign.status === 409 && live === 200 && suspended === 404
    ? { note: 'ACTIVE presign 409 YARD_PHOTO_LOCKED; cover 200 while ACTIVE, 404 while suspended' }
    : { status: 'FAIL', note: JSON.stringify({ presign: presign.status, live, suspended }) };
});

await h.check(r, 'CAMPAIGN-07 BUG-NEW-007 dealer inventory over tied timestamps', async () => {
  const D = await w.onboard('CampPage', { submit: false });
  for (let n = 0; n < 5; n += 1) await D.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await h.q(`UPDATE vehicles SET "createdAt"='2026-10-01T09:00:00.123Z' WHERE "dealerId"=$1`, [D.dealerId]);
  const seen = [];
  let cursor = null;
  for (let n = 0; n < 6; n += 1) {
    const page = await D.get(`/v1/dealer/vehicles?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
    seen.push(...page.json.data.map((x) => x.id));
    if (!page.json.page.hasMore) break;
    cursor = page.json.page.nextCursor;
  }
  r.ev({ visited: seen.length, unique: new Set(seen).size });
  return seen.length === 5 && new Set(seen).size === 5
    ? { note: '5 tied rows, pages of 2 → 5 unique' }
    : { status: 'FAIL', note: `visited ${seen.length}` };
});

await h.check(r, 'CAMPAIGN-09 ORIG-GAP-CLOSE close keeps the record and shuts the members out', async () => {
  const D = await w.onboard('CampClose');
  const close = await admin.post(`/v1/admin/dealers/${D.dealerId}/close`, { reason: 'Final-pass close check' });
  const after = await h.one(`SELECT status FROM dealers WHERE id=$1`, [D.dealerId]);
  const docs = await h.one(`SELECT count(*)::int AS n FROM dealer_documents WHERE "dealerId"=$1 AND status='UPLOADED'`, [D.dealerId]);
  const session = (await D.get('/v1/dealer')).status;
  const activeClose = await admin.post(`/v1/admin/dealers/${D.dealerId}/close`, { reason: 'Second close attempt' });
  r.ev({ close: close.status, after: after.status, docs: docs.n, session, secondClose: activeClose.status });
  return close.status === 200 && after.status === 'CLOSED' && docs.n === 3 && session === 401 && activeClose.status === 422
    ? { note: 'PENDING → CLOSED 200, 3 documents kept, member session 401, second close 422' }
    : { status: 'FAIL', note: JSON.stringify({ close: close.status, after: after.status, docs: docs.n, session }) };
});

r.save();
await b.close();
process.exit(0);
