// Priority validation: SEC-DISC-001, LIFE-DISC-001, LIFE-DISC-002 and the
// product owner's reported document re-upload defect (API-DISC-001..).
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('priority');
const STORAGE = process.env.CERT_STORAGE;
const DEFAULT_SECRET = 'dealers-drive-local-upload-secret';
const forge = (key, contentType, contentLength, expiresAt) =>
  createHmac('sha256', DEFAULT_SECRET)
    .update(`${key}\n${contentType}\n${contentLength}\n${expiresAt}`)
    .digest('hex');

const admin = await h.admin();
const A = await w.onboard('PrioA');
await w.approveDealer(admin, A.dealerId);
const pub = await w.published(A, admin);

// ─── SEC-DISC-001 — forged storage signatures with the committed default secret
// After #241 the stand-ins are mounted only for STORAGE_DRIVER=local, which
// production refuses (#237). With CERT_API_S3 set (an API booted with an S3
// driver), SEC-DISC-001 is judged on that surface — the one production runs —
// and the note records that the local development driver still accepts them.
const S3_API = process.env.CERT_API_S3;
async function s3Surface(method, path, body) {
  const res = await fetch(`${S3_API}${path}`, {
    method,
    ...(body ? { headers: { 'content-type': 'image/jpeg' }, body } : {}),
  });
  r.ev({ surface: `S3-driver API ${S3_API}`, req: `${method} ${path.split('?')[0]}?…&signature=<forged>`, status: res.status });
  return res.status === 404
    ? { note: `S3-driver deployment: forged ${method} ${path.split('?')[0]} → 404 (stand-in not mounted, #241). The local development driver still serves the stand-ins by design; production refuses STORAGE_DRIVER=local (#237).` }
    : { status: 'FAIL', layers: ['SECURITY', 'STORAGE'], bug: 'BUG-001', note: `S3-driver forged ${method} → ${res.status}` };
}
function forgedUploadPath(key) {
  const body = Buffer.from('ATTACKER-CONTROLLED-BYTES');
  const expiresAt = Date.now() + 3600_000;
  return { body, path: `/uploads?${new URLSearchParams({ key, contentType: 'image/jpeg', contentLength: String(body.length), expiresAt: String(expiresAt), signature: forge(key, 'image/jpeg', body.length, expiresAt) })}` };
}

await h.check(r, 'SEC-DISC-001a', async () => {
  if (S3_API) {
    const { body, path } = forgedUploadPath(`vehicles/${pub.vehicleId}/original.jpg`);
    return s3Surface('PUT', path, body);
  }
  // 1. The default is in the repository: .env.example and env.ts.
  const envTs = readFileSync(resolve(h.REPO, 'apps/api/src/config/env.ts'), 'utf8');
  h.assert(
    envTs.includes(`UPLOAD_SIGNING_SECRET: z.string().min(8).default('${DEFAULT_SECRET}')`),
    'default not found',
  );
  // 2. Overwrite a PUBLIC car photograph's served variant, with no credentials.
  const vm = await h.one(
    `SELECT m.id, m.variants, m."storageKey", m."mimeType" FROM vehicle_media vm JOIN media m ON m.id = vm."mediaId" WHERE vm."vehicleId"=$1 AND vm."isPrimary"`,
    [pub.vehicleId],
  );
  // The served key for width 1024 follows media.service: variants[width] ?? 1600 ?? 1024 ?? 640 ?? storageKey.
  const v = vm.variants ?? {};
  const key = v['1024'] ?? v['1600'] ?? v['640'] ?? vm.storageKey;
  const contentType = key.endsWith('.webp') ? 'image/webp' : vm.mimeType;
  const before = await h.call('GET', `/media/by-media/${vm.id}/1024.webp`);
  const evil = Buffer.from('ATTACKER-CONTROLLED-BYTES '.repeat(40));
  const expiresAt = Date.now() + 3600_000;
  const sig = forge(key, contentType, evil.length, expiresAt);
  const put = await fetch(
    `${h.API}/uploads?${new URLSearchParams({ key, contentType, contentLength: String(evil.length), expiresAt: String(expiresAt), signature: sig })}`,
    { method: 'PUT', headers: { 'content-type': contentType }, body: evil },
  );
  const after = await h.call('GET', `/media/by-media/${vm.id}/1024.webp`);
  h.assert(put.status === 200, `forged PUT returned ${put.status}`);
  h.assert(after.text.startsWith('ATTACKER-CONTROLLED-BYTES'), 'public image not replaced');
  r.ev(
    { req: `PUT /uploads?key=${key}&signature=<forged with default secret>`, status: put.status },
    {
      req: `GET /media/by-media/${vm.id}/1024.webp (public)`,
      before: `${before.status} ${before.headers['content-type']} ${before.text.length}B`,
      after: `${after.status} ${after.headers['content-type']} body starts "${after.text.slice(0, 26)}"`,
    },
  );
  return {
    status: 'FAIL',
    layers: ['SECURITY', 'API', 'STORAGE'],
    bug: 'BUG-001',
    note: `Unauthenticated PUT /uploads signed with the committed default UPLOAD_SIGNING_SECRET overwrote the served object (${key.endsWith('.webp') ? 'webp variant' : 'original.jpg — the fallback served when variants are unprocessed, and the source any reprocessing reads'}) of a live listing's primary image; public /media route then served attacker bytes (before ${before.text.length}B image → after ${evil.length}B attacker text).`,
  };
});

