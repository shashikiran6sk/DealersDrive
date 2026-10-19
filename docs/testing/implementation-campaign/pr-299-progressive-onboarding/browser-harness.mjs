import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';

const [out, S, jpeg, ownerSlug, ownerId, draftId, salesDraftId] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const tok = (n) => readFileSync(`${S}/tok-${n}`, 'utf8').trim();
const B = 'http://localhost:3000';
const b = await chromium.launch();
const res = {};
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

async function ctx(cookie, value, width) {
  const c = await b.newContext({ viewport: { width, height: 900 } });
  await c.addCookies([{ name: cookie, value, domain: 'localhost', path: '/' }]);
  return c.newPage();
}
async function publicGallery(tag) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  await p.goto(`${B}/dealers/${ownerSlug}`, { waitUntil: 'networkidle' });
  const imgs = await p.evaluate(() =>
    [...document.querySelectorAll('img')]
      .map((i) => ({ src: i.getAttribute('src') ?? '', ok: i.complete && i.naturalWidth > 0 }))
      .filter((i) => i.src.includes('/media/')),
  );
  await shot(p, `public-dealer-${tag}-390`);
  await p.close();
  return imgs;
}

// 1. Dealer adds a photo: private and pending.
for (const width of [390, 1280]) {
  const o = await ctx('dd_session', tok('owner'), width);
  await o.goto(`${B}/dealer/photos`, { waitUntil: 'networkidle' });
  await shot(o, `dealer-photos-empty-${width}`);
  res[`dealerPhotosOverflow${width}`] = await overflow(o);
  await o.close();
}
const o = await ctx('dd_session', tok('owner'), 390);
await o.goto(`${B}/dealer/photos`, { waitUntil: 'networkidle' });
await o.getByRole('button', { name: 'Add photo' }).first().click();
await o.locator('input[type="file"]').setInputFiles(jpeg);
await o.getByLabel('Caption').fill('Forecourt on Katpadi Road');
await o.getByRole('button', { name: 'Submit for review' }).click();
await o.waitForTimeout(3000);
await o.reload({ waitUntil: 'networkidle' });
res.afterSubmit = (await o.locator('main').innerText()).match(/Awaiting review[^\n]*/)?.[0] ?? null;
await shot(o, 'dealer-photos-pending-390');
res.publicWhilePending = await publicGallery('pending');

// 2. Moderator approves from the queue.
const m = await ctx('dd_admin_session', tok('MODERATOR'), 1280);
await m.goto(`${B}/admin/portfolio`, { waitUntil: 'networkidle' });
await shot(m, 'admin-portfolio-queue-1280');
await m.getByRole('button', { name: 'Approve' }).first().click();
await m.waitForTimeout(3000);
res.publicAfterApprove = await publicGallery('approved');

// 3. Safe replacement: the approved photo stays until the replacement is approved.
await o.reload({ waitUntil: 'networkidle' });
await o.getByRole('button', { name: /^Replace/ }).first().click();
await o.locator('input[type="file"]').setInputFiles(jpeg);
await o.getByRole('button', { name: 'Submit for review' }).click();
await o.waitForTimeout(3000);
await o.reload({ waitUntil: 'networkidle' });
await shot(o, 'dealer-photos-replacement-pending-390');
res.publicWhileReplacementPending = await publicGallery('replacement-pending');
await m.reload({ waitUntil: 'networkidle' });
await shot(m, 'admin-portfolio-replacement-1280');
await m.getByRole('button', { name: 'Approve' }).first().click();
await m.waitForTimeout(3000);
res.publicAfterReplacement = await publicGallery('replaced');

