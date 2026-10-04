// Independent reproduction of BUG-NEW-012: a queued enquiry write commits after membership removal.
import { setTimeout as pause } from 'node:timers/promises';
import * as h from './lib.mjs';
import * as w from './world.mjs';
const r = h.recorder('retest-new012');
const admin = await h.admin();
const D = await w.onboard('R012Owner');
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
const manager = await w.addMember(D, 'MANAGER', 'R012 Manager');
const cust = await h.customer('R012 Buyer');
const e = await cust.post('/v1/enquiries', {
  listingSlug: car.slug,
  message: 'Is this still available for a viewing?',
});
const enquiryId = e.json.id;
await h.check(r, 'BUG-NEW-012-queued-enquiry-close-after-removal', async () => {
  const holder = await h.pool.connect();
  await holder.query('BEGIN');
  await holder.query('SELECT id FROM enquiries WHERE id=$1 FOR UPDATE', [enquiryId]);
  const pending = manager.patch(`/v1/dealer/enquiries/${enquiryId}`, { status: 'CLOSED' });
  await pause(400); // the manager's request is now waiting on the enquiry row
  const removed = await D.del(`/v1/dealer/team/members/${manager.membershipId}`);
  const member = await h.one(`SELECT status FROM dealer_members WHERE id=$1`, [
    manager.membershipId,
  ]);
  await holder.query('COMMIT');
  holder.release();
  const closed = await pending;
  const after = await h
    .one(`SELECT status, "closedBy" FROM enquiries WHERE id=$1`, [enquiryId])
    .catch(async () => h.one(`SELECT status FROM enquiries WHERE id=$1`, [enquiryId]));
  const next = await manager.get('/v1/dealer/enquiries');
  r.ev(
    { removed: removed.status, memberAfterRemoval: member.status },
    closed,
    { enquiryAfter: after },
    { nextRequest: next.status },
  );
  if (closed.status === 200 && after.status === 'CLOSED' && member.status === 'REMOVED') {
    return {
      status: 'FAIL',
      layers: ['API', 'DATABASE', 'CONCURRENCY'],
      bug: 'BUG-NEW-012',
      note: `owner removed the manager (${removed.status}, member ${member.status}) while the manager's close was queued; the queued close then committed 200 → enquiry ${after.status}; the manager's next request → ${next.status}. Reproduced.`,
    };
  }
  return {
    note: `queued close → ${closed.status}, enquiry ${after.status}, member ${member.status}`,
  };
});
r.save();
process.exit(0);
