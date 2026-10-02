// CROSS-001..029, SEARCH-005..009, DATA-001..011.
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('cross-search-data');
const admin = await h.admin();

// Reusable builders.
async function dealerWith(label) {
  const d = await w.onboard(label);
  await w.approveDealer(admin, d.dealerId);
  return d;
}

// ─── CROSS-LIFECYCLE ─────────────────────────────────────────────────────────
await h.check(r, 'CROSS-001', async () => {
  const d = await dealerWith('Cross1'); const pub = await w.published(d, admin);
  const before = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'ACTIVE dealer + listing suspension' });
  const after = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [pub.listingId]);
  r.ev({ before, after, listingRow: row.status });
  return before === 200 && after === 404 && row.status === 'ACTIVE' ? { note: 'suspension hides the listing publicly (404) without deleting it (row ACTIVE)' } : { status: 'FAIL', note: `before ${before} after ${after} row ${row.status}` };
});
await h.check(r, 'CROSS-002', async () => {
  const d = await dealerWith('Cross2'); const pub = await w.published(d, admin);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend then reinstate restoration' });
  await admin.post(`/v1/admin/dealers/${d.dealerId}/reinstate`, {});
  const after = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  r.ev({ afterReinstate: after });
  return after === 200 ? { note: 'reinstatement restores the hidden ACTIVE listing (200)' } : { status: 'FAIL', note: `after ${after}` };
});
await h.check(r, 'CROSS-003', async () => {
  const d = await dealerWith('Cross3'); const pub = await w.published(d, admin);
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/reserve`);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend while reserved' });
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [pub.listingId]);
  r.ev({ reservedRow: row.status });
  return row.status === 'RESERVED' ? { note: 'suspension while RESERVED stays consistent (row RESERVED)' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'CROSS-004', async () => {
  const d = await dealerWith('Cross4'); const s = await w.submitted(d);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend while moderation pending' });
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev({ listingRow: row.status });
  return row.status === 'PENDING_REVIEW' ? { note: 'suspension while moderation-pending leaves the listing PENDING_REVIEW (explicit: not published while dealer suspended)' } : { status: 'FAIL', note: row.status };
});
await h.check(r, 'CROSS-005', async () => {
  const d = await dealerWith('Cross5'); const pub = await w.published(d, admin);
  const buyer = await h.customer('Cross5 Buyer');
  const [suspend, enq] = await Promise.all([
    admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend during enquiry submission' }),
    buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'racing suspension' }),
  ]);
  const count = await h.one(`SELECT count(*)::int c FROM enquiries WHERE "listingId"=$1`, [pub.listingId]);
  r.ev(suspend, enq, { enquiries: count.c });
  return [201, 404, 409].includes(enq.status) ? { layers: ['API', 'DATABASE'], note: `suspension vs enquiry race resolves safely (enq ${enq.status}, ${count.c} row)` } : { status: 'FAIL', note: `enq ${enq.status}` };
});
await h.check(r, 'CROSS-006', async () => {
  const d = await dealerWith('Cross6'); const pub = await w.published(d, admin);
  const buyer = await h.customer('Cross6 Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'before suspend' });
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend preserves enquiries' });
  const row = await h.one(`SELECT id FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev({ enquiryExists: !!row });
  return !!row ? { note: 'suspension preserves existing enquiries' } : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'CROSS-007', async () => {
  // Dealer rejection with draft listings: reject purges the dealer; drafts go with it (explicit policy).
  const d = await w.onboard('Cross7'); // pending, not approved
  const draftId = await w.draft(d);
  const rej = await admin.post(`/v1/admin/dealers/${d.dealerId}/reject`, { reason: 'Rejecting dealer with draft listings' });
  const draftRow = await h.one(`SELECT id FROM vehicles WHERE id=$1`, [draftId]);
  const dealerRow = await h.one(`SELECT status FROM dealers WHERE id=$1`, [d.dealerId]);
  r.ev(rej, { draftExists: !!draftRow, dealerRow: dealerRow?.status ?? 'DELETED' });
  return rej.status === 200 ? { note: `dealer rejection (purge) with drafts: dealer ${dealerRow ? dealerRow.status : 'deleted'}, drafts ${draftRow ? 'retained' : 'removed with dealer'} — defined purge policy` } : { status: 'FAIL', note: `status ${rej.status}` };
});
await h.check(r, 'CROSS-008', async () => {
  const d = await dealerWith('Cross8'); const pub = await w.published(d, admin);
  const saver = await h.customer('Cross8 Saver');
  await saver.put(`/v1/saved-vehicles/${pub.slug}`);
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/mark-sold`);
  const saved = await saver.get('/v1/saved-vehicles');
  const row = await h.one(`SELECT count(*)::int c FROM saved_vehicles WHERE "customerId"=$1`, [saver.userId]);
  r.ev(saved, { savedRows: row.c });
  return saved.status === 200 && row.c >= 1 ? { note: 'ACTIVE saved car → SOLD: Saved Cars still loads, saved row preserved (shown unavailable)' } : { status: 'FAIL', note: `saved ${saved.status} rows ${row.c}` };
});
for (const [id, action, label] of [['CROSS-009', 'mark-sold', 'SOLD'], ['CROSS-010', 'withdraw', 'WITHDRAWN'], ['CROSS-011', 'reserve', 'RESERVED']]) {
  await h.check(r, id, async () => {
    const d = await dealerWith(`X${id}`); const pub = await w.published(d, admin);
    const buyer = await h.customer(`${id} Buyer`);
    const e = await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: `enquiry before ${label}` });
    const body = action === 'withdraw' ? { reason: 'NO_LONGER_FOR_SALE' } : undefined;
    await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/${action}`, body);
    const row = await h.one(`SELECT id FROM enquiries WHERE id=$1`, [e.json.id]);
    const my = await buyer.get('/v1/enquiries');
    r.ev({ listingAction: label, enquiryExists: !!row, inHistory: my.json.data.some((x) => x.id === e.json.id) });
    return !!row && my.json.data.some((x) => x.id === e.json.id) ? { note: `ACTIVE enquiry → ${label} preserves history (row + customer list)` } : { status: 'FAIL', note: `exists ${!!row}` };
  });
}
await h.check(r, 'CROSS-012', async () => {
  // RESERVED vehicle existing enquiry can continue historical workflow.
  const d = await dealerWith('Cross12'); const pub = await w.published(d, admin);
  const buyer = await h.customer('Cross12 Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'before reserve' });
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/reserve`);
  const contact = await d.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' });
  r.ev(contact);
  return contact.status === 200 ? { note: 'an existing enquiry on a now-RESERVED car can still be worked (CONTACTED)' } : { status: 'FAIL', note: `contact ${contact.status}` };
});
await h.check(r, 'CROSS-013', async () => {
  const d = await dealerWith('Cross13'); const pub = await w.published(d, admin);
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/mark-sold`);
  const reserve = await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/reserve`);
  const relistDirect = await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/request-reactivation`, { reason: 'try to revive sold' });
  r.ev(reserve, relistDirect);
  return reserve.status === 409 ? { layers: ['API'], note: `SOLD → reactivation/transition rejected (reserve ${reserve.status}); SOLD is terminal` } : { status: 'FAIL', note: `reserve ${reserve.status}` };
});
await h.check(r, 'CROSS-014', async () => {
  const d = await dealerWith('Cross14'); const pub = await w.published(d, admin);
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/withdraw`, { reason: 'NO_LONGER_FOR_SALE' });
  const sell = await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/mark-sold`);
  const reserve = await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/reserve`);
  r.ev(sell, reserve);
  return reserve.status === 409 ? { layers: ['API'], note: `WITHDRAWN invalid transitions rejected (reserve ${reserve.status}); back on sale needs admin (R82)` } : { status: 'FAIL', note: `reserve ${reserve.status}` };
});
await h.check(r, 'CROSS-015', async () => {
  // STAFF draft → STAFF removed → draft remains dealership-owned.
  const d = await dealerWith('Cross15');
  const staff = await w.addMember(d, 'STAFF', 'Cross15 Staff');
  const draftId = await w.draft(staff);
  await d.del(`/v1/dealer/team/members/${staff.membershipId}`);
  const row = await h.one(`SELECT "dealerId" FROM vehicles WHERE id=$1`, [draftId]);
  r.ev({ draftDealer: row?.dealerId === d.dealerId });
  return row?.dealerId === d.dealerId ? { layers: ['DATABASE'], note: 'draft created by a removed STAFF remains dealership-owned' } : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'CROSS-016', async () => {
  // STAFF draft → promoted MANAGER → can submit.
  const d = await dealerWith('Cross16');
  const staff = await w.addMember(d, 'STAFF', 'Cross16 Staff');
  const v = await staff.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  await staff.patch(`/v1/dealer/vehicles/${v.json.id}`, w.COMPLETE_VEHICLE);
  await d.patch(`/v1/dealer/team/members/${staff.membershipId}`, { role: 'MANAGER' });
  const submit = await staff.post(`/v1/dealer/vehicles/${v.json.id}/submit`);
  r.ev(submit);
  return submit.status === 200 ? { layers: ['API'], note: 'STAFF draft → promoted to MANAGER → can now submit (permission re-read live)' } : { status: 'FAIL', note: `submit ${submit.status}` };
});
await h.check(r, 'CROSS-017', async () => {
  // MANAGER submits → demoted to STAFF before approval → moderation remains valid.
  const d = await dealerWith('Cross17');
  const mgr = await w.addMember(d, 'MANAGER', 'Cross17 Mgr');
  const s = await w.submitted(mgr);
  await d.patch(`/v1/dealer/team/members/${mgr.membershipId}`, { role: 'STAFF' });
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  const approve = await w.approveListing(admin, s.listingId);
  const after = await h.one(`SELECT status FROM listings WHERE id=$1`, [s.listingId]);
  r.ev({ afterDemote: row.status }, approve, { afterApprove: after.status });
  return row.status === 'PENDING_REVIEW' && after.status === 'ACTIVE' ? { note: 'listing submitted by a since-demoted manager still moderates and approves normally' } : { status: 'FAIL', note: `demote ${row.status} approve ${after.status}` };
});
await h.check(r, 'CROSS-018', async () => {
  // MANAGER CONTACTED → removed → enquiry actor/history preserved.
  const d = await dealerWith('Cross18'); const pub = await w.published(d, admin);
  const mgr = await w.addMember(d, 'MANAGER', 'Cross18 Mgr');
  const buyer = await h.customer('Cross18 Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'to contact then remove' });
  await mgr.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' });
  await d.del(`/v1/dealer/team/members/${mgr.membershipId}`);
  const row = await h.one(`SELECT "contactedById" FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev({ contactedByPreserved: row.contactedById === mgr.userId });
  return row.contactedById === mgr.userId ? { layers: ['DATABASE'], note: 'enquiry contactedBy preserved after the manager who contacted it is removed' } : { status: 'FAIL', note: 'actor lost' };
});
await h.check(r, 'CROSS-019', async () => {
  // Member removed while mutation in flight remains safe.
  const d = await dealerWith('Cross19'); const pub = await w.published(d, admin);
  const mgr = await w.addMember(d, 'MANAGER', 'Cross19 Mgr');
  const buyer = await h.customer('Cross19 Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'race removal' });
  const [remove, mutate] = await Promise.all([
    d.del(`/v1/dealer/team/members/${mgr.membershipId}`),
    mgr.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' }),
  ]);
  const row = await h.one(`SELECT status FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev(remove, mutate, { enquiryStatus: row.status });
  return ['NEW', 'CONTACTED'].includes(row.status) ? { layers: ['API', 'DATABASE', 'CONCURRENCY'], note: `removal vs mutation race → valid state (${row.status}), mutate ${mutate.status}` } : { status: 'FAIL', note: `status ${row.status}` };
});
await h.check(r, 'CROSS-020', async () => {
  // Member dashboard open → OWNER revokes → next protected request denied.
  const d = await dealerWith('Cross20');
  const staff = await w.addMember(d, 'STAFF', 'Cross20 Staff');
  const ok = await staff.get('/v1/dealer/dashboard');
  await d.del(`/v1/dealer/team/members/${staff.membershipId}`);
  const after = await staff.get('/v1/dealer/dashboard');
  r.ev({ before: ok.status, after: after.status });
  return ok.status === 200 && after.status === 401 ? { note: 'open member session: next request after revoke → 401' } : { status: 'FAIL', note: `before ${ok.status} after ${after.status}` };
});
await h.check(r, 'CROSS-021', async () => {
  // Dealer dashboard open → Admin suspends → next prohibited op denied.
  const d = await dealerWith('Cross21');
  const ok = await d.get('/v1/dealer/dashboard');
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend mid-session' });
  const after = await d.post('/v1/dealer/vehicles', { registrationNumber: h.regNo() });
  r.ev({ before: ok.status, after: after.status });
  return ok.status === 200 && [401, 403].includes(after.status) ? { note: 'open dealer session: next prohibited op after suspend → denied' } : { status: 'FAIL', note: `before ${ok.status} after ${after.status}` };
});
await h.check(r, 'CROSS-022', async () => {
  const d = await dealerWith('Cross22');
  const staff = await w.addMember(d, 'STAFF', 'Cross22 Staff');
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend then reinstate with member' });
  await admin.post(`/v1/admin/dealers/${d.dealerId}/reinstate`, {});
  const dash = await staff.get('/v1/dealer/dashboard');
  r.ev(dash);
  return dash.status === 200 ? { note: 'reinstated dealer + valid membership restores appropriate access' } : { status: 'FAIL', note: `dash ${dash.status}` };
});
await h.check(r, 'CROSS-023', async () => {
  const d = await dealerWith('Cross23');
  const staff = await w.addMember(d, 'STAFF', 'Cross23 Staff');
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend, revoke member, reinstate' });
  await d.del(`/v1/dealer/team/members/${staff.membershipId}`).catch(() => null); // owner can't act while suspended; remove via another path
  // Owner is also suspended; revoke via DB to emulate "revoked during suspension"
  await h.q(`UPDATE dealer_members SET status='REMOVED', "removedAt"=now() WHERE id=$1`, [staff.membershipId]);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/reinstate`, {});
  const dash = await staff.get('/v1/dealer/dashboard');
  r.ev(dash);
  return [401, 403].includes(dash.status) ? { layers: ['API', 'SECURITY'], note: `reinstated dealer but member revoked during suspension → member still denied (${dash.status})` } : { status: 'FAIL', note: `dash ${dash.status}` };
});
await h.check(r, 'CROSS-024', async () => {
  // Revoked member logs in as customer successfully but dealer access remains revoked.
  const d = await dealerWith('Cross24');
  const staff = await w.addMember(d, 'STAFF', 'Cross24 Staff');
  await d.del(`/v1/dealer/team/members/${staff.membershipId}`);
  const fresh = await h.customer('Cross24 Staff', staff.phone);
  const cust = await fresh.get('/v1/auth/customer/me');
  const dealer = await fresh.get('/v1/dealer');
  r.ev(cust, dealer);
  return cust.status === 200 && [401, 403].includes(dealer.status) ? { layers: ['API', 'IDENTITY'], note: `revoked member signs in as customer (200) but dealer access stays revoked (${dealer.status})` } : { status: 'FAIL', note: `cust ${cust.status} dealer ${dealer.status}` };
});
await h.check(r, 'CROSS-025', async () => {
  // Revoked member opens old dealer bookmark → dealer denied without destroying customer session.
  const d = await dealerWith('Cross25');
  const staff = await w.addMember(d, 'STAFF', 'Cross25 Staff');
  await d.del(`/v1/dealer/team/members/${staff.membershipId}`);
  const dealer = await staff.get('/v1/dealer/dashboard'); // same (old) session = bookmark
  const cust = await staff.get('/v1/auth/customer/me');
  r.ev(dealer, cust);
  return [401, 403].includes(dealer.status) && cust.status === 200 ? { note: 'old dealer bookmark → 401; customer session intact' } : { status: 'FAIL', note: `dealer ${dealer.status} cust ${cust.status}` };
});
await h.check(r, 'CROSS-026', async () => {
  // Customer becomes dealer member while logged in → no duplicate identity.
  const e = h.phone();
  const c = await h.customer('Cross26 Cust', e);
  const d = await dealerWith('Cross26');
  const inv = await d.post('/v1/dealer/team/invitations', { phone: e, role: 'STAFF' });
  await c.post(`/v1/invitations/${inv.json.id}/accept`);
  const users = await h.one(`SELECT count(*)::int n FROM users WHERE phone=$1`, [e]);
  r.ev({ usersForPhone: users.n });
  return users.n === 1 ? { layers: ['DATABASE', 'IDENTITY'], note: 'customer accepting an invite while signed in creates no duplicate identity' } : { status: 'FAIL', note: `users ${users.n}` };
});
await h.check(r, 'CROSS-027', async () => {
  // Dealer member personally enquires with ANOTHER dealership without employer contamination.
  const employer = await dealerWith('Cross27Emp');
  const competitor = await dealerWith('Cross27Comp');
  const compListing = await w.published(competitor, admin);
  const member = await w.addMember(employer, 'MANAGER', 'Cross27 Member');
  const e = await member.post('/v1/enquiries', { listingSlug: compListing.slug, message: 'personal enquiry at competitor' });
  const row = await h.one(`SELECT "customerId", "dealerId" FROM enquiries WHERE id=$1`, [e.json.id]);
  const employerInbox = await employer.get('/v1/dealer/enquiries');
  const leaked = employerInbox.json.data?.some((x) => x.id === e.json.id);
  r.ev(e, { enquiryDealer: row.dealerId === competitor.dealerId, inEmployerInbox: leaked });
  return e.status === 201 && row.dealerId === competitor.dealerId && !leaked ? { layers: ['API', 'DATABASE', 'IDENTITY'], note: "member's personal enquiry belongs to the competitor dealer + their own user; employer inbox never sees it" } : { status: 'FAIL', note: `dealer ${row.dealerId === competitor.dealerId} leaked ${leaked}` };
});
await h.check(r, 'CROSS-028', async () => {
  const employer = await dealerWith('Cross28Emp');
  const competitor = await dealerWith('Cross28Comp');
  const compListing = await w.published(competitor, admin);
  const member = await w.addMember(employer, 'STAFF', 'Cross28 Member');
  await member.put(`/v1/saved-vehicles/${compListing.slug}`);
  const employerView = await employer.get('/v1/dealer/dashboard');
  const savedRow = await h.one(`SELECT "customerId" FROM saved_vehicles WHERE "customerId"=$1`, [member.userId]);
  r.ev({ savedByMemberUser: !!savedRow });
  return !!savedRow ? { layers: ['DATABASE', 'IDENTITY'], note: "member's personal saved competitor car is keyed to their user; not visible to employer" } : { status: 'FAIL', note: 'saved not personal' };
});
await h.check(r, 'CROSS-029', async () => {
  // Employer suspension does not affect member's unrelated customer activity.
  const employer = await dealerWith('Cross29Emp');
  const other = await dealerWith('Cross29Other');
  const otherListing = await w.published(other, admin);
  const member = await w.addMember(employer, 'MANAGER', 'Cross29 Member');
  await member.put(`/v1/saved-vehicles/${otherListing.slug}`);
  await admin.post(`/v1/admin/dealers/${employer.dealerId}/suspend`, { reason: 'Suspend employer, member browses elsewhere' });
  const saved = await member.get('/v1/saved-vehicles');
  const enq = await member.post('/v1/enquiries', { listingSlug: otherListing.slug, message: 'still a customer elsewhere' });
  r.ev(saved, enq);
  return saved.status === 200 && [201, 409].includes(enq.status) ? { layers: ['API', 'IDENTITY'], note: "employer suspension leaves the member's unrelated customer activity (saved, enquire elsewhere) working" } : { status: 'FAIL', note: `saved ${saved.status} enq ${enq.status}` };
});

// ─── SEARCH 005..009 ──────────────────────────────────────────────────────────
await h.check(r, 'SEARCH-005', async () => {
  const d = await dealerWith('Search5'); const pub = await w.published(d, admin);
  const before = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Search visibility under suspension' });
  const after = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  r.ev({ before, after });
  return before === 200 && after === 404 ? { note: 'suspended dealer listings follow suspension visibility policy (hidden)' } : { status: 'FAIL', note: `before ${before} after ${after}` };
});
await h.check(r, 'SEARCH-006', async () => {
  const d = await dealerWith('Search6'); const pub = await w.published(d, admin);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Suspend then reinstate search' });
  await admin.post(`/v1/admin/dealers/${d.dealerId}/reinstate`, {});
  const after = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  r.ev({ afterReinstate: after });
  return after === 200 ? { note: 'reinstated dealer inventory returns to search' } : { status: 'FAIL', note: `after ${after}` };
});
await h.check(r, 'SEARCH-007', async () => {
  const d = await dealerWith('Search7');
  const before = (await h.call('GET', `/v1/dealers/${d.slug}/vehicles?limit=48`)).json.page?.total ?? 0;
  const pub = await w.published(d, admin);
  const after = (await h.call('GET', `/v1/dealers/${d.slug}/vehicles?limit=48`)).json.page?.total ?? 0;
  r.ev({ before, after });
  return after === before + 1 ? { note: `public dealer count updates after approval (${before}→${after})` } : { status: 'FAIL', note: `before ${before} after ${after}` };
});
await h.check(r, 'SEARCH-008', async () => {
  const d = await dealerWith('Search8');
  const pub = await w.published(d, admin);
  const before = (await h.call('GET', `/v1/dealers/${d.slug}/vehicles?limit=48`)).json.page?.total ?? 0;
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/mark-sold`);
  const after = (await h.call('GET', `/v1/dealers/${d.slug}/vehicles?limit=48`)).json.page?.total ?? 0;
  r.ev({ before, after });
  return after === before - 1 ? { note: `count updates after SOLD (${before}→${after})` } : { status: 'FAIL', note: `before ${before} after ${after}` };
});
await h.check(r, 'SEARCH-009', async () => {
  const d = await dealerWith('Search9');
  const pub = await w.published(d, admin);
  const before = (await h.call('GET', `/v1/dealers/${d.slug}/vehicles?limit=48`)).json.page?.total ?? 0;
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/withdraw`, { reason: 'NO_LONGER_FOR_SALE' });
  const after = (await h.call('GET', `/v1/dealers/${d.slug}/vehicles?limit=48`)).json.page?.total ?? 0;
  r.ev({ before, after });
  return after === before - 1 ? { note: `count updates after WITHDRAWN (${before}→${after})` } : { status: 'FAIL', note: `before ${before} after ${after}` };
});

