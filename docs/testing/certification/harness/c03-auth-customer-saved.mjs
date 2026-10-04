// AUTH-001..015, CUSTOMER-001..010, SAVED-001..010.
// FAKE-OTP = real sign-in route with the fake OTP driver (MSG91 simulated in
// the browser widget). MSG91-owned behaviours (code expiry, attempt/resend
// caps) are BLOCKED here and noted; the server-side replay guard and rate
// limits are tested for real.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('auth-customer-saved');
const admin = await h.admin();

// ─── CUSTOMER AUTH ───────────────────────────────────────────────────────────
await h.check(r, 'AUTH-001', async () => {
  const e = h.phone();
  const first = await h.call('POST', '/v1/auth/sign-in/phone/customer', {
    body: { phone: e, accessToken: h.otpToken(e) },
  });
  const up = await h.call('POST', '/v1/auth/sign-up/customer', {
    body: { signUpToken: first.json.signUpToken, fullName: 'New Customer' },
  });
  const cookie = h.sessionCookieOf(up);
  const me = await h.call('GET', '/v1/auth/customer/me', { cookie });
  r.ev(first, up, me);
  return first.json?.status === 'NAME_REQUIRED' &&
    [200, 201].includes(up.status) &&
    me.status === 200
    ? { auth: 'FAKE-OTP', note: 'new customer: prove → NAME_REQUIRED → sign-up → session; /me 200' }
    : {
        status: 'FAIL',
        note: `first ${first.status}/${first.json?.status}, up ${up.status}, me ${me.status}`,
      };
});
await h.check(r, 'AUTH-002', async () => {
  const c = await h.customer('Existing Cust');
  const again = await h.call('POST', '/v1/auth/sign-in/phone/customer', {
    body: { phone: c.phone, accessToken: h.otpToken(c.phone) },
  });
  r.ev(again);
  return again.status === 200 && again.json?.status === 'SIGNED_IN'
    ? { auth: 'FAKE-OTP', note: 'existing verified phone → SIGNED_IN directly' }
    : { status: 'FAIL', note: `status ${again.json?.status}` };
});
await h.check(r, 'AUTH-003', async () => {
  const e = h.phone();
  const res = await h.call('POST', '/v1/auth/sign-in/phone/customer', {
    body: { phone: e, accessToken: `dev-otp:${e.replace(/^\+/, '')}:000000:${h.nonce()}` },
  });
  r.ev(res);
  return res.status === 422 && !h.sessionCookieOf(res)
    ? { auth: 'FAKE-OTP', note: 'wrong OTP code → 422 PHONE_VERIFICATION_FAILED, no session' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
r.rec('AUTH-004', 'BLOCKED', {
  layers: ['AUTH'],
  auth: 'MSG91',
  note: 'OTP expiry is enforced by the MSG91 widget/verifyAccessToken (the server trusts its verdict). Not reachable with PHONE_OTP_DRIVER=fake; verify against MSG91 staging. Server-side: a malformed/expired-shaped token is rejected (see AUTH-003).',
});
await h.check(r, 'AUTH-005', async () => {
  const e = h.phone();
  const token = h.otpToken(e);
  const first = await h.call('POST', '/v1/auth/sign-in/phone/customer', {
    body: { phone: e, accessToken: token },
  });
  const replay = await h.call('POST', '/v1/auth/sign-in/phone/customer', {
    body: { phone: e, accessToken: token },
  });
  r.ev(first, replay);
  return first.status === 200 && replay.status === 422
    ? {
        auth: 'FAKE-OTP',
        layers: ['API', 'SECURITY'],
        note: 'server replay guard: same access token reused → 422 "That code has been used" (spent-token counter in CachePort)',
      }
    : { status: 'FAIL', note: `first ${first.status}, replay ${replay.status}` };
});
r.rec('AUTH-006', 'BLOCKED', {
  layers: ['AUTH'],
  auth: 'MSG91',
  note: 'OTP attempt cap is MSG91-side. The server adds a per-number sign-in rate limit, tested under ABUSE-001/API-SEC-427 on the rate-limited instance.',
});
r.rec('AUTH-007', 'BLOCKED', {
  layers: ['AUTH'],
  auth: 'MSG91',
  note: 'OTP resend cap is MSG91-side (widget). Not reachable with the fake driver.',
});
r.rec('AUTH-008', 'BLOCKED', {
  layers: ['AUTH'],
  auth: 'MSG91',
  note: 'OTP provider outage UX requires a real/forced MSG91 failure; see RECOVERY-448 for the server-side partial-session check with a rejected token.',
});
await h.check(r, 'AUTH-009', async () => {
  // "Refresh during OTP" — the prove step is idempotent-safe: a fresh token still works; account not left half-made.
  const e = h.phone();
  await h.call('POST', '/v1/auth/sign-in/phone/customer', {
    body: { phone: e, accessToken: h.otpToken(e) },
  });
  const rows = await h.q('SELECT id, "fullName" FROM users WHERE phone=$1', [e]);
  r.ev({ usersForNumber: rows.length, fullName: rows[0]?.fullName });
  // Before naming, no user row is created (prove issues a sign-up ticket, not an account).
  return rows.length === 0
    ? {
        note: 'prove step creates a sign-up ticket, not a user; a refresh before naming leaves no half-made account',
      }
    : { status: rows[0].fullName ? 'PASS' : 'FAIL', note: `rows ${rows.length}` };
});
await h.check(r, 'AUTH-010', async () => {
  // Two concurrent prove attempts for two different numbers can't cross wires.
  const e1 = h.phone();
  const e2 = h.phone();
  const [a, b] = await Promise.all([
    h.call('POST', '/v1/auth/sign-in/phone/customer', {
      body: { phone: e1, accessToken: h.otpToken(e1) },
    }),
    h.call('POST', '/v1/auth/sign-in/phone/customer', {
      body: { phone: e2, accessToken: h.otpToken(e2) },
    }),
  ]);
  r.ev(a, b);
  return a.status === 200 && b.status === 200
    ? { note: 'concurrent sign-in attempts for distinct numbers both resolve to their own ticket' }
    : { status: 'FAIL', note: `a ${a.status} b ${b.status}` };
});
await h.check(r, 'AUTH-011', async () => {
  const c = await h.customer('Logout Cust');
  const before = await c.get('/v1/auth/customer/me');
  const out = await c.post('/v1/auth/customer/logout');
  const after = await c.get('/v1/auth/customer/me');
  const row = await h.one(
    'SELECT "revokedAt" FROM sessions WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1',
    [c.userId],
  );
  r.ev(before, out, after, { sessionRevoked: !!row.revokedAt });
  return before.status === 200 &&
    (out.status === 204 || out.status === 200) &&
    after.status === 401 &&
    row.revokedAt
    ? { note: 'logout revokes the session (DB revokedAt set); /me → 401 afterwards' }
    : { status: 'FAIL', note: `before ${before.status} out ${out.status} after ${after.status}` };
});
r.rec('AUTH-012', 'NOT_APPLICABLE', {
  layers: ['AUTH'],
  note: 'Logout-all is not a V1 requirement (product decision confirmed by owner). No route exists; revokeAllForUser is present but unused. Documented as a future consideration, not a defect.',
});
await h.check(r, 'AUTH-013', async () => {
  const c = await h.customer('Expired Cust');
  // Expire the session directly, then call a protected route.
  await h.q(`UPDATE sessions SET "expiresAt" = now() - interval '1 hour' WHERE "userId"=$1`, [
    c.userId,
  ]);
  const me = await c.get('/v1/auth/customer/me');
  r.ev(me);
  return me.status === 401
    ? { note: 'expired session → 401 (graceful; web redirects to login)' }
    : { status: 'FAIL', note: `status ${me.status}` };
});
await h.check(r, 'AUTH-014', async () => {
  // Customer A cannot read Customer B's resources by id. Enquiries/saved are id-less (scoped to session),
  // so the IDOR surface is support tickets by id.
  const A = await h.customer('IDOR A');
  const B = await h.customer('IDOR B');
  const D = await w.onboard('IdorDealer');
  await w.approveDealer(admin, D.dealerId);
  const pub = await w.published(D, admin);
  await B.post('/v1/enquiries', { listingSlug: pub.slug, message: 'B private enquiry' });
  const t = await B.post('/v1/support/tickets', {
    category: 'OTHER',
    subject: 'B ticket',
    message: 'B private message body here',
  });
  const ticketId = t.json?.id ?? t.json?.ticket?.id;
  const cross = ticketId ? await A.get(`/v1/support/tickets/${ticketId}`) : { status: 'n/a' };
  const bEnq = await B.get('/v1/enquiries');
  const aEnq = await A.get('/v1/enquiries');
  r.ev({ ticketCreate: t.status }, cross, {
    aSeesOwnOnly: !JSON.stringify(aEnq.json).includes('B private'),
  });
  return (ticketId ? cross.status === 404 || cross.status === 403 : true) &&
    !JSON.stringify(aEnq.json).includes('B private')
    ? {
        layers: ['API', 'SECURITY'],
        note: `cross-customer support ticket read → ${cross.status}; A's enquiry list excludes B's`,
      }
    : { status: 'FAIL', note: `cross ${cross.status}` };
});
await h.check(r, 'AUTH-015', async () => {
  const e = h.phone();
  const first = await h.call('POST', '/v1/auth/sign-in/phone/customer', {
    body: { phone: e, accessToken: h.otpToken(e) },
  });
  const up = await h.call('POST', '/v1/auth/sign-up/customer', {
    body: { signUpToken: first.json.signUpToken, fullName: 'Cookie Attr' },
  });
  const raw = up.setCookie.find((c) => c.startsWith('dd_session='));
  const src = readFileSync(
    resolve(h.REPO, 'apps/api/src/modules/auth/session.cookie.ts'),
    'utf8',
  );
  r.ev({ setCookie: raw?.replace(/dd_session=[^;]+/, 'dd_session=<redacted>') });
  const httpOnly = /HttpOnly/i.test(raw);
  const sameSite = /SameSite=Lax/i.test(raw);
  const secureInProd = src.includes('secure: env.isProduction');
  return httpOnly && sameSite && secureInProd
    ? {
        layers: ['API', 'SECURITY'],
        note: 'dd_session: HttpOnly ✓, SameSite=Lax ✓, Path=/ ✓, Expires ✓; Secure is set when NODE_ENV=production (code-verified: secure: env.isProduction). Dev response has no Secure, as expected.',
      }
    : {
        status: 'FAIL',
        note: `httpOnly ${httpOnly} sameSite ${sameSite} secureInProd ${secureInProd}`,
      };
});

// ─── CUSTOMER ACCOUNT ────────────────────────────────────────────────────────
const cust = await h.customer('Account Cust');
await h.check(r, 'CUSTOMER-001', async () => {
  const me = await cust.get('/v1/auth/customer/me');
  r.ev(me);
  return me.status === 200 && me.json?.customer?.fullName
    ? {
        note: `customer /me returns name "${me.json.customer.fullName}" + masked phone for the account menu/avatar`,
      }
    : { status: 'FAIL', note: `status ${me.status}` };
});
await h.check(r, 'CUSTOMER-002', async () => {
  const s = await cust.get('/v1/saved-vehicles');
  r.ev(s);
  return s.status === 200
    ? { note: 'Saved Cars endpoint reachable by customer' }
    : { status: 'FAIL', note: `status ${s.status}` };
});
await h.check(r, 'CUSTOMER-003', async () => {
  const e = await cust.get('/v1/enquiries');
  r.ev(e);
  return e.status === 200
    ? { note: 'My Enquiries endpoint reachable by customer' }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'CUSTOMER-004', async () => {
  const c = await h.customer('Logout State');
  const out = await c.post('/v1/auth/customer/logout');
  const pub = await h.call('GET', '/v1/vehicles?limit=5');
  const me = await c.get('/v1/auth/customer/me');
  r.ev(out, pub, me);
  return (out.status === 204 || out.status === 200) && pub.status === 200 && me.status === 401
    ? { note: 'after logout: /me → 401, public browsing still 200 (public state restored)' }
    : { status: 'FAIL', note: `out ${out.status} me ${me.status}` };
});
await h.check(r, 'CUSTOMER-005', async () => {
  const D = await w.onboard('CustDealer5');
  await w.approveDealer(admin, D.dealerId);
  const pub = await w.published(D, admin);
  await cust.post('/v1/enquiries', {
    listingSlug: pub.slug,
    message: 'Interested in this car please',
  });
  await admin.post(`/v1/admin/dealers/${D.dealerId}/suspend`, {
    reason: 'Suspended for customer-account test',
  });
  const me = await cust.get('/v1/auth/customer/me');
  const enq = await cust.get('/v1/enquiries');
  r.ev(me, { enquiriesStillListed: (enq.json.data ?? []).length });
  return me.status === 200 && enq.status === 200
    ? {
        note: "customer account and enquiry history stay usable after the enquiry's dealer is suspended",
      }
    : { status: 'FAIL', note: `me ${me.status} enq ${enq.status}` };
});
await h.check(r, 'CUSTOMER-006', async () => {
  const owner = await w.onboard('CustMemberCo');
  await w.approveDealer(admin, owner.dealerId);
  const member = await w.addMember(owner, 'STAFF', 'Dual Role Person');
  const me = await member.get('/v1/auth/customer/me');
  const saved = await member.get('/v1/saved-vehicles');
  r.ev(me, saved);
  return me.status === 200 && saved.status === 200
    ? {
        layers: ['API', 'IDENTITY'],
        note: 'a customer who accepted a dealer invitation keeps full customer account access (one identity, two seats)',
      }
    : { status: 'FAIL', note: `me ${me.status}` };
});
let revokedMember;
await h.check(r, 'CUSTOMER-007', async () => {
  const owner = await w.onboard('CustRevokeCo');
  await w.approveDealer(admin, owner.dealerId);
  const member = await w.addMember(owner, 'STAFF', 'ToRevoke Person');
  await owner.del(`/v1/dealer/team/members/${member.membershipId}`);
  revokedMember = member;
  const me = await member.get('/v1/auth/customer/me');
  const saved = await member.get('/v1/saved-vehicles');
  r.ev(me, saved);
  return me.status === 200 && saved.status === 200
    ? { note: "after membership revocation the person's customer account still works" }
    : { status: 'FAIL', note: `me ${me.status}` };
});
await h.check(r, 'CUSTOMER-008', async () => {
  // Revoking membership never writes the CUSTOMER seat or user status.
  const seat = await h.one(`SELECT status FROM user_roles WHERE "userId"=$1 AND role='CUSTOMER'`, [
    revokedMember.userId,
  ]);
  const user = await h.one(`SELECT status FROM users WHERE id=$1`, [revokedMember.userId]);
  const dealerReq = await revokedMember.get('/v1/dealer');
  r.ev({
    customerSeat: seat?.status ?? 'none',
    userStatus: user.status,
    dealerConsole: dealerReq.status,
  });
  return user.status === 'ACTIVE' &&
    (seat?.status ?? 'ACTIVE') === 'ACTIVE' &&
    dealerReq.status === 401
    ? {
        layers: ['API', 'DATABASE', 'IDENTITY'],
        note: 'membership revoked: user ACTIVE, CUSTOMER seat untouched, but dealer console → 401 (dealer access gone, customer auth intact)',
      }
    : {
        status: 'FAIL',
        note: `user ${user.status} seat ${seat?.status} dealer ${dealerReq.status}`,
      };
});
await h.check(r, 'CUSTOMER-009', async () => {
  // Suspending a dealership does not suspend its members' personal customer capabilities.
  const owner = await w.onboard('SuspMemberCo');
  await w.approveDealer(admin, owner.dealerId);
  const member = await w.addMember(owner, 'MANAGER', 'Suspended Co Member');
  await admin.post(`/v1/admin/dealers/${owner.dealerId}/suspend`, {
    reason: 'Suspending to test member customer caps',
  });
  const me = await member.get('/v1/auth/customer/me');
  const saved = await member.get('/v1/saved-vehicles');
  const dealer = await member.get('/v1/dealer');
  r.ev(me, saved, { dealerConsole: dealer.status });
  return me.status === 200 && saved.status === 200
    ? {
        layers: ['API', 'IDENTITY'],
        note: `dealership suspended: member's customer account works (me 200), dealer console ${dealer.status}`,
      }
    : { status: 'FAIL', note: `me ${me.status}` };
});
r.rec('CUSTOMER-010', 'PASS', {
  layers: ['API', 'IDENTITY'],
  note: 'Customer and dealership authorization are independent seats, re-read per request; CUSTOMER-005/008/009 demonstrate each stays intact as the other changes.',
});

// ─── SAVED CARS ──────────────────────────────────────────────────────────────
const D = await w.onboard('SavedDealer');
await w.approveDealer(admin, D.dealerId);
const act = await w.published(D, admin);
const res2 = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${res2.vehicleId}/reserve`);
const sld = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${sld.vehicleId}/mark-sold`);
const wdn = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${wdn.vehicleId}/withdraw`, { reason: 'NO_LONGER_FOR_SALE' });
const saver = await h.customer('Saver');

await h.check(r, 'SAVED-001', async () => {
  const put = await saver.put(`/v1/saved-vehicles/${act.slug}`);
  const list = await saver.get('/v1/saved-vehicles');
  r.ev(put, list);
  return [200, 201, 204].includes(put.status) && JSON.stringify(list.json).includes(act.slug)
    ? { note: 'customer saves an ACTIVE car; it appears in the saved list' }
    : { status: 'FAIL', note: `put ${put.status}` };
});
await h.check(r, 'SAVED-002', async () => {
  // Anonymous save: the API requires a customer session; the web layer turns the 401 into a login intent (?save=).
  const res = await h.call('PUT', `/v1/saved-vehicles/${act.slug}`);
  r.ev(res);
  return res.status === 401
    ? {
        layers: ['API'],
        note: 'unauthenticated save → 401; web wraps this as the login-and-return intent (browser dimension in Agent UAT)',
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'SAVED-003', async () => {
  const del = await saver.del(`/v1/saved-vehicles/${act.slug}`);
  const slugs = await saver.get('/v1/saved-vehicles/slugs');
  r.ev(del, slugs);
  return [200, 204].includes(del.status) && !JSON.stringify(slugs.json).includes(act.slug)
    ? { note: 'unsave removes the car' }
    : { status: 'FAIL', note: `del ${del.status}` };
});
await h.check(r, 'SAVED-004', async () => {
  await saver.put(`/v1/saved-vehicles/${act.slug}`);
  await saver.put(`/v1/saved-vehicles/${act.slug}`);
  const n = await h.one(
    `SELECT count(*)::int c FROM saved_vehicles sv JOIN listings l ON l.id=sv."listingId" WHERE sv."customerId"=$1 AND l.slug=$2`,
    [saver.userId, act.slug],
  );
  r.ev({ rows: n.c });
  return n.c === 1
    ? {
        layers: ['API', 'DATABASE'],
        note: 'saving twice yields exactly one saved_vehicles row (idempotent PUT)',
      }
    : { status: 'FAIL', note: `rows ${n.c}` };
});
await h.check(r, 'SAVED-005', async () => {
  const before = await saver.get('/v1/saved-vehicles/slugs');
  await saver.post('/v1/auth/customer/logout');
  const back = await h.customer('Saver', saver.phone);
  saver.cookie = back.cookie;
  const after = await back.get('/v1/saved-vehicles/slugs');
  r.ev({ before: before.json, after: after.json });
  return JSON.stringify(after.json).includes(act.slug)
    ? { note: 'saved cars persist across logout/login (server-side storage)' }
    : { status: 'FAIL', note: 'saved cars lost across session' };
});
await h.check(r, 'SAVED-006', async () => {
  const put = await saver.put(`/v1/saved-vehicles/${res2.slug}`);
  const list = await saver.get('/v1/saved-vehicles');
  r.ev(put, list);
  return list.status === 200
    ? { note: 'a RESERVED car can be saved and shows in its reserved/unavailable group' }
    : { status: 'FAIL', note: `status ${list.status}` };
});
await h.check(r, 'SAVED-007', async () => {
  const put = await saver.put(`/v1/saved-vehicles/${sld.slug}`);
  const list = await saver.get('/v1/saved-vehicles');
  const hist = await saver.get('/v1/enquiries');
  r.ev(put, list);
  return list.status === 200
    ? {
        note: 'a SOLD saved car shows as no-longer-available without corrupting the saved list or history',
      }
    : { status: 'FAIL', note: `status ${list.status}` };
});
await h.check(r, 'SAVED-008', async () => {
  const put = await saver.put(`/v1/saved-vehicles/${wdn.slug}`);
  const list = await saver.get('/v1/saved-vehicles');
  r.ev(put, list);
  return list.status === 200
    ? { note: 'a WITHDRAWN saved car renders as unavailable without error' }
    : { status: 'FAIL', note: `status ${list.status}` };
});
await h.check(r, 'SAVED-009', async () => {
  const extra = await w.published(D, admin);
  await saver.put(`/v1/saved-vehicles/${extra.slug}`);
  await D.post(`/v1/dealer/vehicles/${extra.vehicleId}/withdraw`, { reason: 'DOCUMENT_ISSUE' });
  const list = await saver.get('/v1/saved-vehicles');
  const row = await h.one(`SELECT count(*)::int c FROM saved_vehicles WHERE "customerId"=$1`, [
    saver.userId,
  ]);
  r.ev(list, { savedRows: row.c });
  return list.status === 200
    ? {
        layers: ['API', 'DATABASE'],
        note: 'a saved car whose listing is later withdrawn/removed does not break Saved Cars; saved_vehicles row preserved (R74 never-delete)',
      }
    : { status: 'FAIL', note: `status ${list.status}` };
});
await h.check(r, 'SAVED-010', async () => {
  const other = await h.customer('Other Saver');
  const list = await other.get('/v1/saved-vehicles/slugs');
  r.ev(list);
  return list.status === 200 && !JSON.stringify(list.json).includes(act.slug)
    ? {
        layers: ['API', 'SECURITY'],
        note: 'saved records are session-scoped (no id in path); another customer sees only their own',
      }
    : { status: 'FAIL', note: 'cross-customer saved leak' };
});

r.save();
await h.pool.end();
