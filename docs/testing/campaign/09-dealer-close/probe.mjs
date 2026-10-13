// ORIG-GAP-CLOSE end to end: an Admin closes a DRAFT application through the
// console button; the record survives, the owner's session stops working and
// a fresh sign-in is refused with APPLICATION_CLOSED.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as b from '../../certification/harness/bkit.mjs';
import * as h from '../../certification/harness/lib.mjs';
import * as w from '../../certification/harness/world.mjs';

const out = process.env.CERT_RESULTS_DIR ?? '.';
const admin = await h.admin('cert-admin@example.test');
const D = await w.onboard('CloseProbe');
const before = await h.one(`SELECT status FROM dealers WHERE id=$1`, [D.dealerId]);
const sessionBefore = (await D.get('/v1/dealer')).status;

const ctx = await b.context({ cookie: admin.cookie, viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
await page.goto(`${b.WEB}/admin/dealers/${D.dealerId}`, { waitUntil: 'networkidle' });
await page.fill('#closeReason', 'Duplicate application — closing on the dealer’s request.');
await page.screenshot({ path: resolve(out, 'admin-close-before.png') });
await page.getByRole('button', { name: 'Close application' }).click();
await page.getByText('Application closed. Nothing was deleted.').waitFor({ timeout: 15000 });
await page.screenshot({ path: resolve(out, 'admin-close-after.png') });
await ctx.close();

const after = await h.one(`SELECT status, "statusReason" FROM dealers WHERE id=$1`, [D.dealerId]);
const members = await h.one(`SELECT count(*)::int AS n FROM dealer_members WHERE "dealerId"=$1 AND status='ACTIVE'`, [D.dealerId]);
const docs = await h.one(`SELECT count(*)::int AS n FROM dealer_documents WHERE "dealerId"=$1 AND status <> 'REQUIRED'`, [D.dealerId]);
const audit = await h.one(`SELECT count(*)::int AS n FROM audit_logs WHERE "entityId"=$1 AND action='dealer.closed'`, [D.dealerId]);
const sessionAfter = (await D.get('/v1/dealer')).status;
const signIn = await h.call('POST', '/v1/auth/sign-in/phone/dealer', {
  body: { phone: D.phone.slice(-10), accessToken: h.otpToken(D.phone) },
});
const summary = {
  before: before.status,
  after: after.status,
  reasonKept: after.statusReason !== null,
  activeMembersKept: members.n,
  uploadedDocumentsKept: docs.n,
  closeAuditRows: audit.n,
  ownerSessionBefore: sessionBefore,
  ownerSessionAfter: sessionAfter,
  ownerSignIn: { status: signIn.status, code: signIn.json?.code },
};
console.log(JSON.stringify(summary, null, 1));
writeFileSync(resolve(out, 'probe-fix-branch.json'), JSON.stringify(summary, null, 2) + '\n');
await b.close();
process.exit(0);
