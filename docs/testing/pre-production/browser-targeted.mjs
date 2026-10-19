import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '/opt/codex/runtimes/cua/lib/node_modules/playwright-core/index.mjs';

const root = new URL('./', import.meta.url);
const fixture = JSON.parse(await fs.readFile('/tmp/dd-cert-browser-private.json', 'utf8'));
const roles = JSON.parse(await fs.readFile('/tmp/dd-cert-role-browser-private.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const rows = [];
const sha = 'd6ae115359c4d0ae7ab0fd5115336291666cbb08';
async function check(id, canonical, run) {
  try {
    rows.push({ id, canonical, status: 'PASS', observed: await run(), sha });
  } catch (error) {
    rows.push({ id, canonical, status: 'BLOCKED', reason: error.message, sha });
  }
  console.log(id, rows.at(-1).status);
}
async function screenshot(page, folder, name) {
  const path = `evidence/${folder}/${name}.png`;
  await page.screenshot({ path: new URL(path, root).pathname, fullPage: true });
  return path;
}
for (const [stage, width, height] of [
  ['desktop', 1440, 900],
  ['tablet', 768, 1024],
  ['mobile', 390, 844],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    storageState: `/tmp/dd-cert-${stage}-customer-state.json`,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await check(`TARGET-${stage}-customer`, [], async () => {
    await page.goto(`http://localhost:3000/car/${fixture.other3.slug}`);
    await page.getByRole('button', { name: /^Account menu for/ }).waitFor();
    await page.getByRole('button', { name: 'Enquire now', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Interested in this vehicle?', exact: true }).waitFor();
    const form = page.getByRole('form', { name: 'Interested in this vehicle?' });
    assert.ok((await form.innerText()).includes('Verified'));
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Enquire now', exact: true }).first().click();
    await page
      .getByPlaceholder('Ask about the car, or when you can visit.')
      .fill(`${stage} isolated browser enquiry.`);
    await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
    await page.getByText('Enquiry sent', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Track it in My enquiries', exact: true }).click();
    await page.waitForURL('**/enquiries');
    await page.getByText('Hyundai Creta', { exact: false }).first().waitFor();
    return {
      method: 'BROWSER_WITH_PREVIOUSLY_AUTHENTICATED_STATE',
      screenshot: await screenshot(page, stage, 'targeted-enquiry'),
    };
  });
  await check(`TARGET-${stage}-404`, ['PUBLIC-021', 'SEO-009'], async () => {
    const response = await page.goto('http://localhost:3000/a-route-that-does-not-exist');
    const body = await page.locator('body').innerText();
    const customBrand = body.includes('Dealers-Drive');
    const observation = {
      http: response.status(),
      customBrand,
      visibleText: body.slice(0, 900),
      screenshot: await screenshot(page, stage, 'not-found'),
    };
    if (!customBrand) {
      rows.push({
        id: `UI-DISC-001-${stage}`,
        canonical: ['PUBLIC-021', 'SEO-009'],
        status: 'FAIL',
        observed: observation,
        sha,
      });
    }
    assert.equal(response.status(), 404);
    return observation;
  });
  await context.close();
}
for (const role of ['OWNER', 'MANAGER', 'STAFF']) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addCookies([
    {
      name: 'dd_session',
      value: roles[role].token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await check(`TARGET-${role}-workspace`, [], async () => {
    await page.goto('http://localhost:3000/');
    await page
      .getByRole('button', { name: `Account menu for ${roles[role].name}`, exact: true })
      .click();
    await page
      .getByRole('menuitem', {
        name: new RegExp(`Dealer dashboard.*${role[0]}${role.slice(1).toLowerCase()}`),
      })
      .click();
    await page.waitForURL('**/dealer');
    await page.getByRole('heading').first().waitFor();
    const measurements = [];
    for (const path of ['/dealer', '/dealer/inventory', '/dealer/enquiries']) {
      await page.goto(`http://localhost:3000${path}`);
      await page.getByRole('heading').first().waitFor();
      measurements.push({
        path,
        ...(await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))),
      });
      await screenshot(page, `dealer-${role.toLowerCase()}`, path.split('/').at(-1));
    }
    assert.ok(measurements.every((m) => m.scrollWidth <= m.width));
    return { method: 'CUSTOMER_SCOPE_FIXTURE_THEN_UI_WORKSPACE_SWITCH', measurements };
  });
  if (role === 'OWNER')
    await check('TARGET-OWNER-team', [], async () => {
      await page.goto('http://localhost:3000/dealer/team');
      await page.getByRole('button', { name: 'Invite member', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await page.getByLabel('Mobile number').fill('9000081998');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Invite member', exact: true }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      return { screenshot: await screenshot(page, 'dealer-owner', 'team-cancel-reopen') };
    });
  if (role === 'STAFF')
    await check('TARGET-STAFF-draft', [], async () => {
      await page.goto('http://localhost:3000/dealer/vehicles/new');
      await page.getByLabel('Registration number', { exact: false }).fill('TN22QA8195');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Save draft', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await page
        .getByText('Draft saved. You can come back to it at any time.', { exact: true })
        .waitFor();
      await page.reload();
      return {
        url: new URL(page.url()).pathname,
        screenshot: await screenshot(page, 'dealer-staff', 'draft-saved-refreshed'),
      };
    });
  await context.close();
}
const admin = await browser.newContext({ viewport: { width: 390, height: 844 } });
await admin.addCookies([
  {
    name: 'dd_session',
    value: fixture.adminCookie,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  },
]);
const adminPage = await admin.newPage();
adminPage.setDefaultTimeout(10000);
await check('TARGET-ADMIN-views', [], async () => {
  const measurements = [];
  for (const path of ['/admin/dealers', '/admin/listings', '/admin/enquiries']) {
    await adminPage.goto(`http://localhost:3000${path}`);
    await adminPage.getByRole('heading').first().waitFor();
    assert.ok(new URL(adminPage.url()).pathname.startsWith('/admin/'));
    measurements.push({
      path,
      ...(await adminPage.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))),
    });
    await screenshot(adminPage, 'admin', path.split('/').at(-1));
  }
  return { method: 'SCOPED_ADMIN_FIXTURE_NOT_REAL_GOOGLE_SIGN_IN', measurements };
});
await admin.close();
await fs.writeFile(
  new URL('evidence/targeted-browser.json', root),
  JSON.stringify(rows, null, 2) + '\n',
);
await browser.close();
