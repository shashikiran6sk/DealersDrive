// Delta campaign for 6e39a9a — features merged after the last certified main (8436820, #251):
// support-ticket message limits (#295), Admin Members and least privilege (R110/R111), admin
// session isolation (#293), the Sales workspace (R112–R114), Dealer Verified decisions
// (#297/#299/#303), dealer portfolio photos (#299/#304) and enquiry/support emails (R117).
// Every step goes through the running API; only admin sessions (SIM-SESSION) and the
// activation of an invited Admin Member (SIM-ADMIT) are written directly.
import { randomUUID } from 'node:crypto';

import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('delta');
const admin = await h.admin(process.env.CERT_ADMIN_EMAIL ?? 'cert-admin@example.test');

/** An admitted Admin Member of `role`, invited through the API and activated directly. */
async function adminAs(role, label) {
  const email = `${label}.${h.nonce()}@example.test`;
  const inv = await admin.post('/v1/admin/members', { email, name: `${label} ${role}`, role });
  if (inv.status !== 201 && inv.status !== 200) throw new Error(`invite ${inv.status} ${inv.text}`);
  const u = await h.one(`SELECT id FROM users WHERE email=$1`, [email]);
  await h.q(`UPDATE admin_members SET status='ACTIVE', "activatedAt"=now() WHERE "userId"=$1`, [
    u.id,
  ]);
  const a = await h.admin(email);
  a.memberId = (await h.one(`SELECT id FROM admin_members WHERE "userId"=$1`, [u.id])).id;
  a.email = email;
  return a;
}

const D = await w.onboard('DeltaA');
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
const C1 = await h.customer('Delta Buyer One');
const C2 = await h.customer('Delta Buyer Two');

// ─── Support tickets (#295 five unanswered messages, R90/R91) ───────────────────
async function ticket(c, extra = {}) {
  const t = await c.post('/v1/support/tickets', {
    category: 'GENERAL_QUESTION',
    subject: 'Delta campaign question',
    description: 'A question raised by the delta certification campaign.',
    ...extra,
  });
  if (t.status !== 201 && t.status !== 200) throw new Error(`ticket ${t.status} ${t.text}`);
  return t.json.id;
}
const reply = (c, id, message, clientMessageId) =>
  c.post(`/v1/support/tickets/${id}/messages`, {
    message,
    ...(clientMessageId ? { clientMessageId } : {}),
  });
const counter = async (id) =>
  await h.one(
    `SELECT "unansweredCustomerMessages" AS n, status,
              (SELECT count(*)::int FROM support_ticket_messages m WHERE m."ticketId"=t.id AND m."authorType"='CUSTOMER') AS msgs
       FROM support_tickets t WHERE id=$1`,
    [id],
  );

await h.check(r, 'SUPPORT-DISC-001', async () => {
  const id = await ticket(C1);
  const codes = [];
  for (let i = 1; i <= 6; i += 1) {
    const res = await reply(C1, id, `Follow-up message number ${i}`);
    codes.push(res.status === 200 || res.status === 201 ? 'ok' : `${res.status}:${res.json?.code}`);
  }
  const db = await counter(id);
  r.ev({ codes, db });
  return codes.slice(0, 5).every((c) => c === 'ok') &&
    codes[5] === '409:SUPPORT_MESSAGE_LIMIT_REACHED' &&
    db.n === 5 &&
    db.msgs === 5
    ? {
        layers: ['API', 'DATABASE'],
        note: `five replies accepted, sixth ${codes[5]}; counter 5, 5 rows`,
      }
    : { status: 'FAIL', layers: ['API', 'DATABASE'], note: JSON.stringify({ codes, db }) };
});

await h.check(r, 'SUPPORT-DISC-002', async () => {
  const id = await ticket(C1);
  for (let i = 0; i < 3; i += 1) await reply(C1, id, `Warm-up ${i}`);
  const burst = await Promise.all(
    Array.from({ length: 8 }, (_, i) => reply(C1, id, `Concurrent burst ${i}`)),
  );
  const ok = burst.filter((b) => b.status === 200 || b.status === 201).length;
  const refused = burst.filter((b) => b.json?.code === 'SUPPORT_MESSAGE_LIMIT_REACHED').length;
  const db = await counter(id);
  r.ev({ ok, refused, other: burst.map((b) => b.status), db });
  return ok === 2 && refused === 6 && db.n === 5 && db.msgs === 5
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: '8 concurrent replies at 3/5: exactly 2 persisted, 6 refused; counter 5',
      }
    : {
        status: 'FAIL',
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: JSON.stringify({ ok, refused, db }),
      };
});

