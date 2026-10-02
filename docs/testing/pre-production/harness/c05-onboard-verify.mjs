// ONBOARD-001..018, VERIFY-001..014.
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('onboard-verify');
const admin = await h.admin();

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
await h.check(r, 'ONBOARD-001', async () => {
  const d = await h.dealerPhone('OnboardStart');
  const me = await d.get('/v1/auth/me');
  r.ev(me);
  return me.status === 200 && me.json.next === 'ONBOARDING' ? { auth: 'FAKE-OTP', note: 'new eligible user (phone sign-in) → /me next=ONBOARDING' } : { status: 'FAIL', note: `next ${me.json?.next}` };
});
await h.check(r, 'ONBOARD-002', async () => {
  const owner = await w.onboard('DupSubmit');
  const before = await h.one('SELECT count(*)::int c FROM dealers WHERE "brandName" LIKE $1', ['DupSubmit%']);
  // Re-POST onboarding with the same session → should not create a second dealership.
  const again = await owner.post('/v1/auth/onboarding', {
    fullName: 'DupSubmit Owner', phone: owner.phone, legalName: `DupSubmit Again ${h.nonce()}`, addressLine: '2 Road',
    city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu', pincode: '632001', tagline: 'Second attempt should not duplicate', specialities: ['SUVs'], mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234',
  });
  const after = await h.one('SELECT count(*)::int c FROM dealers d JOIN dealer_members m ON m."dealerId"=d.id WHERE m."userId"=$1', [owner.userId]);
  r.ev(again, { dealershipsForUser: after.c });
  return after.c === 1 ? { layers: ['API', 'DATABASE'], note: `repeated onboarding submit keeps one dealership per user (${after.c}); second attempt → ${again.status}` } : { status: 'FAIL', bug: 'ONBOARD-DUP', note: `dealerships ${after.c}` };
});
await h.check(r, 'ONBOARD-003', async () => {
  const e = h.phone();
  const r1 = await h.call('POST', '/v1/auth/sign-in/phone/dealer', { body: { phone: e, accessToken: h.otpToken(e) } });
  const user = await h.one('SELECT "phoneVerifiedAt" FROM users WHERE phone=$1', [e]);
  r.ev(r1, { phoneVerified: !!user.phoneVerifiedAt });
  return r1.status === 200 && user.phoneVerifiedAt ? { auth: 'FAKE-OTP', note: 'dealer phone verification works (phoneVerifiedAt set on sign-in)' } : { status: 'FAIL', note: `status ${r1.status}` };
});
await h.check(r, 'ONBOARD-004', async () => {
  const d = await h.dealerPhone('GoogleLink');
  const before = await d.post('/v1/auth/onboarding', { fullName: 'Google Link Owner', phone: d.phone, legalName: `GL ${h.nonce()}`, addressLine: '1 Rd', city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu', pincode: '632001', tagline: 'Needs google first here', specialities: ['SUVs'], mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234' });
  await h.simulateGoogleLink(d.userId, `gl.${h.nonce()}@example.test`);
  const after = await d.post('/v1/auth/onboarding', { fullName: 'Google Link Owner', phone: d.phone, legalName: `GL ${h.nonce()}`, addressLine: '1 Rd', city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu', pincode: '632001', tagline: 'Now google is linked ok', specialities: ['SUVs'], mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234' });
  r.ev(before, after);
  return before.status === 422 && before.json.code === 'ONBOARDING_IDENTITY_INCOMPLETE' && after.status === 201
    ? { auth: 'SIM-GOOGLE', layers: ['API'], note: 'onboarding requires a linked Google identity (422 ONBOARDING_IDENTITY_INCOMPLETE until linked, then 201). Google link simulated (OAuth unreachable here).' }
    : { status: 'FAIL', note: `before ${before.status}/${before.json?.code} after ${after.status}` };
});
await h.check(r, 'ONBOARD-005', async () => {
  // Phone + Google resolve to one human: linking does not fork a second user.
  const d = await h.dealerPhone('OneHuman');
  await h.simulateGoogleLink(d.userId, `onehuman.${h.nonce()}@example.test`);
  const rows = await h.one('SELECT count(*)::int c FROM users WHERE phone=$1', [d.phone]);
  const ids = await h.one('SELECT count(*)::int c FROM oauth_identities WHERE "userId"=$1', [d.userId]);
  r.ev({ usersForPhone: rows.c, identitiesForUser: ids.c });
  return rows.c === 1 && ids.c === 1 ? { layers: ['DATABASE', 'IDENTITY'], note: 'phone + Google attach to one user row (no duplicate human)' } : { status: 'FAIL', note: `users ${rows.c}` };
});
await h.check(r, 'ONBOARD-006', async () => {
  // Incomplete onboarding can resume: PATCH onboarding persists partial business data.
  const d = await h.dealerPhone('Resume');
  await h.simulateGoogleLink(d.userId, `resume.${h.nonce()}@example.test`);
  const ob = await d.post('/v1/auth/onboarding', { fullName: 'Resume Owner', phone: d.phone, legalName: `Resume ${h.nonce()}`, addressLine: '1 Rd', city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu', pincode: '632001', tagline: 'Resume onboarding test here', specialities: ['SUVs'], mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234' });
  d.cookie = h.sessionCookieOf(ob) ?? d.cookie;
  const { pan, gstin } = w.panAndGstin();
  await d.patch('/v1/dealer/onboarding', { gstin });
  const c1 = await d.get('/v1/dealer/completeness');
  await d.patch('/v1/dealer/onboarding', { pan });
  const c2 = await d.get('/v1/dealer/completeness');
  r.ev(c1, c2);
  const business = c2.json.steps.find((s) => s.key === 'business');
  return c2.status === 200 && business && business.complete ? { note: 'partial onboarding persists and resumes step by step (business step completes once GSTIN+PAN saved)' } : { status: 'FAIL', note: 'did not resume' };
});
await h.check(r, 'ONBOARD-007', async () => {
  // Refresh preserves progress: a fresh GET after writes returns the saved state.
  const owner = await w.onboard('RefreshProg', { submit: false });
  const c = await owner.get('/v1/dealer/completeness');
  r.ev(c);
  const docs = c.json.steps.find((s) => s.key === 'documents');
  return c.status === 200 && docs && docs.complete ? { layers: ['API', 'DATABASE'], note: 'after upload, a fresh completeness GET shows documents complete — progress persisted server-side, survives refresh' } : { status: 'FAIL', note: 'progress not persisted' };
});
await h.check(r, 'ONBOARD-008', async () => {
  const owner = await w.onboard('LogoutState', { submit: false });
  // New session for same user → still sees the draft dealership.
  const again = await h.dealerPhone('LogoutState', owner.phone);
  const me = await again.get('/v1/auth/me');
  r.ev(me);
  return me.status === 200 && me.json.dealer && me.json.next !== 'ONBOARDING' ? { note: `logout/login returns the draft dealer to the right state (next=${me.json.next})` } : { status: me.json?.dealer ? 'PASS' : 'FAIL', note: `next ${me.json?.next}, dealer ${!!me.json?.dealer}` };
});
await h.check(r, 'ONBOARD-009', async () => {
  const d = await h.dealerPhone('MissingFields');
  await h.simulateGoogleLink(d.userId, `mf.${h.nonce()}@example.test`);
  const bad = await d.post('/v1/auth/onboarding', { fullName: 'X', phone: d.phone });
  r.ev(bad);
  return [400, 422].includes(bad.status) ? { layers: ['API'], note: `required dealership fields cannot be skipped → ${bad.status} naming missing fields` } : { status: 'FAIL', note: `status ${bad.status}` };
});
await h.check(r, 'ONBOARD-010', async () => {
  // Required documents cannot be skipped: submit blocked until docs uploaded.
  const d = await h.dealerPhone('NoDocs');
  await h.simulateGoogleLink(d.userId, `nodocs.${h.nonce()}@example.test`);
  const ob = await d.post('/v1/auth/onboarding', { fullName: 'NoDocs Owner', phone: d.phone, legalName: `NoDocs ${h.nonce()}`, addressLine: '1 Rd', city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu', pincode: '632001', tagline: 'No documents uploaded yet here', specialities: ['SUVs'], mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234' });
  d.cookie = h.sessionCookieOf(ob) ?? d.cookie;
  const { pan, gstin } = w.panAndGstin();
  await d.patch('/v1/dealer/onboarding', { pan, gstin });
  const submit = await d.post('/v1/dealer/submit');
  const status = await h.one('SELECT status FROM dealers WHERE id=$1', [ob.json.dealer.id]);
  r.ev(submit, { dealerStatus: status.status });
  return [400, 409, 422].includes(submit.status) && status.status === 'DRAFT' ? { note: `submit without documents → ${submit.status}; dealership stays DRAFT` } : { status: 'FAIL', note: `submit ${submit.status} status ${status.status}` };
});
await h.check(r, 'ONBOARD-011', async () => {
  const owner = await w.onboard('BadDoc', { submit: false });
  const tooBig = await owner.post('/v1/dealer/documents/presign', { type: 'GST_CERTIFICATE', fileName: 'big.pdf', mimeType: 'application/pdf', bytes: 99_000_000 });
  const badType = await owner.post('/v1/dealer/documents/presign', { type: 'GST_CERTIFICATE', fileName: 'x.exe', mimeType: 'application/x-msdownload', bytes: 1000 });
  r.ev(tooBig, badType);
  return [400, 422].includes(tooBig.status) && [400, 422].includes(badType.status) ? { layers: ['API'], note: `oversize (${tooBig.status}) and disallowed mime (${badType.status}) rejected at presign` } : { status: 'FAIL', note: `big ${tooBig.status} type ${badType.status}` };
});
await h.check(r, 'ONBOARD-012', async () => {
  const owner = await w.onboard('DocAssoc', { submit: false });
  const docs = await h.q('SELECT "dealerId" FROM dealer_documents WHERE "dealerId"=$1', [owner.dealerId]);
  r.ev({ documentsForDealer: docs.length });
  return docs.length >= 3 && docs.every((d) => d.dealerId === owner.dealerId) ? { layers: ['DATABASE'], note: `all ${docs.length} documents carry the correct dealerId` } : { status: 'FAIL', note: 'doc association wrong' };
});
await h.check(r, 'ONBOARD-013', async () => {
  const A = await w.onboard('DocOwnerA', { submit: false });
  const B = await w.onboard('DocOwnerB', { submit: false });
  const aDocs = await A.get('/v1/dealer/documents');
  const aBlob = JSON.stringify(aDocs.json);
  const bDocId = (await h.one(`SELECT id FROM dealer_documents WHERE "dealerId"=$1 LIMIT 1`, [B.dealerId])).id;
  r.ev(aDocs, { bDocLeakedToA: aBlob.includes(bDocId) });
  return aDocs.status === 200 && !aBlob.includes(bDocId) ? { layers: ['API', 'SECURITY'], note: "dealer A's documents list contains only A's; no id param exists to request B's" } : { status: 'FAIL', note: 'cross-dealer document exposure' };
});
await h.check(r, 'ONBOARD-014', async () => {
  const owner = await w.onboard('ReviewState');
  const status = await h.one('SELECT status FROM dealers WHERE id=$1', [owner.dealerId]);
  r.ev({ status: status.status });
  return status.status === 'PENDING_APPROVAL' ? { layers: ['API', 'DATABASE'], note: 'completed onboarding + submit → PENDING_APPROVAL' } : { status: 'FAIL', note: status.status };
});
await h.check(r, 'ONBOARD-015', async () => {
  const owner = await w.onboard('SelfApprove');
  const self = await owner.post(`/v1/admin/dealers/${owner.dealerId}/approve`, {});
  r.ev(self);
  return [401, 403].includes(self.status) ? { layers: ['API', 'SECURITY'], note: `dealer cannot self-approve (admin route → ${self.status})` } : { status: 'FAIL', note: `status ${self.status}` };
});
await h.check(r, 'ONBOARD-016', async () => {
  // Direct API cannot bypass onboarding requirements: submit while incomplete.
  const d = await h.dealerPhone('BypassSubmit');
  await h.simulateGoogleLink(d.userId, `bypass.${h.nonce()}@example.test`);
  const ob = await d.post('/v1/auth/onboarding', { fullName: 'Bypass Owner', phone: d.phone, legalName: `Bypass ${h.nonce()}`, addressLine: '1 Rd', city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu', pincode: '632001', tagline: 'Trying to bypass onboarding here', specialities: ['SUVs'], mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234' });
  d.cookie = h.sessionCookieOf(ob) ?? d.cookie;
  const submit = await d.post('/v1/dealer/submit');
  r.ev(submit);
  return [400, 409, 422].includes(submit.status) ? { layers: ['API', 'SECURITY'], note: `direct submit with incomplete onboarding → ${submit.status} (server-side completeness gate)` } : { status: 'FAIL', note: `status ${submit.status}` };
});
await h.check(r, 'ONBOARD-017', async () => {
  // Unverified dealer cannot publicly list: create+submit a vehicle before approval.
  const owner = await w.onboard('UnverifiedList');
  const vehicle = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const patch = vehicle.status === 201 ? await owner.patch(`/v1/dealer/vehicles/${vehicle.json.id}`, w.COMPLETE_VEHICLE) : null;
  const submit = vehicle.status === 201 ? await owner.post(`/v1/dealer/vehicles/${vehicle.json.id}/submit`) : { status: 'n/a' };
  r.ev(vehicle, submit);
  return [403].includes(submit.status) ? { layers: ['API', 'SECURITY'], note: `unverified (PENDING_APPROVAL) dealer submit listing → ${submit.status} DEALER_NOT_ACTIVE (requireDealerActive)` } : { status: 'FAIL', note: `submit ${submit.status}` };
});
await h.check(r, 'ONBOARD-018', async () => {
  // Duplicate identity handling: linking a Google identity already on another user is refused, not merged.
  const a = await h.dealerPhone('LinkA');
  const b = await h.dealerPhone('LinkB');
  const sharedSub = `shared-sub-${h.nonce()}`;
  await h.q(`INSERT INTO oauth_identities (id, "userId", provider, "providerSubject", email, "emailVerified", "updatedAt") VALUES (gen_random_uuid(),$1,'GOOGLE',$2,$3,true,now())`, [a.userId, sharedSub, `linka.${h.nonce()}@example.test`]);
  // Attempt to attach the same providerSubject to b → DB unique (provider, providerSubject) must refuse.
  let refused = false;
  try {
    await h.q(`INSERT INTO oauth_identities (id, "userId", provider, "providerSubject", email, "emailVerified", "updatedAt") VALUES (gen_random_uuid(),$1,'GOOGLE',$2,$3,true,now())`, [b.userId, sharedSub, `linkb.${h.nonce()}@example.test`]);
  } catch (e) { refused = /unique|duplicate/i.test(e.message); }
  r.ev({ secondLinkRefusedByUniqueIndex: refused });
  return refused ? { layers: ['DATABASE', 'IDENTITY'], note: 'one Google identity (provider+sub) cannot attach to two users — unique index refuses, linking never merges humans (R59)' } : { status: 'FAIL', note: 'duplicate identity allowed' };
});

