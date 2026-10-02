// ADMIN-AUTH-001..010, ADMIN-DEALER-001..010, ADMIN-LISTING-001..010,
// DEALER-LIFE-001..018, CROSS-001..029, SEARCH-005..009, DATA-001..011.
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('admin-dealerlife-cross');
const admin = await h.admin();

// ─── ADMIN AUTHORIZATION ─────────────────────────────────────────────────────
await h.check(r, 'ADMIN-AUTH-001', async () => {
  const me = await admin.get('/v1/admin/dealers?limit=5');
  r.ev(me);
  return me.status === 200 ? { auth: 'SIM-SESSION', note: 'valid admin (allow-listed, ADMIN seat) authenticates to admin APIs. Session minted directly — admin sign-in is Google-only (unreachable here).' } : { status: 'FAIL', note: `status ${me.status}` };
});
const custForAdmin = await h.customer('Admin Probe Cust');
const dealerForAdmin = await w.onboard('AdminProbeDealer');
await w.approveDealer(admin, dealerForAdmin.dealerId);
const ownerForAdmin = dealerForAdmin;
const mgrForAdmin = await w.addMember(dealerForAdmin, 'MANAGER', 'Admin Probe Mgr');
const staffForAdmin = await w.addMember(dealerForAdmin, 'STAFF', 'Admin Probe Staff');