await h.check(r, 'SEC-DISC-001b', async () => {
  // Read a PRIVATE KYC document with a forged read signature, no session.
  if (S3_API) {
    const key = 'dealers/victim/documents/PAN_CARD/forged-read';
    const expiresAt = Date.now() + 3600_000;
    return s3Surface('GET', `/private?${new URLSearchParams({ key, expiresAt: String(expiresAt), signature: forge(key, 'read', 0, expiresAt) })}`);
  }
  const doc = await h.one(
    `SELECT d.id, d.type, dl.slug FROM dealer_documents d JOIN dealers dl ON dl.id=d."dealerId" WHERE d."dealerId"=$1 AND d.type='PAN_CARD'`,
    [A.dealerId],
  );
  const key = `dealers/${doc.slug}/documents/${doc.type}/${doc.id}`;
  const expiresAt = Date.now() + 3600_000;
  const sig = forge(key, 'read', 0, expiresAt);
  const res = await h.call(
    'GET',
    `/private?${new URLSearchParams({ key, expiresAt: String(expiresAt), signature: sig })}`,
  );
  h.assert(res.status === 200 && res.text.startsWith('%PDF'), `private read ${res.status}`);
  r.ev({
    req: 'GET /private?key=dealers/<slug>/documents/PAN_CARD/<documentId>&signature=<forged>',
    status: res.status,
    body: `${res.text.slice(0, 8)}… (${res.text.length} bytes, KYC PDF)`,
  });
  return {
    status: 'FAIL',
    layers: ['SECURITY', 'API', 'STORAGE'],
    bug: 'BUG-001',
    note: 'Forged read signature returned a private KYC PDF with no session. Requires knowing the document UUID (not public), so the read path is constrained; the write path (001a) is not.',
  };
});

await h.check(r, 'SEC-DISC-001c', async () => {
  // Arbitrary new objects: unauthenticated storage writes anywhere in the bucket.
  if (S3_API) {
    const { body, path } = forgedUploadPath(`dealers/${A.slug}/documents/PAN_CARD/planted-${h.nonce()}`);
    return s3Surface('PUT', path, body);
  }
  const key = `dealers/${A.slug}/documents/PAN_CARD/planted-${h.nonce()}`;
  const body = Buffer.from('planted');
  const expiresAt = Date.now() + 3600_000;
  const put = await fetch(
    `${h.API}/uploads?${new URLSearchParams({ key, contentType: 'application/pdf', contentLength: String(body.length), expiresAt: String(expiresAt), signature: forge(key, 'application/pdf', body.length, expiresAt) })}`,
    { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body },
  );
  h.assert(put.status === 200, `plant ${put.status}`);
  h.assert(existsSync(resolve(STORAGE, key)), 'object not on disk');
  return {
    status: 'FAIL',
    layers: ['SECURITY', 'STORAGE'],
    bug: 'BUG-001',
    note: "Unauthenticated forged PUT created an arbitrary object inside another dealership's private KYC prefix (12 MB per request, no rate limit).",
  };
});