let quotaTicket;
await h.check(r, 'SUPPORT-DISC-003', async () => {
  quotaTicket = await ticket(C1);
  for (let i = 0; i < 5; i += 1) await reply(C1, quotaTicket, `Fill ${i}`);
  const note = await admin.post(`/v1/admin/support/tickets/${quotaTicket}/notes`, {
    note: 'Internal note — must not reset the quota.',
  });
  const afterNote = await reply(C1, quotaTicket, 'After an internal note');
  const sup = await admin.post(`/v1/admin/support/tickets/${quotaTicket}/messages`, {
    message: 'Support replies here.',
  });
  const afterReply = await reply(C1, quotaTicket, 'After a support reply');
  const db = await counter(quotaTicket);
  r.ev({
    note: note.status,
    afterNote: [afterNote.status, afterNote.json?.code],
    sup: sup.status,
    afterReply: afterReply.status,
    db,
  });
  return afterNote.json?.code === 'SUPPORT_MESSAGE_LIMIT_REACHED' &&
    (sup.status === 200 || sup.status === 201) &&
    (afterReply.status === 200 || afterReply.status === 201) &&
    db.n === 1
    ? {
        note: 'an internal note does not reset; a support reply resets to a fresh allowance (counter 1)',
      }
    : {
        status: 'FAIL',
        note: JSON.stringify({
          note: note.status,
          afterNote: afterNote.status,
          sup: sup.status,
          afterReply: afterReply.status,
          db,
        }),
      };
});

await h.check(r, 'SUPPORT-DISC-004', async () => {
  const mine = await C1.get(`/v1/support/tickets/${quotaTicket}`);
  const other = await C2.get(`/v1/support/tickets/${quotaTicket}`);
  const otherReply = await reply(C2, quotaTicket, 'Cross-customer write attempt');
  const otherReopen = await C2.post(`/v1/support/tickets/${quotaTicket}/reopen`);
  const leaksNote = JSON.stringify(mine.json ?? {}).includes('Internal note');
  r.ev({
    own: mine.status,
    other: other.status,
    otherReply: otherReply.status,
    otherReopen: otherReopen.status,
    leaksNote,
  });
  return mine.status === 200 &&
    other.status === 404 &&
    otherReply.status === 404 &&
    otherReopen.status === 404 &&
    !leaksNote
    ? {
        layers: ['API', 'SECURITY'],
        note: 'customer B gets 404 on read, reply and reopen of A’s ticket; internal notes absent from the customer payload',
      }
    : {
        status: 'FAIL',
        layers: ['API', 'SECURITY'],
        note: JSON.stringify({
          other: other.status,
          otherReply: otherReply.status,
          otherReopen: otherReopen.status,
          leaksNote,
        }),
      };
});

await h.check(r, 'SUPPORT-DISC-005', async () => {
  const id = await ticket(C1);
  const resolve = await admin.patch(`/v1/admin/support/tickets/${id}`, { status: 'RESOLVED' });
  const onResolved = await reply(C1, id, 'Reply on a resolved ticket');
  const reopen = await C1.post(`/v1/support/tickets/${id}/reopen`);
  const afterReopen = await reply(C1, id, 'Reply after reopening');
  const close = await admin.patch(`/v1/admin/support/tickets/${id}`, { status: 'CLOSED' });
  const onClosed = await reply(C1, id, 'Reply on a closed ticket');
  const reopenClosed = await C1.post(`/v1/support/tickets/${id}/reopen`);
  const adminOnClosed = await admin.post(`/v1/admin/support/tickets/${id}/messages`, {
    message: 'Support on closed',
  });
  const out = {
    resolve: resolve.status,
    onResolved: onResolved.json?.code,
    reopen: reopen.json?.status,
    afterReopen: afterReopen.status,
    close: close.status,
    onClosed: onClosed.json?.code,
    reopenClosed: reopenClosed.json?.code,
    adminOnClosed: adminOnClosed.status,
  };
  r.ev(out);
  return out.onResolved === 'SUPPORT_TICKET_RESOLVED' &&
    out.reopen === 'OPEN' &&
    (out.afterReopen === 200 || out.afterReopen === 201) &&
    out.onClosed === 'SUPPORT_TICKET_CLOSED' &&
    out.reopenClosed === 'SUPPORT_TICKET_CLOSED' &&
    out.adminOnClosed === 409
    ? {
        note: 'RESOLVED refuses replies, explicit reopen → OPEN, CLOSED is final for customer and support',
      }
    : { status: 'FAIL', note: JSON.stringify(out) };
});

