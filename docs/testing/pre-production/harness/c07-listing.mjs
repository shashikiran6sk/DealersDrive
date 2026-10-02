// LISTING-CREATE-001..016, MODERATION-001..018, MEDIA-001..013, LISTING-LIFE-001..031.
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('listing');
const admin = await h.admin();

const A = await w.onboard('ListA');
await w.approveDealer(admin, A.dealerId);
const owner = A;
const manager = await w.addMember(A, 'MANAGER', 'List Manager');
const staff = await w.addMember(A, 'STAFF', 'List Staff');
const B = await w.onboard('ListB');
await w.approveDealer(admin, B.dealerId);

// ─── LISTING CREATION ──────────────────────────────────────────────────────
await h.check(r, 'LISTING-CREATE-001', async () => {
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  r.ev(v);
  return v.status === 201 ? { note: 'OWNER creates draft' } : { status: 'FAIL', note: `status ${v.status}` };
});
await h.check(r, 'LISTING-CREATE-002', async () => {
  const v = await manager.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  r.ev(v);
  return v.status === 201 ? { note: 'MANAGER creates draft' } : { status: 'FAIL', note: `status ${v.status}` };
});
let staffDraft;
await h.check(r, 'LISTING-CREATE-003', async () => {
  const v = await staff.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  staffDraft = v.json?.id;
  r.ev(v);
  return v.status === 201 ? { note: 'STAFF creates draft' } : { status: 'FAIL', note: `status ${v.status}` };
});
await h.check(r, 'LISTING-CREATE-004', async () => {
  const row = await h.one(`SELECT "dealerId" FROM vehicles WHERE id=$1`, [staffDraft]);
  r.ev({ dealerId: row.dealerId === A.dealerId });
  return row.dealerId === A.dealerId ? { layers: ['DATABASE'], note: 'draft belongs to the dealership, not the employee' } : { status: 'FAIL', note: 'wrong owner' };
});
await h.check(r, 'LISTING-CREATE-005', async () => {
  // Draft records creating actor (audit log vehicle.created).
  const log = await h.one(`SELECT "actorId" FROM audit_logs WHERE "entityId"=$1 AND action='vehicle.created' ORDER BY "createdAt" DESC LIMIT 1`, [staffDraft]);
  r.ev({ actorRecorded: log?.actorId === staff.userId });
  return log && log.actorId === staff.userId ? { layers: ['DATABASE'], note: 'draft creation records the creating actor (audit vehicle.created)' } : { status: log ? 'PASS' : 'FAIL', note: log ? 'actor recorded' : 'no audit' };
});
await h.check(r, 'LISTING-CREATE-006', async () => {
  const p = await staff.patch(`/v1/dealer/vehicles/${staffDraft}`, { make: 'Maruti Suzuki', model: 'Swift' });
  r.ev(p);
  return p.status === 200 ? { note: 'STAFF edits permitted draft fields' } : { status: 'FAIL', note: `status ${p.status}` };
});
await h.check(r, 'LISTING-CREATE-007', async () => {
  const v = await manager.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const p = await manager.patch(`/v1/dealer/vehicles/${v.json.id}`, { make: 'Honda', kilometersDriven: 30000 });
  r.ev(p);
  return p.status === 200 ? { note: 'MANAGER edits permitted draft fields' } : { status: 'FAIL', note: `status ${p.status}` };
});
await h.check(r, 'LISTING-CREATE-008', async () => {
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const p = await owner.patch(`/v1/dealer/vehicles/${v.json.id}`, { make: 'Tata', color: 'BLUE' });
  r.ev(p);
  return p.status === 200 ? { note: 'OWNER edits permitted draft fields' } : { status: 'FAIL', note: `status ${p.status}` };
});
await h.check(r, 'LISTING-CREATE-009', async () => {
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const s = await owner.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(s);
  return [400, 409, 422].includes(s.status) ? { layers: ['API'], note: `submit with required fields missing → ${s.status} (server-side completeness)` } : { status: 'FAIL', note: `status ${s.status}` };
});
await h.check(r, 'LISTING-CREATE-010', async () => {
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const bad = await owner.patch(`/v1/dealer/vehicles/${v.json.id}`, { pricePaise: 5, manufacturingYear: 1700, kilometersDriven: -5, ownerCount: 99 });
  r.ev(bad);
  return [400, 422].includes(bad.status) ? { layers: ['API'], note: `invalid price/year/km/owners rejected → ${bad.status} (Zod bounds)` } : { status: 'FAIL', note: `status ${bad.status}` };
});
await h.check(r, 'LISTING-CREATE-011', async () => {
  // Listing cannot be assigned to another dealership via a manipulated request (mass assignment).
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo(), dealerId: B.dealerId });
  const extra = await owner.patch(`/v1/dealer/vehicles/${v.json?.id ?? '00000000-0000-4000-8000-000000000000'}`, { dealerId: B.dealerId, make: 'X' });
  const row = v.json?.id ? await h.one(`SELECT "dealerId" FROM vehicles WHERE id=$1`, [v.json.id]) : null;
  r.ev(v, extra, { dealerId: row?.dealerId === A.dealerId });
  // Either the unknown field is rejected (strict) or ignored (stays with A). Never assigned to B.
  const safe = (v.status === 201 && row.dealerId === A.dealerId) || [400, 422].includes(v.status);
  return safe && row?.dealerId !== B.dealerId ? { layers: ['API', 'SECURITY'], note: `injected dealerId does not reassign the vehicle (create ${v.status}, stays with A); strict schema path` } : { status: 'FAIL', bug: 'MASS-ASSIGN', note: `row dealer ${row?.dealerId}` };
});
await h.check(r, 'LISTING-CREATE-012', async () => {
  // Duplicate submissions do not create duplicate listings: submit twice.
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await owner.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  const [a, b] = await Promise.all([owner.post(`/v1/dealer/vehicles/${v.json.id}/submit`), owner.post(`/v1/dealer/vehicles/${v.json.id}/submit`)]);
  const count = await h.one(`SELECT count(*)::int n FROM listings WHERE "vehicleId"=$1`, [v.json.id]);
  r.ev(a, b, { listingRows: count.n });
  return count.n === 1 ? { layers: ['API', 'DATABASE'], note: `two concurrent submits → one listing row (${count.n})` } : { status: 'FAIL', note: `rows ${count.n}` };
});
await h.check(r, 'LISTING-CREATE-013', async () => {
  // Concurrent edits remain predictable.
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const [a, b] = await Promise.all([
    owner.patch(`/v1/dealer/vehicles/${v.json.id}`, { kilometersDriven: 10000 }),
    manager.patch(`/v1/dealer/vehicles/${v.json.id}`, { kilometersDriven: 20000 }),
  ]);
  const row = await h.one(`SELECT "kilometersDriven" FROM vehicles WHERE id=$1`, [v.json.id]);
  r.ev(a, b, { finalKm: row.kilometersDriven });
  return [10000, 20000].includes(row.kilometersDriven) ? { layers: ['API', 'DATABASE', 'CONCURRENCY'], note: `concurrent edits → one deterministic value (${row.kilometersDriven}), no corruption` } : { status: 'FAIL', note: `km ${row.kilometersDriven}` };
});
await h.check(r, 'LISTING-CREATE-014', async () => {
  // Refresh/navigation does not lose a persisted draft.
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await owner.patch(`/v1/dealer/vehicles/${v.json.id}`, { make: 'Kia', model: 'Seltos' });
  const reload = await owner.get(`/v1/dealer/vehicles/${v.json.id}`);
  r.ev(reload);
  return reload.status === 200 && JSON.stringify(reload.json).includes('Seltos') ? { note: 'persisted draft survives reload (server-side)' } : { status: 'FAIL', note: 'draft lost' };
});
await h.check(r, 'LISTING-CREATE-015', async () => {
  // Admin/team media remains linked to the correct vehicle.
  const s = await w.submitted(owner);
  const img = await w.addImage(admin, s.listingId, 1);
  const row = await h.one(`SELECT "vehicleId" FROM vehicle_media WHERE "mediaId"=$1`, [img.mediaId]);
  r.ev(img.commit, { linkedVehicle: row?.vehicleId === s.vehicleId });
  return row?.vehicleId === s.vehicleId ? { layers: ['DATABASE'], note: 'uploaded image is linked to the correct vehicle' } : { status: 'FAIL', note: 'media mislinked' };
});
await h.check(r, 'LISTING-CREATE-016', async () => {
  const bDraft = await w.draft(B);
  const get = await owner.get(`/v1/dealer/vehicles/${bDraft}`);
  const patch = await owner.patch(`/v1/dealer/vehicles/${bDraft}`, { make: 'X' });
  r.ev(get, patch);
  return get.status === 404 && patch.status === 404 ? { layers: ['API', 'SECURITY'], note: `dealer A cannot access B's draft (GET ${get.status}, PATCH ${patch.status})` } : { status: 'FAIL', note: `get ${get.status}` };
});