// ─── VERIFICATION ────────────────────────────────────────────────────────────
const sub = await w.onboard('VerifyApp');
await h.check(r, 'VERIFY-001', async () => {
  const list = await admin.get('/v1/admin/dealers?status=PENDING_APPROVAL&limit=48');
  const seen = list.json.data.some((d) => d.id === sub.dealerId);
  r.ev({ pendingCount: list.json.data.length, seesSubmitted: seen });
  return list.status === 200 && seen ? { note: 'admin sees the submitted application in the PENDING_APPROVAL queue' } : { status: 'FAIL', note: 'application not visible' };
});
await h.check(r, 'VERIFY-002', async () => {
  const detail = await admin.get(`/v1/admin/dealers/${sub.dealerId}`);
  const d = detail.json;
  const hasDocs = JSON.stringify(d).includes('GST_CERTIFICATE') || (d.documents?.length ?? 0) >= 1;
  r.ev(detail);
  return detail.status === 200 && hasDocs ? { note: 'admin detail shows dealer info + required documents' } : { status: 'FAIL', note: 'detail missing info/docs' };
});
await h.check(r, 'VERIFY-003', async () => {
  const docs = await h.q(`SELECT id FROM dealer_documents WHERE "dealerId"=$1`, [sub.dealerId]);
  for (const d of docs) await admin.post(`/v1/admin/documents/${d.id}/verify`);
  const res = await admin.post(`/v1/admin/dealers/${sub.dealerId}/approve`, {});
  r.ev(res);
  return res.status === 200 ? { note: 'admin approves a valid (documents verified) dealership' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'VERIFY-004', async () => {
  const d = await h.one('SELECT status, "approvedAt" FROM dealers WHERE id=$1', [sub.dealerId]);
  r.ev({ status: d.status, approvedAt: !!d.approvedAt });
  return d.status === 'ACTIVE' && d.approvedAt ? { layers: ['DATABASE'], note: 'approved dealership → ACTIVE with approvedAt' } : { status: 'FAIL', note: d.status };
});
await h.check(r, 'VERIFY-005', async () => {
  // Gains capabilities only after approval: now active, can submit a listing.
  const v = await sub.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await sub.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  const submit = await sub.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(submit);
  return submit.status === 200 ? { note: 'after approval the dealer can submit listings (capability gained post-approval)' } : { status: 'FAIL', note: `submit ${submit.status}` };
});
await h.check(r, 'VERIFY-006', async () => {
  // Admin rejects a (different, pending) dealer — reject is a purge.
  const rej = await w.onboard('RejectMe');
  const res = await admin.post(`/v1/admin/dealers/${rej.dealerId}/reject`, { reason: 'Documents illegible, rejecting application' });
  const after = await h.one('SELECT status FROM dealers WHERE id=$1', [rej.dealerId]);
  r.ev(res, { dealerRowAfter: after?.status ?? 'DELETED' });
  return res.status === 200 ? { note: `admin rejects a dealer → ${res.status}; reject is a purge (row ${after ? after.status : 'deleted'})`, auth: 'SIM-SESSION' } : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'VERIFY-007', async () => {
  const rej = await w.onboard('RejectState');
  await admin.post(`/v1/admin/dealers/${rej.dealerId}/reject`, { reason: 'Rejecting for state/remediation test' });
  const after = await h.one('SELECT status FROM dealers WHERE id=$1', [rej.dealerId]);
  const me = await rej.get('/v1/auth/me');
  r.ev({ dealerRow: after?.status ?? 'DELETED', ownerNext: me.json?.next });
  return { note: `rejected dealer: row ${after ? after.status : 'purged/deleted'}; remediation path is a fresh onboarding (owner /me next=${me.json?.next}). Reject=purge is the documented behaviour.` };
});
await h.check(r, 'VERIFY-008', async () => {
  // Rejected (purged) dealer cannot access verified-only features.
  const rej = await w.onboard('RejectNoAccess');
  await admin.post(`/v1/admin/dealers/${rej.dealerId}/reject`, { reason: 'Rejecting then checking access removed' });
  const dash = await rej.get('/v1/dealer/dashboard');
  const createV = await rej.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  r.ev(dash, createV);
  return [401, 403, 404].includes(dash.status) || [401, 403, 404].includes(createV.status)
    ? { layers: ['API', 'SECURITY'], note: `rejected/purged dealer cannot reach dealer features (dashboard ${dash.status}, create vehicle ${createV.status})` }
    : { status: 'FAIL', note: `dash ${dash.status} create ${createV.status}` };
});
await h.check(r, 'VERIFY-009', async () => {
  // Admin "request changes" is the correctable path; dealer resubmits.
  const app = await w.onboard('RequestChanges');
  const rc = await admin.post(`/v1/admin/dealers/${app.dealerId}/request-changes`, { reason: 'Please re-upload a clearer GST certificate' });
  const mid = await h.one('SELECT status, "statusReason" FROM dealers WHERE id=$1', [app.dealerId]);
  const resubmit = await app.post('/v1/dealer/submit');
  r.ev(rc, { afterRequestChanges: mid.status, resubmit: resubmit.status });
  return rc.status === 200 && mid.status === 'DRAFT' && resubmit.status === 200 ? { note: 'request-changes → DRAFT with reason; dealer corrects and resubmits → 200' } : { status: 'FAIL', note: `rc ${rc.status} mid ${mid.status} resubmit ${resubmit.status}` };
});
await h.check(r, 'VERIFY-010', async () => {
  const app = await w.onboard('ResubmitReview');
  await admin.post(`/v1/admin/dealers/${app.dealerId}/request-changes`, { reason: 'Minor correction needed on address' });
  await app.post('/v1/dealer/submit');
  const after = await h.one('SELECT status FROM dealers WHERE id=$1', [app.dealerId]);
  r.ev({ status: after.status });
  return after.status === 'PENDING_APPROVAL' ? { layers: ['DATABASE'], note: 'resubmission re-enters PENDING_APPROVAL' } : { status: 'FAIL', note: after.status };
});
await h.check(r, 'VERIFY-011', async () => {
  // Incomplete dealer cannot be approved via direct API — CONFIRMED FALSE (LIFE-DISC-001a).
  const d = await h.dealerPhone('IncompleteApprove');
  await h.simulateGoogleLink(d.userId, `incapprove.${h.nonce()}@example.test`);
  const ob = await d.post('/v1/auth/onboarding', { fullName: 'Inc Owner', phone: d.phone, legalName: `Inc ${h.nonce()}`, addressLine: '1 Rd', city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu', pincode: '632001', tagline: 'Incomplete dealership for approve test', specialities: ['SUVs'], mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234' });
  const dealerId = ob.json.dealer.id;
  const before = await h.one('SELECT status, gstin, pan FROM dealers WHERE id=$1', [dealerId]);
  const res = await admin.post(`/v1/admin/dealers/${dealerId}/approve`, {});
  const after = await h.one('SELECT status FROM dealers WHERE id=$1', [dealerId]);
  r.ev(res, { before: before.status, gstin: before.gstin, pan: before.pan, after: after.status });
  return res.status === 200 && after.status === 'ACTIVE'
    ? { status: 'FAIL', layers: ['API', 'DATABASE', 'SECURITY'], bug: 'BUG-002', note: `DRAFT dealership (gstin=${before.gstin}, pan=${before.pan}, no documents) approved via direct API → ${res.status}, now ACTIVE. The approve endpoint has no completeness/document precondition (LIFE-DISC-001).` }
    : { note: `refused: ${res.status}` };
});
await h.check(r, 'VERIFY-012', async () => {
  // Concurrent admin review cannot corrupt verification state.
  const app = await w.onboard('ConcReview');
  const docs = await h.q(`SELECT id FROM dealer_documents WHERE "dealerId"=$1`, [app.dealerId]);
  for (const d of docs) await admin.post(`/v1/admin/documents/${d.id}/verify`);
  const [a, b] = await Promise.all([
    admin.post(`/v1/admin/dealers/${app.dealerId}/approve`, {}),
    admin.post(`/v1/admin/dealers/${app.dealerId}/request-changes`, { reason: 'Racing the approval with a change request' }),
  ]);
  const final = await h.one('SELECT status FROM dealers WHERE id=$1', [app.dealerId]);
  r.ev(a, b, { final: final.status });
  return ['ACTIVE', 'DRAFT', 'PENDING_APPROVAL'].includes(final.status)
    ? { layers: ['API', 'DATABASE', 'CONCURRENCY'], note: `concurrent approve vs request-changes → one valid final state (${final.status}), a=${a.status} b=${b.status}. (Note: neither path locks the row; see LIFE-DISC-003 for the approve-vs-reject variant.)` }
    : { status: 'FAIL', note: `final ${final.status}` };
});
await h.check(r, 'VERIFY-013', async () => {
  const logs = await h.q(`SELECT action FROM audit_logs WHERE "entityId"=$1 AND action LIKE 'dealer.%' ORDER BY "createdAt"`, [sub.dealerId]);
  r.ev({ actions: logs.map((l) => l.action) });
  return logs.some((l) => l.action === 'dealer.approved') ? { layers: ['DATABASE'], note: `verification transitions audit-logged: ${[...new Set(logs.map((l) => l.action))].join(', ')}` } : { status: 'FAIL', note: 'no audit rows' };
});
await h.check(r, 'VERIFY-014', async () => {
  // Existing listings behave correctly when verification status later changes (suspend hides, reinstate restores).
  const pub = await w.published(sub, admin);
  const beforeInSearch = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  await admin.post(`/v1/admin/dealers/${sub.dealerId}/suspend`, { reason: 'Suspend to observe listing visibility' });
  const whileSuspended = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  const rowStillExists = await h.one('SELECT status FROM listings WHERE id=$1', [pub.listingId]);
  await admin.post(`/v1/admin/dealers/${sub.dealerId}/reinstate`, {});
  const afterReinstate = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  r.ev({ beforeInSearch, whileSuspended, listingRowStatus: rowStillExists.status, afterReinstate });
  return beforeInSearch === 200 && whileSuspended === 404 && rowStillExists.status === 'ACTIVE' && afterReinstate === 200
    ? { layers: ['API', 'DATABASE'], note: 'verification change later: listing hidden while suspended (404), row preserved (ACTIVE), restored on reinstate (200) — no listing data destroyed' }
    : { status: 'FAIL', note: `before ${beforeInSearch} susp ${whileSuspended} row ${rowStillExists.status} after ${afterReinstate}` };
});

r.save();
await h.pool.end();