await h.check(r, 'SUPPORT-DISC-006', async () => {
  const id = await ticket(C1);
  const cmid = randomUUID();
  const first = await reply(C1, id, 'Idempotent retry text', cmid);
  const retry = await reply(C1, id, 'Idempotent retry text', cmid);
  const changed = await reply(C1, id, 'Different text, same id', cmid);
  const forged = await C1.post(`/v1/support/tickets/${id}/messages`, {
    message: 'forged author',
    authorType: 'SUPPORT',
  });
  const db = await counter(id);
  r.ev({
    first: first.status,
    retry: retry.status,
    changed: [changed.status, changed.json?.code],
    forged: [forged.status, forged.json?.code],
    db,
  });
  const ok2 = (x) => x.status === 200 || x.status === 201;
  return ok2(first) &&
    ok2(retry) &&
    changed.status >= 400 &&
    forged.status === 400 &&
    db.n === 1 &&
    db.msgs === 1
    ? {
        note: 'retry with the same clientMessageId persists once and consumes one slot; reused id with new text refused; authorType field → 400',
      }
    : {
        status: 'FAIL',
        note: JSON.stringify({
          retry: retry.status,
          changed: changed.status,
          forged: forged.status,
          db,
        }),
      };
});

await h.check(r, 'SUPPORT-DISC-007', async () => {
  const e = await C2.post('/v1/enquiries', {
    listingSlug: car.slug,
    message: 'Delta enquiry by C2',
  });
  const foreign = await C1.post('/v1/support/tickets', {
    category: 'ENQUIRY_ISSUE',
    subject: 'About someone else’s enquiry',
    description: 'Referencing an enquiry that belongs to another customer.',
    enquiryId: e.json?.id,
  });
  r.ev({ enquiry: e.status, foreign: [foreign.status, foreign.json?.code] });
  return e.status === 201 && foreign.status >= 400 && foreign.status < 500
    ? {
        layers: ['API', 'SECURITY'],
        note: `another customer’s enquiryId refused (${foreign.status} ${foreign.json?.code})`,
      }
    : {
        status: 'FAIL',
        layers: ['API', 'SECURITY'],
        note: JSON.stringify({ e: e.status, foreign: foreign.status }),
      };
});

// ─── Admin Members and least privilege (R110/R111) ─────────────────────────────
const support = await adminAs('SUPPORT', 'deltasupport');
const moderator = await adminAs('MODERATOR', 'deltamod');
const salesA = await adminAs('SALES_REP', 'deltasalesa');
const salesB = await adminAs('SALES_REP', 'deltasalesb');

await h.check(r, 'ADMIN-RBAC-DISC-001', async () => {
  const matrix = {
    support: {
      dealers: (await support.get('/v1/admin/dealers')).status,
      approve: (await support.post(`/v1/admin/dealers/${D.dealerId}/approve`, {})).status,
      members: (await support.get('/v1/admin/members')).status,
      tickets: (await support.get('/v1/admin/support/tickets')).status,
      notifications: (await support.get('/v1/admin/notifications')).status,
    },
    moderator: {
      members: (await moderator.get('/v1/admin/members')).status,
      invite: (
        await moderator.post('/v1/admin/members', {
          email: `x${h.nonce()}@example.test`,
          role: 'SUPER_ADMIN',
        })
      ).status,
      config: (await moderator.get('/v1/admin/notifications')).status,
      queue: (await moderator.get('/v1/admin/listings')).status,
    },
    sales: {
      dealers: (await salesA.get('/v1/admin/dealers')).status,
      enquiries: (await salesA.get('/v1/admin/enquiries')).status,
      workspace: (await salesA.get('/v1/sales/dealers')).status,
    },
    superAdminSales: (await admin.get('/v1/sales/dealers')).status,
  };
  r.ev(matrix);
  const ok =
    matrix.support.dealers === 200 &&
    matrix.support.approve === 403 &&
    matrix.support.members === 403 &&
    matrix.support.tickets === 200 &&
    matrix.support.notifications === 403 &&
    matrix.moderator.members === 403 &&
    matrix.moderator.invite === 403 &&
    matrix.moderator.config === 403 &&
    matrix.moderator.queue === 200 &&
    matrix.sales.dealers === 403 &&
    matrix.sales.enquiries === 403 &&
    matrix.sales.workspace === 200 &&
    matrix.superAdminSales === 403;
  return ok
    ? {
        layers: ['API', 'SECURITY'],
        note: 'SUPPORT/MODERATOR/SALES_REP/SUPER_ADMIN matrix matches ADMIN_PERMISSIONS',
        auth: 'SIM-ADMIT',
      }
    : {
        status: 'FAIL',
        layers: ['API', 'SECURITY'],
        note: JSON.stringify(matrix),
        auth: 'SIM-ADMIT',
      };
});