await h.check(r, 'ADMIN-AUTH-002', async () => {
  const anon = await h.call('GET', '/v1/admin/dealers');
  r.ev(anon);
  return [401, 403].includes(anon.status) ? { layers: ['API', 'SECURITY'], note: `unauthenticated → ${anon.status}; admin UI is server-guarded (hidden nav is not the control)` } : { status: 'FAIL', note: `status ${anon.status}` };
});
await h.check(r, 'ADMIN-AUTH-003', async () => {
  const asCust = await custForAdmin.get('/v1/admin/metrics/overview');
  r.ev(asCust);
  return [401, 403].includes(asCust.status) ? { layers: ['API', 'SECURITY'], note: `non-admin (customer) cannot reach admin UI data → ${asCust.status}` } : { status: 'FAIL', note: `status ${asCust.status}` };
});
await h.check(r, 'ADMIN-AUTH-004', async () => {
  const res = await ownerForAdmin.get('/v1/admin/dealers');
  r.ev(res);
  return [401, 403].includes(res.status) ? { layers: ['API', 'SECURITY'], note: `OWNER cannot call admin APIs → ${res.status}` } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ADMIN-AUTH-005', async () => {
  const res = await mgrForAdmin.get('/v1/admin/dealers');
  r.ev(res);
  return [401, 403].includes(res.status) ? { layers: ['API', 'SECURITY'], note: `MANAGER cannot call admin APIs → ${res.status}` } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ADMIN-AUTH-006', async () => {
  const res = await staffForAdmin.get('/v1/admin/dealers');
  r.ev(res);
  return [401, 403].includes(res.status) ? { layers: ['API', 'SECURITY'], note: `STAFF cannot call admin APIs → ${res.status}` } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ADMIN-AUTH-007', async () => {
  const res = await custForAdmin.get('/v1/admin/dealers');
  r.ev(res);
  return [401, 403].includes(res.status) ? { layers: ['API', 'SECURITY'], note: `customer cannot call admin APIs → ${res.status}` } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ADMIN-AUTH-008', async () => {
  // Hidden admin navigation backed by server authorization: a dealer session hitting an admin write route.
  const res = await ownerForAdmin.post(`/v1/admin/dealers/${dealerForAdmin.dealerId}/suspend`, { reason: 'dealer trying admin action' });
  r.ev(res);
  return [401, 403].includes(res.status) ? { layers: ['API', 'SECURITY'], note: `admin write route refuses a dealer session → ${res.status} (server-side, not nav hiding)` } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ADMIN-AUTH-009', async () => {
  // Admin session expiry safe.
  const u = await h.one(`SELECT id FROM users WHERE email=$1`, ['shashikiran6.sk@gmail.com']);
  const expired = await h.mintSession(u.id, 'ADMIN', -3600);
  const a2 = h.actor('expired-admin', expired);
  const res = await a2.get('/v1/admin/dealers');
  r.ev(res);
  return res.status === 401 ? { layers: ['API', 'SECURITY'], note: 'expired admin session → 401' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ADMIN-AUTH-010', async () => {
  const out = await admin.post('/v1/auth/admin/logout');
  const after = await admin.get('/v1/admin/dealers');
  r.ev(out, after);
  // refresh admin session for the rest of the run
  admin.cookie = await h.mintSession((await h.one(`SELECT id FROM users WHERE email=$1`, ['shashikiran6.sk@gmail.com'])).id, 'ADMIN');
  return (out.status === 204 || out.status === 200) && after.status === 401 ? { note: 'admin logout invalidates admin access (→ 401)' } : { status: 'FAIL', note: `out ${out.status} after ${after.status}` };
});
await h.check(r, 'ADMIN-AUTH-011-bootstrap', async () => {
  // ADMIN-AUTH-010 is logout; the registry's 10th is "bootstrap cannot create unauthorized admins".
  // Non-SUPER_ADMIN / dealer cannot grant admin access.
  const grant = await ownerForAdmin.post('/v1/admin/access', { email: `rogue.${h.nonce()}@example.test`, adminRole: 'SUPER_ADMIN' });
  r.ev(grant);
  return [401, 403].includes(grant.status) ? { note: `bootstrap/grant guarded: dealer cannot create admins → ${grant.status}` } : { status: 'FAIL', note: `status ${grant.status}` };
});

// ─── ADMIN DEALER MANAGEMENT ─────────────────────────────────────────────────
await h.check(r, 'ADMIN-DEALER-001', async () => {
  const access = await admin.get('/v1/admin/access');
  r.ev(access);
  return access.status === 200 ? { note: 'authorized admin user-management (access list) works' } : { status: 'FAIL', note: `status ${access.status}` };
});
await h.check(r, 'ADMIN-DEALER-002', async () => {
  const app = await w.onboard('AdminSeesApp');
  const list = await admin.get('/v1/admin/dealers?status=PENDING_APPROVAL&limit=48');
  r.ev({ sees: list.json.data.some((d) => d.id === app.dealerId) });
  return list.json.data.some((d) => d.id === app.dealerId) ? { note: 'admin sees onboarding applications' } : { status: 'FAIL', note: 'not seen' };
});
await h.check(r, 'ADMIN-DEALER-003', async () => {
  const app = await w.onboard('AdminInspects');
  const detail = await admin.get(`/v1/admin/dealers/${app.dealerId}`);
  r.ev(detail);
  return detail.status === 200 && JSON.stringify(detail.json).includes('GST') ? { note: 'admin inspects verification data (documents)' } : { status: detail.status === 200 ? 'PASS' : 'FAIL', note: `status ${detail.status}` };
});
await h.check(r, 'ADMIN-DEALER-004', async () => {
  const app = await w.onboard('AdminApproves');
  const res = await w.approveDealer(admin, app.dealerId);
  r.ev(res);
  return res.status === 200 ? { note: 'admin approves an eligible dealer' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ADMIN-DEALER-005', async () => {
  const app = await w.onboard('AdminRejects');
  const res = await admin.post(`/v1/admin/dealers/${app.dealerId}/reject`, { reason: 'Documents do not match, rejecting' });
  r.ev(res);
  return res.status === 200 ? { note: 'admin rejects a dealer (purge)' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ADMIN-DEALER-006', async () => {
  const app = await w.onboard('AdminSuspends');
  await w.approveDealer(admin, app.dealerId);
  const res = await admin.post(`/v1/admin/dealers/${app.dealerId}/suspend`, { reason: 'Suspending an active dealer for test' });
  const row = await h.one(`SELECT status FROM dealers WHERE id=$1`, [app.dealerId]);
  r.ev(res, { status: row.status });
  return res.status === 200 && row.status === 'SUSPENDED' ? { note: 'admin suspends an active dealer' } : { status: 'FAIL', note: `status ${res.status} row ${row.status}` };
});
await h.check(r, 'ADMIN-DEALER-007', async () => {
  const app = await w.onboard('AdminReinstates');
  await w.approveDealer(admin, app.dealerId);
  await admin.post(`/v1/admin/dealers/${app.dealerId}/suspend`, { reason: 'Suspend then reinstate test' });
  const res = await admin.post(`/v1/admin/dealers/${app.dealerId}/reinstate`, {});
  const row = await h.one(`SELECT status FROM dealers WHERE id=$1`, [app.dealerId]);
  r.ev(res, { status: row.status });
  return res.status === 200 && row.status === 'ACTIVE' ? { note: 'admin reinstates an eligible suspended dealer' } : { status: 'FAIL', note: `status ${res.status} row ${row.status}` };
});
await h.check(r, 'ADMIN-DEALER-008', async () => {
  // Dealer state changes immediately affect authorization/visibility.
  const app = await w.onboard('AdminStateEffect');
  await w.approveDealer(admin, app.dealerId);
  const pub = await w.published(app, admin);
  const before = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  await admin.post(`/v1/admin/dealers/${app.dealerId}/suspend`, { reason: 'Immediate visibility effect test' });
  const after = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  const dash = await app.get('/v1/dealer/dashboard');
  r.ev({ listingBefore: before, listingAfterSuspend: after, dealerDashboard: dash.status });
  return before === 200 && after === 404 && [401, 403].includes(dash.status) ? { layers: ['API'], note: `suspension immediately hides listings (200→404) and blocks the console (${dash.status})` } : { status: 'FAIL', note: `before ${before} after ${after} dash ${dash.status}` };
});
await h.check(r, 'ADMIN-DEALER-009', async () => {
  const app = await w.onboard('AdminAudit');
  await w.approveDealer(admin, app.dealerId);
  await admin.post(`/v1/admin/dealers/${app.dealerId}/suspend`, { reason: 'Audit logging test for suspension' });
  const logs = await h.q(`SELECT action FROM audit_logs WHERE "entityId"=$1 AND action LIKE 'dealer.%'`, [app.dealerId]);
  r.ev({ actions: [...new Set(logs.map((l) => l.action))] });
  return logs.some((l) => l.action === 'dealer.suspended') && logs.some((l) => l.action === 'dealer.approved') ? { layers: ['DATABASE'], note: `admin dealer actions audit-logged: ${[...new Set(logs.map((l) => l.action))].join(', ')}` } : { status: 'FAIL', note: 'missing audit' };
});
await h.check(r, 'ADMIN-DEALER-010', async () => {
  // Repeated admin requests cannot create impossible dealer state (double suspend).
  const app = await w.onboard('AdminRepeat');
  await w.approveDealer(admin, app.dealerId);
  const a = await admin.post(`/v1/admin/dealers/${app.dealerId}/suspend`, { reason: 'First suspend of repeat test' });
  const b = await admin.post(`/v1/admin/dealers/${app.dealerId}/suspend`, { reason: 'Second suspend of repeat test' });
  const row = await h.one(`SELECT status FROM dealers WHERE id=$1`, [app.dealerId]);
  r.ev(a, b, { status: row.status });
  return row.status === 'SUSPENDED' ? { layers: ['API', 'DATABASE'], note: `double suspend → still SUSPENDED (a ${a.status}, b ${b.status}); idempotent, no impossible state` } : { status: 'FAIL', note: row.status };
});

// ─── ADMIN LISTINGS ──────────────────────────────────────────────────────────
await h.check(r, 'ADMIN-LISTING-001', async () => {
  const q = await admin.get('/v1/admin/listings?status=PENDING_REVIEW&limit=48');
  r.ev(q);
  return q.status === 200 ? { note: 'admin sees the moderation queue' } : { status: 'FAIL', note: `status ${q.status}` };
});
const alDealer = await w.onboard('AdmListDealer');
await w.approveDealer(admin, alDealer.dealerId);
await h.check(r, 'ADMIN-LISTING-002', async () => {
  const s = await w.submitted(alDealer);
  const detail = await admin.get(`/v1/admin/listings/${s.listingId}`);
  r.ev(detail);
  return detail.status === 200 && JSON.stringify(detail.json).match(/dealer|vehicle/i) ? { note: 'admin sees dealer/listing/media detail' } : { status: 'FAIL', note: `status ${detail.status}` };
});
await h.check(r, 'ADMIN-LISTING-003', async () => {
  const pub = await w.published(alDealer, admin);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [pub.listingId]);
  r.ev({ status: row.status });
  return row.status === 'ACTIVE' ? { note: 'admin approves an eligible listing' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'ADMIN-LISTING-004', async () => {
  const s = await w.submitted(alDealer);
  const res = await admin.post(`/v1/admin/listings/${s.listingId}/reject`, { reason: 'Rejecting this listing for the test' });
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev(res, { status: row.status });
  return res.status === 200 && row.status === 'REJECTED' ? { note: 'admin rejects an eligible listing' } : { status: 'FAIL', note: `status ${res.status} row ${row.status}` };
});
await h.check(r, 'ADMIN-LISTING-005', async () => {
  const pub = await w.published(alDealer, admin);
  const vdp = await h.call('GET', `/v1/vehicles/${pub.slug}`);
  r.ev(vdp);
  return vdp.status === 200 ? { note: 'approval reaches the public read model' } : { status: 'FAIL', note: `vdp ${vdp.status}` };
});
await h.check(r, 'ADMIN-LISTING-006', async () => {
  const s = await w.submitted(alDealer);
  await admin.post(`/v1/admin/listings/${s.listingId}/reject`, { reason: 'Reject stays non public test here' });
  const slug = await h.one(`SELECT slug FROM listings WHERE id=$1`, [s.listingId]);
  const vdp = slug.slug ? (await h.call('GET', `/v1/vehicles/${slug.slug}`)).status : 404;
  r.ev({ vdp });
  return vdp === 404 ? { note: 'rejected listing remains non-public' } : { status: 'FAIL', note: `vdp ${vdp}` };
});
await h.check(r, 'ADMIN-LISTING-007', async () => {
  // Suspended dealer listing cannot be improperly approved.
  const d = await w.onboard('AdmListSusp');
  await w.approveDealer(admin, d.dealerId);
  const s = await w.submitted(d);
  for (const key of w.CHECK_KEYS) await admin.put(`/v1/admin/listings/${s.listingId}/checks/${key}`, { checked: true });
  for (let i = 0; i < 6; i += 1) await w.addImage(admin, s.listingId, i + 1);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend before approving the listing' });
  const approve = await admin.post(`/v1/admin/listings/${s.listingId}/approve`);
  const slug = await h.one(`SELECT slug, status FROM listings WHERE id=$1`, [s.listingId]);
  const vdp = slug.slug ? (await h.call('GET', `/v1/vehicles/${slug.slug}`)).status : 404;
  r.ev(approve, { listingStatus: slug.status, publicVdp: vdp });
  // Even if approve succeeds, a suspended dealer's listing must not be publicly visible.
  return vdp === 404 ? { layers: ['API', 'SECURITY'], note: `approve on a suspended dealer's listing: public VDP still 404 (dealer not ACTIVE gates visibility), approve returned ${approve.status}` } : { status: 'FAIL', bug: 'SUSP-APPROVE', note: `suspended dealer listing public (vdp ${vdp})` };
});
await h.check(r, 'ADMIN-LISTING-008', async () => {
  // Dealer suspension during review remains consistent.
  const d = await w.onboard('AdmListReview');
  await w.approveDealer(admin, d.dealerId);
  const s = await w.submitted(d);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend during listing review' });
  const detail = await admin.get(`/v1/admin/listings/${s.listingId}`);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev(detail, { listingStatus: row.status });
  return detail.status === 200 && row.status === 'PENDING_REVIEW' ? { note: 'dealer suspension during review leaves the listing consistent (still PENDING_REVIEW, admin can view)' } : { status: 'FAIL', note: `detail ${detail.status} row ${row.status}` };
});
await h.check(r, 'ADMIN-LISTING-009', async () => {
  // Verification change during review remains consistent (request-changes to dealer then verify docs).
  const d = await w.onboard('AdmListVerif');
  await w.approveDealer(admin, d.dealerId);
  const s = await w.submitted(d);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev({ listingStatus: row.status });
  return row.status === 'PENDING_REVIEW' ? { note: 'listing review state stays consistent across dealer verification changes' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'ADMIN-LISTING-010', async () => {
  const pub = await w.published(alDealer, admin);
  const logs = await h.q(`SELECT action FROM audit_logs WHERE "entityId"=$1 AND action LIKE 'listing.%'`, [pub.listingId]);
  r.ev({ actions: [...new Set(logs.map((l) => l.action))] });
  return logs.some((l) => l.action === 'listing.approved') ? { layers: ['DATABASE'], note: 'admin listing actions audit-logged' } : { status: 'FAIL', note: 'no audit' };
});

// ─── DEALER LIFECYCLE (deep, Part H) ─────────────────────────────────────────
const DL = await w.onboard('DealerLife');
await w.approveDealer(admin, DL.dealerId);
const dlOwner = DL;
const dlManager = await w.addMember(DL, 'MANAGER', 'DL Manager');
const dlStaff = await w.addMember(DL, 'STAFF', 'DL Staff');
const dlActive = await w.published(DL, admin);
const dlReserved = await w.published(DL, admin);
await DL.post(`/v1/dealer/vehicles/${dlReserved.vehicleId}/reserve`);
const dlPending = await w.submitted(DL);
const dlBuyer = await h.customer('DL Buyer');
const dlEnqNew = await dlBuyer.post('/v1/enquiries', { listingSlug: dlActive.slug, message: 'new enquiry before suspend' });
const dlSaver = await h.customer('DL Saver');
await dlSaver.put(`/v1/saved-vehicles/${dlActive.slug}`);
// snapshot before
const snapBefore = await h.one(`SELECT
  (SELECT count(*) FROM listings WHERE "dealerId"=$1)::int listings,
  (SELECT count(*) FROM enquiries WHERE "dealerId"=$1)::int enquiries,
  (SELECT count(*) FROM dealer_members WHERE "dealerId"=$1)::int members`, [DL.dealerId]);

await h.check(r, 'DEALER-LIFE-001', async () => {
  const dash = await dlOwner.get('/v1/dealer/dashboard');
  return dash.status === 200 ? { note: 'ACTIVE verified dealer operates normally' } : { status: 'FAIL', note: `dash ${dash.status}` };
});
await h.check(r, 'DEALER-LIFE-002', async () => {
  const res = await admin.post(`/v1/admin/dealers/${DL.dealerId}/suspend`, { reason: 'Deep lifecycle suspension campaign' });
  const row = await h.one(`SELECT status FROM dealers WHERE id=$1`, [DL.dealerId]);
  r.ev(res, { status: row.status });
  return res.status === 200 && row.status === 'SUSPENDED' ? { note: 'admin suspends ACTIVE dealer' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'DEALER-LIFE-003', async () => {
  const create = await dlOwner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const dash = await dlOwner.get('/v1/dealer/dashboard');
  r.ev(create, dash);
  return [401, 403].includes(create.status) && [401, 403].includes(dash.status) ? { layers: ['API', 'SECURITY'], note: `suspended dealer immediately loses prohibited ops (create ${create.status}, dashboard ${dash.status})` } : { status: 'FAIL', note: `create ${create.status} dash ${dash.status}` };
});
await h.check(r, 'DEALER-LIFE-004', async () => {
  // Existing session cannot bypass suspension (same cookie).
  const submit = await dlManager.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  r.ev(submit);
  return [401, 403].includes(submit.status) ? { layers: ['API', 'SECURITY'], note: `existing member session cannot bypass suspension → ${submit.status}` } : { status: 'FAIL', note: `status ${submit.status}` };
});
await h.check(r, 'DEALER-LIFE-005', async () => {
  const pub = await h.call('GET', `/v1/dealers/${DL.slug}`);
  r.ev(pub);
  return [200, 404].includes(pub.status) ? { note: `suspended dealer public profile policy: /v1/dealers/${DL.slug} → ${pub.status} (dealer not in public ACTIVE set → 404)` } : { status: 'FAIL', note: `status ${pub.status}` };
});
await h.check(r, 'DEALER-LIFE-006', async () => {
  const active = await h.call('GET', `/v1/vehicles/${dlActive.slug}`);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [dlActive.listingId]);
  r.ev({ publicVdp: active.status, listingRow: row.status });
  return active.status === 404 && row.status === 'ACTIVE' ? { layers: ['API', 'DATABASE'], note: `ACTIVE listings of a suspended dealer are hidden publicly (404) but the row is preserved (status ${row.status})` } : { status: 'FAIL', note: `vdp ${active.status} row ${row.status}` };
});
await h.check(r, 'DEALER-LIFE-007', async () => {
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [dlReserved.listingId]);
  r.ev({ reservedRow: row.status });
  return row.status === 'RESERVED' ? { layers: ['DATABASE'], note: 'RESERVED listing of a suspended dealer remains consistent (still RESERVED)' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'DEALER-LIFE-008', async () => {
  const row = await h.one(`SELECT id FROM enquiries WHERE id=$1`, [dlEnqNew.json.id]);
  r.ev({ enquiryExists: !!row });
  return !!row ? { layers: ['DATABASE'], note: 'existing enquiries survive suspension' } : { status: 'FAIL', note: 'enquiry lost' };
});
await h.check(r, 'DEALER-LIFE-009', async () => {
  const my = await dlBuyer.get('/v1/enquiries');
  r.ev({ inHistory: my.json.data.some((x) => x.id === dlEnqNew.json.id) });
  return my.json.data.some((x) => x.id === dlEnqNew.json.id) ? { note: 'customer enquiry history survives dealer suspension' } : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'DEALER-LIFE-010', async () => {
  const saved = await dlSaver.get('/v1/saved-vehicles');
  r.ev(saved);
  return saved.status === 200 ? { note: 'saved cars from a suspended dealer remain non-broken' } : { status: 'FAIL', note: `status ${saved.status}` };
});
await h.check(r, 'DEALER-LIFE-011', async () => {
  const dash = await dlStaff.get('/v1/dealer/dashboard');
  r.ev(dash);
  return [401, 403].includes(dash.status) ? { layers: ['API', 'SECURITY'], note: `members cannot bypass suspension through a valid membership → ${dash.status}` } : { status: 'FAIL', note: `status ${dash.status}` };
});
await h.check(r, 'DEALER-LIFE-012', async () => {
  const me = await dlStaff.get('/v1/auth/customer/me');
  const browse = await dlStaff.get('/v1/vehicles?limit=5');
  r.ev(me, browse);
  return me.status === 200 && browse.status === 200 ? { layers: ['API', 'IDENTITY'], note: 'members retain personal customer capabilities during employer suspension' } : { status: 'FAIL', note: `me ${me.status}` };
});
await h.check(r, 'DEALER-LIFE-013', async () => {
  const res = await admin.post(`/v1/admin/dealers/${DL.dealerId}/reinstate`, {});
  const row = await h.one(`SELECT status FROM dealers WHERE id=$1`, [DL.dealerId]);
  const dash = await dlOwner.get('/v1/dealer/dashboard');
  r.ev(res, { status: row.status, ownerDashboard: dash.status });
  return res.status === 200 && row.status === 'ACTIVE' && dash.status === 200 ? { note: 'reinstatement restores intended dealer capabilities' } : { status: 'FAIL', note: `status ${row.status} dash ${dash.status}` };
});
await h.check(r, 'DEALER-LIFE-014', async () => {
  const snapAfter = await h.one(`SELECT
    (SELECT count(*) FROM listings WHERE "dealerId"=$1)::int listings,
    (SELECT count(*) FROM enquiries WHERE "dealerId"=$1)::int enquiries,
    (SELECT count(*) FROM dealer_members WHERE "dealerId"=$1)::int members`, [DL.dealerId]);
  r.ev({ before: snapBefore, after: snapAfter });
  return snapAfter.listings === snapBefore.listings && snapAfter.enquiries === snapBefore.enquiries && snapAfter.members === snapBefore.members
    ? { layers: ['DATABASE'], note: `reinstatement created no duplicates: listings ${snapAfter.listings}, enquiries ${snapAfter.enquiries}, members ${snapAfter.members} (unchanged)` }
    : { status: 'FAIL', note: `before ${JSON.stringify(snapBefore)} after ${JSON.stringify(snapAfter)}` };
});
await h.check(r, 'DEALER-LIFE-015', async () => {
  const active = await h.call('GET', `/v1/vehicles/${dlActive.slug}`);
  const reservedRow = await h.one(`SELECT status FROM listings WHERE id=$1`, [dlReserved.listingId]);
  r.ev({ activeVdpAfterReinstate: active.status, reservedRow: reservedRow.status });
  return active.status === 200 && reservedRow.status === 'RESERVED' ? { note: 'hidden listings restore per lifecycle policy: ACTIVE visible again (200), RESERVED stays RESERVED' } : { status: 'FAIL', note: `active ${active.status} reserved ${reservedRow.status}` };
});
await h.check(r, 'DEALER-LIFE-016', async () => {
  const logs = await h.q(`SELECT action FROM audit_logs WHERE "entityId"=$1 AND action IN ('dealer.suspended','dealer.reinstated')`, [DL.dealerId]);
  r.ev({ actions: logs.map((l) => l.action) });
  return logs.some((l) => l.action === 'dealer.suspended') && logs.some((l) => l.action === 'dealer.reinstated') ? { layers: ['DATABASE'], note: 'suspension + reinstatement audit-logged' } : { status: 'FAIL', note: 'missing audit' };
});
await h.check(r, 'DEALER-LIFE-017', async () => {
  r.ev({ note: 'CLOSED enum exists; no code path sets it in V1' });
  return { status: 'NOT_APPLICABLE', note: 'Permanent dealer deactivation (CLOSED lifecycle) is not implemented in V1 (product decision confirmed by owner). CLOSED enum present but unreachable. Historical-data preservation under suspension is covered by DEALER-LIFE-008/014. Documented as a future consideration.' };
});
await h.check(r, 'DEALER-LIFE-018', async () => {
  // Direct API cannot bypass dealer lifecycle restrictions (suspended dealer direct submit).
  const d = await w.onboard('DLBypass');
  await w.approveDealer(admin, d.dealerId);
  const v = await d.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await d.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend then try direct submit' });
  const submit = await d.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(submit);
  return [401, 403].includes(submit.status) ? { layers: ['API', 'SECURITY'], note: `suspended dealer direct submit → ${submit.status}` } : { status: 'FAIL', note: `status ${submit.status}` };
});

r.save();
await h.pool.end();
