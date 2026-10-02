// World builder — every step goes through the real API. Only Google linking
// (SIM-GOOGLE) and admin sessions (SIM-SESSION) are simulated.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import * as h from './lib.mjs';

const requireApi = createRequire(resolve(h.CERT, '../../../apps/api/package.json'));
const sharp = requireApi('sharp');

export const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);
export async function jpeg(seed = 0, w = 1600, h2 = 1200) {
  return sharp({
    create: {
      width: w,
      height: h2,
      channels: 3,
      background: { r: (seed * 53) % 255, g: (seed * 97) % 255, b: 120 },
    },
  })
    .jpeg()
    .toBuffer();
}

const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function letters(n) {
  return Array.from({ length: n }, () => L[Math.floor(Math.random() * L.length)]).join('');
}
export function panAndGstin() {
  const pan = `${letters(3)}C${letters(1)}${String(1000 + Math.floor(Math.random() * 8999))}${letters(1)}`;
  return { pan, gstin: `33${pan}1Z${Math.floor(Math.random() * 9)}` };
}

export const COMPLETE_VEHICLE = {
  make: 'Hyundai',
  model: 'Creta',
  variant: 'SX(O)',
  manufacturingYear: 2023,
  registrationYear: 2023,
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  bodyType: 'SUV',
  kilometersDriven: 22400,
  ownerCount: 1,
  color: 'WHITE',
  insuranceType: 'COMPREHENSIVE',
  insuranceValidUntil: '2027-03-31',
  pricePaise: 145000000,
  negotiability: 'FIXED',
  description: 'Single owner, certification fixture.',
};

/** PUT the bytes to a presigned URL exactly as a browser would. */
export async function upload(presign, bytes, contentType) {
  const headers = { 'content-type': contentType };
  const res = await fetch(presign.uploadUrl, { method: 'PUT', headers, body: bytes });
  return res.status;
}

export async function uploadDocument(owner, type, bytes = PDF, mimeType = 'application/pdf') {
  const p = await owner.post('/v1/dealer/documents/presign', {
    type,
    fileName: `${type.toLowerCase()}.pdf`,
    mimeType,
    bytes: bytes.length,
  });
  if (p.status !== 200 && p.status !== 201) return { presign: p };
  const put = await upload(p.json, bytes, mimeType);
  const commit = await owner.post(`/v1/dealer/documents/${type}/commit`, {
    documentId: p.json.documentId,
  });
  return { presign: p, put, commit };
}

export async function uploadYard(owner) {
  const bytes = await jpeg(7, 800, 600);
  const p = await owner.post('/v1/dealer/yard-photo/presign', {
    fileName: 'yard.jpg',
    mimeType: 'image/jpeg',
    bytes: bytes.length,
  });
  const put = await upload(p.json, bytes, 'image/jpeg');
  const commit = await owner.post('/v1/dealer/yard-photo/commit', { mediaId: p.json.mediaId });
  return { presign: p, put, commit };
}

/** Phone sign-in → SIM-GOOGLE → onboarding → business → docs → yard → submit. */
export async function onboard(label, { city = 'Vellore', district = 'Vellore', submit = true } = {}) {
  const owner = await h.dealerPhone(`${label} Owner`);
  await h.simulateGoogleLink(owner.userId, `${label.toLowerCase().replace(/\W/g, '')}.${h.nonce()}@example.test`);
  const legalName = `${label} Motors ${h.nonce()}`;
  const ob = await owner.post('/v1/auth/onboarding', {
    fullName: `${label} Owner`,
    phone: owner.phone,
    legalName,
    addressLine: '12 Main Road',
    city,
    district,
    state: 'Tamil Nadu',
    pincode: '632001',
    tagline: `Quality used cars from ${label}`,
    specialities: ['SUVs', 'Sedans'],
    mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234',
  });
  if (ob.status !== 201) throw new Error(`onboarding ${ob.status} ${ob.text}`);
  owner.cookie = h.sessionCookieOf(ob) ?? owner.cookie;
  owner.dealerId = ob.json.dealer.id;
  owner.slug = ob.json.dealer.slug;
  const ids = panAndGstin();
  const biz = await owner.patch('/v1/dealer/onboarding', ids);
  if (biz.status !== 200) throw new Error(`business ${biz.status} ${biz.text}`);
  for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
    const d = await uploadDocument(owner, type);
    if (d.commit?.status !== 200) throw new Error(`doc ${type} put=${d.put} commit=${d.commit?.status} ${d.commit?.text}`);
  }
  const y = await uploadYard(owner);
  if (y.commit.status !== 200) throw new Error(`yard ${y.commit.status} ${y.commit.text}`);
  if (submit) {
    const s = await owner.post('/v1/dealer/submit');
    if (s.status !== 200) throw new Error(`submit ${s.status} ${s.text}`);
  }
  return owner;
}