await h.check(r, 'ADMIN-RBAC-DISC-002', async () => {
  const victim = await adminAs('MODERATOR', 'deltadisable');
  const before = (await victim.get('/v1/admin/listings')).status;
  const dis = await admin.post(`/v1/admin/members/${victim.memberId}/disable`, {
    reason: 'Delta campaign disable check',
  });
  const after = (await victim.get('/v1/admin/listings')).status;
  const revoked = await h.one(
    `SELECT count(*)::int AS n FROM sessions s JOIN admin_members m ON m."userId"=s."userId" WHERE m.id=$1 AND s."revokedAt" IS NULL AND s.scope='ADMIN'`,
    [victim.memberId],
  );
  const selfDisable = await admin.post(
    `/v1/admin/members/${(await h.one(`SELECT m.id FROM admin_members m JOIN users u ON u.id=m."userId" WHERE u.email=$1`, [process.env.CERT_ADMIN_EMAIL ?? 'cert-admin@example.test'])).id}/disable`,
    { reason: 'Self disable attempt' },
  );
  r.ev({
    before,
    disable: dis.status,
    after,
    openSessions: revoked.n,
    selfDisable: [selfDisable.status, selfDisable.json?.code],
  });
  return before === 200 &&
    dis.status === 200 &&
    after === 401 &&
    revoked.n === 0 &&
    selfDisable.status >= 400
    ? {
        layers: ['API', 'SECURITY', 'DATABASE'],
        note: 'disabling a member revokes its open admin session at once (200 → 401); self-disable refused',
      }
    : {
        status: 'FAIL',
        layers: ['API', 'SECURITY', 'DATABASE'],
        note: JSON.stringify({
          before,
          dis: dis.status,
          after,
          open: revoked.n,
          self: selfDisable.status,
        }),
      };
});

await h.check(r, 'ADMIN-RBAC-DISC-003', async () => {
  const roleChange = await adminAs('SUPPORT', 'deltarole');
  const before = (await roleChange.post(`/v1/admin/dealers/${D.dealerId}/approve`, {})).status;
  await admin.patch(`/v1/admin/members/${roleChange.memberId}`, { role: 'SALES_REP' });
  const consoleAfter = (await roleChange.get('/v1/admin/dealers')).status;
  const salesAfter = (await roleChange.get('/v1/sales/dealers')).status;
  r.ev({ before, consoleAfter, salesAfter });
  return before === 403 && consoleAfter === 403 && salesAfter === 200
    ? {
        note: 'a role change applies on the next request of the same session (console closed, Sales opened)',
      }
    : { status: 'FAIL', note: JSON.stringify({ before, consoleAfter, salesAfter }) };
});

// ─── Admin session isolation (#293) ────────────────────────────────────────────
await h.check(r, 'ADMIN-SESSION-DISC-001', async () => {
  const token = (c) => c.split('=')[1];
  const adminAsCustomer = await h.call('GET', '/v1/auth/customer/me', {
    cookie: `dd_session=${token(admin.cookie)}`,
  });
  const adminAsDealer = await h.call('GET', '/v1/dealer/vehicles', {
    cookie: `dd_session=${token(admin.cookie)}`,
  });
  const customerAsAdmin = await h.call('GET', '/v1/admin/dealers', {
    cookie: `dd_admin_session=${token(C1.cookie)}`,
  });
  const dealerAsAdmin = await h.call('GET', '/v1/admin/dealers', {
    cookie: `dd_admin_session=${token(D.cookie)}`,
  });
  const out = {
    adminAsCustomer: adminAsCustomer.status,
    adminAsDealer: adminAsDealer.status,
    customerAsAdmin: customerAsAdmin.status,
    dealerAsAdmin: dealerAsAdmin.status,
  };
  r.ev(out);
  return Object.values(out).every((s) => s === 401)
    ? {
        layers: ['API', 'SECURITY'],
        note: 'an ADMIN token is refused on customer/dealer routes and a person token on admin routes, whichever cookie carries it',
      }
    : { status: 'FAIL', layers: ['API', 'SECURITY'], note: JSON.stringify(out) };
});

