import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '/opt/codex/runtimes/cua/lib/node_modules/playwright-core/index.mjs';

const root = new URL('./', import.meta.url);
const fixture = JSON.parse(await fs.readFile('/tmp/dd-bug008-browser-private.json', 'utf8'));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const rows = [];
async function contextFor(token, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  if (token)
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
  return context;
}
async function fitted(page) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(result.document <= result.width, JSON.stringify(result));
  return result;
}
async function api(path, token, options = {}) {
  return fetch(`http://localhost:4018${path}`, {
    ...options,
    headers: { ...options.headers, ...(token ? { Cookie: `dd_session=${token}` } : {}) },
  });
}
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await contextFor(fixture.adminToken, width);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto('http://localhost:3009/admin/dealers');
    const nav = page.getByRole('navigation', { name: 'Admin console', exact: true });
    await nav.getByRole('link', { name: 'Listings', exact: true }).click();
    await page.waitForURL('**/admin/listings');
    await nav.getByRole('link', { name: 'Enquiries', exact: true }).click();
    await page.waitForURL('**/admin/enquiries');
    await page
      .getByPlaceholder('Customer, mobile, dealer, car or plate')
      .fill(fixture.car.registrationNumber ?? fixture.car.plate ?? 'KL41MO');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.waitForURL('**q=**');
    const action = page.locator(`a[href="/admin/enquiries/${fixture.enquiryId}"]`);
    await action.waitFor();
    const table = page.locator('table').first();
    const scroll = await table.evaluate((element) => {
      const container = element.parentElement;
      container.scrollLeft = container.scrollWidth;
      return {
        scrollLeft: container.scrollLeft,
        viewportWidth: container.clientWidth,
        contentWidth: container.scrollWidth,
      };
    });
    await action.scrollIntoViewIfNeeded();
    const box = await action.boundingBox();
    assert.ok(
      box.x >= 0 && box.x + box.width <= width + 1,
      'View must be reachable inside contained table scroll',
    );
    await fitted(page);
    if (width === 390)
      await page.screenshot({
        path: new URL('evidence/screenshots/fixed-enquiry-actions-scrolled-390.png', root).pathname,
      });
    await action.click();
    await page.waitForURL(`**/admin/enquiries/${fixture.enquiryId}`);
    await page.getByText('Admin mobile regression fixture', { exact: true }).waitFor();
    const detail = await fitted(page);
    await page.goto('http://localhost:3009/admin/dealers');
    await page.locator('.seg').evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const rejected = page.getByRole('link', { name: 'Rejected', exact: false });
    await rejected.scrollIntoViewIfNeeded();
    const rejectedBox = await rejected.boundingBox();
    assert.ok(rejectedBox.x >= 0 && rejectedBox.x + rejectedBox.width <= width + 1);
    await rejected.click();
    await page.waitForURL('**status=REJECTED**');
    await fitted(page);
    rows.push({
      scenario: 'navigation-search-contained-table-view-detail-status-tab',
      width,
      result: 'PASS',
      scroll,
      detail,
    });
    await context.close();
  }
  for (const width of [320, 390, 768]) {
    const context = await contextFor(fixture.longAdminToken, width);
    const page = await context.newPage();
    await page.goto('http://localhost:3009/admin/enquiries');
    await page.getByRole('navigation', { name: 'Admin console', exact: true }).waitFor();
    const geometry = await fitted(page);
    const signOut = await page.getByRole('button', { name: 'Sign out', exact: true }).boundingBox();
    assert.ok(signOut.x >= 0 && signOut.x + signOut.width <= width + 1);
    if (width === 320)
      await page.screenshot({
        path: new URL('evidence/screenshots/fixed-long-email-320.png', root).pathname,
      });
    rows.push({
      scenario: 'long-email-granted-moderator-controls',
      width,
      result: 'PASS',
      geometry,
    });
    await context.close();
  }
  for (const [role, token] of [
    ['anonymous', null],
    ['customer', fixture.customerToken],
    ['dealer-owner', fixture.ownerToken],
    ['expired-admin', fixture.expiredAdminToken],
  ]) {
    const responses = [];
    for (const path of [
      '/v1/admin/metrics/overview',
      '/v1/admin/dealers',
      '/v1/admin/listings',
      '/v1/admin/enquiries',
      `/v1/admin/enquiries/${fixture.enquiryId}`,
    ]) {
      const response = await api(path, token);
      assert.equal(response.status, 401, `${role} must be refused by ${path}`);
      responses.push({ path, status: response.status });
    }
    const context = await contextFor(token, 390);
    const page = await context.newPage();
    await page.goto('http://localhost:3009/admin/enquiries');
    assert.equal(new URL(page.url()).pathname, '/admin/login');
    rows.push({
      scenario: 'server-and-browser-denial',
      role,
      result: 'PASS',
      responses,
      redirect: '/admin/login',
    });
    await context.close();
  }
  const revokedContext = await contextFor(fixture.longAdminToken, 390);
  const revokedPage = await revokedContext.newPage();
  await revokedPage.goto('http://localhost:3009/admin/enquiries');
  await revokedPage.getByRole('heading', { name: 'Enquiries', exact: true }).waitFor();
  const revoked = await api(`/v1/admin/access/${fixture.longOperatorId}`, fixture.adminToken, {
    method: 'DELETE',
  });
  assert.equal(revoked.status, 204);
  assert.equal((await api('/v1/admin/enquiries', fixture.longAdminToken)).status, 401);
  await revokedPage.reload();
  assert.equal(new URL(revokedPage.url()).pathname, '/admin/login');
  rows.push({
    scenario: 'revoked-granted-admin-existing-tab-refresh',
    result: 'PASS',
    revoke: 204,
    staleApi: 401,
    redirect: '/admin/login',
  });
  await revokedContext.close();
  const logoutContext = await contextFor(fixture.logoutAdminToken, 320);
  const logoutPage = await logoutContext.newPage();
  await logoutPage.goto('http://localhost:3009/admin/enquiries');
  await logoutPage.getByRole('button', { name: 'Sign out', exact: true }).click();
  await logoutPage.waitForURL('**/admin/login');
  assert.equal((await api('/v1/admin/metrics/overview', fixture.logoutAdminToken)).status, 401);
  await logoutPage.goto('http://localhost:3009/admin/enquiries');
  assert.equal(new URL(logoutPage.url()).pathname, '/admin/login');
  rows.push({
    scenario: 'mobile-sign-out-and-stale-cookie-denial',
    width: 320,
    result: 'PASS',
    staleApi: 401,
  });
  await logoutContext.close();
} finally {
  await browser.close();
  await fs.writeFile(
    new URL('evidence/browser-uat.json', root),
    JSON.stringify(
      { sha, rows, result: rows.length === 13 ? 'PASS' : 'INCOMPLETE', humanUat: 'PENDING' },
      null,
      2,
    ) + '\n',
  );
}
assert.equal(rows.length, 13);
console.log(
  'Admin UAT13 scenarios PASS;20 negative direct endpoints; real logout/access revocation and stale tabs.',
);
