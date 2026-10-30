// PR #233 independent race probe: concurrent approve vs reject on ready applications.
import * as h from './lib.mjs';
import * as w from './world.mjs';
const r = h.recorder('retest-233-race');
const admin = await h.admin();
await h.check(r, 'R233-approve-vs-reject-race', async () => {
  const outcomes = [];
  for (let i = 0; i < 8; i++) {
    const D = await w.onboard(`R233Race${i}`);
    const docs = await h.q(`SELECT id FROM dealer_documents WHERE "dealerId"=$1`, [D.dealerId]);
    for (const d of docs) await admin.post(`/v1/admin/documents/${d.id}/verify`);
    const [ap, rj] = await Promise.all([
      admin.post(`/v1/admin/dealers/${D.dealerId}/approve`, {}),
      admin.post(`/v1/admin/dealers/${D.dealerId}/reject`, {
        reason: 'Concurrent rejection probe',
      }),
    ]);
    const row = await h.q(`SELECT status, "approvedAt" FROM dealers WHERE id=$1`, [D.dealerId]);
    const o = {
      approve: ap.status,
      reject: rj.status,
      rejectCode: rj.json?.code,
      dealer: row[0]?.status ?? 'ABSENT',
    };
    outcomes.push(o);
    // Invariant: never "approval succeeded" and the dealership purged; never both 200.
    h.assert(
      !(ap.status === 200 && o.dealer === 'ABSENT'),
      `approved then purged: ${JSON.stringify(o)}`,
    );
    h.assert(!(ap.status === 200 && rj.status === 200), `both succeeded: ${JSON.stringify(o)}`);
    h.assert(![ap.status, rj.status].includes(500), `500: ${JSON.stringify(o)}`);
  }
  r.ev({ outcomes });
  return {
    note: `8 races, invariants hold: ${JSON.stringify(outcomes.map((o) => `${o.approve}/${o.reject}/${o.dealer}`))}`,
  };
});
r.save();