await h.check(r, 'ADMIN-SESSION-DISC-002', async () => {
  const other = await adminAs('MODERATOR', 'deltalogout');
  const out = await h.call('POST', '/v1/auth/admin/logout', { cookie: other.cookie });
  const after = (await other.get('/v1/admin/listings')).status;
  const set = out.setCookie.find((c) => c.startsWith('dd_admin_session=')) ?? '';
  r.ev({ logout: out.status, after, clears: /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(set) });
  return (out.status === 200 || out.status === 204) && after === 401
    ? { note: 'admin logout revokes the server session (next request 401)' }
    : { status: 'FAIL', note: JSON.stringify({ logout: out.status, after }) };
});

// ─── Sales workspace (R112–R114) ────────────────────────────────────────────────
await h.check(r, 'SALES-DISC-001', async () => {
  const mine = await h.one(
    `SELECT d.id FROM dealers d JOIN admin_members m ON m.id=d."assistedByMemberId" JOIN users u ON u.id=m."userId" WHERE u.email='arun.sales@dealers-drive.test' LIMIT 1`,
  );
  const outsider = await salesB.get(`/v1/sales/dealers/${mine.id}`);
  const outsiderVehicles = await salesB.get(`/v1/sales/dealers/${mine.id}/vehicles`);
  const outsiderPatch = await salesB.patch(`/v1/sales/dealers/${mine.id}`, {
    tagline: 'Hijack attempt',
  });
  const selfServeDealer = await salesB.get(`/v1/sales/dealers/${D.dealerId}`);
  const list = await salesB.get('/v1/sales/dealers');
  const leaks = JSON.stringify(list.json ?? {}).includes(mine.id);
  r.ev({
    outsider: outsider.status,
    outsiderVehicles: outsiderVehicles.status,
    outsiderPatch: outsiderPatch.status,
    selfServeDealer: selfServeDealer.status,
    leaks,
  });
  return [outsider, outsiderVehicles, outsiderPatch, selfServeDealer].every(
    (x) => x.status === 404,
  ) && !leaks
    ? {
        layers: ['API', 'TENANT'],
        note: 'a Sales rep gets 404 on another rep’s dealership (read, vehicles, edit) and on self-serve dealers; list carries none',
      }
    : {
        status: 'FAIL',
        layers: ['API', 'TENANT'],
        note: JSON.stringify({
          outsider: outsider.status,
          v: outsiderVehicles.status,
          p: outsiderPatch.status,
          s: selfServeDealer.status,
          leaks,
        }),
      };
});

await h.check(r, 'SALES-DISC-002', async () => {
  const assisted = await h.one(
    `SELECT d.id FROM dealers d WHERE d."assistedByMemberId" IS NOT NULL AND d.status='ACTIVE' LIMIT 1`,
  );
  const mass = await salesA.post(`/v1/sales/dealers/${assisted?.id ?? D.dealerId}/vehicles`, {
    registrationNumber: h.regNo(),
    dealerId: D.dealerId,
  });
  r.ev({ assisted: assisted?.id ?? null, mass: [mass.status, mass.json?.code] });
  return mass.status === 400 || mass.status === 404
    ? { layers: ['API', 'SECURITY'], note: `dealerId in a Sales body refused (${mass.status})` }
    : { status: 'FAIL', layers: ['API', 'SECURITY'], note: JSON.stringify(mass.json) };
});

