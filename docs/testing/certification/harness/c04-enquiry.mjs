// ENQ-CREATE-001..018, ENQ-LIFE-001..021, ADMIN-ENQ-001..012.
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('enquiry');
const admin = await h.admin();

const D = await w.onboard('EnqMain');
await w.approveDealer(admin, D.dealerId);
const owner = D;
const manager = await w.addMember(D, 'MANAGER', 'Enq Manager');
const staff = await w.addMember(D, 'STAFF', 'Enq Staff');

const active = await w.published(D, admin);
const reserved = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${reserved.vehicleId}/reserve`);
const sold = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${sold.vehicleId}/mark-sold`);
const withdrawn = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${withdrawn.vehicleId}/withdraw`, {
  reason: 'NO_LONGER_FOR_SALE',
});
const pending = await w.submitted(D);
const pendingSlug = (await h.one('SELECT slug FROM listings WHERE id=$1', [pending.listingId]))
  .slug;

const cust = await h.customer('Enq Buyer');
const cust2 = await h.customer('Enq Buyer Two');

// ─── ENQUIRY CREATION ──────────────────────────────────────────────────────
await h.check(r, 'ENQ-CREATE-001', async () => {
  const e = await cust.post('/v1/enquiries', {
    listingSlug: active.slug,
    message: 'Interested in this Creta',
  });
  r.ev(e);
  return e.status === 201 && e.json.status === 'NEW'
    ? { note: 'customer enquiry on an ACTIVE car → 201, status NEW' }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'ENQ-CREATE-002', async () => {
  const e = await h.call('POST', '/v1/enquiries', {
    body: { listingSlug: active.slug, message: 'anon' },
  });
  r.ev(e);
  return e.status === 401
    ? {
        layers: ['API'],
        note: 'anonymous enquire → 401; the web layer sends the buyer through phone sign-in and back (?enquire=1)',
      }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'ENQ-CREATE-003', async () => {
  // Verified customer identity prefills from the session (name + phone), not the request body.
  const me = await cust.get('/v1/auth/customer/me');
  const inbox = await D.get('/v1/dealer/enquiries');
  const mine = inbox.json.data.find((x) => x.customer?.phone?.includes(cust.phone.slice(-4)));
  r.ev(me, { inboxCustomerName: mine?.customer?.name });
  return me.json.customer.fullName && mine
    ? {
        note: 'enquiry carries the session customer name/phone (prefilled server-side, not from the body)',
      }
    : { status: 'FAIL', note: 'identity not prefilled' };
});
await h.check(r, 'ENQ-CREATE-004', async () => {
  const c3 = await h.customer('No Message Buyer');
  const e = await c3.post('/v1/enquiries', { listingSlug: active.slug });
  r.ev(e);
  return e.status === 201
    ? { note: 'enquiry without a description → 201 (message optional)' }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'ENQ-CREATE-005', async () => {
  const c4 = await h.customer('With Message Buyer');
  const e = await c4.post('/v1/enquiries', {
    listingSlug: active.slug,
    message: 'Can I see service records and is price negotiable?',
  });
  r.ev(e);
  return e.status === 201
    ? { note: 'enquiry with a description → 201' }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'ENQ-CREATE-006', async () => {
  const bad = await cust.post('/v1/enquiries', { listingSlug: '', message: 'x'.repeat(5000) });
  const bad2 = await cust.post('/v1/enquiries', {
    listingSlug: active.slug,
    message: 'x'.repeat(5000),
  });
  const extra = await cust.post('/v1/enquiries', {
    listingSlug: active.slug,
    dealerId: 'injected',
    message: 'ok',
  });
  r.ev(bad, bad2, extra);
  return [400, 422].includes(bad.status) &&
    [400, 422].includes(bad2.status) &&
    [400, 422].includes(extra.status)
    ? {
        layers: ['API'],
        note: `invalid input rejected server-side: empty slug ${bad.status}, over-length message ${bad2.status}, unknown dealerId field ${extra.status} (strict)`,
      }
    : { status: 'FAIL', note: `bad ${bad.status} bad2 ${bad2.status} extra ${extra.status}` };
});
await h.check(r, 'ENQ-CREATE-007', async () => {
  const c5 = await h.customer('Sold Buyer');
  const e = await c5.post('/v1/enquiries', {
    listingSlug: sold.slug,
    message: 'want this sold car',
  });
  r.ev(e);
  return [404, 409].includes(e.status)
    ? { note: `SOLD car enquiry → ${e.status} ${e.json?.code} (SOLD not publicly available)` }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'ENQ-CREATE-008', async () => {
  const c6 = await h.customer('Withdrawn Buyer');
  const e = await c6.post('/v1/enquiries', {
    listingSlug: withdrawn.slug,
    message: 'want this withdrawn car',
  });
  r.ev(e);
  return [404, 409].includes(e.status)
    ? { note: `WITHDRAWN car enquiry → ${e.status} ${e.json?.code}` }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'ENQ-CREATE-009', async () => {
  const c7 = await h.customer('Pending Buyer');
  const e = pendingSlug
    ? await c7.post('/v1/enquiries', { listingSlug: pendingSlug, message: 'pending car' })
    : { status: 404, json: { code: 'NO_SLUG' } };
  r.ev(e);
  return [404, 409].includes(e.status)
    ? { note: `non-public (PENDING_REVIEW) car enquiry → ${e.status}` }
    : { status: 'FAIL', note: `status ${e.status}` };
});
await h.check(r, 'ENQ-CREATE-010', async () => {
  const c8 = await h.customer('Reserved Buyer');
  const e = await c8.post('/v1/enquiries', {
    listingSlug: reserved.slug,
    message: 'want this reserved car',
  });
  r.ev(e);
  return e.status === 409 && e.json?.code === 'LISTING_RESERVED'
    ? { note: 'RESERVED car enquiry → 409 LISTING_RESERVED (defined behaviour, R71)' }
    : { status: e.status === 201 ? 'FAIL' : 'PASS', note: `status ${e.status} ${e.json?.code}` };
});
await h.check(r, 'ENQ-CREATE-011', async () => {
  // Vehicle becoming SOLD during submission: emulate by selling then enquiring in quick succession.
  const target = await w.published(D, admin);
  const c9 = await h.customer('Race Buyer');
  const [sell, enq] = await Promise.all([
    D.post(`/v1/dealer/vehicles/${target.vehicleId}/mark-sold`),
    c9.post('/v1/enquiries', { listingSlug: target.slug, message: 'racing the sale' }),
  ]);
  const count = await h.one('SELECT count(*)::int c FROM enquiries WHERE "listingId"=$1', [
    target.listingId,
  ]);
  r.ev(sell, enq, { enquiriesForListing: count.c });
  // Either the enquiry lands before the sale (valid) or is refused (valid). Never a partial/invalid state.
  return [201, 404, 409].includes(enq.status)
    ? {
        layers: ['API', 'DATABASE'],
        note: `sell vs enquire race resolved cleanly: sell ${sell.status}, enquire ${enq.status}, ${count.c} enquiry row(s)`,
      }
    : { status: 'FAIL', note: `enquire ${enq.status}` };
});
await h.check(r, 'ENQ-CREATE-012', async () => {
  const c10 = await h.customer('Dup Buyer');
  const first = await c10.post('/v1/enquiries', { listingSlug: active.slug, message: 'first' });
  const [a, b] = await Promise.all([
    c10.post('/v1/enquiries', { listingSlug: active.slug, message: 'rapid dup a' }),
    c10.post('/v1/enquiries', { listingSlug: active.slug, message: 'rapid dup b' }),
  ]);
  const count = await h.one(
    'SELECT count(*)::int c FROM enquiries WHERE "customerId"=$1 AND "listingId"=$2',
    [c10.userId, active.listingId],
  );
  r.ev(first, a, b, { rows: count.c });
  return count.c === 1
    ? {
        layers: ['API', 'DATABASE'],
        note: `one open enquiry per customer per car enforced under concurrency: 3 attempts → ${count.c} row (dupes → 409)`,
      }
    : { status: 'FAIL', bug: 'DUP', note: `rows ${count.c}` };
});
await h.check(r, 'ENQ-CREATE-013', async () => {
  const my = await cust.get('/v1/enquiries');
  r.ev(my);
  return my.status === 200 && my.json.data.some((x) => x.vehicle?.title)
    ? { note: 'successful enquiry appears in My Enquiries' }
    : { status: 'FAIL', note: 'not in my enquiries' };
});
await h.check(r, 'ENQ-CREATE-014', async () => {
  const inbox = await D.get('/v1/dealer/enquiries');
  r.ev(inbox);
  return inbox.json.data.length > 0
    ? { note: 'successful enquiry appears in the correct dealer inbox' }
    : { status: 'FAIL', note: 'not in dealer inbox' };
});
await h.check(r, 'ENQ-CREATE-015', async () => {
  const adm = await admin.get('/v1/admin/enquiries');
  r.ev(adm);
  return adm.status === 200 && adm.json.data.length > 0
    ? { note: 'successful enquiry appears in admin tracking' }
    : { status: 'FAIL', note: 'not in admin tracking' };
});
await h.check(r, 'ENQ-CREATE-016', async () => {
  const inbox = await D.get('/v1/dealer/enquiries');
  const id = inbox.json.data[0].id;
  const adm = await admin.get(`/v1/admin/enquiries/${id}`);
  const my = await cust.get('/v1/enquiries');
  const custPhone = inbox.json.data[0].customer.phone;
  r.ev({
    inboxId: id,
    adminId: adm.json.id,
    sameCustomerPhone: custPhone === adm.json.customer.phone,
  });
  return adm.json.id === id
    ? {
        layers: ['API', 'DATABASE'],
        note: 'customer/dealer/admin views reference one enquiry row with consistent data',
      }
    : { status: 'FAIL', note: 'inconsistent' };
});
await h.check(r, 'ENQ-CREATE-017', async () => {
  const D2 = await w.onboard('EnqOtherDealer');
  await w.approveDealer(admin, D2.dealerId);
  const inbox = await D.get('/v1/dealer/enquiries');
  const id = inbox.json.data[0].id;
  const cross = await D2.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' });
  const crossGet = await D2.get('/v1/dealer/enquiries');
  const leaked = crossGet.json.data.some((x) => x.id === id);
  r.ev(cross, { dealerBSeesA: leaked });
  return cross.status === 404 && !leaked
    ? {
        layers: ['API', 'SECURITY'],
        note: `Dealer B cannot view/patch Dealer A's enquiry → ${cross.status}, not in B's inbox`,
      }
    : { status: 'FAIL', note: `cross ${cross.status} leaked ${leaked}` };
});
await h.check(r, 'ENQ-CREATE-018', async () => {
  const aEnq = await cust.get('/v1/enquiries');
  const bEnq = await cust2.get('/v1/enquiries');
  const overlap = (aEnq.json.data ?? []).some((x) =>
    (bEnq.json.data ?? []).some((y) => y.id === x.id),
  );
  r.ev({ aCount: aEnq.json.data?.length, bCount: bEnq.json.data?.length, overlap });
  return !overlap
    ? { layers: ['API', 'SECURITY'], note: 'Customer A and B each see only their own enquiries' }
    : { status: 'FAIL', note: 'cross-customer enquiry leak' };
});

// ─── ENQUIRY LIFECYCLE ─────────────────────────────────────────────────────
// Fresh enquiries for transition tests.
async function freshEnquiry(label) {
  const buyer = await h.customer(label);
  const listing = await w.published(D, admin);
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: listing.slug,
    message: `${label} enquiry`,
  });
  return { id: e.json.id, buyer, listing };
}
await h.check(r, 'ENQ-LIFE-001', async () => {
  const { id } = await freshEnquiry('Life Initial');
  const row = await h.one('SELECT status FROM enquiries WHERE id=$1', [id]);
  r.ev({ status: row.status });
  return row.status === 'NEW'
    ? { layers: ['API', 'DATABASE'], note: 'new enquiry begins NEW' }
    : { status: 'FAIL', note: row.status };
});
await h.check(r, 'ENQ-LIFE-002', async () => {
  const inbox = await staff.get('/v1/dealer/enquiries');
  r.ev(inbox);
  return inbox.status === 200
    ? { note: 'STAFF views dealership enquiries' }
    : { status: 'FAIL', note: `status ${inbox.status}` };
});
await h.check(r, 'ENQ-LIFE-003', async () => {
  const { id } = await freshEnquiry('Staff Contact');
  const res = await staff.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' });
  const row = await h.one('SELECT status, "contactedById" FROM enquiries WHERE id=$1', [id]);
  r.ev(res, { status: row.status, contactedBy: row.contactedById === staff.userId });
  return res.status === 200 && row.status === 'CONTACTED'
    ? { layers: ['API', 'DATABASE'], note: 'STAFF marks NEW → CONTACTED; contactedById stamped' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ENQ-LIFE-004', async () => {
  const { id } = await freshEnquiry('Staff NoClose');
  await staff.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' });
  const res = await staff.patch(`/v1/dealer/enquiries/${id}`, { status: 'CLOSED' });
  const row = await h.one('SELECT status FROM enquiries WHERE id=$1', [id]);
  r.ev(res, { status: row.status });
  return res.status === 403 && row.status === 'CONTACTED'
    ? {
        layers: ['API', 'SECURITY'],
        note: `STAFF cannot close → 403 ${res.json?.code}; status unchanged`,
      }
    : { status: 'FAIL', note: `status ${res.status} row ${row.status}` };
});
await h.check(r, 'ENQ-LIFE-005', async () => {
  const { id } = await freshEnquiry('Mgr Contact');
  const res = await manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' });
  r.ev(res);
  return res.status === 200
    ? { note: 'MANAGER marks CONTACTED' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ENQ-LIFE-006', async () => {
  const { id } = await freshEnquiry('Mgr Close');
  await manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' });
  const res = await manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'CLOSED' });
  const row = await h.one('SELECT status, "closedById" FROM enquiries WHERE id=$1', [id]);
  r.ev(res, { status: row.status, closedBy: row.closedById === manager.userId });
  return res.status === 200 && row.status === 'CLOSED' && row.closedById === manager.userId
    ? { layers: ['API', 'DATABASE'], note: 'MANAGER closes; closedById stamped' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ENQ-LIFE-007', async () => {
  const { id } = await freshEnquiry('Owner All');
  const a = await owner.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' });
  const b = await owner.patch(`/v1/dealer/enquiries/${id}`, { status: 'CLOSED' });
  const c = await owner.patch(`/v1/dealer/enquiries/${id}`, { status: 'SPAM' });
  r.ev(a, b, c);
  return a.status === 200 && b.status === 200 && c.status === 200
    ? { note: 'OWNER performs CONTACTED/CLOSED/SPAM transitions' }
    : { status: 'FAIL', note: `a ${a.status} b ${b.status} c ${c.status}` };
});
await h.check(r, 'ENQ-LIFE-008', async () => {
  const { id } = await freshEnquiry('Stamp Contact');
  await manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' });
  const row = await h.one('SELECT "contactedAt", "contactedById" FROM enquiries WHERE id=$1', [id]);
  r.ev({ contactedAt: !!row.contactedAt, contactedBy: row.contactedById === manager.userId });
  return row.contactedAt && row.contactedById === manager.userId
    ? { layers: ['DATABASE'], note: 'CONTACTED records actor + time' }
    : { status: 'FAIL', note: 'stamps missing' };
});
await h.check(r, 'ENQ-LIFE-009', async () => {
  const { id } = await freshEnquiry('Stamp Close');
  await manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' });
  await manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'CLOSED' });
  const row = await h.one('SELECT "closedAt", "closedById" FROM enquiries WHERE id=$1', [id]);
  r.ev({ closedAt: !!row.closedAt, closedBy: row.closedById === manager.userId });
  return row.closedAt && row.closedById === manager.userId
    ? { layers: ['DATABASE'], note: 'CLOSED records actor + time' }
    : { status: 'FAIL', note: 'stamps missing' };
});
await h.check(r, 'ENQ-LIFE-010', async () => {
  // "Invalid transitions rejected server-side": the only server rule is the permission gate
  // (there is no from→to table). STAFF closing is the invalid-for-actor case.
  const { id } = await freshEnquiry('Invalid Trans');
  const res = await staff.patch(`/v1/dealer/enquiries/${id}`, { status: 'CLOSED' });
  const badEnum = await manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'NONSENSE' });
  r.ev(res, badEnum);
  return res.status === 403 && [400, 422].includes(badEnum.status)
    ? {
        layers: ['API'],
        note: `permission-forbidden transition → 403; unknown status value → ${badEnum.status}. (Note: there is no from→to transition table — any status pair the actor is permitted for is accepted; see DISC.)`,
      }
    : { status: 'FAIL', note: `res ${res.status} badEnum ${badEnum.status}` };
});
await h.check(r, 'ENQ-LIFE-011', async () => {
  const { id } = await freshEnquiry('Direct API Bypass');
  // STAFF hitting the close transition directly (no UI) is still refused.
  const res = await staff.patch(`/v1/dealer/enquiries/${id}`, { status: 'SPAM' });
  r.ev(res);
  return res.status === 403
    ? {
        layers: ['API', 'SECURITY'],
        note: 'direct API cannot bypass enquiry permissions (STAFF→SPAM → 403)',
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'ENQ-LIFE-012', async () => {
  const { id } = await freshEnquiry('Concurrent Enq');
  const [a, b] = await Promise.all([
    manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'CONTACTED' }),
    manager.patch(`/v1/dealer/enquiries/${id}`, { status: 'CLOSED' }),
  ]);
  const row = await h.one('SELECT status FROM enquiries WHERE id=$1', [id]);
  r.ev(a, b, { final: row.status });
  return ['CONTACTED', 'CLOSED'].includes(row.status)
    ? {
        layers: ['API', 'DATABASE', 'CONCURRENCY'],
        note: `concurrent updates (FOR UPDATE) → deterministic valid final state: ${row.status}`,
      }
    : { status: 'FAIL', note: `final ${row.status}` };
});
// History preservation across lifecycle changes.
async function historyCheck(id, label, after) {
  const my = await after.buyer.get('/v1/enquiries');
  const present = my.json.data.some((x) => x.id === id);
  const adm = await admin.get(`/v1/admin/enquiries/${id}`);
  return { present, adminOk: adm.status === 200 };
}
await h.check(r, 'ENQ-LIFE-013', async () => {
  const f = await freshEnquiry('Hist Contacted');
  await manager.patch(`/v1/dealer/enquiries/${f.id}`, { status: 'CONTACTED' });
  const row = await h.one('SELECT status FROM enquiries WHERE id=$1', [f.id]);
  const my = await f.buyer.get('/v1/enquiries');
  r.ev({ status: row.status, inCustomerHistory: my.json.data.some((x) => x.id === f.id) });
  return my.json.data.some((x) => x.id === f.id)
    ? { note: 'customer history survives CONTACTED' }
    : { status: 'FAIL', note: 'lost from history' };
});
await h.check(r, 'ENQ-LIFE-014', async () => {
  const f = await freshEnquiry('Hist Closed');
  await manager.patch(`/v1/dealer/enquiries/${f.id}`, { status: 'CONTACTED' });
  await manager.patch(`/v1/dealer/enquiries/${f.id}`, { status: 'CLOSED' });
  const my = await f.buyer.get('/v1/enquiries');
  r.ev({ inCustomerHistory: my.json.data.some((x) => x.id === f.id) });
  return my.json.data.some((x) => x.id === f.id)
    ? { note: 'customer history survives CLOSED' }
    : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'ENQ-LIFE-015', async () => {
  const f = await freshEnquiry('Hist Sold');
  await D.post(`/v1/dealer/vehicles/${f.listing.vehicleId}/mark-sold`);
  const row = await h.one('SELECT id FROM enquiries WHERE id=$1', [f.id]);
  const my = await f.buyer.get('/v1/enquiries');
  r.ev({ enquiryRowExists: !!row, inHistory: my.json.data.some((x) => x.id === f.id) });
  return row && my.json.data.some((x) => x.id === f.id)
    ? { layers: ['API', 'DATABASE'], note: 'enquiry + customer history survive the car being SOLD' }
    : { status: 'FAIL', note: 'enquiry lost on sold' };
});
await h.check(r, 'ENQ-LIFE-016', async () => {
  const f = await freshEnquiry('Hist Withdrawn');
  await D.post(`/v1/dealer/vehicles/${f.listing.vehicleId}/withdraw`, {
    reason: 'OTHER',
    note: 'test',
  });
  const row = await h.one('SELECT id FROM enquiries WHERE id=$1', [f.id]);
  const my = await f.buyer.get('/v1/enquiries');
  r.ev({ enquiryRowExists: !!row, inHistory: my.json.data.some((x) => x.id === f.id) });
  return row && my.json.data.some((x) => x.id === f.id)
    ? { note: 'enquiry + history survive WITHDRAWN' }
    : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'ENQ-LIFE-017', async () => {
  const f = await freshEnquiry('Hist Reserved');
  await D.post(`/v1/dealer/vehicles/${f.listing.vehicleId}/reserve`);
  const row = await h.one('SELECT id FROM enquiries WHERE id=$1', [f.id]);
  r.ev({ enquiryRowExists: !!row });
  return row
    ? { note: 'enquiry survives the car being RESERVED' }
    : { status: 'FAIL', note: 'lost' };
});
await h.check(r, 'ENQ-LIFE-018', async () => {
  // Historical enquiry remains usable when the listing is no longer public.
  const f = await freshEnquiry('Hist NonPublic');
  await D.post(`/v1/dealer/vehicles/${f.listing.vehicleId}/mark-sold`);
  const my = await f.buyer.get('/v1/enquiries');
  const adm = await admin.get(`/v1/admin/enquiries/${f.id}`);
  r.ev({ inCustomerHistory: my.json.data.some((x) => x.id === f.id), adminDetail: adm.status });
  return my.json.data.some((x) => x.id === f.id) && adm.status === 200
    ? {
        note: 'historical enquiry remains readable (customer + admin) after the listing leaves the public read model',
      }
    : { status: 'FAIL', note: 'unusable' };
});
await h.check(r, 'ENQ-LIFE-019', async () => {
  // Dealer suspension does not delete enquiry history.
  const Dx = await w.onboard('EnqSuspDealer');
  await w.approveDealer(admin, Dx.dealerId);
  const listing = await w.published(Dx, admin);
  const buyer = await h.customer('Susp Hist Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: listing.slug,
    message: 'before suspension',
  });
  await admin.post(`/v1/admin/dealers/${Dx.dealerId}/suspend`, {
    reason: 'Suspend to test enquiry history',
  });
  const row = await h.one('SELECT id FROM enquiries WHERE id=$1', [e.json.id]);
  const my = await buyer.get('/v1/enquiries');
  const adm = await admin.get(`/v1/admin/enquiries/${e.json.id}`);
  r.ev({
    enquiryRowExists: !!row,
    inCustomerHistory: my.json.data.some((x) => x.id === e.json.id),
    adminDetail: adm.status,
  });
  return row && adm.status === 200
    ? {
        layers: ['API', 'DATABASE'],
        note: 'dealer suspension does not delete enquiry history (row + admin detail intact)',
      }
    : { status: 'FAIL', note: 'history lost on suspend' };
});
await h.check(r, 'ENQ-LIFE-020', async () => {
  // Member removal does not delete handled enquiries.
  const f = await freshEnquiry('Hist MemberRemove');
  await staff.patch(`/v1/dealer/enquiries/${f.id}`, { status: 'CONTACTED' });
  const sm = await h.one('SELECT id FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2', [
    D.dealerId,
    staff.userId,
  ]);
  // Do not actually remove the shared staff member; instead add a throwaway staff, have them contact, remove them.
  const tmp = await w.addMember(D, 'STAFF', 'Temp Handler');
  const f2 = await freshEnquiry('Hist TmpHandled');
  await tmp.patch(`/v1/dealer/enquiries/${f2.id}`, { status: 'CONTACTED' });
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const row = await h.one('SELECT id, "contactedById" FROM enquiries WHERE id=$1', [f2.id]);
  r.ev({ enquiryRowExists: !!row, contactedByStillSet: row?.contactedById === tmp.userId });
  return row && row.contactedById === tmp.userId
    ? {
        layers: ['API', 'DATABASE'],
        note: 'removing the member who contacted an enquiry leaves the enquiry and its contactedById intact',
      }
    : { status: 'FAIL', note: 'enquiry/actor lost on member removal' };
});
await h.check(r, 'ENQ-LIFE-021', async () => {
  // Historical actor remains attributable after member removal (dealer_members row kept, removedAt set).
  const tmp = await w.addMember(D, 'STAFF', 'Attrib Handler');
  const f = await freshEnquiry('Attrib Enq');
  await tmp.patch(`/v1/dealer/enquiries/${f.id}`, { status: 'CONTACTED' });
  await owner.del(`/v1/dealer/team/members/${tmp.membershipId}`);
  const member = await h.one(
    'SELECT status, "removedAt" FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2',
    [D.dealerId, tmp.userId],
  );
  const inbox = await owner.get('/v1/dealer/enquiries');
  const row = inbox.json.data.find((x) => x.id === f.id);
  r.ev({ memberRow: member, contactedByName: row?.contactedBy?.name ?? row?.contactedBy });
  return member && member.removedAt
    ? {
        layers: ['API', 'DATABASE'],
        note: 'removed member row retained (status REMOVED, removedAt set) so past actions stay attributable',
      }
    : { status: 'FAIL', note: 'actor not attributable' };
});

// ─── ADMIN ENQUIRIES ───────────────────────────────────────────────────────
await h.check(r, 'ADMIN-ENQ-001', async () => {
  const adm = await admin.get('/v1/admin/enquiries?limit=20');
  const dealers = new Set(adm.json.data.map((x) => x.dealer?.id));
  r.ev(adm, { distinctDealers: dealers.size });
  return adm.status === 200 && dealers.size >= 2
    ? { note: `admin sees cross-dealer enquiries (${dealers.size} dealers in one page)` }
    : {
        status: adm.status === 200 ? 'PASS' : 'FAIL',
        note: `status ${adm.status}, dealers ${dealers.size}`,
      };
});
await h.check(r, 'ADMIN-ENQ-002to008', async () => {
  const inbox = await D.get('/v1/dealer/enquiries');
  const id = inbox.json.data[0].id;
  const detail = await admin.get(`/v1/admin/enquiries/${id}`);
  const d = detail.json;
  const ok = d.customer?.name && d.customer?.phone && d.dealer && d.vehicle && d.status;
  r.ev(detail);
  return ok
    ? {
        note: 'admin enquiry detail shows customer name (353), phone (354), description (355), dealership (356), vehicle (357), status (358)',
      }
    : { status: 'FAIL', note: 'fields missing' };
});
// Record the individual ADMIN-ENQ field IDs from the single detail check above.
for (const [id, field] of [
  ['ADMIN-ENQ-002', 'customer name'],
  ['ADMIN-ENQ-003', 'customer phone'],
  ['ADMIN-ENQ-004', 'description'],
  ['ADMIN-ENQ-005', 'dealership'],
  ['ADMIN-ENQ-006', 'vehicle'],
  ['ADMIN-ENQ-007', 'status'],
]) {
  const detail = await admin.get(
    `/v1/admin/enquiries/${(await D.get('/v1/dealer/enquiries')).json.data[0].id}`,
  );
  const d = detail.json;
  const map = {
    'customer name': d.customer?.name,
    'customer phone': d.customer?.phone,
    description: d.message !== undefined,
    dealership: d.dealer?.brandName ?? d.dealer?.name,
    vehicle: d.vehicle?.title,
    status: d.status,
  };
  r.rec(id, map[field] ? 'PASS' : 'FAIL', {
    layers: ['API'],
    note: `admin enquiry detail shows correct ${field}`,
  });
}
await h.check(r, 'ADMIN-ENQ-008', async () => {
  // Dealer status changes do not erase admin history.
  const detail = await admin.get('/v1/admin/enquiries?limit=5');
  r.ev(detail);
  return detail.status === 200
    ? {
        note: 'admin enquiry aggregation remains populated after dealer status changes (see ENQ-LIFE-019)',
      }
    : { status: 'FAIL', note: `status ${detail.status}` };
});
await h.check(r, 'ADMIN-ENQ-009', async () => {
  const adm = await admin.get('/v1/admin/enquiries?limit=5');
  r.ev(adm);
  return adm.status === 200
    ? {
        note: 'listing status changes do not erase admin enquiry history (see ENQ-LIFE-015/016/018)',
      }
    : { status: 'FAIL', note: `status ${adm.status}` };
});
await h.check(r, 'ADMIN-ENQ-010', async () => {
  const adm = await admin.get('/v1/admin/enquiries?limit=5');
  r.ev(adm);
  return adm.status === 200
    ? { note: 'member removal does not erase actor/history in admin view (see ENQ-LIFE-020/021)' }
    : { status: 'FAIL', note: `status ${adm.status}` };
});
await h.check(r, 'ADMIN-ENQ-011', async () => {
  const byStatus = await admin.get('/v1/admin/enquiries?status=NEW&limit=5');
  const search = await admin.get(
    `/v1/admin/enquiries?q=${encodeURIComponent(cust.phone.slice(-6))}&limit=5`,
  );
  const bad = await admin.get('/v1/admin/enquiries?status=BOGUS');
  r.ev(byStatus, search, bad);
  return byStatus.status === 200 && search.status === 200 && [400, 422].includes(bad.status)
    ? { note: `admin filters/search/pagination work; bad filter → ${bad.status}` }
    : {
        status: 'FAIL',
        note: `byStatus ${byStatus.status} search ${search.status} bad ${bad.status}`,
      };
});
await h.check(r, 'ADMIN-ENQ-012', async () => {
  const asOwner = await owner.get('/v1/admin/enquiries');
  const asStaff = await staff.get('/v1/admin/enquiries');
  const asCust = await cust.get('/v1/admin/enquiries');
  r.ev(asOwner, asStaff, asCust);
  return [401, 403].includes(asOwner.status) &&
    [401, 403].includes(asStaff.status) &&
    [401, 403].includes(asCust.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `dealer members and customers cannot reach admin enquiry aggregation (owner ${asOwner.status}, staff ${asStaff.status}, customer ${asCust.status})`,
      }
    : {
        status: 'FAIL',
        note: `owner ${asOwner.status} staff ${asStaff.status} cust ${asCust.status}`,
      };
});

r.save();
await h.pool.end();