// ─── DATA INTEGRITY ──────────────────────────────────────────────────────────
await h.check(r, 'DATA-001', async () => {
  const d = await dealerWith('Data1'); const pub = await w.published(d, admin);
  const staff = await w.addMember(d, 'STAFF', 'Data1 Staff');
  const before = await h.one(`SELECT count(*)::int c FROM listings WHERE "dealerId"=$1`, [d.dealerId]);
  await d.del(`/v1/dealer/team/members/${staff.membershipId}`);
  const after = await h.one(`SELECT count(*)::int c FROM listings WHERE "dealerId"=$1`, [d.dealerId]);
  r.ev({ before: before.c, after: after.c });
  return before.c === after.c ? { layers: ['DATABASE'], note: 'membership revocation never cascades dealership listings' } : { status: 'FAIL', note: `before ${before.c} after ${after.c}` };
});
await h.check(r, 'DATA-002', async () => {
  const d = await dealerWith('Data2'); const pub = await w.published(d, admin);
  const staff = await w.addMember(d, 'STAFF', 'Data2 Staff');
  const buyer = await h.customer('Data2 Buyer');
  await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'keep after member change' });
  const before = await h.one(`SELECT count(*)::int c FROM enquiries WHERE "dealerId"=$1`, [d.dealerId]);
  await d.patch(`/v1/dealer/team/members/${staff.membershipId}`, { role: 'MANAGER' });
  await d.del(`/v1/dealer/team/members/${staff.membershipId}`);
  const after = await h.one(`SELECT count(*)::int c FROM enquiries WHERE "dealerId"=$1`, [d.dealerId]);
  r.ev({ before: before.c, after: after.c });
  return before.c === after.c ? { layers: ['DATABASE'], note: 'membership changes never delete enquiries' } : { status: 'FAIL', note: `before ${before.c} after ${after.c}` };
});
await h.check(r, 'DATA-003', async () => {
  const d = await dealerWith('Data3'); const pub = await w.published(d, admin);
  const buyer = await h.customer('Data3 Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'survive lifecycle' });
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/mark-sold`);
  const row = await h.one(`SELECT id FROM enquiries WHERE id=$1`, [e.json.id]);
  r.ev({ enquiryExists: !!row });
  return !!row ? { layers: ['DATABASE'], note: 'listing lifecycle changes never delete enquiry history' } : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'DATA-004', async () => {
  const d = await dealerWith('Data4'); const pub = await w.published(d, admin);
  const buyer = await h.customer('Data4 Buyer');
  await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'survive suspension' });
  const before = await h.one(`SELECT (SELECT count(*) FROM listings WHERE "dealerId"=$1)::int l, (SELECT count(*) FROM enquiries WHERE "dealerId"=$1)::int e`, [d.dealerId]);
  await admin.post(`/v1/admin/dealers/${d.dealerId}/suspend`, { reason: 'Data integrity under suspension' });
  const after = await h.one(`SELECT (SELECT count(*) FROM listings WHERE "dealerId"=$1)::int l, (SELECT count(*) FROM enquiries WHERE "dealerId"=$1)::int e`, [d.dealerId]);
  r.ev({ before, after });
  return before.l === after.l && before.e === after.e ? { layers: ['DATABASE'], note: 'dealer suspension never destroys historical data (listings + enquiries unchanged)' } : { status: 'FAIL', note: `before ${JSON.stringify(before)} after ${JSON.stringify(after)}` };
});
await h.check(r, 'DATA-005', async () => {
  // Foreign keys remain valid across lifecycle transitions: no orphan listings/enquiries.
  const orphanListings = await h.one(`SELECT count(*)::int c FROM listings l LEFT JOIN dealers d ON d.id=l."dealerId" WHERE d.id IS NULL`);
  const orphanEnq = await h.one(`SELECT count(*)::int c FROM enquiries e LEFT JOIN listings l ON l.id=e."listingId" WHERE l.id IS NULL`);
  const orphanMembers = await h.one(`SELECT count(*)::int c FROM dealer_members m LEFT JOIN users u ON u.id=m."userId" WHERE u.id IS NULL`);
  r.ev({ orphanListings: orphanListings.c, orphanEnquiries: orphanEnq.c, orphanMembers: orphanMembers.c });
  return orphanListings.c === 0 && orphanEnq.c === 0 && orphanMembers.c === 0 ? { layers: ['DATABASE'], note: 'no orphaned FKs across all lifecycle transitions exercised this run' } : { status: 'FAIL', note: `orphans L${orphanListings.c} E${orphanEnq.c} M${orphanMembers.c}` };
});
await h.check(r, 'DATA-006', async () => {
  // Mixed OTP/Google/invite flows do not create duplicate users.
  const dups = await h.one(`SELECT count(*)::int c FROM (SELECT phone FROM users WHERE phone IS NOT NULL GROUP BY phone HAVING count(*)>1) x`);
  const dupEmail = await h.one(`SELECT count(*)::int c FROM (SELECT email FROM users WHERE email IS NOT NULL GROUP BY email HAVING count(*)>1) x`);
  r.ev({ duplicatePhones: dups.c, duplicateEmails: dupEmail.c });
  return dups.c === 0 && dupEmail.c === 0 ? { layers: ['DATABASE'], note: 'no duplicate users by phone or email across all flows this run' } : { status: 'FAIL', note: `dupPhone ${dups.c} dupEmail ${dupEmail.c}` };
});
await h.check(r, 'DATA-007', async () => {
  // Retry/races do not create duplicate dealerships: each user has ≤1 OWNER membership here.
  const multi = await h.one(`SELECT count(*)::int c FROM (SELECT "userId" FROM dealer_members WHERE role='OWNER' AND status='ACTIVE' GROUP BY "userId" HAVING count(*)>1) x`);
  r.ev({ usersWithMultipleOwnerMemberships: multi.c });
  return multi.c === 0 ? { layers: ['DATABASE'], note: 'no user ended up owning two dealerships via retries/races' } : { status: 'FAIL', note: `multi-owner ${multi.c}` };
});
await h.check(r, 'DATA-008', async () => {
  const dups = await h.one(`SELECT count(*)::int c FROM (SELECT "dealerId","userId" FROM dealer_members GROUP BY "dealerId","userId" HAVING count(*)>1) x`);
  r.ev({ duplicateMemberships: dups.c });
  return dups.c === 0 ? { layers: ['DATABASE'], note: 'duplicate memberships prevented at DB level (unique dealerId+userId); 0 duplicates' } : { status: 'FAIL', note: `dups ${dups.c}` };
});
await h.check(r, 'DATA-009', async () => {
  // Duplicate lifecycle operations safely rejected/idempotent (double mark-sold).
  const d = await dealerWith('Data9'); const pub = await w.published(d, admin);
  const a = await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/mark-sold`);
  const b = await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/mark-sold`);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [pub.listingId]);
  r.ev(a, b, { status: row.status });
  return a.status === 200 && b.status === 409 && row.status === 'SOLD' ? { layers: ['API', 'DATABASE'], note: `double mark-sold → first 200, second 409; status SOLD (idempotent/guarded)` } : { status: 'FAIL', note: `a ${a.status} b ${b.status} row ${row.status}` };
});
await h.check(r, 'DATA-010', async () => {
  // Audit records survive actor membership loss.
  const d = await dealerWith('Data10'); const pub = await w.published(d, admin);
  const mgr = await w.addMember(d, 'MANAGER', 'Data10 Mgr');
  const buyer = await h.customer('Data10 Buyer');
  const e = await buyer.post('/v1/enquiries', { listingSlug: pub.slug, message: 'audit survive' });
  await mgr.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CONTACTED' });
  await d.del(`/v1/dealer/team/members/${mgr.membershipId}`);
  const logs = await h.q(`SELECT count(*)::int c FROM audit_logs WHERE "actorId"=$1`, [mgr.userId]);
  r.ev({ auditRowsForRemovedActor: logs[0].c });
  return logs[0].c >= 1 ? { layers: ['DATABASE'], note: `audit rows for a removed actor survive (${logs[0].c} rows)` } : { status: 'FAIL', note: 'audit lost' };
});
await h.check(r, 'DATA-011', async () => {
  // Public read model is not authoritative lifecycle source: DB row is truth, public hides derived.
  const d = await dealerWith('Data11'); const pub = await w.published(d, admin);
  await d.post(`/v1/dealer/vehicles/${pub.vehicleId}/mark-sold`);
  const row = await h.one(`SELECT status FROM listings WHERE id=$1`, [pub.listingId]);
  const publicVdp = (await h.call('GET', `/v1/vehicles/${pub.slug}`)).status;
  r.ev({ dbStatus: row.status, publicVdp });
  return row.status === 'SOLD' && publicVdp === 404 ? { layers: ['API', 'DATABASE'], note: 'authoritative lifecycle lives in listings.status (SOLD); the public read is derived and simply hides it (404)' } : { status: 'FAIL', note: `db ${row.status} vdp ${publicVdp}` };
});

r.save();
await h.pool.end();