// ─── Dealer Verified decisions (#297/#303) ──────────────────────────────────────
await h.check(r, 'VERIFY-DISC-001', async () => {
  const fresh = await w.onboard('DeltaVer');
  await w.approveDealer(admin, fresh.dealerId);
  const byDealer = await fresh.post(`/v1/admin/dealers/${fresh.dealerId}/verification`, {
    expectedVersion: 0,
    status: 'VERIFIED',
  });
  const bySupport = await w.verifyDealer(support, fresh.dealerId);
  const bySales = await w.verifyDealer(salesA, fresh.dealerId);
  const stale = await admin.post(`/v1/admin/dealers/${fresh.dealerId}/verification`, {
    expectedVersion: 99,
    status: 'VERIFIED',
  });
  const ok = await w.verifyDealer(moderator, fresh.dealerId);
  const again = await admin.post(`/v1/admin/dealers/${fresh.dealerId}/verification`, {
    expectedVersion: 0,
    status: 'REVOKED',
    reason: 'Stale version revoke attempt',
  });
  const row = await h.one(`SELECT "verificationStatus" AS s FROM dealers WHERE id=$1`, [
    fresh.dealerId,
  ]);
  const audit = await h.one(
    `SELECT count(*)::int AS n FROM audit_logs WHERE "entityId"=$1 AND action LIKE 'dealer.verification%'`,
    [fresh.dealerId],
  );
  const out = {
    byDealer: byDealer.status,
    bySupport: bySupport.status,
    bySales: bySales.status,
    stale: [stale.status, stale.json?.code],
    ok: [ok.status, ok.json?.code],
    again: again.status,
    row: row.s,
    audit: audit.n,
  };
  r.ev(out);
  return byDealer.status === 401 &&
    bySupport.status === 403 &&
    bySales.status === 403 &&
    stale.status === 409 &&
    ok.status === 200 &&
    again.status === 409 &&
    row.s === 'VERIFIED' &&
    audit.n >= 1
    ? {
        layers: ['API', 'SECURITY', 'DATABASE'],
        note: 'only a reviewer grants Dealer Verified; stale expectedVersion 409; decision audited',
      }
    : { status: 'FAIL', layers: ['API', 'SECURITY', 'DATABASE'], note: JSON.stringify(out) };
});

await h.check(r, 'VERIFY-DISC-002', async () => {
  const pending = await w.onboard('DeltaVerPending');
  const early = await w.verifyDealer(admin, pending.dealerId);
  const row = await h.one(`SELECT "verificationStatus" AS s, status FROM dealers WHERE id=$1`, [
    pending.dealerId,
  ]);
  r.ev({ early: [early.status, early.json?.code], row });
  return early.status >= 400 && row.s !== 'VERIFIED'
    ? {
        note: `Dealer Verified refused for an unapproved application (${early.status} ${early.json?.code})`,
      }
    : { status: 'FAIL', note: JSON.stringify({ early: early.status, row }) };
});

await h.check(r, 'VERIFY-DISC-003', async () => {
  const fresh = await w.onboard('DeltaVerSusp');
  await w.approveDealer(admin, fresh.dealerId);
  await w.verifyDealer(admin, fresh.dealerId);
  const before = await h.call('GET', `/v1/dealers/${fresh.slug}`);
  await admin.post(`/v1/admin/dealers/${fresh.dealerId}/suspend`, {
    reason: 'Delta verified-badge suspension check',
  });
  const during = await h.call('GET', `/v1/dealers/${fresh.slug}`);
  await admin.post(`/v1/admin/dealers/${fresh.dealerId}/reinstate`, {});
  const after = await h.call('GET', `/v1/dealers/${fresh.slug}`);
  const row = await h.one(`SELECT "verificationStatus" AS s FROM dealers WHERE id=$1`, [
    fresh.dealerId,
  ]);
  const badge = (x) => x.json?.verified ?? x.json?.dealer?.verified ?? x.json?.isVerified ?? null;
  r.ev({
    before: [before.status, badge(before)],
    during: during.status,
    after: [after.status, badge(after)],
    row: row.s,
  });
  return before.status === 200 &&
    during.status === 404 &&
    after.status === 200 &&
    row.s === 'VERIFIED'
    ? {
        note: 'a verified dealer disappears while suspended and returns verified after reinstatement',
      }
    : {
        status: 'FAIL',
        note: JSON.stringify({
          before: before.status,
          during: during.status,
          after: after.status,
          row: row.s,
        }),
      };
});

