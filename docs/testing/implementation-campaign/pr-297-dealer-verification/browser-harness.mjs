import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, S, id, slug] = process.argv.slice(2);
const b = await chromium.launch();
const res = {};
const pub = await b.newPage({ viewport: { width: 390, height: 900 } });
async function publicState(tag) {
  await pub.goto('http://localhost:3000/dealers', { waitUntil: 'networkidle' });
  const badges = await pub.getByText('Dealer Verified', { exact: true }).count();
  const card = await pub.evaluate(
    (s) =>
      document.querySelector(`a[href="/dealers/${s}"]`)?.innerText.includes('Dealer Verified') ??
      null,
    slug,
  );
  const claim = await pub.evaluate(() =>
    /identity- and GST-verified|Dealers-Drive verifies dealer identity/.test(
      document.body.innerText,
    ),
  );
  await pub.goto(`http://localhost:3000/dealers/${slug}`, { waitUntil: 'networkidle' });
  const detail = await pub.getByText('Dealer Verified', { exact: true }).count();
  await pub.screenshot({ path: `${out}/public-detail-${tag}-390.png` });
  return {
    directoryBadges: badges,
    thisCardBadge: card,
    detailBadge: detail,
    oldUnsupportedClaims: claim,
  };
}
res.whileVerified = await publicState('verified');
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addCookies([
  {
    name: 'dd_admin_session',
    value: readFileSync(`${S}/tok-super-admin`, 'utf8').trim(),
    domain: 'localhost',
    path: '/',
  },
]);
const a = await ctx.newPage();
await a.goto(`http://localhost:3000/admin/dealers/${id}`, { waitUntil: 'networkidle' });
const panel = a.locator('section[aria-labelledby="dealer-verification-heading"]');
await panel.scrollIntoViewIfNeeded();
await a.screenshot({ path: `${out}/admin-verification-panel-verified-390.png` });
res.adminPanel = {
  present: await panel.count(),
  status:
    (await panel.innerText()).match(/Dealer Verified|Verification revoked|Not verified/)?.[0] ??
    null,
  overflow: await a.evaluate(() => document.documentElement.scrollWidth > innerWidth),
};
await panel.getByLabel('Next verification status').selectOption('REVOKED');
await panel
  .locator('textarea[name="reason"]')
  .fill('Local end-to-end check: revoking to confirm the public badge is withdrawn.');
await panel.getByRole('button', { name: 'Save verification decision' }).click();
await a.waitForTimeout(3000);
await a.reload({ waitUntil: 'networkidle' });
res.adminAfterRevoke =
  (await a.locator('section[aria-labelledby="dealer-verification-heading"]').innerText()).match(
    /Verification revoked|Dealer Verified/,
  )?.[0] ?? null;
await a
  .locator('section[aria-labelledby="dealer-verification-heading"]')
  .screenshot({ path: `${out}/admin-verification-panel-revoked-390.png` });
res.afterRevoke = await publicState('revoked');
console.log(JSON.stringify(res, null, 1));
await b.close();