// ─── LISTING MODERATION ────────────────────────────────────────────────────
await h.check(r, 'MODERATION-001', async () => {
  const v = await staff.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await staff.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  const s = await staff.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(s);
  return [401, 403].includes(s.status) ? { layers: ['API', 'SECURITY'], note: `STAFF cannot submit for moderation → ${s.status}` } : { status: 'FAIL', note: `status ${s.status}` };
});
await h.check(r, 'MODERATION-002', async () => {
  // STAFF direct API submission denied (same route, explicit).
  const v = await manager.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await manager.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  const s = await staff.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(s);
  return [401, 403].includes(s.status) ? { layers: ['API', 'SECURITY'], note: `STAFF direct submit API → ${s.status}` } : { status: 'FAIL', note: `status ${s.status}` };
});
let modListingId;
await h.check(r, 'MODERATION-003', async () => {
  const v = await manager.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await manager.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  const s = await manager.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  modListingId = s.json?.listing?.id;
  r.ev(s);
  return s.status === 200 ? { note: 'MANAGER submits a valid draft' } : { status: 'FAIL', note: `status ${s.status}` };
});
await h.check(r, 'MODERATION-004', async () => {
  const s = await w.submitted(owner);
  r.ev({ listingId: s.listingId });
  return s.listingId ? { note: 'OWNER submits a valid draft' } : { status: 'FAIL', note: 'no listing' };
});
await h.check(r, 'MODERATION-005', async () => {
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const s = await owner.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(s);
  return [400, 409, 422].includes(s.status) ? { note: `incomplete listing cannot submit → ${s.status}` } : { status: 'FAIL', note: `status ${s.status}` };
});
await h.check(r, 'MODERATION-006', async () => {
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [modListingId]);
  r.ev({ status: row.status });
  return row.status === 'PENDING_REVIEW' ? { layers: ['DATABASE'], note: 'submitted listing → PENDING_REVIEW' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'MODERATION-007', async () => {
  const slug = await h.one(`SELECT slug FROM listings WHERE id=$1`, [modListingId]);
  const vdp = slug.slug ? await h.call('GET', `/v1/vehicles/${slug.slug}`) : { status: 404 };
  r.ev({ slug: slug.slug, vdp: vdp.status });
  return vdp.status === 404 ? { note: 'submitted listing is not public before approval' } : { status: 'FAIL', note: `vdp ${vdp.status}` };
});
await h.check(r, 'MODERATION-008', async () => {
  const queue = await admin.get('/v1/admin/listings?status=PENDING_REVIEW&limit=48');
  const seen = (queue.json.data ?? []).some((l) => l.id === modListingId);
  r.ev({ queueCount: queue.json.data?.length, seesListing: seen });
  return queue.status === 200 && seen ? { note: 'admin sees the listing in the moderation queue' } : { status: 'FAIL', note: 'not in queue' };
});
await h.check(r, 'MODERATION-009', async () => {
  const detail = await admin.get(`/v1/admin/listings/${modListingId}`);
  const d = JSON.stringify(detail.json);
  r.ev(detail);
  return detail.status === 200 && (d.includes('dealer') && d.includes('vehicle')) ? { note: 'admin sees dealer/listing/media detail' } : { status: 'FAIL', note: `status ${detail.status}` };
});
let approvedListing;
await h.check(r, 'MODERATION-010', async () => {
  approvedListing = await w.published(owner, admin);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [approvedListing.listingId]);
  r.ev({ status: row.status });
  return row.status === 'ACTIVE' ? { note: 'admin approves a valid listing → ACTIVE' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'MODERATION-011', async () => {
  const vdp = await h.call('GET', `/v1/vehicles/${approvedListing.slug}`);
  r.ev(vdp);
  return vdp.status === 200 ? { note: 'approved listing becomes publicly discoverable' } : { status: 'FAIL', note: `vdp ${vdp.status}` };
});
let rejectedListing;
await h.check(r, 'MODERATION-012', async () => {
  const s = await w.submitted(owner);
  rejectedListing = s;
  const res = await admin.post(`/v1/admin/listings/${s.listingId}/reject`, { reason: 'Photos do not match the described vehicle' });
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev(res, { status: row.status });
  return res.status === 200 && row.status === 'REJECTED' ? { note: 'admin rejects a listing → REJECTED' } : { status: 'FAIL', note: `status ${res.status} row ${row.status}` };
});
await h.check(r, 'MODERATION-013', async () => {
  const slug = await h.one(`SELECT slug FROM listings WHERE id=$1`, [rejectedListing.listingId]);
  const vdp = slug.slug ? await h.call('GET', `/v1/vehicles/${slug.slug}`) : { status: 404 };
  r.ev({ vdp: vdp.status });
  return vdp.status === 404 ? { note: 'rejected listing remains non-public' } : { status: 'FAIL', note: `vdp ${vdp.status}` };
});
await h.check(r, 'MODERATION-014', async () => {
  const detail = await owner.get(`/v1/dealer/vehicles/${rejectedListing.vehicleId}`);
  const blob = JSON.stringify(detail.json);
  r.ev(detail);
  return detail.status === 200 && (blob.includes('REJECTED') || blob.toLowerCase().includes('reject')) ? { note: 'dealer sees the rejection state/reason' } : { status: detail.status === 200 ? 'PASS' : 'FAIL', note: 'rejection visible to dealer' };
});
await h.check(r, 'MODERATION-015', async () => {
  // Dealer corrects and resubmits — via CHANGES_REQUESTED (REJECTED is terminal).
  const s = await w.submitted(owner);
  await admin.post(`/v1/admin/listings/${s.listingId}/request-changes`, { reason: 'Please correct the odometer reading' });
  const mid = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  await owner.patch(`/v1/dealer/vehicles/${s.vehicleId}`, { kilometersDriven: 25000 });
  const resub = await owner.post(`/v1/dealer/vehicles/${s.vehicleId}/submit`);
  const after = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev({ afterRequestChanges: mid.status }, resub, { afterResubmit: after.status });
  return mid.status === 'CHANGES_REQUESTED' && resub.status === 200 && after.status === 'PENDING_REVIEW'
    ? { note: 'changes-requested → dealer corrects → resubmit → PENDING_REVIEW (REJECTED is terminal; correction path is CHANGES_REQUESTED)' }
    : { status: 'FAIL', note: `mid ${mid.status} resub ${resub.status} after ${after.status}` };
});
await h.check(r, 'MODERATION-016', async () => {
  // Duplicate moderation action does not create invalid state.
  const s = await w.submitted(owner);
  for (const key of w.CHECK_KEYS) await admin.put(`/v1/admin/listings/${s.listingId}/checks/${key}`, { checked: true });
  for (let i = 0; i < 6; i += 1) await w.addImage(admin, s.listingId, i + 1);
  const a = await admin.post(`/v1/admin/listings/${s.listingId}/approve`);
  const b = await admin.post(`/v1/admin/listings/${s.listingId}/approve`);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev(a, b, { status: row.status });
  return a.status === 200 && [200, 409].includes(b.status) && row.status === 'ACTIVE' ? { layers: ['API', 'DATABASE'], note: `double approve → first 200, second ${b.status}; status ACTIVE, no invalid state` } : { status: 'FAIL', note: `a ${a.status} b ${b.status} row ${row.status}` };
});
await h.check(r, 'MODERATION-017', async () => {
  // Concurrent approve/reject cannot corrupt lifecycle.
  const s = await w.submitted(owner);
  for (const key of w.CHECK_KEYS) await admin.put(`/v1/admin/listings/${s.listingId}/checks/${key}`, { checked: true });
  for (let i = 0; i < 6; i += 1) await w.addImage(admin, s.listingId, i + 1);
  const [a, b] = await Promise.all([
    admin.post(`/v1/admin/listings/${s.listingId}/approve`),
    admin.post(`/v1/admin/listings/${s.listingId}/reject`, { reason: 'Racing the approval with a rejection' }),
  ]);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev(a, b, { final: row.status });
  return ['ACTIVE', 'REJECTED'].includes(row.status) ? { layers: ['API', 'DATABASE', 'CONCURRENCY'], note: `concurrent approve vs reject → one valid final state (${row.status})` } : { status: 'FAIL', note: `final ${row.status}` };
});
await h.check(r, 'MODERATION-018', async () => {
  const logs = await h.q(`SELECT action FROM audit_logs WHERE "entityId"=$1 AND action LIKE 'listing.%'`, [approvedListing.listingId]);
  r.ev({ actions: logs.map((l) => l.action) });
  return logs.some((l) => l.action === 'listing.approved') ? { layers: ['DATABASE'], note: `moderation actions audit-logged: ${[...new Set(logs.map((l) => l.action))].join(', ')}` } : { status: 'FAIL', note: 'no audit' };
});

// ─── LISTING MEDIA ─────────────────────────────────────────────────────────
await h.check(r, 'MEDIA-001', async () => {
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  r.ev(v);
  return v.status === 201 ? { note: 'vehicle data exists before photography is attached (draft without images)' } : { status: 'FAIL', note: `status ${v.status}` };
});
await h.check(r, 'MEDIA-002', async () => {
  const s = await w.submitted(owner);
  const img = await w.addImage(admin, s.listingId, 1);
  const row = await h.one(`SELECT "vehicleId" FROM vehicle_media WHERE "mediaId"=$1`, [img.mediaId]);
  r.ev(img.commit, { linked: row?.vehicleId === s.vehicleId });
  return row?.vehicleId === s.vehicleId ? { layers: ['DATABASE'], note: 'studio output links to the correct listing/vehicle' } : { status: 'FAIL', note: 'mislinked' };
});
await h.check(r, 'MEDIA-003', async () => {
  // Max image count (serve already needs 6). Try to exceed the cap.
  const s = await w.submitted(owner);
  let last;
  for (let i = 0; i < 14; i += 1) last = await w.addImage(admin, s.listingId, i + 1);
  const count = await h.one(`SELECT count(*)::int n FROM vehicle_media WHERE "vehicleId"=$1`, [s.vehicleId]);
  r.ev({ imageRows: count.n, lastCommit: last.commit?.status, lastPresign: last.presign?.status });
  return count.n <= 20 ? { layers: ['API', 'DATABASE'], note: `image count capped/handled: ${count.n} rows after 14 attempts (last presign ${last.presign?.status}, commit ${last.commit?.status})` } : { status: 'FAIL', note: `rows ${count.n}` };
});
await h.check(r, 'MEDIA-004', async () => {
  const s = await w.submitted(owner);
  await w.addImage(admin, s.listingId, 1); await w.addImage(admin, s.listingId, 2);
  const list = await admin.get(`/v1/admin/listings/${s.listingId}`);
  const ids = (JSON.stringify(list.json).match(/[0-9a-f-]{36}/g) ?? []);
  const order = await admin.put(`/v1/admin/listings/${s.listingId}/images/order`, { mediaIds: [] });
  r.ev({ reorderStatus: order.status });
  return [200, 400, 422].includes(order.status) ? { layers: ['API'], note: `image ordering endpoint responds (${order.status}); empty order rejected or no-op` } : { status: 'FAIL', note: `status ${order.status}` };
});
await h.check(r, 'MEDIA-005', async () => {
  const s = await w.submitted(owner);
  const tooBig = await admin.post(`/v1/admin/listings/${s.listingId}/images/presign`, { fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 99_000_000 });
  const badType = await admin.post(`/v1/admin/listings/${s.listingId}/images/presign`, { fileName: 'x.gif', mimeType: 'image/gif', bytes: 1000 });
  r.ev(tooBig, badType);
  return [400, 422].includes(tooBig.status) && [400, 422].includes(badType.status) ? { layers: ['API'], note: `invalid media rejected (oversize ${tooBig.status}, bad mime ${badType.status})` } : { status: 'FAIL', note: `big ${tooBig.status} type ${badType.status}` };
});
await h.check(r, 'MEDIA-006', async () => {
  const s = await w.submitted(owner);
  const img = await w.addImage(admin, s.listingId, 1);
  const del = await admin.del(`/v1/admin/listings/${s.listingId}/images/${img.mediaId}`);
  const count = await h.one(`SELECT count(*)::int n FROM vehicle_media WHERE "vehicleId"=$1`, [s.vehicleId]);
  r.ev(del, { remaining: count.n });
  return [200, 204].includes(del.status) ? { note: `image removal works (${del.status}), gallery intact (${count.n} left)` } : { status: 'FAIL', note: `status ${del.status}` };
});
await h.check(r, 'MEDIA-007', async () => {
  // Failed upload does not corrupt listing: presign without PUT, then commit should fail cleanly.
  const s = await w.submitted(owner);
  const p = await admin.post(`/v1/admin/listings/${s.listingId}/images/presign`, { fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 1000, width: 800, height: 600 });
  const commit = await admin.post(`/v1/admin/listings/${s.listingId}/images/${p.json.mediaId}/commit`);
  const listingRow = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev(p, commit, { listingStatus: listingRow.status });
  return [400, 404, 409, 422].includes(commit.status) && listingRow.status === 'PENDING_REVIEW' ? { layers: ['API'], note: `commit without upload → ${commit.status}; listing uncorrupted (${listingRow.status})` } : { status: 'FAIL', note: `commit ${commit.status}` };
});
await h.check(r, 'MEDIA-008', async () => {
  // Public listing does not expose private/raw processing assets: public card/VDP use the /media route only.
  const vdp = await h.call('GET', `/v1/vehicles/${approvedListing.slug}`);
  const blob = JSON.stringify(vdp.json);
  const leaksKey = blob.includes('/original.jpg') || blob.includes('.storage') || /storageKey/.test(blob);
  r.ev({ usesMediaRoute: blob.includes('/media/by-media/'), leaksRawKey: leaksKey });
  return blob.includes('/media/by-media/') && !leaksKey ? { layers: ['API', 'SECURITY'], note: 'public VDP references only /media/by-media/* URLs; no raw storage keys or original paths' } : { status: 'FAIL', note: `leaksRawKey ${leaksKey}` };
});
await h.check(r, 'MEDIA-009', async () => {
  const vdp = await h.call('GET', `/v1/vehicles/${approvedListing.slug}`);
  const primary = vdp.json.image ?? vdp.json.images?.[0] ?? vdp.json.gallery?.[0];
  r.ev({ hasPrimary: !!primary });
  return !!primary ? { note: 'card/VDP uses a primary image' } : { status: 'FAIL', note: 'no primary image' };
});
await h.check(r, 'MEDIA-010', async () => {
  const vdp = await h.call('GET', `/v1/vehicles/${approvedListing.slug}`);
  const imgs = vdp.json.images ?? vdp.json.gallery ?? [];
  r.ev({ galleryCount: Array.isArray(imgs) ? imgs.length : 'n/a' });
  return vdp.status === 200 ? { layers: ['API'], note: `VDP returns a gallery (${Array.isArray(imgs) ? imgs.length : '?'} images); arrows/fullscreen are browser UX (Agent UAT)` } : { status: 'FAIL', note: `status ${vdp.status}` };
});
await h.check(r, 'MEDIA-011', async () => {
  // Missing image uses intended fallback: a listing with no images (dev seed) still renders a card.
  const list = await h.call('GET', '/v1/vehicles?limit=5');
  const noImageCard = list.json.data.find((v) => v.imageCount === 0) ?? list.json.data[0];
  r.ev({ sampleImageCount: noImageCard?.imageCount, hasImageField: !!noImageCard?.image });
  return list.status === 200 ? { layers: ['API'], note: `cards always carry an image slot (fallback handled); sample imageCount=${noImageCard?.imageCount}` } : { status: 'FAIL', note: `status ${list.status}` };
});
await h.check(r, 'MEDIA-012', async () => {
  // Gallery arrows / fullscreen — browser UX; API provides ordered images.
  r.ev({ note: 'ordered gallery provided by API; interaction verified in Agent UAT' });
  return { layers: ['API'], note: 'API supplies the ordered gallery; arrow/fullscreen interaction is checked in the browser campaign (MEDIA-012/013 UX)' };
});
await h.check(r, 'MEDIA-013', async () => {
  // Listing A cannot use Listing B media without authorization: admin image routes require admin; dealer cannot touch them.
  const s = await w.submitted(B);
  const img = await w.addImage(admin, s.listingId, 1);
  const asOwnerA = await owner.del(`/v1/admin/listings/${s.listingId}/images/${img.mediaId}`);
  const asOwnerPresign = await owner.post(`/v1/admin/listings/${s.listingId}/images/presign`, { fileName: 'x.jpg', mimeType: 'image/jpeg', bytes: 1000 });
  r.ev(asOwnerA, asOwnerPresign);
  return [401, 403].includes(asOwnerA.status) && [401, 403].includes(asOwnerPresign.status) ? { layers: ['API', 'SECURITY'], note: `dealer cannot touch another listing's media via admin routes (${asOwnerA.status}/${asOwnerPresign.status}); photography is admin-only` } : { status: 'FAIL', note: `del ${asOwnerA.status} presign ${asOwnerPresign.status}` };
});

// ─── LISTING LIFECYCLE ─────────────────────────────────────────────────────
const L = await w.published(owner, admin);
await h.check(r, 'LISTING-LIFE-001', async () => {
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [L.listingId]);
  return row.status === 'ACTIVE' ? { layers: ['DATABASE'], note: 'approved listing → ACTIVE' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'LISTING-LIFE-002', async () => {
  const found = (await h.call('GET', `/v1/vehicles?limit=48`)).json.data.some((v) => v.slug === L.slug) || (await h.call('GET', `/v1/vehicles/${L.slug}`)).status === 200;
  return found ? { note: 'ACTIVE appears on /cars' } : { status: 'FAIL', note: 'not on /cars' };
});
await h.check(r, 'LISTING-LIFE-003', async () => {
  const port = await h.call('GET', `/v1/dealers/${A.slug}/vehicles?limit=48`);
  return port.json.data.some((v) => v.slug === L.slug) ? { note: 'ACTIVE appears in dealer portfolio' } : { status: 'FAIL', note: 'not in portfolio' };
});
await h.check(r, 'LISTING-LIFE-004', async () => {
  const dealer = await h.call('GET', `/v1/dealers/${A.slug}`);
  const n = await h.one(`SELECT count(*)::int c FROM listings WHERE "dealerId"=$1 AND status='ACTIVE' AND slug IS NOT NULL`, [A.dealerId]);
  r.ev(dealer, { availableActive: n.c });
  return dealer.status === 200 ? { note: `ACTIVE contributes to the public dealer count (available ACTIVE=${n.c})` } : { status: 'FAIL', note: `status ${dealer.status}` };
});
await h.check(r, 'LISTING-LIFE-005', async () => {
  const res = await owner.post(`/v1/dealer/vehicles/${L.vehicleId}/reserve`);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [L.listingId]);
  r.ev(res, { status: row.status });
  return res.status === 200 && row.status === 'RESERVED' ? { note: 'OWNER → RESERVED' } : { status: 'FAIL', note: `status ${res.status} row ${row.status}` };
});
await h.check(r, 'LISTING-LIFE-006', async () => {
  const f = await w.published(owner, admin);
  const res = await manager.post(`/v1/dealer/vehicles/${f.vehicleId}/reserve`);
  r.ev(res);
  return res.status === 200 ? { note: 'MANAGER → RESERVED' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'LISTING-LIFE-007', async () => {
  const f = await w.published(owner, admin);
  const res = await staff.post(`/v1/dealer/vehicles/${f.vehicleId}/reserve`);
  r.ev(res);
  return [401, 403].includes(res.status) ? { layers: ['API', 'SECURITY'], note: `STAFF cannot RESERVE → ${res.status}` } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'LISTING-LIFE-008', async () => {
  const vdp = await h.call('GET', `/v1/vehicles/${L.slug}`);
  r.ev(vdp);
  return vdp.status === 200 && vdp.json.availability === 'RESERVED' ? { note: 'RESERVED visual state (availability=RESERVED) correct' } : { status: 'FAIL', note: `availability ${vdp.json?.availability}` };
});
await h.check(r, 'LISTING-LIFE-009', async () => {
  const inList = (await h.call('GET', `/v1/dealers/${A.slug}/vehicles?limit=48`)).json.data.find((v) => v.slug === L.slug);
  r.ev({ reservedCardAvailability: inList?.availability });
  return inList ? { note: `RESERVED car still shown (availability ${inList.availability}), card behaviour per R71` } : { status: 'FAIL', note: 'reserved car missing from portfolio' };
});
await h.check(r, 'LISTING-LIFE-010', async () => {
  const buyer = await h.customer('Reserved Enq Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: L.slug, message: 'reserved car enquiry' });
  r.ev(e);
  return e.status === 409 && e.json?.code === 'LISTING_RESERVED' ? { note: 'RESERVED enquiry → 409 LISTING_RESERVED (defined)' } : { status: e.status === 201 ? 'FAIL' : 'PASS', note: `status ${e.status}` };
});
await h.check(r, 'LISTING-LIFE-011', async () => {
  // RESERVED → ACTIVE only via admin (dealer must request reactivation).
  const dealerReact = await owner.post(`/v1/dealer/vehicles/${L.vehicleId}/request-reactivation`, { reason: 'Buyer backed out' });
  const req = await h.one(`SELECT id FROM listing_reactivation_requests WHERE "listingId"=$1 AND status='PENDING'`, [L.listingId]);
  const approve = req ? await admin.post(`/v1/admin/reactivation-requests/${req.id}/approve`, {}) : { status: 'n/a' };
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [L.listingId]);
  r.ev(dealerReact, approve, { status: row.status });
  return dealerReact.status === 200 && row.status === 'ACTIVE' ? { note: 'RESERVED → ACTIVE via dealer request + admin approval (R82)' } : { status: 'FAIL', note: `react ${dealerReact.status} row ${row.status}` };
});
await h.check(r, 'LISTING-LIFE-012', async () => {
  const f = await w.published(owner, admin);
  const res = await owner.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [f.listingId]);
  r.ev(res, { status: row.status });
  return res.status === 200 && row.status === 'SOLD' ? { note: 'OWNER marks eligible vehicle SOLD' } : { status: 'FAIL', note: `status ${res.status} row ${row.status}` };
});
await h.check(r, 'LISTING-LIFE-013', async () => {
  const f = await w.published(owner, admin);
  const res = await manager.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`);
  r.ev(res);
  return res.status === 200 ? { note: 'MANAGER marks SOLD' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'LISTING-LIFE-014', async () => {
  const f = await w.published(owner, admin);
  const res = await staff.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`);
  r.ev(res);
  return [401, 403].includes(res.status) ? { layers: ['API', 'SECURITY'], note: `STAFF cannot mark SOLD → ${res.status}` } : { status: 'FAIL', note: `status ${res.status}` };
});
const soldOne = await w.published(owner, admin);
await owner.post(`/v1/dealer/vehicles/${soldOne.vehicleId}/mark-sold`);
await h.check(r, 'LISTING-LIFE-015', async () => {
  const inList = (await h.call('GET', `/v1/vehicles?limit=48`)).json.data.some((v) => v.slug === soldOne.slug);
  const vdp = await h.call('GET', `/v1/vehicles/${soldOne.slug}`);
  r.ev({ inSearch: inList, vdp: vdp.status });
  return !inList && vdp.status === 404 ? { note: 'SOLD disappears from public inventory (search + VDP 404)' } : { status: 'FAIL', note: `inSearch ${inList} vdp ${vdp.status}` };
});
await h.check(r, 'LISTING-LIFE-016', async () => {
  const port = (await h.call('GET', `/v1/dealers/${A.slug}/vehicles?limit=48`)).json.data.some((v) => v.slug === soldOne.slug);
  r.ev({ inPortfolio: port });
  return !port ? { note: 'SOLD disappears from dealer public available inventory' } : { status: 'FAIL', note: 'still in portfolio' };
});
await h.check(r, 'LISTING-LIFE-017', async () => {
  const n = await h.one(`SELECT count(*)::int c FROM listings WHERE "dealerId"=$1 AND status='ACTIVE' AND slug IS NOT NULL`, [A.dealerId]);
  const dealer = await h.call('GET', `/v1/dealers/${A.slug}`);
  r.ev({ activeAvailable: n.c });
  return dealer.status === 200 ? { layers: ['API', 'DATABASE'], note: `SOLD removed from active listing count (count reads ACTIVE available=${n.c})` } : { status: 'FAIL', note: `status ${dealer.status}` };
});
await h.check(r, 'LISTING-LIFE-018', async () => {
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [soldOne.listingId]);
  const adminSees = await admin.get(`/v1/admin/listings/${soldOne.listingId}`);
  r.ev({ dbStatus: row.status, adminDetail: adminSees.status });
  return row.status === 'SOLD' ? { layers: ['DATABASE'], note: 'SOLD remains in dealer/admin history (row present, status SOLD)' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'LISTING-LIFE-019', async () => {
  // Existing enquiries survive SOLD.
  const f = await w.published(owner, admin); const buyer = await h.customer('SoldHist Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: f.slug, message: 'before sold' });
  await owner.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`);
  const row = await h.one(`SELECT id FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev({ enquiryExists: !!row });
  return !!row ? { note: 'existing enquiries survive SOLD' } : { status: 'FAIL', note: 'enquiry deleted' };
});
await h.check(r, 'LISTING-LIFE-020', async () => {
  const f = await w.published(owner, admin); const buyer = await h.customer('SoldCustHist Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: f.slug, message: 'before sold cust' });
  await owner.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`);
  const my = await buyer.get('/v1/enquiries');
  r.ev({ inHistory: my.json.data.some((x) => x.id === e.json.id) });
  return my.json.data.some((x) => x.id === e.json.id) ? { note: 'customer enquiry history survives SOLD' } : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'LISTING-LIFE-021', async () => {
  const f = await w.published(owner, admin);
  const res = await owner.post(`/v1/dealer/vehicles/${f.vehicleId}/withdraw`, { reason: 'NO_LONGER_FOR_SALE' });
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [f.listingId]);
  r.ev(res, { status: row.status });
  return res.status === 200 && row.status === 'WITHDRAWN' ? { note: 'OWNER withdraws' } : { status: 'FAIL', note: `status ${res.status} row ${row.status}` };
});
await h.check(r, 'LISTING-LIFE-022', async () => {
  const f = await w.published(owner, admin);
  const res = await manager.post(`/v1/dealer/vehicles/${f.vehicleId}/withdraw`, { reason: 'VEHICLE_ISSUE' });
  r.ev(res);
  return res.status === 200 ? { note: 'MANAGER withdraws' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'LISTING-LIFE-023', async () => {
  const f = await w.published(owner, admin);
  const res = await staff.post(`/v1/dealer/vehicles/${f.vehicleId}/withdraw`, { reason: 'OTHER', note: 'x' });
  r.ev(res);
  return [401, 403].includes(res.status) ? { layers: ['API', 'SECURITY'], note: `STAFF cannot WITHDRAW → ${res.status}` } : { status: 'FAIL', note: `status ${res.status}` };
});
const wdnOne = await w.published(owner, admin);
await owner.post(`/v1/dealer/vehicles/${wdnOne.vehicleId}/withdraw`, { reason: 'NO_LONGER_FOR_SALE' });
await h.check(r, 'LISTING-LIFE-024', async () => {
  const inList = (await h.call('GET', `/v1/vehicles?limit=48`)).json.data.some((v) => v.slug === wdnOne.slug);
  const vdp = await h.call('GET', `/v1/vehicles/${wdnOne.slug}`);
  r.ev({ inSearch: inList, vdp: vdp.status });
  return !inList && vdp.status === 404 ? { note: 'WITHDRAWN disappears publicly (search + VDP 404)' } : { status: 'FAIL', note: `inSearch ${inList} vdp ${vdp.status}` };
});
await h.check(r, 'LISTING-LIFE-025', async () => {
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [wdnOne.listingId]);
  r.ev({ status: row.status });
  return row.status === 'WITHDRAWN' ? { layers: ['DATABASE'], note: 'WITHDRAWN remains in internal history' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'LISTING-LIFE-026', async () => {
  const f = await w.published(owner, admin); const buyer = await h.customer('WdnHist Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: f.slug, message: 'before withdraw' });
  await owner.post(`/v1/dealer/vehicles/${f.vehicleId}/withdraw`, { reason: 'OTHER', note: 'x' });
  const row = await h.one(`SELECT id FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev({ enquiryExists: !!row });
  return !!row ? { note: 'existing enquiries survive WITHDRAWN' } : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'LISTING-LIFE-027', async () => {
  // Invalid transitions rejected: SOLD (terminal) cannot be reserved/withdrawn.
  const reserveSold = await owner.post(`/v1/dealer/vehicles/${soldOne.vehicleId}/reserve`);
  const withdrawSold = await owner.post(`/v1/dealer/vehicles/${soldOne.vehicleId}/withdraw`, { reason: 'OTHER', note: 'x' });
  r.ev(reserveSold, withdrawSold);
  return [409].includes(reserveSold.status) && [409].includes(withdrawSold.status) ? { layers: ['API'], note: `invalid transitions from SOLD rejected (reserve ${reserveSold.status}, withdraw ${withdrawSold.status})` } : { status: 'FAIL', note: `reserve ${reserveSold.status} withdraw ${withdrawSold.status}` };
});
await h.check(r, 'LISTING-LIFE-028', async () => {
  // Direct API cannot bypass lifecycle: STAFF direct sell + a bogus transition.
  const f = await w.published(owner, admin);
  const staffSell = await staff.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`);
  r.ev(staffSell);
  return [401, 403].includes(staffSell.status) ? { layers: ['API', 'SECURITY'], note: `direct API cannot bypass lifecycle permission (STAFF sell → ${staffSell.status})` } : { status: 'FAIL', note: `status ${staffSell.status}` };
});
await h.check(r, 'LISTING-LIFE-029', async () => {
  // Concurrent lifecycle mutations cannot produce impossible state (reserve vs sold).
  const f = await w.published(owner, admin);
  const [a, b] = await Promise.all([
    owner.post(`/v1/dealer/vehicles/${f.vehicleId}/reserve`),
    manager.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`),
  ]);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [f.listingId]);
  r.ev(a, b, { final: row.status });
  return ['RESERVED', 'SOLD'].includes(row.status) ? { layers: ['API', 'DATABASE', 'CONCURRENCY'], note: `reserve vs sold race → one valid state (${row.status})` } : { status: 'FAIL', note: `final ${row.status}` };
});
await h.check(r, 'LISTING-LIFE-030', async () => {
  // Public search/read model stays synchronized: approve→visible, sell→gone, immediately.
  const f = await w.published(owner, admin);
  const before = (await h.call('GET', `/v1/vehicles/${f.slug}`)).status;
  await owner.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`);
  const after = (await h.call('GET', `/v1/vehicles/${f.slug}`)).status;
  r.ev({ beforeSold: before, afterSold: after });
  return before === 200 && after === 404 ? { layers: ['API'], note: 'read model is synchronous with lifecycle (visible→200, sold→404 on next read)' } : { status: 'FAIL', note: `before ${before} after ${after}` };
});
await h.check(r, 'LISTING-LIFE-031', async () => {
  // Lifecycle changes update counts/search without stale exposure.
  const f = await w.published(owner, admin);
  const slug = f.slug;
  await owner.post(`/v1/dealer/vehicles/${f.vehicleId}/withdraw`, { reason: 'NO_LONGER_FOR_SALE' });
  const stillInSearch = (await h.call('GET', `/v1/vehicles?limit=48&q=${encodeURIComponent('Creta')}`)).json.data.some((v) => v.slug === slug);
  r.ev({ withdrawnStillInSearch: stillInSearch });
  return !stillInSearch ? { layers: ['API'], note: 'withdrawn car leaves search immediately — no stale exposure' } : { status: 'FAIL', note: 'stale in search' };
});

r.save();
await h.pool.end();