export async function approveDealer(admin, dealerId) {
  const docs = await h.q(`SELECT id FROM dealer_documents WHERE "dealerId" = $1`, [dealerId]);
  for (const d of docs) await admin.post(`/v1/admin/documents/${d.id}/verify`);
  return admin.post(`/v1/admin/dealers/${dealerId}/approve`, {});
}

/** Invite → the invitee signs in as a customer → accepts. Returns the member actor. */
export async function addMember(owner, role, label) {
  const e164 = h.phone();
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e164, role });
  if (inv.status !== 201 && inv.status !== 200) throw new Error(`invite ${inv.status} ${inv.text}`);
  const m = await h.customer(label, e164);
  const acc = await m.post(`/v1/invitations/${inv.json.id}/accept`);
  if (acc.status !== 200) throw new Error(`accept ${acc.status} ${acc.text}`);
  m.dealerId = owner.dealerId;
  m.role = role;
  m.membershipId = (
    await h.one(`SELECT id FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`, [
      owner.dealerId,
      m.userId,
    ])
  ).id;
  return m;
}

export async function draft(actor, details = COMPLETE_VEHICLE) {
  const c = await actor.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  if (c.status !== 201) throw new Error(`create vehicle ${c.status} ${c.text}`);
  if (details) {
    const p = await actor.patch(`/v1/dealer/vehicles/${c.json.id}`, details);
    if (p.status !== 200) throw new Error(`patch vehicle ${p.status} ${p.text}`);
  }
  return c.json.id;
}

export async function submitted(actor, details) {
  const vehicleId = await draft(actor, details);
  const s = await actor.post(`/v1/dealer/vehicles/${vehicleId}/submit`);
  if (s.status !== 200) throw new Error(`submit vehicle ${s.status} ${s.text}`);
  return { vehicleId, listingId: s.json.listing.id };
}

/** Admin photography through the real presign → PUT → commit route. */
export async function addImage(admin, listingId, seed = 1) {
  const bytes = await jpeg(seed);
  const p = await admin.post(`/v1/admin/listings/${listingId}/images/presign`, {
    fileName: `car-${seed}.jpg`,
    mimeType: 'image/jpeg',
    bytes: bytes.length,
    width: 1600,
    height: 1200,
  });
  if (p.status !== 200 && p.status !== 201) return { presign: p };
  const put = await upload(p.json, bytes, 'image/jpeg');
  const commit = await admin.post(`/v1/admin/listings/${listingId}/images/${p.json.mediaId}/commit`);
  return { presign: p, put, commit, mediaId: p.json.mediaId };
}

export const CHECK_KEYS = ['REGISTRATION', 'MAKE_MODEL', 'VARIANT', 'YEAR', 'ODOMETER', 'OWNERSHIP', 'PRICING'];

export async function approveListing(admin, listingId, images = 6) {
  for (const key of CHECK_KEYS) await admin.put(`/v1/admin/listings/${listingId}/checks/${key}`, { checked: true });
  for (let i = 0; i < images; i += 1) {
    const r = await addImage(admin, listingId, i + 1);
    if (r.commit?.status !== 200 && r.commit?.status !== 201) {
      throw new Error(`image ${JSON.stringify(r.presign.json ?? r.commit?.json)}`);
    }
  }
  return admin.post(`/v1/admin/listings/${listingId}/approve`);
}

export async function published(actor, admin, details) {
  const s = await submitted(actor, details);
  const a = await approveListing(admin, s.listingId);
  if (a.status !== 200) throw new Error(`approve listing ${a.status} ${a.text}`);
  const row = await h.one(`SELECT slug FROM listings WHERE id=$1`, [s.listingId]);
  return { ...s, slug: row.slug };
}