// 4. Admin dealer page: verification panel has no evidence fields; yard visit.
const s = await ctx('dd_admin_session', tok('super-admin'), 1280);
await s.goto(`${B}/admin/dealers/${ownerId}`, { waitUntil: 'networkidle' });
const panel = s.locator('section[aria-labelledby="dealer-verification-heading"]');
res.verification = {
  status: (await panel.locator('p.font-bold').first().innerText()),
  textareasBeforeSave: await panel.locator('textarea').count(),
};
const select = panel.getByLabel('Next verification status');
if (await select.count()) {
  const options = await select.locator('option').allInnerTexts();
  res.verification.options = options;
  if (options.includes('Verification in review')) {
    await select.selectOption({ label: 'Verification in review' });
    await panel.getByRole('button', { name: 'Save verification decision' }).click();
    await s.waitForTimeout(2500);
  }
  if ((await select.locator('option').allInnerTexts()).includes('Dealer Verified')) {
    await select.selectOption({ label: 'Dealer Verified' });
    res.verification.textareasForVerified = await panel.locator('textarea').count();
    await panel.getByRole('button', { name: 'Save verification decision' }).click();
    await s.waitForTimeout(2500);
    res.verification.verifiedOutcome =
      (await panel.getByRole('alert').count()) > 0
        ? await panel.getByRole('alert').innerText()
        : await panel.locator('p.font-bold').first().innerText();
  }
}
await panel.screenshot({ path: `${out}/admin-verification-panel-1280.png` });

const visits = s.getByRole('heading', { name: 'Internal yard visits' });
res.yardPanel = await visits.count();
if (res.yardPanel) {
  await s.getByLabel('Visited on').fill('2026-10-10');
  await s.getByLabel('What was found').selectOption('NO_PHYSICAL_YARD');
  await s.getByLabel('Notes').fill('Trades from an office; vehicles parked at customers.');
  await s.getByRole('button', { name: 'Record visit' }).click();
  await s.waitForTimeout(2500);
  await s.reload({ waitUntil: 'networkidle' });
  const input = s.locator('input[type="file"][aria-label^="Add a photograph"], input[type="file"]').last();
  await input.setInputFiles(jpeg);
  await s.waitForTimeout(4000);
  await s.reload({ waitUntil: 'networkidle' });
  res.yardVisitPhotos = await s.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((i) => (i.getAttribute('alt') ?? '').startsWith('Yard visit photograph'))
      .map((i) => ({ ok: i.complete && i.naturalWidth > 0, signed: (i.getAttribute('src') ?? '').includes('sig') })),
  );
}
await shot(s, 'admin-dealer-active-1280');
res.adminDealerOverflow390 = await (async () => {
  const p = await ctx('dd_admin_session', tok('super-admin'), 390);
  await p.goto(`${B}/admin/dealers/${ownerId}`, { waitUntil: 'networkidle' });
  await shot(p, 'admin-dealer-active-390');
  const r = await overflow(p);
  await p.close();
  return r;
})();

// 5. A draft: the override block (blocked or available), and the document review.
await s.goto(`${B}/admin/dealers/${draftId}`, { waitUntil: 'networkidle' });
await shot(s, 'admin-dealer-draft-override-1280');
res.draftOverride = (await s.locator('main').innerText()).match(/(Activate[^\n]*|Manual activation[^\n]*)/g)?.slice(0, 4) ?? [];

// 6. Sales representative: the part is done after Step 2.
for (const width of [390, 1280]) {
  const r = await ctx('dd_admin_session', tok('arun'), width);
  await r.goto(`${B}/sales/dealers/${salesDraftId}`, { waitUntil: 'networkidle' });
  await shot(r, `sales-draft-${width}`);
  res[`sales${width}`] = {
    yard: /yard photo/i.test(await r.locator('main').innerText()),
    optional: /optional for you/i.test(await r.locator('main').innerText()),
    overflow: await overflow(r),
  };
  await r.close();
}

// 7. Public page never leaks the yard-visit evidence.
const pub = await (await b.newContext()).newPage();
const html = await (await pub.goto(`${B}/dealers/${ownerSlug}`)).text();
res.publicMentionsYardVisit = /yard-visits|Internal yard visits/.test(html);
console.log(JSON.stringify(res, null, 1));
await b.close();