// ─── LIFE-DISC-001 — approveDealer accepts any non-ACTIVE dealer
await h.check(r, 'LIFE-DISC-001a', async () => {
  // A DRAFT dealership that never submitted, has no GSTIN/PAN and no documents.
  const owner = await h.dealerPhone('DraftOnly Owner');
  await h.simulateGoogleLink(owner.userId, `draftonly.${h.nonce()}@example.test`);
  const ob = await owner.post('/v1/auth/onboarding', {
    fullName: 'DraftOnly Owner',
    phone: owner.phone,
    legalName: `DraftOnly ${h.nonce()}`,
    addressLine: '1 Road',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    tagline: 'A dealership that never finished onboarding',
    specialities: ['SUVs'],
    mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234',
  });
  owner.cookie = h.sessionCookieOf(ob) ?? owner.cookie;
  const dealerId = ob.json.dealer.id;
  const before = await h.one(`SELECT status, gstin, pan FROM dealers WHERE id=$1`, [dealerId]);
  const docs = await h.one(`SELECT count(*)::int n FROM dealer_documents WHERE "dealerId"=$1`, [
    dealerId,
  ]);
  const completeness = await owner.get('/v1/dealer/completeness');
  const res = await admin.post(`/v1/admin/dealers/${dealerId}/approve`, {});
  const after = await h.one(`SELECT status, "approvedAt" FROM dealers WHERE id=$1`, [dealerId]);
  r.ev(completeness, res, { db_before: before, documents: docs.n, db_after: after });
  h.assert(before.status === 'DRAFT', `pre-state ${before.status}`);
  if (res.status === 200 && after.status === 'ACTIVE') {
    // Can the never-verified dealership now publish?
    const v = await w.submitted(owner);
    r.ev({ step: 'unverified dealership submits a listing', listingId: v.listingId });
    return {
      status: 'FAIL',
      layers: ['API', 'DATABASE'],
      bug: 'BUG-002',
      note: `POST /v1/admin/dealers/:id/approve on a DRAFT dealer (completeness ${completeness.json.percent}%, gstin=null, pan=null, ${docs.n} documents) → 200, status ACTIVE; the dealership then submitted a listing for moderation.`,
    };
  }
  return { note: `refused: ${res.status} ${res.json?.code}` };
});

await h.check(r, 'LIFE-DISC-001b', async () => {
  // A SUSPENDED dealership "approved" back to ACTIVE — the reinstate path bypassed.
  const S = await w.onboard('SuspApprove');
  await w.approveDealer(admin, S.dealerId);
  const sus = await admin.post(`/v1/admin/dealers/${S.dealerId}/suspend`, {
    reason: 'Fraud investigation in progress',
  });
  const res = await admin.post(`/v1/admin/dealers/${S.dealerId}/approve`, {});
  const after = await h.one(`SELECT status FROM dealers WHERE id=$1`, [S.dealerId]);
  const audit = await h
    .q(`SELECT action FROM audit_logs WHERE "entityId"=$1 ORDER BY "createdAt"`, [S.dealerId])
    .catch(() => []);
  r.ev(sus, res, { db_after: after, audit: audit.map((a) => a.action) });
  if (res.status === 200 && after.status === 'ACTIVE') {
    return {
      status: 'FAIL',
      layers: ['API', 'DATABASE'],
      bug: 'BUG-002',
      note: 'approve on a SUSPENDED dealer → 200 ACTIVE (recorded as dealer.approved, not dealer.reinstated). Suspension can be lifted through the approval endpoint.',
    };
  }
  return { note: `refused: ${res.status} ${res.json?.code}` };
});

// ─── LIFE-DISC-002 — suspend / reinstate have no source-state check
await h.check(r, 'LIFE-DISC-002a', async () => {
  // PENDING_APPROVAL (documents unverified) → reinstate → ACTIVE.
  const P = await w.onboard('PendReinstate');
  const before = await h.one(`SELECT status FROM dealers WHERE id=$1`, [P.dealerId]);
  const docs = await h.q(`SELECT status FROM dealer_documents WHERE "dealerId"=$1`, [P.dealerId]);
  const res = await admin.post(`/v1/admin/dealers/${P.dealerId}/reinstate`, {});
  const after = await h.one(`SELECT status, "approvedAt" FROM dealers WHERE id=$1`, [P.dealerId]);
  r.ev(res, { db_before: before, documents: docs.map((d) => d.status), db_after: after });
  if (res.status === 200 && after.status === 'ACTIVE') {
    return {
      status: 'FAIL',
      layers: ['API', 'DATABASE'],
      bug: 'BUG-003',
      note: `reinstate on a never-approved ${before.status} dealer (documents ${docs.map((d) => d.status).join('/')}) → 200 ACTIVE with approvedAt set. Verification skipped entirely.`,
    };
  }
  return { note: `refused: ${res.status} ${res.json?.code}` };
});

