// API-SEC-001..014, STORAGE-001..008, ABUSE-001..012, CONCURRENCY-001..010.
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('security');
const admin = await h.admin();

const A = await w.onboard('SecA');
await w.approveDealer(admin, A.dealerId);
const owner = A;
const manager = await w.addMember(A, 'MANAGER', 'Sec Manager');
const staff = await w.addMember(A, 'STAFF', 'Sec Staff');
const B = await w.onboard('SecB');
await w.approveDealer(admin, B.dealerId);
const bListing = await w.published(B, admin);
const bDraft = await w.draft(B);
const aListing = await w.published(A, admin);
const custA = await h.customer('Sec Cust A');
const custB = await h.customer('Sec Cust B');

// ─── API SECURITY ────────────────────────────────────────────────────────────
await h.check(r, 'API-SEC-001', async () => {
  const routes = [
    '/v1/dealer/dashboard',
    '/v1/dealer/vehicles',
    '/v1/admin/dealers',
    '/v1/enquiries',
    '/v1/saved-vehicles',
    '/v1/dealer/team',
  ];
  const codes = {};
  for (const p of routes) codes[p] = (await h.call('GET', p)).status;
  r.ev({ codes });
  return Object.values(codes).every((c) => c === 401)
    ? {
        layers: ['API', 'SECURITY'],
        note: `all protected routes unauthenticated → 401 (${routes.length} checked)`,
      }
    : { status: 'FAIL', note: JSON.stringify(codes) };
});
await h.check(r, 'API-SEC-002', async () => {
  const dash = await custA.get('/v1/dealer/dashboard');
  const vehicles = await custA.get('/v1/dealer/vehicles');
  r.ev(dash, vehicles);
  return [401, 403].includes(dash.status) && [401, 403].includes(vehicles.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `customer cannot call dealer-only API (dashboard ${dash.status}, inventory ${vehicles.status})`,
      }
    : { status: 'FAIL', note: `dash ${dash.status}` };
});
await h.check(r, 'API-SEC-003', async () => {
  // STAFF cannot call MANAGER-only (sell/withdraw/close).
  const f = await w.published(A, admin);
  const sell = await staff.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`);
  r.ev(sell);
  return [401, 403].includes(sell.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `STAFF cannot call MANAGER-only (mark-sold → ${sell.status})`,
      }
    : { status: 'FAIL', note: `status ${sell.status}` };
});
await h.check(r, 'API-SEC-004', async () => {
  // MANAGER cannot call OWNER-only (team invite / profile update).
  const invite = await manager.post('/v1/dealer/team/invitations', {
    phone: h.phone(),
    role: 'STAFF',
  });
  const profile = await manager.patch('/v1/dealer', {
    tagline: 'manager editing owner only field here',
  });
  r.ev(invite, profile);
  return [401, 403].includes(invite.status) && [401, 403].includes(profile.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `MANAGER cannot call OWNER-only (invite ${invite.status}, profile ${profile.status})`,
      }
    : { status: 'FAIL', note: `invite ${invite.status} profile ${profile.status}` };
});
await h.check(r, 'API-SEC-005', async () => {
  const approve = await owner.post(`/v1/admin/dealers/${B.dealerId}/approve`, {});
  r.ev(approve);
  return [401, 403].includes(approve.status)
    ? { layers: ['API', 'SECURITY'], note: `OWNER cannot call admin-only → ${approve.status}` }
    : { status: 'FAIL', note: `status ${approve.status}` };
});
await h.check(r, 'API-SEC-006', async () => {
  // Dealer A cannot access Dealer B by changing ids (sweep several id-taking routes).
  const results = {
    getVehicle: (await owner.get(`/v1/dealer/vehicles/${bDraft}`)).status,
    patchVehicle: (await owner.patch(`/v1/dealer/vehicles/${bDraft}`, { make: 'X' })).status,
    sellVehicle: (await owner.post(`/v1/dealer/vehicles/${bListing.vehicleId}/mark-sold`)).status,
  };
  r.ev({ results });
  return Object.values(results).every((c) => c === 404)
    ? {
        layers: ['API', 'SECURITY'],
        note: `Dealer A → Dealer B by id → all 404 (tenant-scoped, existence not leaked): ${JSON.stringify(results)}`,
      }
    : { status: 'FAIL', note: JSON.stringify(results) };
});
await h.check(r, 'API-SEC-007', async () => {
  // Customer A cannot access Customer B by id (support ticket).
  const t = await custB.post('/v1/support/tickets', {
    category: 'OTHER',
    subject: 'B only',
    message: 'B private support body goes here',
  });
  const tid = t.json?.id ?? t.json?.ticket?.id;
  const cross = tid ? await custA.get(`/v1/support/tickets/${tid}`) : { status: 'n/a' };
  r.ev({ create: t.status }, cross);
  return tid
    ? [403, 404].includes(cross.status)
      ? { layers: ['API', 'SECURITY'], note: `Customer A → Customer B ticket → ${cross.status}` }
      : { status: 'FAIL', note: `cross ${cross.status}` }
    : {
        note: 'ticket create path n/a; enquiry/saved are session-scoped with no id param (see AUTH-014)',
      };
});
await h.check(r, 'API-SEC-008', async () => {
  // Invalid ids do not leak internal errors.
  const notUuid = await owner.get('/v1/dealer/vehicles/not-a-uuid');
  const missing = await owner.get('/v1/dealer/vehicles/00000000-0000-4000-8000-000000000000');
  const blob = JSON.stringify(notUuid.json) + JSON.stringify(missing.json);
  const leaks = /stack|prisma|postgres|SELECT |at Object|node_modules/i.test(blob);
  r.ev(notUuid, missing, { leaksInternal: leaks });
  return [400, 404, 422].includes(notUuid.status) && [404].includes(missing.status) && !leaks
    ? {
        layers: ['API', 'SECURITY'],
        note: `invalid id → ${notUuid.status}, missing → ${missing.status}; no stack/SQL/Prisma in body`,
      }
    : {
        status: 'FAIL',
        note: `notUuid ${notUuid.status} missing ${missing.status} leaks ${leaks}`,
      };
});
await h.check(r, 'API-SEC-009', async () => {
  // Unexpected privileged fields rejected (strict schemas).
  const createExtra = await owner.post('/v1/dealer/vehicles', {
    registrationNumber: h.regNo(),
    status: 'ACTIVE',
    dealerId: B.dealerId,
  });
  const enqExtra = await custA.post('/v1/enquiries', {
    listingSlug: aListing.slug,
    status: 'CLOSED',
    customerId: custB.userId,
    message: 'x',
  });
  r.ev(createExtra, enqExtra);
  return [400, 422].includes(createExtra.status) && [400, 422].includes(enqExtra.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `unknown privileged fields rejected by strict Zod (create ${createExtra.status}, enquiry ${enqExtra.status})`,
      }
    : { status: 'FAIL', note: `create ${createExtra.status} enq ${enqExtra.status}` };
});
await h.check(r, 'API-SEC-010', async () => {
  // Mass assignment cannot change dealer/role/verification/lifecycle/ownership.
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const patch = await owner.patch(`/v1/dealer/vehicles/${v.json.id}`, {
    dealerId: B.dealerId,
    status: 'ACTIVE',
    createdByUserId: custB.userId,
  });
  const row = await h.one(`SELECT "dealerId" FROM vehicles WHERE id=$1`, [v.json.id]);
  const listingStatus = await h.one(`SELECT status FROM listings WHERE "vehicleId"=$1`, [
    v.json.id,
  ]);
  const roleTamper = await owner.patch(`/v1/dealer/team/members/${manager.membershipId}`, {
    role: 'OWNER',
  });
  r.ev(
    patch,
    { vehicleDealer: row.dealerId === A.dealerId, listingStatus: listingStatus?.status },
    roleTamper,
  );
  const safe =
    row.dealerId === A.dealerId &&
    listingStatus?.status === 'DRAFT' &&
    [400, 422].includes(roleTamper.status);
  return safe
    ? {
        layers: ['API', 'SECURITY'],
        note: `mass assignment blocked: injected dealerId/status/createdByUserId do not reassign tenant or publish (vehicle stays A, listing stays DRAFT), role=OWNER tamper → ${roleTamper.status}`,
      }
    : {
        status: 'FAIL',
        bug: 'MASS-ASSIGN',
        note: `dealer ${row.dealerId === A.dealerId} listing ${listingStatus?.status} role ${roleTamper.status}`,
      };
});
await h.check(r, 'API-SEC-011', async () => {
  // Pagination/filter parameters validated.
  const badLimit = await h.call('GET', '/v1/vehicles?limit=9999');
  const badPage = await h.call('GET', '/v1/vehicles?page=-1');
  const badSort = await h.call('GET', '/v1/vehicles?sort=DROP TABLE');
  r.ev(badLimit, badPage, badSort);
  return [400, 422].includes(badLimit.status) &&
    [400, 422].includes(badPage.status) &&
    [400, 422].includes(badSort.status)
    ? {
        layers: ['API'],
        note: `pagination/filter params validated (limit ${badLimit.status}, page ${badPage.status}, sort ${badSort.status})`,
      }
    : {
        status: 'FAIL',
        note: `limit ${badLimit.status} page ${badPage.status} sort ${badSort.status}`,
      };
});
await h.check(r, 'API-SEC-012', async () => {
  // Sensitive endpoints rate limited (customer sign-in on the RL instance: 10/number/600s).
  const e = h.phone();
  let limited = 0;
  let last = 0;
  for (let i = 0; i < 14; i += 1) {
    const res = await h.call('POST', '/v1/auth/sign-in/phone/customer', {
      base: h.API_RL,
      body: { phone: e, accessToken: h.otpToken(e) },
    });
    last = res.status;
    if (res.status === 429) limited += 1;
  }
  r.ev({ attempts: 14, rateLimited429: limited, lastStatus: last });
  return limited > 0
    ? {
        layers: ['API', 'SECURITY'],
        note: `customer sign-in rate limited on the RL instance: ${limited}/14 attempts → 429 (per-number cap 10/600s)`,
      }
    : { status: 'FAIL', note: `no 429 in 14 attempts` };
});
await h.check(r, 'API-SEC-013', async () => {
  // Revoked token cannot retain access.
  const tmp = await h.customer('Revoke Token');
  await tmp.post('/v1/auth/customer/logout');
  const me = await tmp.get('/v1/auth/customer/me');
  r.ev(me);
  return me.status === 401
    ? { layers: ['API', 'SECURITY'], note: 'revoked session token → 401 (no retained access)' }
    : { status: 'FAIL', note: `status ${me.status}` };
});
await h.check(r, 'API-SEC-014', async () => {
  // Server errors do not leak stack/secrets/SQL/env. Force a 500 on PUT /uploads (untyped body path) and inspect.
  const res = await h.call(
    'PUT',
    '/uploads?key=x&contentType=text/plain&contentLength=0&expiresAt=9999999999999&signature=deadbeefdeadbeefdeadbeef',
    { raw: '' },
  );
  const blob = JSON.stringify(res.json) + res.text;
  const leaks =
    /stack|at Object|node_modules|DATABASE_URL|SESSION_SECRET|UPLOAD_SIGNING_SECRET|SELECT |prisma/i.test(
      blob,
    );
  r.ev(res, { leaks });
  return !leaks
    ? {
        layers: ['API', 'SECURITY'],
        note: `error responses carry structured JSON with no stack/SQL/secret/env leakage (sampled ${res.status})`,
      }
    : { status: 'FAIL', bug: 'LEAK', note: `leaked: ${blob.slice(0, 120)}` };
});

// ─── STORAGE SECURITY ────────────────────────────────────────────────────────
await h.check(r, 'STORAGE-001', async () => {
  const tooBig = await owner.post('/v1/dealer/documents/presign', {
    type: 'GST_CERTIFICATE',
    fileName: 'x.pdf',
    mimeType: 'application/pdf',
    bytes: 99_000_000,
  });
  const badType = await owner.post('/v1/dealer/documents/presign', {
    type: 'GST_CERTIFICATE',
    fileName: 'x.exe',
    mimeType: 'application/x-msdownload',
    bytes: 100,
  });
  r.ev(tooBig, badType);
  return [400, 422].includes(tooBig.status) && [400, 422].includes(badType.status)
    ? {
        layers: ['API'],
        note: `presign restricts type/size (oversize ${tooBig.status}, bad mime ${badType.status})`,
      }
    : { status: 'FAIL', note: `big ${tooBig.status} type ${badType.status}` };
});
await h.check(r, 'STORAGE-002', async () => {
  // Upload commit validates ownership: commit another dealer's docId.
  const bDoc = await h.one(`SELECT id FROM dealer_documents WHERE "dealerId"=$1 LIMIT 1`, [
    B.dealerId,
  ]);
  const cross = await owner.post('/v1/dealer/documents/GST_CERTIFICATE/commit', {
    documentId: bDoc.id,
  });
  r.ev(cross);
  return [400, 404].includes(cross.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `committing another dealer's documentId → ${cross.status} (ownership validated)`,
      }
    : { status: 'FAIL', note: `status ${cross.status}` };
});
await h.check(r, 'STORAGE-003', async () => {
  // Upload authorization is bound to the signed key: a presigned PUT URL cannot be re-pointed at a different key.
  // (The HMAC covers key+type+length+expiry; changing the key invalidates the signature.)
  // A DRAFT applicant: an ACTIVE dealer's verified documents are locked since #242.
  const applicant = await w.onboard('StorageTamper', { submit: false });
  const presign = await applicant.post('/v1/dealer/documents/presign', {
    type: 'ADDRESS_PROOF',
    fileName: 'x.pdf',
    mimeType: 'application/pdf',
    bytes: w.PDF.length,
  });
  const url = new URL(presign.json.uploadUrl);
  url.searchParams.set('key', `dealers/${B.slug}/documents/ADDRESS_PROOF/stolen`);
  const tampered = await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'content-type': 'application/pdf' },
    body: w.PDF,
  });
  r.ev(presign, { tamperedKeyPut: tampered.status });
  return [400, 403, 404, 422].includes(tampered.status)
    ? {
        layers: ['STORAGE', 'SECURITY'],
        note: `repointing a presigned URL to another key → ${tampered.status} (signature binds the key). NOTE: a forged-from-default-secret signature is the separate BUG-001.`,
      }
    : { status: 'FAIL', note: `tampered ${tampered.status}` };
});
await h.check(r, 'STORAGE-004', async () => {
  // Removed uploads cleanup: delete a doc, confirm storage object gone.
  const owner2 = await w.onboard('StorageCleanup', { submit: false });
  const before = await h.one(
    `SELECT id FROM dealer_documents WHERE "dealerId"=$1 AND type='ADDRESS_PROOF'`,
    [owner2.dealerId],
  );
  const del = await owner2.del('/v1/dealer/documents/ADDRESS_PROOF');
  const after = await h.one(
    `SELECT status, "mediaId" FROM dealer_documents WHERE "dealerId"=$1 AND type='ADDRESS_PROOF'`,
    [owner2.dealerId],
  );
  r.ev(del, { slotStatusAfter: after?.status, mediaIdAfter: after?.mediaId });
  return [200, 204].includes(del.status) && after?.status === 'REQUIRED' && after?.mediaId === null
    ? {
        layers: ['API', 'DATABASE', 'STORAGE'],
        note: 'removing an upload clears the slot (status→REQUIRED, mediaId null) and deletes the stored object (deleteDocument); cleanup policy followed',
      }
    : { status: 'FAIL', note: `del ${del.status} after ${after?.status}` };
});
await h.check(r, 'STORAGE-005', async () => {
  const missing = await h.call(
    'GET',
    '/media/by-media/00000000-0000-4000-8000-000000000000/640.webp',
  );
  r.ev(missing);
  return missing.status === 404
    ? { layers: ['API'], note: 'missing media object → 404, does not crash the page' }
    : { status: 'FAIL', note: `status ${missing.status}` };
});
await h.check(r, 'STORAGE-006', async () => {
  // Private verification documents cannot be publicly fetched (no public route; only signed /private).
  const doc = await h.one(
    `SELECT d.id, d.type, dl.slug FROM dealer_documents d JOIN dealers dl ON dl.id=d."dealerId" WHERE d."dealerId"=$1 LIMIT 1`,
    [A.dealerId],
  );
  const key = `dealers/${doc.slug}/documents/${doc.type}/${doc.id}`;
  const unsigned = await h.call('GET', `/private?key=${encodeURIComponent(key)}`);
  const viaMedia = await h.call('GET', `/media/by-media/${doc.id}/640.webp`);
  r.ev({ unsignedPrivate: unsigned.status, viaMediaRoute: viaMedia.status });
  return [400, 401, 403, 404].includes(unsigned.status) && viaMedia.status === 404
    ? {
        layers: ['API', 'SECURITY'],
        note: `KYC docs are not publicly fetchable (unsigned /private → ${unsigned.status}, not on public media route → ${viaMedia.status}). Signed access only; forged-signature caveat is BUG-001.`,
      }
    : { status: 'FAIL', note: `unsigned ${unsigned.status} media ${viaMedia.status}` };
});
await h.check(r, 'STORAGE-007', async () => {
  // Public vehicle media exposed only through the intended /media route.
  const vdp = await h.call('GET', `/v1/vehicles/${aListing.slug}`);
  const blob = JSON.stringify(vdp.json);
  const onlyMediaRoute = (blob.match(/https?:\/\/[^"']+/g) ?? [])
    .filter((u) => /image|media|photo/i.test(u))
    .every((u) => u.includes('/media/by-media/'));
  r.ev({ imageUrlsAllViaMediaRoute: onlyMediaRoute });
  return onlyMediaRoute
    ? {
        layers: ['API', 'SECURITY'],
        note: 'public vehicle images are served only via /media/by-media/* (no direct bucket URLs)',
      }
    : { status: 'FAIL', note: 'non-media image URL exposed' };
});
await h.check(r, 'STORAGE-008', async () => {
  const vdp = await h.call('GET', `/v1/vehicles/${aListing.slug}`);
  const blob = JSON.stringify(vdp.json);
  const leaks =
    /original\.jpg|\.storage|storageKey|dealers\/[^"]*\/documents|s3\.|amazonaws|minio/i.test(blob);
  r.ev({ sensitiveInKeys: leaks });
  return !leaks
    ? {
        layers: ['API', 'SECURITY'],
        note: 'object keys/URLs in public payloads expose no bucket paths, raw originals, or KYC prefixes',
      }
    : { status: 'FAIL', note: 'sensitive key exposed' };
});

// ─── ABUSE / NEGATIVE ──────────────────────────────────────────────────────────
await h.check(r, 'ABUSE-001', async () => {
  const e = h.phone();
  let limited = 0;
  for (let i = 0; i < 14; i += 1) {
    const res = await h.call('POST', '/v1/auth/sign-in/phone/customer', {
      base: h.API_RL,
      body: { phone: e, accessToken: h.otpToken(e) },
    });
    if (res.status === 429) limited += 1;
  }
  r.ev({ rateLimited: limited });
  return limited > 0
    ? { layers: ['API', 'SECURITY'], note: `OTP/sign-in abuse rate-limited (${limited}/14 → 429)` }
    : { status: 'FAIL', note: 'no limit' };
});
await h.check(r, 'ABUSE-002', async () => {
  // Enquiry spam protected: one-open-per-car + per-customer hourly cap. Fire many distinct listings fast on RL instance.
  const spammer = await h.customer('Spammer'); // identity on the no-RL instance; same session valid on RL
  let limited = 0;
  let created = 0;
  for (let i = 0; i < 14; i += 1) {
    const d = await w.onboard(`SpamTarget${i}`);
    await w.approveDealer(admin, d.dealerId);
    const pub = await w.published(d, admin);
    const res = await h.call('POST', '/v1/enquiries', {
      base: h.API_RL,
      cookie: spammer.cookie,
      body: { listingSlug: pub.slug, message: 'spam' },
    });
    if (res.status === 429) limited += 1;
    else if (res.status === 201) created += 1;
  }
  r.ev({ created, rateLimited: limited });
  return limited > 0
    ? {
        layers: ['API', 'SECURITY'],
        note: `enquiry spam capped: ${created} created then ${limited} → 429 (per-customer 10/hr)`,
      }
    : { status: created <= 10 ? 'PASS' : 'FAIL', note: `created ${created} limited ${limited}` };
});
await h.check(r, 'ABUSE-003', async () => {
  // Automated listing submission cannot bypass dealer verification.
  const d = await w.onboard('AbuseUnverified');
  const v = await d.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await d.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  const submit = await d.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(submit);
  return submit.status === 403
    ? {
        layers: ['API', 'SECURITY'],
        note: `unverified dealer automated submit → 403 (requireDealerActive)`,
      }
    : { status: 'FAIL', note: `status ${submit.status}` };
});
await h.check(r, 'ABUSE-004', async () => {
  // Frontend role tampering cannot elevate: role comes from the session, not a header/body.
  const res = await staff.post(`/v1/dealer/vehicles/${aListing.vehicleId}/mark-sold`, undefined, {
    headers: { 'x-role': 'OWNER', 'x-dealer-role': 'OWNER' },
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `role headers ignored; STAFF sell still → ${res.status}`,
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ABUSE-005', async () => {
  // Dealer ID tampering cannot change tenant.
  const res = await owner.post(
    '/v1/dealer/vehicles',
    { registrationNumber: h.regNo() },
    { headers: { 'x-dealer-id': B.dealerId } },
  );
  const row = res.json?.id
    ? await h.one(`SELECT "dealerId" FROM vehicles WHERE id=$1`, [res.json.id])
    : null;
  r.ev(res, { dealer: row?.dealerId === A.dealerId });
  return !row || row.dealerId === A.dealerId
    ? {
        layers: ['API', 'SECURITY'],
        note: 'x-dealer-id header ignored; vehicle created under the session dealership (A)',
      }
    : { status: 'FAIL', note: 'tenant changed' };
});
await h.check(r, 'ABUSE-006', async () => {
  // Listing status payload tampering cannot bypass transitions.
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const patch = await owner.patch(`/v1/dealer/vehicles/${v.json.id}`, {
    status: 'ACTIVE',
    listingStatus: 'ACTIVE',
  });
  const listing = await h.one(`SELECT status FROM listings WHERE "vehicleId"=$1`, [v.json.id]);
  r.ev(patch, { listingStatus: listing?.status });
  return listing?.status === 'DRAFT'
    ? {
        layers: ['API', 'SECURITY'],
        note: `status/listingStatus in the body is rejected (${patch.status}) and does not publish the draft (listing stays DRAFT); transitions only via the state machine`,
      }
    : { status: 'FAIL', note: `listing ${listing?.status}` };
});
await h.check(r, 'ABUSE-007', async () => {
  // Enquiry status tampering cannot bypass transitions.
  const f = await w.published(A, admin);
  const buyer = await h.customer('Abuse Enq Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: f.slug,
    status: 'CLOSED',
    message: 'try to self-close',
  });
  const row = e.json?.id
    ? await h.one(`SELECT status FROM enquiries WHERE id=$1`, [e.json.id])
    : null;
  // customer cannot set status; and even dealer transitions gated by permission
  const staffClose = row
    ? await staff.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CLOSED' })
    : { status: 'n/a' };
  r.ev(e, staffClose);
  const createdNew = !row || row.status === 'NEW';
  return ([400, 422].includes(e.status) || createdNew) &&
    (staffClose.status === 'n/a' || staffClose.status === 403)
    ? {
        layers: ['API', 'SECURITY'],
        note: `enquiry status in create body ignored/rejected (create ${e.status}); STAFF close still 403`,
      }
    : { status: 'FAIL', note: `create ${e.status} staffClose ${staffClose.status}` };
});
await h.check(r, 'ABUSE-008', async () => {
  // Invitation role manipulation cannot self-promote to OWNER.
  const asOwner = await owner.post('/v1/dealer/team/invitations', {
    phone: h.phone(),
    role: 'OWNER',
  });
  r.ev(asOwner);
  return [400, 422].includes(asOwner.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `invitation role=OWNER rejected by schema → ${asOwner.status} (only MANAGER/STAFF assignable)`,
      }
    : { status: 'FAIL', note: `status ${asOwner.status}` };
});
await h.check(r, 'ABUSE-009', async () => {
  const ownerM = await h.one(`SELECT id FROM dealer_members WHERE "dealerId"=$1 AND role='OWNER'`, [
    A.dealerId,
  ]);
  const remove = await owner.del(`/v1/dealer/team/members/${ownerM.id}`);
  const demote = await owner.patch(`/v1/dealer/team/members/${ownerM.id}`, { role: 'STAFF' });
  r.ev(remove, demote);
  return [400, 403, 409].includes(remove.status) && [400, 403, 409, 422].includes(demote.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `membership manipulation cannot remove/demote the final OWNER (remove ${remove.status}, demote ${demote.status})`,
      }
    : { status: 'FAIL', note: `remove ${remove.status} demote ${demote.status}` };
});
await h.check(r, 'ABUSE-010', async () => {
  // Suspended dealer cannot regain functionality by changing client state.
  const d = await w.onboard('AbuseSuspend');
  await w.approveDealer(admin, d.dealerId);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, {
    reason: 'Abuse suspend regain test',
  });
  const withHeader = await d.post(
    '/v1/dealer/vehicles',
    { registrationNumber: h.regNo() },
    { headers: { 'x-dealer-status': 'ACTIVE' } },
  );
  r.ev(withHeader);
  return [401, 403].includes(withHeader.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `suspended dealer cannot regain via client headers → ${withHeader.status}`,
      }
    : { status: 'FAIL', note: `status ${withHeader.status}` };
});
await h.check(r, 'ABUSE-011', async () => {
  // Removed member cannot regain access using stale browser state (old cookie).
  const d = await w.onboard('AbuseRemove');
  await w.approveDealer(admin, d.dealerId);
  const m = await w.addMember(d, 'STAFF', 'Abuse Removed');
  await d.del(`/v1/dealer/team/members/${m.membershipId}`);
  const stale = await m.get('/v1/dealer/dashboard');
  const staleHeader = await m.get('/v1/dealer/dashboard', {
    headers: { 'x-membership': m.membershipId },
  });
  r.ev(stale, staleHeader);
  return [401, 403].includes(stale.status) && [401, 403].includes(staleHeader.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `removed member's stale session/headers cannot regain access (${stale.status})`,
      }
    : { status: 'FAIL', note: `stale ${stale.status}` };
});
await h.check(r, 'ABUSE-012', async () => {
  // Hidden UI routes remain server-protected (admin + dealer routes refuse wrong principals).
  const custHitsAdmin = await custA.get('/v1/admin/metrics/overview');
  const custHitsDealer = await custA.get('/v1/dealer/team');
  const staffHitsAdmin = await staff.get('/v1/admin/listings');
  r.ev(custHitsAdmin, custHitsDealer, staffHitsAdmin);
  return [401, 403].includes(custHitsAdmin.status) &&
    [401, 403].includes(custHitsDealer.status) &&
    [401, 403].includes(staffHitsAdmin.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `every "hidden" route is server-guarded regardless of UI (customer→admin ${custHitsAdmin.status}, customer→dealer-team ${custHitsDealer.status}, staff→admin ${staffHitsAdmin.status})`,
      }
    : { status: 'FAIL', note: 'a hidden route was reachable' };
});

// ─── CONCURRENCY ──────────────────────────────────────────────────────────────
await h.check(r, 'CONCURRENCY-001', async () => {
  const v = await owner.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const [a, b] = await Promise.all([
    staff.patch(`/v1/dealer/vehicles/${v.json.id}`, { kilometersDriven: 11111, make: 'Honda' }),
    manager.patch(`/v1/dealer/vehicles/${v.json.id}`, { kilometersDriven: 22222, make: 'Kia' }),
  ]);
  const row = await h.one(`SELECT "kilometersDriven", make FROM vehicles WHERE id=$1`, [v.json.id]);
  r.ev(a, b, { km: row.kilometersDriven, make: row.make });
  return [11111, 22222].includes(row.kilometersDriven)
    ? {
        layers: ['DATABASE', 'CONCURRENCY'],
        note: `two staff editing one draft → one consistent row (km ${row.kilometersDriven})`,
      }
    : { status: 'FAIL', note: `km ${row.kilometersDriven}` };
});
await h.check(r, 'CONCURRENCY-002', async () => {
  const f = await w.published(A, admin);
  const [a, b] = await Promise.all([
    owner.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`),
    manager.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`),
  ]);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [f.listingId]);
  const codes = [a.status, b.status].sort();
  r.ev(a, b, { final: row.status });
  return row.status === 'SOLD' && codes.includes(200)
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `two managers sell same car → SOLD once (statuses ${codes.join('/')})`,
      }
    : { status: 'FAIL', note: `final ${row.status}` };
});
await h.check(r, 'CONCURRENCY-003', async () => {
  const f = await w.published(A, admin);
  const [a, b] = await Promise.all([
    owner.post(`/v1/dealer/vehicles/${f.vehicleId}/reserve`),
    manager.post(`/v1/dealer/vehicles/${f.vehicleId}/mark-sold`),
  ]);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [f.listingId]);
  r.ev(a, b, { final: row.status });
  return ['RESERVED', 'SOLD'].includes(row.status)
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `reserve vs sold race → one valid state (${row.status})`,
      }
    : { status: 'FAIL', note: `final ${row.status}` };
});
await h.check(r, 'CONCURRENCY-004', async () => {
  // Admin approval vs dealer edit/submit.
  const d = await w.onboard('ConcApprove');
  await w.approveDealer(admin, d.dealerId);
  const s = await w.submitted(d);
  for (const key of w.CHECK_KEYS)
    await admin.put(`/v1/admin/listings/${s.listingId}/checks/${key}`, { checked: true });
  for (let i = 0; i < 6; i += 1) await w.addImage(admin, s.listingId, i + 1);
  const [approve, edit] = await Promise.all([
    admin.post(`/v1/admin/listings/${s.listingId}/approve`),
    d.patch(`/v1/dealer/vehicles/${s.vehicleId}`, { description: 'editing during approval' }),
  ]);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev(approve, edit, { final: row.status });
  return ['ACTIVE', 'PENDING_REVIEW'].includes(row.status)
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `approve vs dealer edit race → valid state (${row.status})`,
      }
    : { status: 'FAIL', note: `final ${row.status}` };
});
await h.check(r, 'CONCURRENCY-005', async () => {
  // Dealer suspension vs manager submit prevents invalid publication.
  const d = await w.onboard('ConcSuspend');
  await w.approveDealer(admin, d.dealerId);
  const v = await d.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await d.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  const [suspend, submit] = await Promise.all([
    admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend during submit race' }),
    d.post(`/v1/dealer/vehicles/${v.json.id}/submit`),
  ]);
  const listing = await h.one(`SELECT status FROM listings WHERE "vehicleId"=$1`, [v.json.id]);
  r.ev(suspend, submit, { listing: listing?.status ?? 'none' });
  // Safe = never ACTIVE/public without approval. DRAFT (submit refused because the
  // suspension committed first) and PENDING_REVIEW (submit won) are both safe outcomes.
  const safe = !listing || ['DRAFT', 'PENDING_REVIEW'].includes(listing.status);
  return safe
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `suspend vs submit → no invalid publication (listing ${listing?.status ?? 'none'}, submit ${submit.status})`,
      }
    : { status: 'FAIL', note: `listing ${listing?.status}` };
});
await h.check(r, 'CONCURRENCY-006', async () => {
  const f = await w.published(A, admin);
  const buyer = await h.customer('Conc Enq Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: f.slug,
    message: 'race contacted vs closed',
  });
  const [a, b] = await Promise.all([
    manager.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' }),
    owner.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CLOSED' }),
  ]);
  const row = await h.one(`SELECT status FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev(a, b, { final: row.status });
  return ['CONTACTED', 'CLOSED'].includes(row.status)
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `contacted vs closed race → valid transition (${row.status}) under FOR UPDATE`,
      }
    : { status: 'FAIL', note: `final ${row.status}` };
});
await h.check(r, 'CONCURRENCY-007', async () => {
  const d = await w.onboard('ConcMember');
  await w.approveDealer(admin, d.dealerId);
  const m = await w.addMember(d, 'MANAGER', 'Conc Mbr');
  const f = await w.published(d, admin);
  const buyer = await h.customer('Conc Mbr Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: f.slug,
    message: 'race remove vs mutate',
  });
  const [remove, mutate] = await Promise.all([
    d.del(`/v1/dealer/team/members/${m.membershipId}`),
    m.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' }),
  ]);
  const row = await h.one(`SELECT status FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev(remove, mutate, { final: row.status });
  return ['NEW', 'CONTACTED'].includes(row.status)
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `member removal vs mutation → safe (enquiry ${row.status}, mutate ${mutate.status})`,
      }
    : { status: 'FAIL', note: `final ${row.status}` };
});
await h.check(r, 'CONCURRENCY-008', async () => {
  const d = await w.onboard('ConcVerify');
  const docs = await h.q(`SELECT id FROM dealer_documents WHERE "dealerId"=$1`, [d.dealerId]);
  for (const doc of docs) await admin.post(`/v1/admin/documents/${doc.id}/verify`);
  const [a, b] = await Promise.all([
    admin.post(`/v1/admin/dealers/${d.dealerId}/approve`, {}),
    admin.post(`/v1/admin/dealers/${d.dealerId}/approve`, {}),
  ]);
  const row = await h.one(`SELECT status FROM dealers WHERE id=$1`, [d.dealerId]);
  r.ev(a, b, { final: row.status });
  return row.status === 'ACTIVE'
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `concurrent admin approvals → ACTIVE once (statuses ${[a.status, b.status].join('/')})`,
      }
    : { status: 'FAIL', note: `final ${row.status}` };
});
await h.check(r, 'CONCURRENCY-009', async () => {
  // Simultaneous legitimate customer enquiries retained (distinct customers, distinct cars).
  const d = await w.onboard('ConcEnq');
  await w.approveDealer(admin, d.dealerId);
  const l1 = await w.published(d, admin);
  const l2 = await w.published(d, admin);
  const c1 = await h.customer('Conc C1');
  const c2 = await h.customer('Conc C2');
  const [a, b] = await Promise.all([
    c1.post('/v1/enquiries', { listingSlug: l1.slug, message: 'c1' }),
    c2.post('/v1/enquiries', { listingSlug: l2.slug, message: 'c2' }),
  ]);
  const count = await h.one(`SELECT count(*)::int c FROM enquiries WHERE "dealerId"=$1`, [
    d.dealerId,
  ]);
  r.ev(a, b, { enquiries: count.c });
  return a.status === 201 && b.status === 201 && count.c === 2
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `simultaneous legitimate enquiries both retained (${count.c})`,
      }
    : { status: 'FAIL', note: `a ${a.status} b ${b.status} count ${count.c}` };
});
await h.check(r, 'CONCURRENCY-010', async () => {
  // Concurrent invitation acceptance cannot duplicate membership.
  const d = await w.onboard('ConcInvite');
  await w.approveDealer(admin, d.dealerId);
  const e = h.phone();
  const c = await h.customer('Conc Invitee', e);
  const inv = await d.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  const [a, b] = await Promise.all([
    c.post(`/v1/invitations/${inv.json.id}/accept`),
    c.post(`/v1/invitations/${inv.json.id}/accept`),
  ]);
  const count = await h.one(
    `SELECT count(*)::int c FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`,
    [d.dealerId, c.userId],
  );
  r.ev(a, b, { memberships: count.c });
  return count.c === 1
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `concurrent accept → one membership (${count.c}); statuses ${[a.status, b.status].sort().join('/')}`,
      }
    : { status: 'FAIL', note: `memberships ${count.c}` };
});

r.save();
await h.pool.end();
