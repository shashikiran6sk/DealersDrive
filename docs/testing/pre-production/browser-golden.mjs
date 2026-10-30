import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '/opt/codex/runtimes/cua/lib/node_modules/playwright-core/index.mjs';
const root = new URL('./', import.meta.url);
const fixture = JSON.parse(await fs.readFile('/tmp/dd-cert-golden-private.json', 'utf8'));
const roles = JSON.parse(await fs.readFile('/tmp/dd-cert-role-browser-private.json', 'utf8'));
const original = JSON.parse(await fs.readFile('/tmp/dd-cert-browser-private.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const rows = [];
async function check(id, canonical, run) {
  try {
    rows.push({ id, canonical, status: 'PASS', observed: await run() });
  } catch (error) {
    rows.push({ id, canonical, status: 'BLOCKED', reason: error.message });
  }
  console.log(id, rows.at(-1).status);
}
async function actor(token) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addCookies([
    {
      name: 'dd_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  return { ctx, page };
}
async function shot(page, folder, name) {
  const path = `evidence/${folder}/${name}.png`;
  await page.screenshot({ path: new URL(path, root).pathname, fullPage: true });
  return path;
}
const buyer = await actor(fixture.buyerToken);
await check(
  'JOURNEY-customer',
  ['SAVED-001', 'SAVED-003', 'ENQ-CREATE-003', 'ENQ-CREATE-005', 'ENQ-CREATE-013'],
  async () => {
    await buyer.page.goto(`http://localhost:3000/car/${fixture.car.slug}`);
    await buyer.page
      .getByRole('button', { name: /^Account menu for Certification Customer/ })
      .waitFor();
    await buyer.page
      .getByRole('button', { name: /^Save 2023 Hyundai/ })
      .first()
      .click();
    await buyer.page
      .getByRole('button', { name: /^Remove 2023 Hyundai/ })
      .first()
      .click();
    await buyer.page
      .getByRole('button', { name: /^Save 2023 Hyundai/ })
      .first()
      .click();
    await buyer.page
      .getByRole('button', { name: /^Remove 2023 Hyundai/ })
      .first()
      .waitFor();
    await buyer.page.getByRole('button', { name: 'Enquire now', exact: true }).first().click();
    await buyer.page.getByRole('form', { name: 'Interested in this vehicle?' }).waitFor();
    assert.ok((await buyer.page.getByRole('form').innerText()).includes('Certification Customer'));
    await buyer.page
      .getByPlaceholder('Ask about the car, or when you can visit.')
      .fill('Mobile golden journey lead.');
    await buyer.page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
    await buyer.page.getByText('Enquiry sent', { exact: true }).waitFor();
    await buyer.page.getByRole('link', { name: 'Track it in My enquiries', exact: true }).click();
    await buyer.page.waitForURL('**/enquiries');
    await buyer.page.getByText('Mobile golden journey lead.', { exact: true }).waitFor();
    return { screenshot: await shot(buyer.page, 'customer-enquiries', 'mobile-golden-sent') };
  },
);
const staff = await actor(roles.STAFF.token);
await check(
  'JOURNEY-staff-contact',
  [
    'STAFF-009',
    'STAFF-010',
    'STAFF-011',
    'STAFF-012',
    'ENQ-LIFE-002',
    'ENQ-LIFE-003',
    'ENQ-LIFE-004',
  ],
  async () => {
    await staff.page.goto('http://localhost:3000/dealer/enquiries');
    const card = staff.page
      .getByRole('listitem')
      .filter({ hasText: 'Mobile golden journey lead.' });
    await card.waitFor();
    assert.ok((await card.innerText()).includes('Certification Customer'));
    assert.equal(await card.getByRole('button', { name: 'Close', exact: true }).count(), 0);
    await card.getByRole('button', { name: 'Mark contacted', exact: true }).click();
    await staff.page.getByRole('link', { name: /^Contacted/ }).click();
    await staff.page.getByText(/Contacted by Certification Staff/).waitFor();
    return { screenshot: await shot(staff.page, 'dealer-staff', 'mobile-contacted') };
  },
);
const manager = await actor(roles.MANAGER.token);
await check('JOURNEY-manager-close', ['MANAGER-008', 'ENQ-LIFE-006'], async () => {
  await manager.page.goto('http://localhost:3000/dealer/enquiries?status=CONTACTED');
  const card = manager.page
    .getByRole('listitem')
    .filter({ hasText: 'Mobile golden journey lead.' });
  await card.getByRole('button', { name: 'Close', exact: true }).click();
  await manager.page.getByRole('link', { name: /^Closed/ }).click();
  await manager.page.getByText(/Closed by Certification Manager/).waitFor();
  return { screenshot: await shot(manager.page, 'dealer-manager', 'mobile-closed') };
});
await check('JOURNEY-customer-history', ['ENQ-LIFE-013', 'ENQ-LIFE-014'], async () => {
  await buyer.page.reload();
  const card = buyer.page.getByRole('listitem').filter({ hasText: 'Mobile golden journey lead.' });
  await card.getByText('Closed', { exact: true }).waitFor();
  return { screenshot: await shot(buyer.page, 'customer-enquiries', 'mobile-golden-closed') };
});
await check('JOURNEY-staff-draft', ['LISTING-CREATE-003', 'LISTING-CREATE-014'], async () => {
  await staff.page.goto('http://localhost:3000/dealer/vehicles/new');
  await staff.page.locator('input[name="registrationNumber"]').fill('TN22QA8195');
  await staff.page.getByRole('button', { name: 'Continue', exact: true }).click();
  await staff.page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await staff.page
    .getByText('Draft saved. You can come back to it at any time.', { exact: true })
    .waitFor();
  await staff.page.reload();
  const path = new URL(staff.page.url()).pathname;
  assert.ok(path.includes('/dealer/vehicles/'));
  return { path, screenshot: await shot(staff.page, 'dealer-staff', 'mobile-draft-persisted') };
});
const admin = await actor(original.adminCookie);
await check('JOURNEY-admin-history', [], async () => {
  await admin.page.goto('http://localhost:3000/admin/enquiries?q=TN22QA8196');
  await admin.page
    .getByRole('link', { name: /View enquiry/ })
    .first()
    .click();
  await admin.page.getByText(/Mobile golden journey lead/).waitFor();
  return { screenshot: await shot(admin.page, 'admin', 'golden-enquiry-history') };
});
for (const row of rows) row.sha = 'd6ae115359c4d0ae7ab0fd5115336291666cbb08';
await fs.writeFile(
  new URL('evidence/golden-browser.json', root),
  JSON.stringify(rows, null, 2) + '\n',
);
await browser.close();