await h.check(r, 'LIFE-DISC-002b', async () => {
  // DRAFT → suspend → SUSPENDED; then reinstate → ACTIVE.
  const owner = await h.dealerPhone('DraftSusp Owner');
  await h.simulateGoogleLink(owner.userId, `draftsusp.${h.nonce()}@example.test`);
  const ob = await owner.post('/v1/auth/onboarding', {
    fullName: 'DraftSusp Owner',
    phone: owner.phone,
    legalName: `DraftSusp ${h.nonce()}`,
    addressLine: '1 Road',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    tagline: 'A draft dealership used for state tests',
    specialities: ['SUVs'],
    mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234',
  });
  const dealerId = ob.json.dealer.id;
  const s = await admin.post(`/v1/admin/dealers/${dealerId}/suspend`, {
    reason: 'Testing suspension of a draft',
  });
  const mid = await h.one(`SELECT status FROM dealers WHERE id=$1`, [dealerId]);
  const re = await admin.post(`/v1/admin/dealers/${dealerId}/reinstate`, {});
  const after = await h.one(`SELECT status, "approvedAt" FROM dealers WHERE id=$1`, [dealerId]);
  r.ev(s, { db_after_suspend: mid }, re, { db_after_reinstate: after });
  if (
    s.status === 200 &&
    mid.status === 'SUSPENDED' &&
    re.status === 200 &&
    after.status === 'ACTIVE'
  ) {
    return {
      status: 'FAIL',
      layers: ['API', 'DATABASE'],
      bug: 'BUG-003',
      note: 'DRAFT dealer: suspend → 200 SUSPENDED; reinstate → 200 ACTIVE with approvedAt. A dealership that never submitted is now verified.',
    };
  }
  return { note: `suspend ${s.status}/${mid.status}, reinstate ${re.status}/${after.status}` };
});

await h.check(r, 'LIFE-DISC-002c', async () => {
  // Reinstating an already-ACTIVE dealer: an audit event for a non-change.
  const re = await admin.post(`/v1/admin/dealers/${A.dealerId}/reinstate`, {});
  r.ev(re);
  return re.status === 200
    ? {
        status: 'FAIL',
        layers: ['API'],
        bug: 'BUG-003',
        note: 'reinstate on an ACTIVE (never suspended) dealer → 200 and a dealer.reinstated audit row + DealerReinstated outbox event for a non-transition.',
      }
    : { note: `refused ${re.status}` };
});

// ─── API-DISC-001.. — product owner's report: KYC documents editable after approval
await h.check(r, 'API-DISC-001', async () => {
  const doc = await h.one(
    `SELECT d.id, d.status, dl.slug, dl.status AS dealer FROM dealer_documents d JOIN dealers dl ON dl.id=d."dealerId" WHERE d."dealerId"=$1 AND d.type='GST_CERTIFICATE'`,
    [A.dealerId],
  );
  const keyBefore = resolve(STORAGE, `dealers/${doc.slug}/documents/GST_CERTIFICATE/${doc.id}`);
  const fileBefore = existsSync(keyBefore);
  const presign = await A.post('/v1/dealer/documents/presign', {
    type: 'GST_CERTIFICATE',
    fileName: 'other.pdf',
    mimeType: 'application/pdf',
    bytes: w.PDF.length,
  });
  const rowAfterPresign = await h.one(
    `SELECT id, status FROM dealer_documents WHERE "dealerId"=$1 AND type='GST_CERTIFICATE'`,
    [A.dealerId],
  );
  const fileAfterPresign = existsSync(keyBefore);
  r.ev(
    { db_before: { dealer: doc.dealer, document: doc.status, verifiedFileOnDisk: fileBefore } },
    presign,
    {
      db_after_presign: rowAfterPresign,
      verifiedFileOnDiskAfterPresign: fileAfterPresign,
    },
  );
  h.assert(doc.dealer === 'ACTIVE' && doc.status === 'VERIFIED', 'precondition');
  if (presign.status === 200 || presign.status === 201) {
    return {
      status: 'FAIL',
      layers: ['API', 'DATABASE', 'STORAGE'],
      bug: 'BUG-004',
      note: `ACTIVE dealer, VERIFIED GST certificate: POST /v1/dealer/documents/presign → ${presign.status}. Merely asking for the URL reset the row to ${rowAfterPresign.status} with a new id and DELETED the verified file from storage (on disk before=${fileBefore}, after=${fileAfterPresign}). No upload needed to destroy verification evidence.`,
    };
  }
  return { note: `refused ${presign.status}` };
});

