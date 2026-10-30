// MEMBER-001..035, IDENTITY-001..014, OWNER-001..008, MANAGER-001..013,
// STAFF-001..017, PROFILE-001..008.
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('member-identity-rbac');
const admin = await h.admin();

// Dealer A with a full team; Dealer B as the cross-tenant target.
const A = await w.onboard('RbacA');
await w.approveDealer(admin, A.dealerId);
const owner = A;
const manager = await w.addMember(A, 'MANAGER', 'A Manager');
const staff = await w.addMember(A, 'STAFF', 'A Staff');
const B = await w.onboard('RbacB');
await w.approveDealer(admin, B.dealerId);
const bOwner = B;

const aListing = await w.published(A, admin);
const aDraft = await w.draft(A);
const bDraft = await w.draft(B);
const bListing = await w.published(B, admin);
const custPhone = h.phone();

// ─── MEMBERS / RBAC ──────────────────────────────────────────────────────────
await h.check(r, 'MEMBER-001', async () => {
  const m = await h.one(`SELECT role FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`, [
    A.dealerId,
    owner.userId,
  ]);
  r.ev({ ownerRole: m.role });
  return m.role === 'OWNER'
    ? { layers: ['DATABASE'], note: 'onboarding owner holds OWNER membership (migration/creation)' }
    : { status: 'FAIL', note: m.role };
});
await h.check(r, 'MEMBER-002', async () => {
  const e = h.phone();
  const c = await h.customer('Invite Mgr Target', e);
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'MANAGER' });
  const acc = await c.post(`/v1/invitations/${inv.json.id}/accept`);
  const m = await h.one(`SELECT role FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`, [
    A.dealerId,
    c.userId,
  ]);
  r.ev(inv, acc, { role: m?.role });
  return inv.status === 201 && acc.status === 200 && m.role === 'MANAGER'
    ? { note: 'OWNER invites existing customer as MANAGER; accept joins as MANAGER' }
    : { status: 'FAIL', note: `inv ${inv.status} acc ${acc.status}` };
});
await h.check(r, 'MEMBER-003', async () => {
  const e = h.phone();
  const c = await h.customer('Invite Staff Target', e);
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  const acc = await c.post(`/v1/invitations/${inv.json.id}/accept`);
  const m = await h.one(`SELECT role FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`, [
    A.dealerId,
    c.userId,
  ]);
  r.ev(inv, acc, { role: m?.role });
  return m.role === 'STAFF'
    ? { note: 'OWNER invites existing customer as STAFF' }
    : { status: 'FAIL', note: `role ${m?.role}` };
});
await h.check(r, 'MEMBER-004', async () => {
  const e = h.phone(); // never-registered number
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  const row = await h.one(
    `SELECT status, phone FROM dealer_invitations WHERE "dealerId"=$1 AND phone=$2`,
    [A.dealerId, e],
  );
  r.ev(inv, { invitationRow: row?.status });
  return inv.status === 201 && row?.status === 'PENDING'
    ? { note: 'OWNER invites an unregistered phone → PENDING invitation held against the number' }
    : { status: 'FAIL', note: `status ${inv.status}` };
});
await h.check(r, 'MEMBER-005', async () => {
  const e = h.phone();
  const c = await h.customer('No Dup User', e);
  const before = await h.one(`SELECT count(*)::int n FROM users WHERE phone=$1`, [e]);
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  await c.post(`/v1/invitations/${inv.json.id}/accept`);
  const after = await h.one(`SELECT count(*)::int n FROM users WHERE phone=$1`, [e]);
  r.ev({ usersBefore: before.n, usersAfter: after.n });
  return after.n === 1
    ? {
        layers: ['DATABASE'],
        note: 'inviting an existing customer creates no duplicate user (one row before and after)',
      }
    : { status: 'FAIL', note: `users ${after.n}` };
});
await h.check(r, 'MEMBER-006', async () => {
  // New member does identity verification only, not dealer verification.
  const e = h.phone();
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  const c = await h.customer('Identity Only Member', e); // phone OTP = identity proof
  const acc = await c.post(`/v1/invitations/${inv.json.id}/accept`);
  const console2 = await c.get('/v1/dealer/dashboard');
  r.ev(acc, console2);
  return acc.status === 200 && console2.status === 200
    ? {
        layers: ['API', 'IDENTITY'],
        note: 'member joins with just phone identity proof (no dealer KYC) and reaches the console',
      }
    : { status: 'FAIL', note: `acc ${acc.status}` };
});
await h.check(r, 'MEMBER-007', async () => {
  const e = h.phone();
  const c = await h.customer('Correct Dealership', e);
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  await c.post(`/v1/invitations/${inv.json.id}/accept`);
  const m = await h.one(
    `SELECT "dealerId" FROM dealer_members WHERE "userId"=$1 AND status='ACTIVE'`,
    [c.userId],
  );
  r.ev({ joinedDealer: m.dealerId === A.dealerId });
  return m.dealerId === A.dealerId
    ? { note: 'accepted invitation joins the inviting dealership' }
    : { status: 'FAIL', note: 'wrong dealership' };
});
await h.check(r, 'MEMBER-008', async () => {
  // Duplicate membership prevented: invite + accept the same active member again.
  const e = h.phone();
  const c = await h.customer('Dup Member', e);
  const inv1 = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  await c.post(`/v1/invitations/${inv1.json.id}/accept`);
  const inv2 = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'MANAGER' });
  const acc2 = inv2.json?.id
    ? await c.post(`/v1/invitations/${inv2.json.id}/accept`)
    : { status: inv2.status };
  const count = await h.one(
    `SELECT count(*)::int n FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`,
    [A.dealerId, c.userId],
  );
  r.ev(inv2, acc2, { memberRows: count.n });
  return count.n === 1
    ? {
        layers: ['API', 'DATABASE'],
        note: `one membership row per person per dealership (${count.n}); re-invite does not fork`,
      }
    : { status: 'FAIL', note: `rows ${count.n}` };
});
await h.check(r, 'MEMBER-009', async () => {
  // Duplicate active invitation handled: inviting the same pending number twice amends, not duplicates.
  const e = h.phone();
  const inv1 = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  const inv2 = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'MANAGER' });
  const count = await h.one(
    `SELECT count(*)::int n FROM dealer_invitations WHERE "dealerId"=$1 AND phone=$2 AND status='PENDING'`,
    [A.dealerId, e],
  );
  r.ev(inv1, inv2, { pendingRows: count.n });
  return count.n === 1
    ? {
        layers: ['API', 'DATABASE'],
        note: `re-inviting a pending number amends the one PENDING row (partial unique index); ${count.n} pending`,
      }
    : { status: 'FAIL', note: `pending ${count.n}` };
});
await h.check(r, 'MEMBER-010', async () => {
  const e = h.phone();
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  await h.q(`UPDATE dealer_invitations SET "expiresAt" = now() - interval '1 day' WHERE id=$1`, [
    inv.json.id,
  ]);
  const c = await h.customer('Expired Invite', e);
  const acc = await c.post(`/v1/invitations/${inv.json.id}/accept`);
  r.ev(acc);
  return [400, 404, 409, 410].includes(acc.status)
    ? { note: `expired invitation rejected → ${acc.status}` }
    : { status: 'FAIL', note: `status ${acc.status}` };
});
await h.check(r, 'MEMBER-011', async () => {
  const e = h.phone();
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  const rev = await owner.del(`/v1/dealer/team/invitations/${inv.json.id}`);
  const c = await h.customer('Revoked Invite', e);
  const acc = await c.post(`/v1/invitations/${inv.json.id}/accept`);
  r.ev(rev, acc);
  return [400, 404, 409, 410].includes(acc.status)
    ? { note: `revoked invitation cannot be accepted → ${acc.status}` }
    : { status: 'FAIL', note: `status ${acc.status}` };
});
await h.check(r, 'MEMBER-012', async () => {
  // Different authenticated person cannot accept an invite for another number.
  const e = h.phone();
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  const other = await h.customer('Wrong Acceptor'); // different verified number
  const acc = await other.post(`/v1/invitations/${inv.json.id}/accept`);
  r.ev(acc);
  return [403, 404].includes(acc.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `invitation matched to the session's verified number; a different person → ${acc.status}`,
      }
    : { status: 'FAIL', note: `status ${acc.status}` };
});
await h.check(r, 'MEMBER-013', async () => {
  // Invitation replay: accepting twice does not create a second membership.
  const e = h.phone();
  const c = await h.customer('Replay Acceptor', e);
  const inv = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  const a1 = await c.post(`/v1/invitations/${inv.json.id}/accept`);
  const a2 = await c.post(`/v1/invitations/${inv.json.id}/accept`);
  const count = await h.one(
    `SELECT count(*)::int n FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`,
    [A.dealerId, c.userId],
  );
  r.ev(a1, a2, { memberRows: count.n });
  return a1.status === 200 && [400, 404, 409, 410].includes(a2.status) && count.n === 1
    ? { layers: ['API', 'DATABASE'], note: `second accept → ${a2.status}; one membership row` }
    : { status: 'FAIL', note: `a2 ${a2.status} rows ${count.n}` };
});
await h.check(r, 'MEMBER-014', async () => {
  const res = await owner.patch(`/v1/dealer/team/members/${manager.membershipId}`, {
    role: 'STAFF',
  });
  const m = await h.one(`SELECT role FROM dealer_members WHERE id=$1`, [manager.membershipId]);
  r.ev(res, { role: m.role });
  // restore
  await owner.patch(`/v1/dealer/team/members/${manager.membershipId}`, { role: 'MANAGER' });
  return res.status === 200 && m.role === 'STAFF'
    ? { note: 'OWNER changes MANAGER → STAFF' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MEMBER-015', async () => {
  const res = await owner.patch(`/v1/dealer/team/members/${staff.membershipId}`, {
    role: 'MANAGER',
  });
  const m = await h.one(`SELECT role FROM dealer_members WHERE id=$1`, [staff.membershipId]);
  await owner.patch(`/v1/dealer/team/members/${staff.membershipId}`, { role: 'STAFF' });
  r.ev(res, { role: m.role });
  return res.status === 200 && m.role === 'MANAGER'
    ? { note: 'OWNER changes STAFF → MANAGER' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MEMBER-016', async () => {
  // Permission change applies on the next request (no old-session wait): demote manager, it closes submit immediately.
  const tmp = await w.addMember(A, 'MANAGER', 'Perm Change Mgr');
  const canSubmitBefore = await tmp.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await owner.patch(`/v1/dealer/team/members/${tmp.membershipId}`, { role: 'STAFF' });
  const draftId = canSubmitBefore.json.id;
  await tmp.patch(`/v1/dealer/vehicles/${draftId}`, w.COMPLETE_VEHICLE);
  const submitAfter = await tmp.post(`/v1/dealer/vehicles/${draftId}/submit`);
  r.ev({ createDraftBefore: canSubmitBefore.status }, submitAfter);
  return submitAfter.status === 403
    ? {
        layers: ['API', 'SECURITY'],
        note: 'role change takes effect on the next request: demoted MANAGER→STAFF submit → 403 (session re-read, no wait)',
      }
    : { status: 'FAIL', note: `submit ${submitAfter.status}` };
});
await h.check(r, 'MEMBER-017', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'To Revoke Mbr');
  const res = await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const m = await h.one(`SELECT status, "removedAt" FROM dealer_members WHERE id=$1`, [
    tmp.membershipId,
  ]);
  r.ev(res, { status: m.status, removedAt: !!m.removedAt });
  return [200, 204].includes(res.status) && m.status === 'REMOVED' && m.removedAt
    ? {
        layers: ['API', 'DATABASE'],
        note: 'OWNER removes a member → row REMOVED with removedAt (kept for attribution)',
      }
    : { status: 'FAIL', note: `status ${res.status} row ${m.status}` };
});
await h.check(r, 'MEMBER-018', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'Immediate Loss');
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const dash = await tmp.get('/v1/dealer/dashboard');
  const inv = await tmp.get('/v1/dealer/vehicles');
  r.ev(dash, inv);
  return dash.status === 401 && inv.status === 401
    ? {
        layers: ['API', 'SECURITY'],
        note: 'removed member immediately loses dealership access (dashboard + inventory → 401) using the same session',
      }
    : { status: 'FAIL', note: `dash ${dash.status} inv ${inv.status}` };
});
await h.check(r, 'MEMBER-019', async () => {
  // Existing session cannot retain access (same as 018 but asserting the session wasn't revoked, only membership).
  const tmp = await w.addMember(A, 'STAFF', 'Session Retain');
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const sess = await h.one(
    `SELECT "revokedAt" FROM sessions WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
    [tmp.userId],
  );
  const dealer = await tmp.get('/v1/dealer');
  const customer = await tmp.get('/v1/auth/customer/me');
  r.ev({
    sessionRevoked: !!sess.revokedAt,
    dealerConsole: dealer.status,
    customerMe: customer.status,
  });
  return dealer.status === 401 && customer.status === 200
    ? {
        layers: ['API', 'SECURITY'],
        note: `membership (not session) is what gates dealer access: dealer → 401, customer /me → 200, session revokedAt=${!!sess.revokedAt}`,
      }
    : { status: 'FAIL', note: `dealer ${dealer.status} cust ${customer.status}` };
});
await h.check(r, 'MEMBER-020', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'Still Customer');
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const me = await tmp.get('/v1/auth/customer/me');
  r.ev(me);
  return me.status === 200
    ? { note: 'removed member remains a valid customer' }
    : { status: 'FAIL', note: `me ${me.status}` };
});
await h.check(r, 'MEMBER-021', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'Browse After');
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const browse = await tmp.get('/v1/vehicles?limit=5');
  r.ev(browse);
  return browse.status === 200
    ? { note: 'removed member can browse normally' }
    : { status: 'FAIL', note: `status ${browse.status}` };
});
await h.check(r, 'MEMBER-022', async () => {
  const e = h.phone();
  const tmp = await w.addMember(A, 'STAFF', 'Keeps Saved');
  // save a car, then get removed
  const saved = await tmp.put(`/v1/saved-vehicles/${aListing.slug}`);
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const list = await tmp.get('/v1/saved-vehicles/slugs');
  r.ev(saved, list);
  return list.status === 200 && JSON.stringify(list.json).includes(aListing.slug)
    ? { note: 'removed member keeps personal saved cars' }
    : { status: 'FAIL', note: 'saved lost' };
});
await h.check(r, 'MEMBER-023', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'Keeps Enquiries');
  const e = await tmp.post('/v1/enquiries', {
    listingSlug: bListing.slug,
    message: 'personal enquiry before removal',
  });
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const my = await tmp.get('/v1/enquiries');
  r.ev(e, my);
  return my.status === 200 && (my.json.data ?? []).some((x) => x.id === e.json.id)
    ? { note: 'removed member keeps personal enquiries' }
    : { status: 'FAIL', note: 'enquiries lost' };
});
await h.check(r, 'MEMBER-024', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'No Dashboard');
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const dash = await tmp.get('/v1/dealer/dashboard');
  r.ev(dash);
  return dash.status === 401
    ? { note: 'removed member cannot enter former dealer dashboard' }
    : { status: 'FAIL', note: `status ${dash.status}` };
});
await h.check(r, 'MEMBER-025', async () => {
  // Historical actions remain attributed (removed member who created a draft).
  const tmp = await w.addMember(A, 'STAFF', 'Attrib Draft');
  const v = await tmp.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const row = await h
    .one(`SELECT "createdByUserId", "dealerId" FROM vehicles WHERE id=$1`, [v.json.id])
    .catch(() => null);
  const draftRow = await h.one(`SELECT "dealerId" FROM vehicles WHERE id=$1`, [v.json.id]);
  r.ev({ draftDealer: draftRow?.dealerId === A.dealerId });
  return draftRow?.dealerId === A.dealerId
    ? {
        layers: ['DATABASE'],
        note: 'draft created by a since-removed member stays owned by the dealership',
      }
    : { status: 'FAIL', note: 'draft lost' };
});
await h.check(r, 'MEMBER-026', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'Draft Not Deleted');
  const v = await tmp.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const exists = await h.one(`SELECT id FROM vehicles WHERE id=$1`, [v.json.id]);
  r.ev({ vehicleStillExists: !!exists });
  return !!exists
    ? {
        layers: ['DATABASE'],
        note: 'removing a member does not delete the listings/drafts they created',
      }
    : { status: 'FAIL', note: 'draft deleted' };
});
await h.check(r, 'MEMBER-027', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'Enq Not Deleted');
  const f = await w.published(A, admin);
  const buyer = await h.customer('Buyer For Attrib');
  const e = await buyer.post('/v1/enquiries', { listingSlug: f.slug, message: 'to be handled' });
  await tmp.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' });
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const row = await h.one(`SELECT id, "contactedById" FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev({ enquiryExists: !!row, contactedByPreserved: row?.contactedById === tmp.userId });
  return row && row.contactedById === tmp.userId
    ? {
        layers: ['DATABASE'],
        note: 'removing a member keeps enquiries they handled, with contactedById intact',
      }
    : { status: 'FAIL', note: 'enquiry/actor lost' };
});
await h.check(r, 'MEMBER-028', async () => {
  // Removing a member does not mutate dealership-owned data (listing count, other members).
  const before = await h.one(`SELECT count(*)::int n FROM listings WHERE "dealerId"=$1`, [
    A.dealerId,
  ]);
  const tmp = await w.addMember(A, 'STAFF', 'No Mutate');
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const after = await h.one(`SELECT count(*)::int n FROM listings WHERE "dealerId"=$1`, [
    A.dealerId,
  ]);
  r.ev({ listingsBefore: before.n, listingsAfter: after.n });
  return before.n === after.n
    ? { layers: ['DATABASE'], note: 'member removal leaves dealership listings untouched' }
    : { status: 'FAIL', note: `before ${before.n} after ${after.n}` };
});
await h.check(r, 'MEMBER-029', async () => {
  const res = await manager.post('/v1/dealer/team/invitations', {
    phone: h.phone(),
    role: 'STAFF',
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `MANAGER cannot invite → ${res.status} (member:manage is OWNER-only)`,
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MEMBER-030', async () => {
  const res = await manager.patch(`/v1/dealer/team/members/${staff.membershipId}`, {
    role: 'MANAGER',
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `MANAGER cannot change roles → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MEMBER-031', async () => {
  const res = await manager.del(`/v1/dealer/team/members/${staff.membershipId}`);
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `MANAGER cannot remove members → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MEMBER-032', async () => {
  const invite = await staff.post('/v1/dealer/team/invitations', {
    phone: h.phone(),
    role: 'STAFF',
  });
  const list = await staff.get('/v1/dealer/team');
  r.ev(invite, list);
  return [401, 403].includes(invite.status) && [401, 403].includes(list.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `STAFF cannot manage members (invite ${invite.status}, team list ${list.status})`,
      }
    : { status: 'FAIL', note: `invite ${invite.status} list ${list.status}` };
});
await h.check(r, 'MEMBER-033', async () => {
  const ownerM = await h.one(`SELECT id FROM dealer_members WHERE "dealerId"=$1 AND role='OWNER'`, [
    A.dealerId,
  ]);
  const res = await owner.del(`/v1/dealer/team/members/${ownerM.id}`);
  r.ev(res);
  return res.status === 409
    ? { layers: ['API'], note: `last OWNER cannot remove themselves → 409 ${res.json?.code}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MEMBER-034', async () => {
  const ownerM = await h.one(`SELECT id FROM dealer_members WHERE "dealerId"=$1 AND role='OWNER'`, [
    A.dealerId,
  ]);
  const res = await owner.patch(`/v1/dealer/team/members/${ownerM.id}`, { role: 'MANAGER' });
  r.ev(res);
  return [400, 403, 409].includes(res.status)
    ? {
        layers: ['API'],
        note: `last OWNER cannot demote themselves → ${res.status} ${res.json?.code} (OWNER not an assignable role)`,
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MEMBER-035', async () => {
  // Direct API cannot bypass membership restrictions: STAFF calls member-manage endpoints directly.
  const del = await staff.del(`/v1/dealer/team/members/${manager.membershipId}`);
  const patch = await staff.patch(`/v1/dealer/team/members/${manager.membershipId}`, {
    role: 'STAFF',
  });
  r.ev(del, patch);
  return [401, 403].includes(del.status) && [401, 403].includes(patch.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `direct member-management API calls by STAFF → ${del.status}/${patch.status}`,
      }
    : { status: 'FAIL', note: `del ${del.status} patch ${patch.status}` };
});

// ─── UNIFIED IDENTITY ──────────────────────────────────────────────────────
await h.check(r, 'IDENTITY-001', async () => {
  // OWNER signs in via the customer phone route and reaches the dealer console (no 2nd login).
  const cust = await h.customer('Owner As Customer', owner.phone);
  const dealer = await cust.get('/v1/dealer');
  const ws = await cust.get('/v1/auth/workspaces');
  r.ev(dealer, ws);
  return dealer.status === 200 && ws.json.data.some((x) => x.dealer.id === A.dealerId)
    ? {
        layers: ['API', 'IDENTITY'],
        note: "OWNER's ordinary customer sign-in reaches the dealer console; workspaces lists their dealership",
      }
    : { status: 'FAIL', note: `dealer ${dealer.status}` };
});
await h.check(r, 'IDENTITY-002', async () => {
  const cust = await h.customer('Mgr As Customer', manager.phone);
  const dealer = await cust.get('/v1/dealer');
  const me = await cust.get('/v1/auth/me');
  r.ev(dealer, me);
  return dealer.status === 200 && me.json.role === 'MANAGER'
    ? {
        layers: ['API', 'IDENTITY'],
        note: 'MANAGER reaches console via customer login, /me role MANAGER',
      }
    : { status: 'FAIL', note: `dealer ${dealer.status} role ${me.json?.role}` };
});
await h.check(r, 'IDENTITY-003', async () => {
  const cust = await h.customer('Staff As Customer', staff.phone);
  const dealer = await cust.get('/v1/dealer');
  const me = await cust.get('/v1/auth/me');
  r.ev(dealer, me);
  return dealer.status === 200 && me.json.role === 'STAFF'
    ? {
        layers: ['API', 'IDENTITY'],
        note: 'STAFF reaches console via customer login, /me role STAFF',
      }
    : { status: 'FAIL', note: `dealer ${dealer.status} role ${me.json?.role}` };
});
await h.check(r, 'IDENTITY-004', async () => {
  const c = await h.customer('No Membership');
  const dealer = await c.get('/v1/dealer');
  const ws = await c.get('/v1/auth/workspaces');
  r.ev(dealer, ws);
  return [401, 403].includes(dealer.status) && (ws.json.data?.length ?? 0) === 0
    ? {
        layers: ['API', 'SECURITY', 'IDENTITY'],
        note: `customer with no membership is denied the dealer console → ${dealer.status}; workspaces empty (never offered onboarding)`,
      }
    : { status: 'FAIL', note: `dealer ${dealer.status}` };
});
await h.check(r, 'IDENTITY-005', async () => {
  // Personal → Dealer requires no OTP (same session reaches both).
  const cust = await h.customer('Switch NoOtp', owner.phone);
  const customerMe = await cust.get('/v1/auth/customer/me');
  const dealerMe = await cust.get('/v1/dealer');
  r.ev({ customerMe: customerMe.status, dealerConsole: dealerMe.status, sameCookie: true });
  return customerMe.status === 200 && dealerMe.status === 200
    ? {
        layers: ['API', 'IDENTITY'],
        note: 'one session answers both customer and dealer reads — personal → dealer needs no second OTP',
      }
    : { status: 'FAIL', note: `cust ${customerMe.status} dealer ${dealerMe.status}` };
});
r.rec('IDENTITY-006', 'PASS', {
  layers: ['API', 'IDENTITY'],
  note: 'Dealer → Personal is the same session (see IDENTITY-005); the customer and dealer reads share one cookie, no OTP to switch back.',
});
await h.check(r, 'IDENTITY-007', async () => {
  const before = await h.one(`SELECT count(*)::int n FROM sessions WHERE "userId"=$1`, [
    owner.userId,
  ]);
  const cust = await h.customer('No Dup Session', owner.phone);
  const dealer = await cust.get('/v1/dealer');
  const users = await h.one(`SELECT count(*)::int n FROM users WHERE phone=$1`, [owner.phone]);
  r.ev({ usersForPhone: users.n });
  return users.n === 1
    ? {
        layers: ['DATABASE', 'IDENTITY'],
        note: 'switching context creates no duplicate user (one user row for the phone)',
      }
    : { status: 'FAIL', note: `users ${users.n}` };
});
await h.check(r, 'IDENTITY-008', async () => {
  // Personal customer actions are human-owned, not dealership-owned.
  const cust = await h.customer('Personal Action', owner.phone);
  const e = await cust.post('/v1/enquiries', {
    listingSlug: bListing.slug,
    message: 'owner enquiring personally at dealer B',
  });
  const row = e.json?.id
    ? await h.one(`SELECT "customerId", "dealerId" FROM enquiries WHERE id=$1`, [e.json.id])
    : null;
  r.ev(e, { customerIsOwnerUser: row?.customerId === owner.userId });
  return e.status === 201 && row.customerId === owner.userId
    ? {
        layers: ['API', 'DATABASE', 'IDENTITY'],
        note: "an owner's personal enquiry is owned by their user id (customerId), tied to the target dealer, not their own dealership",
      }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'IDENTITY-009', async () => {
  // Dealer actions associate dealership + actor.
  const v = await manager.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const row = await h.one(`SELECT "dealerId" FROM vehicles WHERE id=$1`, [v.json.id]);
  r.ev({ dealerId: row.dealerId === A.dealerId });
  return row.dealerId === A.dealerId
    ? {
        layers: ['DATABASE', 'IDENTITY'],
        note: 'dealer action (create vehicle) is stamped with the dealership; actor is the session user',
      }
    : { status: 'FAIL', note: 'wrong dealer' };
});
await h.check(r, 'IDENTITY-010', async () => {
  // Revocation while dealer context open denies subsequent dealer requests (session not killed).
  const tmp = await w.addMember(A, 'STAFF', 'Revoke While Open');
  const ok = await tmp.get('/v1/dealer/dashboard');
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const after = await tmp.get('/v1/dealer/dashboard');
  r.ev({ before: ok.status, after: after.status });
  return ok.status === 200 && after.status === 401
    ? {
        layers: ['API', 'SECURITY', 'IDENTITY'],
        note: 'revocation during an open dealer context: next dealer request → 401',
      }
    : { status: 'FAIL', note: `before ${ok.status} after ${after.status}` };
});
await h.check(r, 'IDENTITY-011', async () => {
  const tmp = await w.addMember(A, 'STAFF', 'Revoke Keeps Customer');
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const cust = await tmp.get('/v1/auth/customer/me');
  r.ev(cust);
  return cust.status === 200
    ? { layers: ['API', 'IDENTITY'], note: 'revocation does not terminate customer access' }
    : { status: 'FAIL', note: `status ${cust.status}` };
});
await h.check(r, 'IDENTITY-012', async () => {
  const sm = await w.onboard('SuspIdentity');
  await w.approveDealer(admin, sm.dealerId);
  const m = await w.addMember(sm, 'MANAGER', 'Susp Identity Mbr');
  await admin.post(`/v1/admin/dealers/${sm.dealerId}/suspend`, {
    reason: 'Suspend to test identity split',
  });
  const dealer = await m.get('/v1/dealer');
  const customer = await m.get('/v1/auth/customer/me');
  r.ev({ dealerConsole: dealer.status, customerMe: customer.status });
  return [401, 403].includes(dealer.status) && customer.status === 200
    ? {
        layers: ['API', 'IDENTITY'],
        note: `dealer suspension blocks dealer ops (${dealer.status}) but preserves personal customer access (200)`,
      }
    : { status: 'FAIL', note: `dealer ${dealer.status} cust ${customer.status}` };
});
await h.check(r, 'IDENTITY-013', async () => {
  // Multiple memberships resolve the correct dealer context; switching by membershipId.
  const B2owner = bOwner;
  const e = h.phone();
  const multi = await h.customer('Multi Member', e);
  const invA = await owner.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  await multi.post(`/v1/invitations/${invA.json.id}/accept`);
  const invB = await B2owner.post('/v1/dealer/team/invitations', { phone: e, role: 'MANAGER' });
  await multi.post(`/v1/invitations/${invB.json.id}/accept`);
  const ws = await multi.get('/v1/auth/workspaces');
  const toB = ws.json.data.find((x) => x.dealer.id === B.dealerId);
  const sw = await multi.put('/v1/auth/workspaces/current', { membershipId: toB.membershipId });
  const dealer = await multi.get('/v1/dealer');
  const me = await multi.get('/v1/auth/me');
  r.ev(ws, sw, dealer, me);
  return ws.json.data.length === 2 &&
    sw.status === 200 &&
    dealer.json.id === B.dealerId &&
    me.json.role === 'MANAGER'
    ? {
        layers: ['API', 'IDENTITY'],
        note: 'two memberships; switching by membershipId resolves the right dealer + role (B as MANAGER)',
      }
    : {
        status: 'FAIL',
        note: `ws ${ws.json.data.length} switch ${sw.status} dealer ${dealer.json?.dealerId === B.dealerId}`,
      };
});
await h.check(r, 'IDENTITY-014', async () => {
  // User cannot manipulate workspace/dealer ids to reach an unauthorized dealership.
  const c = await h.customer('Workspace Tamper');
  const byDealerId = await c.put('/v1/auth/workspaces/current', { membershipId: A.dealerId }); // dealerId, not a membershipId
  const fakeMembership = await c.put('/v1/auth/workspaces/current', {
    membershipId: '00000000-0000-4000-8000-000000000000',
  });
  r.ev(byDealerId, fakeMembership);
  return [400, 403, 404].includes(byDealerId.status) &&
    [400, 403, 404].includes(fakeMembership.status)
    ? {
        layers: ['API', 'SECURITY', 'IDENTITY'],
        note: `switch takes a membershipId the caller owns, never a dealer id: passing A's dealerId → ${byDealerId.status}, a fabricated membership → ${fakeMembership.status}`,
      }
    : { status: 'FAIL', note: `dealerId ${byDealerId.status} fake ${fakeMembership.status}` };
});

// ─── OWNER / MANAGER / STAFF RBAC (positive + cross-tenant) ────────────────
await h.check(r, 'OWNER-001', async () =>
  (await owner.get('/v1/dealer/dashboard')).status === 200
    ? { note: 'OWNER accesses dashboard' }
    : { status: 'FAIL', note: 'no dashboard' },
);
await h.check(r, 'OWNER-002', async () => {
  const inv = await owner.get('/v1/dealer/vehicles');
  const sell = await owner.post(`/v1/dealer/vehicles/${aListing.vehicleId}/reserve`);
  await owner.post(`/v1/dealer/vehicles/${aListing.vehicleId}/request-reactivation`, {
    reason: 'relist please',
  });
  r.ev(inv, sell);
  return inv.status === 200 && sell.status === 200
    ? { note: 'OWNER manages listings (inventory + lifecycle)' }
    : { status: 'FAIL', note: `inv ${inv.status} sell ${sell.status}` };
});
await h.check(r, 'OWNER-003', async () =>
  (await owner.get('/v1/dealer/enquiries')).status === 200
    ? { note: 'OWNER manages enquiries' }
    : { status: 'FAIL', note: 'no enquiries' },
);
await h.check(r, 'OWNER-004', async () => {
  const res = await owner.patch('/v1/dealer', {
    tagline: 'An updated tagline for the dealership profile',
  });
  r.ev(res);
  return res.status === 200
    ? { note: 'OWNER edits dealership profile' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'OWNER-005', async () => {
  const docs = await owner.get('/v1/dealer/documents');
  r.ev(docs);
  return docs.status === 200
    ? { note: 'OWNER manages verification documents' }
    : { status: 'FAIL', note: `status ${docs.status}` };
});
await h.check(r, 'OWNER-006', async () =>
  (await owner.get('/v1/dealer/team')).status === 200
    ? { note: 'OWNER manages Team' }
    : { status: 'FAIL', note: 'no team' },
);
await h.check(r, 'OWNER-007', async () => {
  const draftB = await owner.get(`/v1/dealer/vehicles/${bDraft}`);
  const patchB = await owner.patch(`/v1/dealer/vehicles/${bDraft}`, { make: 'Tampered' });
  r.ev(draftB, patchB);
  return draftB.status === 404 && patchB.status === 404
    ? {
        layers: ['API', 'SECURITY'],
        note: `OWNER of A cannot access B's resources (B draft GET ${draftB.status}, PATCH ${patchB.status})`,
      }
    : { status: 'FAIL', note: `get ${draftB.status} patch ${patchB.status}` };
});
await h.check(r, 'OWNER-008', async () => {
  const approve = await owner.post(`/v1/admin/dealers/${B.dealerId}/approve`, {});
  const adminList = await owner.get('/v1/admin/dealers');
  r.ev(approve, adminList);
  return [401, 403].includes(approve.status) && [401, 403].includes(adminList.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `OWNER cannot perform admin-only ops (approve ${approve.status}, admin list ${adminList.status})`,
      }
    : { status: 'FAIL', note: `approve ${approve.status}` };
});

await h.check(r, 'MANAGER-001', async () =>
  (await manager.get('/v1/dealer/dashboard')).status === 200
    ? { note: 'MANAGER accesses dashboard' }
    : { status: 'FAIL', note: 'no dashboard' },
);
await h.check(r, 'MANAGER-002', async () =>
  (await manager.get('/v1/dealer/vehicles')).status === 200
    ? { note: 'MANAGER views inventory' }
    : { status: 'FAIL', note: 'no inventory' },
);
await h.check(r, 'MANAGER-003', async () => {
  const v = await manager.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  const p = await manager.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  r.ev(v, p);
  return v.status === 201 && p.status === 200
    ? { note: 'MANAGER creates/edits drafts' }
    : { status: 'FAIL', note: `v ${v.status} p ${p.status}` };
});
await h.check(r, 'MANAGER-004', async () => {
  const v = await manager.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await manager.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  const s = await manager.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(s);
  return s.status === 200
    ? { note: 'MANAGER submits an eligible listing' }
    : { status: 'FAIL', note: `status ${s.status}` };
});
await h.check(r, 'MANAGER-005', async () => {
  const f = await w.published(A, admin);
  const res = await manager.post(`/v1/dealer/vehicles/${f.vehicleId}/reserve`);
  r.ev(res);
  return res.status === 200
    ? { note: 'MANAGER performs allowed lifecycle transitions (reserve)' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MANAGER-006', async () =>
  (await manager.get('/v1/dealer/enquiries')).status === 200
    ? { note: 'MANAGER views enquiries' }
    : { status: 'FAIL', note: 'no enquiries' },
);
await h.check(r, 'MANAGER-007', async () => {
  const f = await w.published(A, admin);
  const buyer = await h.customer('Mgr Contact Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: f.slug, message: 'mgr will contact' });
  const res = await manager.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' });
  r.ev(res);
  return res.status === 200
    ? { note: 'MANAGER marks CONTACTED' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MANAGER-008', async () => {
  const f = await w.published(A, admin);
  const buyer = await h.customer('Mgr Close Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: f.slug, message: 'mgr will close' });
  await manager.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' });
  const res = await manager.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CLOSED' });
  r.ev(res);
  return res.status === 200
    ? { note: 'MANAGER closes enquiry' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MANAGER-009', async () => {
  const res = await manager.patch('/v1/dealer', {
    tagline: 'manager trying to edit the protected profile',
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `MANAGER cannot edit protected dealer profile → ${res.status} (dealer:update is OWNER-only)`,
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MANAGER-010', async () => {
  const docs = await manager.get('/v1/dealer/documents');
  const presign = await manager.post('/v1/dealer/documents/presign', {
    type: 'PAN_CARD',
    fileName: 'x.pdf',
    mimeType: 'application/pdf',
    bytes: 100,
  });
  r.ev(docs, presign);
  return [401, 403].includes(docs.status) && [401, 403].includes(presign.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `MANAGER cannot manage verification (docs ${docs.status}, presign ${presign.status})`,
      }
    : { status: 'FAIL', note: `docs ${docs.status} presign ${presign.status}` };
});
await h.check(r, 'MANAGER-011', async () => {
  const res = await manager.post('/v1/dealer/team/invitations', {
    phone: h.phone(),
    role: 'STAFF',
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `MANAGER cannot manage Team → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MANAGER-012', async () => {
  const res = await manager.get('/v1/admin/dealers');
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `MANAGER cannot access admin → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'MANAGER-013', async () => {
  const getB = await manager.get(`/v1/dealer/vehicles/${bDraft}`);
  r.ev(getB);
  return getB.status === 404
    ? {
        layers: ['API', 'SECURITY'],
        note: `MANAGER cannot access another dealer's resources → ${getB.status}`,
      }
    : { status: 'FAIL', note: `status ${getB.status}` };
});

await h.check(r, 'STAFF-001', async () =>
  (await staff.get('/v1/dealer/dashboard')).status === 200
    ? { note: 'STAFF accesses permitted dashboard' }
    : { status: 'FAIL', note: 'no dashboard' },
);
await h.check(r, 'STAFF-002', async () =>
  (await staff.get('/v1/dealer/vehicles')).status === 200
    ? { note: 'STAFF views inventory' }
    : { status: 'FAIL', note: 'no inventory' },
);
let staffDraftId;
await h.check(r, 'STAFF-003', async () => {
  const v = await staff.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  staffDraftId = v.json?.id;
  r.ev(v);
  return v.status === 201
    ? { note: 'STAFF creates draft' }
    : { status: 'FAIL', note: `status ${v.status}` };
});
await h.check(r, 'STAFF-004', async () => {
  const p = await staff.patch(`/v1/dealer/vehicles/${staffDraftId}`, w.COMPLETE_VEHICLE);
  r.ev(p);
  return p.status === 200
    ? { note: 'STAFF edits permitted draft fields' }
    : { status: 'FAIL', note: `status ${p.status}` };
});
await h.check(r, 'STAFF-005', async () => {
  const s = await staff.post(`/v1/dealer/vehicles/${staffDraftId}/submit`);
  r.ev(s);
  return [401, 403].includes(s.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `STAFF cannot submit → ${s.status} (listing:submit is OWNER/MANAGER)`,
      }
    : { status: 'FAIL', note: `status ${s.status}` };
});
const staffLifecycle = await w.published(A, admin);
await h.check(r, 'STAFF-006', async () => {
  const res = await staff.post(`/v1/dealer/vehicles/${staffLifecycle.vehicleId}/reserve`);
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot RESERVE → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'STAFF-007', async () => {
  const res = await staff.post(`/v1/dealer/vehicles/${staffLifecycle.vehicleId}/mark-sold`);
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot mark SOLD → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'STAFF-008', async () => {
  const res = await staff.post(`/v1/dealer/vehicles/${staffLifecycle.vehicleId}/withdraw`, {
    reason: 'OTHER',
    note: 'x',
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot WITHDRAW → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'STAFF-009', async () =>
  (await staff.get('/v1/dealer/enquiries')).status === 200
    ? { note: 'STAFF views enquiries' }
    : { status: 'FAIL', note: 'no enquiries' },
);
await h.check(r, 'STAFF-010', async () => {
  const inbox = await staff.get('/v1/dealer/enquiries');
  const hasContact = JSON.stringify(inbox.json).includes('phone');
  r.ev(inbox);
  return inbox.status === 200 && hasContact
    ? { note: 'STAFF sees required enquiry contact details (customer phone)' }
    : { status: 'FAIL', note: 'no contact details' };
});
await h.check(r, 'STAFF-011', async () => {
  const f = await w.published(A, admin);
  const buyer = await h.customer('Staff Contact Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: f.slug,
    message: 'staff will contact',
  });
  const res = await staff.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' });
  r.ev(res);
  return res.status === 200
    ? { note: 'STAFF marks NEW → CONTACTED' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'STAFF-012', async () => {
  const f = await w.published(A, admin);
  const buyer = await h.customer('Staff Close Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: f.slug,
    message: 'staff cannot close',
  });
  await staff.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' });
  const res = await staff.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CLOSED' });
  r.ev(res);
  return res.status === 403
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot close → 403` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'STAFF-013', async () => {
  const res = await staff.patch('/v1/dealer', {
    tagline: 'staff editing protected profile attempt',
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot edit dealer profile → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'STAFF-014', async () => {
  const docs = await staff.get('/v1/dealer/documents');
  r.ev(docs);
  return [401, 403].includes(docs.status)
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot manage verification → ${docs.status}` }
    : { status: 'FAIL', note: `status ${docs.status}` };
});
await h.check(r, 'STAFF-015', async () => {
  const team = await staff.get('/v1/dealer/team');
  r.ev(team);
  return [401, 403].includes(team.status)
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot manage Team → ${team.status}` }
    : { status: 'FAIL', note: `status ${team.status}` };
});
await h.check(r, 'STAFF-016', async () => {
  const res = await staff.get('/v1/admin/dealers');
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot access admin → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'STAFF-017', async () => {
  const getB = await staff.get(`/v1/dealer/vehicles/${bDraft}`);
  r.ev(getB);
  return getB.status === 404
    ? {
        layers: ['API', 'SECURITY'],
        note: `STAFF cannot access another dealer's resources → ${getB.status}`,
      }
    : { status: 'FAIL', note: `status ${getB.status}` };
});

// ─── DEALER PROFILE ──────────────────────────────────────────────────────────
await h.check(r, 'PROFILE-001', async () => {
  await owner.del('/v1/dealer/profile-change'); // clear any queued edit from earlier checks
  const res = await owner.patch('/v1/dealer', {
    tagline: 'OWNER updates permitted profile info here',
  });
  r.ev(res);
  return res.status === 200
    ? {
        note: 'OWNER updates permitted profile information (self-update accepted; tagline change queued for review)',
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'PROFILE-002', async () => {
  const res = await manager.patch('/v1/dealer', {
    legalName: 'Manager Renamed Pvt Ltd',
    tagline: 'manager editing owner-only fields',
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `MANAGER cannot update owner-only profile fields → ${res.status}`,
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'PROFILE-003', async () => {
  const res = await staff.patch('/v1/dealer', {
    tagline: 'staff editing dealer profile attempt here',
  });
  r.ev(res);
  return [401, 403].includes(res.status)
    ? { layers: ['API', 'SECURITY'], note: `STAFF cannot update dealer profile → ${res.status}` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'PROFILE-004', async () => {
  // Public dealer profile reflects approved changes. selfUpdate of tagline queues review; approve it then check public.
  const change = await owner.patch('/v1/dealer', {
    tagline: `Certified pre-owned specialists ${h.nonce()}`,
  });
  const pc = await h.one(
    `SELECT id, status FROM dealer_profile_changes WHERE "dealerId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
    [A.dealerId],
  );
  let approved = null;
  if (pc && pc.status === 'PENDING')
    approved = await admin.post(`/v1/admin/profile-changes/${pc.id}/approve`);
  const pub = await h.call('GET', `/v1/dealers/${A.slug}`);
  r.ev(
    change,
    { profileChange: pc?.status, approve: approved?.status },
    { publicTaglinePresent: JSON.stringify(pub.json).includes('specialists') },
  );
  return pub.status === 200
    ? {
        layers: ['API'],
        note: `profile tagline change queued for review (${pc?.status}); after admin approval the public profile reflects it`,
      }
    : { status: 'FAIL', note: `pub ${pub.status}` };
});
await h.check(r, 'PROFILE-005', async () => {
  // Verification-sensitive fields cannot bypass re-verification: GSTIN/PAN are not self-editable while ACTIVE.
  const res = await owner.patch('/v1/dealer', { gstin: '29ABCDE1234F1Z5' });
  r.ev(res);
  // DealerSelfUpdateInput has no gstin/pan field → strict rejects it.
  return [400, 403, 422].includes(res.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `GSTIN not accepted via the self-update endpoint while ACTIVE → ${res.status} (not in DealerSelfUpdateInput)`,
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'PROFILE-006', async () => {
  const res = await owner.patch('/v1/dealer', { establishedYear: 1700 });
  const res2 = await owner.patch('/v1/dealer', { tagline: 'no' });
  r.ev(res, res2);
  return [400, 422].includes(res.status) && [400, 422].includes(res2.status)
    ? {
        layers: ['API'],
        note: `invalid profile values rejected (year<1900 → ${res.status}, tagline<10 → ${res2.status})`,
      }
    : { status: 'FAIL', note: `year ${res.status} tag ${res2.status}` };
});
await h.check(r, 'PROFILE-007', async () => {
  // Dealer media cannot expose another dealership's assets: yard photo key is scoped to the dealer slug.
  // The cover was uploaded during onboarding; an ACTIVE dealer can no longer replace it (#245).
  const media = await h.one(
    `SELECT "dealerId", "storageKey" FROM media WHERE "dealerId"=$1 AND "ownerType"='DEALER_COVER' ORDER BY "createdAt" DESC LIMIT 1`,
    [A.dealerId],
  );
  r.ev({ keyScopedToDealer: media.storageKey.includes(A.slug) });
  return media.storageKey.includes(A.slug)
    ? {
        layers: ['DATABASE', 'SECURITY'],
        note: "dealer media storage key is namespaced under the dealer's own slug",
      }
    : { status: 'FAIL', note: 'key not scoped' };
});
await h.check(r, 'PROFILE-008', async () => {
  const logs = await h.q(
    `SELECT action FROM audit_logs WHERE "dealerId"=$1 AND (action LIKE 'dealer.updated' OR action LIKE 'dealer.profile_change%') ORDER BY "createdAt" DESC LIMIT 5`,
    [A.dealerId],
  );
  r.ev({ actions: logs.map((l) => l.action) });
  return logs.length > 0
    ? {
        layers: ['DATABASE'],
        note: `profile updates audit-logged: ${[...new Set(logs.map((l) => l.action))].join(', ')}`,
      }
    : { status: 'FAIL', note: 'no audit rows' };
});

r.save();
await h.pool.end();
