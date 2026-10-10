import * as b from '../../certification/harness/bkit.mjs';
import * as h from '../../certification/harness/lib.mjs';
const longEmail = `a.very.long.dealer.mailbox.name.for.overflow.${h.nonce()}@example-dealership-group.test`;
const o = await h.dealerPhone('Overflow Diag');
await h.simulateGoogleLink(o.userId, longEmail);
const admin = await h.admin('cert-admin@example.test');
const d = await h.one(`SELECT id FROM dealers WHERE "brandName" ILIKE 'OverflowDetail%' OR "legalName" ILIKE 'OverflowDetail%' ORDER BY "createdAt" DESC LIMIT 1`);
for (const [cookie, path] of [[o.cookie, '/dealer/onboarding'], [admin.cookie, `/admin/dealers/${d?.id}`]]) {
  const ctx = await b.context({ cookie, viewport: { width: 320, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${b.WEB}${path}`, { waitUntil: 'networkidle' });
  const wide = await p.evaluate(() => [...document.querySelectorAll('body *')]
    .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
    .map((e) => `${e.tagName}.${(e.className?.toString?.() ?? '').slice(0, 70)} w=${Math.round(e.getBoundingClientRect().width)}`).slice(0, 14));
  console.log(path.split('/')[1], JSON.stringify(wide, null, 1));
  await ctx.close();
}
await b.close(); process.exit(0);