await h.check(r, 'API-DISC-002', async () => {
  // Complete the swap: upload a different file and commit — dealer stays ACTIVE.
  const presign = await A.post('/v1/dealer/documents/presign', {
    type: 'PAN_CARD',
    fileName: 'swapped.pdf',
    mimeType: 'application/pdf',
    bytes: w.PDF.length,
  });
  if (presign.status === 409) {
    r.ev(presign);
    return { note: `presign refused ${presign.status} ${presign.json?.code} — a verified document cannot be swapped while ACTIVE (#242)` };
  }
  const put = await w.upload(presign.json, w.PDF, 'application/pdf');
  const commit = await A.post('/v1/dealer/documents/PAN_CARD/commit', {
    documentId: presign.json.documentId,
  });
  const after = await h.one(
    `SELECT d.status, dl.status AS dealer FROM dealer_documents d JOIN dealers dl ON dl.id=d."dealerId" WHERE d."dealerId"=$1 AND d.type='PAN_CARD'`,
    [A.dealerId],
  );
  r.ev(presign, { put }, commit, { db_after: after });
  return commit.status === 200 && after.dealer === 'ACTIVE'
    ? {
        status: 'FAIL',
        layers: ['API', 'DATABASE'],
        bug: 'BUG-004',
        note: `ACTIVE dealer replaced its verified PAN card: document now ${after.status}, dealership still ${after.dealer} — no re-verification triggered, admin not notified.`,
      }
    : { note: `commit ${commit.status}` };
});

await h.check(r, 'API-DISC-003', async () => {
  const del = await A.del('/v1/dealer/documents/ADDRESS_PROOF');
  const after = await h.one(
    `SELECT count(*)::int n FROM dealer_documents WHERE "dealerId"=$1 AND type='ADDRESS_PROOF'`,
    [A.dealerId],
  );
  const dealer = await h.one(`SELECT status FROM dealers WHERE id=$1`, [A.dealerId]);
  r.ev(del, { addressProofRows: after.n, dealer: dealer.status });
  return del.status === 204 || del.status === 200
    ? {
        status: 'FAIL',
        layers: ['API', 'DATABASE', 'STORAGE'],
        bug: 'BUG-004',
        note: `ACTIVE dealer: DELETE /v1/dealer/documents/ADDRESS_PROOF → ${del.status}; verified KYC row and file deleted, dealership remains ${dealer.status}.`,
      }
    : { note: `refused ${del.status}` };
});

await h.check(r, 'API-DISC-004', async () => {
  // Yard photo: is it public, and can an ACTIVE dealer replace it without review?
  const before = await h.call('GET', `/v1/dealers/${A.slug}`);
  const probe = await A.post('/v1/dealer/yard-photo/presign', {
    fileName: 'swap.jpg',
    mimeType: 'image/jpeg',
    bytes: 1024,
  });
  if (probe.status === 409) {
    r.ev(probe);
    return { note: `ACTIVE dealer yard-photo presign refused ${probe.status} ${probe.json?.code} — the reviewed photograph is locked outside DRAFT (#245)` };
  }
  const y = await w.uploadYard(A);
  const after = await h.call('GET', `/v1/dealers/${A.slug}`);
  const coverBefore =
    JSON.stringify(before.json).match(/coverMediaId":"([^"]+)/)?.[1] ??
    JSON.stringify(before.json).match(/by-media\/([0-9a-f-]{36})/)?.[1];
  const coverAfter =
    JSON.stringify(after.json).match(/coverMediaId":"([^"]+)/)?.[1] ??
    JSON.stringify(after.json).match(/by-media\/([0-9a-f-]{36})/)?.[1];
  r.ev(y.commit, { publicCoverBefore: coverBefore ?? null, publicCoverAfter: coverAfter ?? null });
  if (y.commit.status === 200 && coverBefore && coverAfter && coverBefore !== coverAfter) {
    return {
      status: 'FAIL',
      layers: ['API'],
      bug: 'BUG-005',
      note: 'ACTIVE dealer replaced the public yard photograph with no moderation, while tagline/services edits on the same profile are held for review (R34). A public image is the unmoderated channel R34 closed for text.',
    };
  }
  return {
    status: 'PASS',
    note: `yard photo commit ${y.commit.status}; public cover before=${coverBefore ?? 'none'} after=${coverAfter ?? 'none'} — not exposed publicly, or unchanged`,
  };
});

r.save();
await h.pool.end();
