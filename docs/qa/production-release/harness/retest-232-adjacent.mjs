// PR #232 adjacent-state retest: the valid paths still work after the gate.
import * as h from './lib.mjs';
import * as w from './world.mjs';
const r = h.recorder('retest-232-adjacent');
const admin = await h.admin();
await h.check(r, 'R232-valid-approve-suspend-reinstate', async () => {
  const D = await w.onboard('R232Valid');
  const ap = await w.approveDealer(admin, D.dealerId);
  const a1 = await h.one(`SELECT status, "approvedAt" FROM dealers WHERE id=$1`, [D.dealerId]);
  const su = await admin.post(`/v1/admin/dealers/${D.dealerId}/suspend`, {
    reason: 'Retest suspension reason',
  });
  const su2 = await admin.post(`/v1/admin/dealers/${D.dealerId}/suspend`, {
    reason: 'Retest suspension reason',
  });
  const re = await admin.post(`/v1/admin/dealers/${D.dealerId}/reinstate`, {});
  const a2 = await h.one(`SELECT status, "approvedAt" FROM dealers WHERE id=$1`, [D.dealerId]);
  const audits = await h.q(
    `SELECT action FROM audit_logs WHERE "entityId"=$1 ORDER BY "createdAt"`,
    [D.dealerId],
  );
  r.ev(ap, su, su2, re, { a1, a2, audits: audits.map((x) => x.action) });
  h.assert(ap.status === 200 && a1.status === 'ACTIVE', `approve ${ap.status}`);
  h.assert(
    su.status === 200 && su2.status === 422,
    `suspend ${su.status}, double-suspend ${su2.status}`,
  );
  h.assert(re.status === 200 && a2.status === 'ACTIVE', `reinstate ${re.status}`);
  h.assert(String(a1.approvedAt) === String(a2.approvedAt), 'approvedAt preserved');
  return {
    note: 'approve 200 → suspend 200 → second suspend 422 → reinstate 200; approvedAt preserved',
  };
});
await h.check(r, 'R232-unverified-pending-refused', async () => {
  const D = await w.onboard('R232Pend');
  const before = await h.one(`SELECT status FROM dealers WHERE id=$1`, [D.dealerId]);
  const ap = await admin.post(`/v1/admin/dealers/${D.dealerId}/approve`, {});
  const after = await h.one(`SELECT status FROM dealers WHERE id=$1`, [D.dealerId]);
  r.ev(ap, { before, after });
  h.assert(
    before.status === 'PENDING_APPROVAL' &&
      ap.status === 422 &&
      after.status === 'PENDING_APPROVAL',
    `approve ${ap.status} ${ap.json?.code}`,
  );
  return {
    note: `PENDING with unverified uploads: approve → 422 ${ap.json?.code}; state unchanged`,
  };
});
r.save();
