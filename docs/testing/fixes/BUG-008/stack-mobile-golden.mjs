import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '/opt/codex/runtimes/cua/lib/node_modules/playwright-core/index.mjs';
const root = new URL('./', import.meta.url);
const fixture = JSON.parse(await fs.readFile('/tmp/dd-bug008-browser-private.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const rows = [];
async function person(token) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([
    {
      name: 'dd_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, page };
}
try {
  const customer = await person(fixture.customerToken);
  for (const path of ['/cars', `/car/${fixture.car.slug}`, '/saved', '/enquiries']) {
    const response = await customer.page.goto(`http://localhost:3009${path}`, {
      waitUntil: 'domcontentloaded',
    });
    assert.equal(response.status(), 200);
    rows.push({ role: 'customer', path, http: 200, result: 'PASS' });
  }
  const owner = await person(fixture.ownerToken);
  await owner.page.goto('http://localhost:3009/dealer/enquiries');
  await owner.page.getByText('Admin mobile regression fixture', { exact: true }).waitFor();
  await owner.page.getByRole('button', { name: 'Mark contacted', exact: true }).click();
  await owner.page.getByText('No new enquiries', { exact: true }).waitFor();
  await owner.page.goto('http://localhost:3009/dealer/enquiries?status=CONTACTED');
  await owner.page.getByText('Admin mobile regression fixture', { exact: true }).waitFor();
  await owner.page.getByRole('button', { name: 'Close', exact: true }).click();
  await owner.page.getByText('Nobody marked contacted', { exact: true }).waitFor();
  await owner.page.goto('http://localhost:3009/dealer/enquiries?status=CLOSED');
  await owner.page.getByText('Admin mobile regression fixture', { exact: true }).waitFor();
  rows.push({
    role: 'owner',
    path: '/dealer/enquiries',
    lifecycle: 'NEW -> CONTACTED -> CLOSED',
    result: 'PASS',
  });
  await customer.page.goto('http://localhost:3009/enquiries', { waitUntil: 'domcontentloaded' });
  await customer.page.getByText('Closed', { exact: true }).first().waitFor();
  rows.push({
    role: 'customer',
    path: '/enquiries',
    expected: 'Closed history retained',
    result: 'PASS',
  });
  const admin = await person(fixture.adminToken);
  await admin.page.goto(`http://localhost:3009/admin/enquiries/${fixture.enquiryId}`, {
    waitUntil: 'domcontentloaded',
  });
  await admin.page.getByText('Admin mobile regression fixture', { exact: true }).waitFor();
  const text = await admin.page.locator('main').innerText();
  assert.ok(/Closed/.test(text) && /Contacted/.test(text));
  await admin.page.screenshot({
    path: new URL('evidence/screenshots/stack-admin-history-390.png', root).pathname,
  });
  rows.push({
    role: 'admin',
    path: '/admin/enquiries/:fixtureId',
    expected: 'Contacted and Closed history retained',
    result: 'PASS',
  });
  for (const p of [customer, owner, admin]) await p.context.close();
} finally {
  await browser.close();
  await fs.writeFile(
    new URL('evidence/stack-mobile-golden.json', root),
    JSON.stringify(
      {
        sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        rows,
        result: rows.length === 7 ? 'PASS' : 'INCOMPLETE',
        scope:
          'Fresh-authority happy path; does not close known queued enquiry revocation BUG-NEW-012',
        humanUat: 'PENDING',
      },
      null,
      2,
    ) + '\n',
  );
}
assert.equal(rows.length, 7);
console.log(
  'Mobile stack golden7 checks PASS: public browsing, Saved Cars, customer history, dealer contact/close, Admin history.',
);