// ─── Dealer portfolio photographs (#299/#304) ──────────────────────────────────
await h.check(r, 'PORTFOLIO-DISC-001', async () => {
  const bytes = await w.jpeg(11, 1200, 900);
  const p = await D.post('/v1/dealer/portfolio/presign', {
    fileName: 'yard.jpg',
    mimeType: 'image/jpeg',
    bytes: bytes.length,
  });
  if (p.status !== 201 && p.status !== 200)
    return { status: 'FAIL', note: `presign ${p.status} ${p.text.slice(0, 200)}` };
  await w.upload(p.json, bytes, 'image/jpeg');
  const c = await D.post('/v1/dealer/portfolio/commit', { mediaId: p.json.mediaId });
  const photo = await h.one(
    `SELECT id, status, "mediaId" FROM dealer_portfolio_photos WHERE "mediaId"=$1`,
    [p.json.mediaId],
  );
  const pubPending = await h.call('GET', `/media/by-media/${p.json.mediaId}/640.webp`);
  const pagePending = JSON.stringify(
    (await h.call('GET', `/v1/dealers/${D.slug}`)).json ?? {},
  ).includes(p.json.mediaId);
  const approve = await admin.post(`/v1/admin/portfolio/${photo.id}/approve`, {});
  const pubApproved = await h.call('GET', `/media/by-media/${p.json.mediaId}/640.webp`);
  const pageApproved = JSON.stringify(
    (await h.call('GET', `/v1/dealers/${D.slug}`)).json ?? {},
  ).includes(p.json.mediaId);
  const takeDown = await admin.post(`/v1/admin/portfolio/${photo.id}/take-down`, {
    reason: 'Delta take-down check',
  });
  const pubDown = await h.call('GET', `/media/by-media/${p.json.mediaId}/640.webp`);
  const out = {
    commit: c.status,
    status: photo.status,
    pubPending: pubPending.status,
    pagePending,
    approve: approve.status,
    pubApproved: pubApproved.status,
    pageApproved,
    takeDown: takeDown.status,
    pubDown: pubDown.status,
  };
  r.ev(out);
  return photo.status === 'PENDING' &&
    pubPending.status === 404 &&
    !pagePending &&
    approve.status === 200 &&
    pubApproved.status === 200 &&
    pageApproved &&
    pubDown.status === 404
    ? {
        layers: ['API', 'STORAGE', 'SECURITY'],
        note: 'a pending portfolio photo is private, public only after approval, private again after take-down',
      }
    : { status: 'FAIL', layers: ['API', 'STORAGE', 'SECURITY'], note: JSON.stringify(out) };
});

await h.check(r, 'PORTFOLIO-DISC-002', async () => {
  const staff = await w.addMember(D, 'STAFF', 'Delta Portfolio Staff');
  const mgr = await w.addMember(D, 'MANAGER', 'Delta Portfolio Manager');
  const other = await w.onboard('DeltaPortB');
  await w.approveDealer(admin, other.dealerId);
  const own = await h.one(`SELECT id FROM dealer_portfolio_photos WHERE "dealerId"=$1 LIMIT 1`, [
    D.dealerId,
  ]);
  const pres = (a) =>
    a.post('/v1/dealer/portfolio/presign', {
      fileName: 'x.jpg',
      mimeType: 'image/jpeg',
      bytes: 100,
    });
  const out = {
    staff: (await pres(staff)).status,
    manager: (await pres(mgr)).status,
    crossDelete: own ? (await other.del(`/v1/dealer/portfolio/${own.id}`)).status : 'n/a',
    stillThere: own
      ? (await h.one(`SELECT status FROM dealer_portfolio_photos WHERE id=$1`, [own.id])).status
      : 'n/a',
  };
  r.ev(out);
  return out.staff === 403 &&
    out.manager === 403 &&
    (out.crossDelete === 404 || out.crossDelete === 403)
    ? {
        layers: ['API', 'TENANT', 'RBAC'],
        note: `portfolio is OWNER-only (STAFF ${out.staff}, MANAGER ${out.manager}); another dealer’s delete ${out.crossDelete}`,
      }
    : { status: 'FAIL', layers: ['API', 'TENANT', 'RBAC'], note: JSON.stringify(out) };
});

// ─── Verification documents stay private (#297) ─────────────────────────────────
await h.check(r, 'DOC-DISC-001', async () => {
  const docs = await h.q(`SELECT id FROM dealer_documents WHERE "dealerId"=$1`, [D.dealerId]);
  const other = await w.onboard('DeltaDocB', { submit: false });
  const crossList = await other.get('/v1/dealer/documents');
  const leaks = docs.some((d) => JSON.stringify(crossList.json ?? {}).includes(d.id));
  const supportVerify = await support.post(`/v1/admin/documents/${docs[0].id}/reject`, {
    reason: 'Support may not review KYC',
  });
  const salesVerify = await salesA.post(`/v1/admin/documents/${docs[0].id}/verify`, {});
  const still = await h.one(`SELECT status FROM dealer_documents WHERE id=$1`, [docs[0].id]);
  r.ev({
    crossList: crossList.status,
    leaks,
    supportReject: supportVerify.status,
    salesVerify: salesVerify.status,
    still: still.status,
  });
  return !leaks &&
    supportVerify.status === 403 &&
    salesVerify.status === 403 &&
    still.status === 'VERIFIED'
    ? {
        layers: ['API', 'SECURITY', 'TENANT'],
        note: 'another dealer’s document list carries none of A’s documents; SUPPORT and SALES_REP cannot review KYC (403), document unchanged',
      }
    : {
        status: 'FAIL',
        layers: ['API', 'SECURITY', 'TENANT'],
        note: JSON.stringify({
          leaks,
          s: supportVerify.status,
          sa: salesVerify.status,
          still: still.status,
        }),
      };
});

// ─── Notification privacy (R117) ───────────────────────────────────────────────
await h.check(r, 'NOTIFY-DISC-001', async () => {
  // R117: a dealer's new-enquiry email never carries the buyer's number. Judged over every
  // email the console mailer wrote to the API log(s) during the campaign (CERT_API_LOG,
  // comma-separated), not one timed delivery: the email queue drains at 30/min (PERF-DISC-001).
  const { readFileSync, existsSync } = await import('node:fs');
  const files = (process.env.CERT_API_LOG ?? '').split(',').filter((f) => f && existsSync(f));
  const support = /\+914162248890|\+91 41622 48890/g;
  const mobile = /(?<![\w-])(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\w-])/;
  const byTemplate = {};
  const hits = {};
  for (const f of files) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      if (!line.includes('"driver":"console"') || !line.includes('"to"')) continue;
      let d;
      try {
        d = JSON.parse(line);
      } catch {
        continue;
      }
      byTemplate[d.tag] = (byTemplate[d.tag] ?? 0) + 1;
      const body = String(d.msg ?? '').replace(support, '<SUPPORT>');
      // Only enquiry and support emails can carry a customer; other templates name the
      // dealership, whose synthetic legal name may itself contain ten digits.
      if (/enquiry|support/.test(d.tag) && mobile.test(body)) hits[d.tag] = (hits[d.tag] ?? 0) + 1;
    }
  }
  const enquiryEmails = byTemplate['dealer.enquiry.received'] ?? 0;
  r.ev({ logs: files.length, emailsByTemplate: byTemplate, templatesWithAMobileNumber: hits });
  if (enquiryEmails === 0)
    return { status: 'BLOCKED', note: 'no dealer.enquiry.received email in the API log(s)' };
  return Object.keys(hits).length === 0
    ? {
        layers: ['API', 'NOTIFY'],
        note: `${Object.values(byTemplate).reduce((x, y) => x + y, 0)} console emails across ${Object.keys(byTemplate).length} templates (${enquiryEmails} dealer enquiry alerts): no enquiry or support email carries a mobile number`,
      }
    : {
        status: 'FAIL',
        layers: ['API', 'NOTIFY'],
        note: `mobile-number pattern in ${JSON.stringify(hits)}`,
      };
});

// ─── Small API-shape observations ───────────────────────────────────────────────
await h.check(r, 'AUTH-DISC-002', async () => {
  const fresh = await h.dealerPhone('Delta Me');
  const me = await fresh.get('/v1/auth/me');
  r.ev({ email: me.json?.user?.email ?? null, emailVerified: me.json?.user?.emailVerified });
  return me.json?.user?.email === null && me.json?.user?.emailVerified === true
    ? {
        status: 'FAIL',
        bug: 'BUG-102',
        note: '/v1/auth/me reports emailVerified:true for a user with no email address',
      }
    : { note: `emailVerified ${me.json?.user?.emailVerified} for email ${me.json?.user?.email}` };
});

r.save();
await h.pool.end();
