import { chromium } from '/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const stage = process.argv[2] ?? 'pre-pr';
const out = `/tmp/dd-campaign-evidence/docs/testing/implementation-campaign/pr-04-service-locations/${stage}`;
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile('/tmp/dd-campaign-pr04-private-session.json', 'utf8'));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const results = [];
const errors = [];
async function authenticated(role, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addCookies([{ name: 'dd_session', value: fixture[role], domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  return context;
}
async function phoneProof(page, context, phone) {
  await page.locator('#assisted-phone').fill(phone); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send OTP', exact: true }).click();
  const digits = page.getByLabel(/^Digit /); await digits.first().waitFor();
  const widget = await context.request.get('http://127.0.0.1:4001/v1/sales/phone/widget'); assert.equal(widget.status(), 200);
  const { devCode } = await widget.json();
  for (let i = 0; i < devCode.length; i++) await digits.nth(i).fill(devCode[i]);
  await page.getByRole('button', { name: /Verify/, exact: false }).click();
  await page.getByRole('button', { name: 'Continue to dealership details' }).click();
}
const masks = (page) => [page.locator('[name=email]'), page.locator('[name=pan]'), page.locator('[name=gstin]'), page.getByText(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/), page.getByText(/\+91[0-9 -]{10,}/)];
async function checkDistrict(context, id, predicate) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const response = await context.request.get('http://127.0.0.1:4001/v1/admin/service-locations');
    assert.equal(response.status(), 200);
    const body = await response.json(); const district = body.data.flatMap((item) => item.districts).find((item) => item.id === id);
    if (predicate(district)) return district;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Saved configuration did not persist.');
}
for (const [index, width] of [320, 390, 768, 1280].entries()) {
  const context = await authenticated('sales', width); const page = await context.newPage();
  page.on('pageerror', (error) => errors.push({ width, message: error.message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted]') }));
  const response = await page.goto('http://127.0.0.1:3001/sales/dealers/new', { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
  await phoneProof(page, context, `${stage === 'pre-pr' ? '9000040' : stage === 'pre-pr-final' ? '9000042' : '9000041'}${String(index).padStart(3, '0')}`);
  const state = page.locator('#assisted-state'); await state.waitFor();
  await page.waitForFunction(() => !document.querySelector('#assisted-state').disabled);
  assert.deepEqual(await state.locator('option').allTextContents(), ['Select state', 'Tamil Nadu']);
  await state.selectOption('Tamil Nadu'); assert.equal(await state.inputValue(), 'Tamil Nadu');
  const district = page.getByRole('combobox', { name: 'District' }); await district.click();
  assert.equal(await page.getByRole('listbox', { name: 'Districts' }).getByRole('option').count(), 38);
  await district.fill('Cheng'); await district.press('Enter'); assert.equal(await district.inputValue(), 'Chengalpattu');
  assert.equal(await page.locator('input[name=district]').inputValue(), 'Chengalpattu');
  await district.fill('Vell'); await page.getByRole('button', { name: 'Vellore', exact: true }).click();
  assert.equal(await district.inputValue(), 'Vellore');
  await state.scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert.equal(overflow, false);
  await page.screenshot({ path: `${out}/assisted-locations-${width}.png`, mask: masks(page), maskColor: '#e5e7eb' });
  await district.click(); await district.fill('Vell');
  await page.screenshot({ path: `${out}/district-search-${width}.png`, mask: masks(page), maskColor: '#e5e7eb' });
  await page.getByRole('button', { name: 'Vellore', exact: true }).click();
  if (width === 1280) {
    const fields = { contactName: 'Synthetic Location Representative', email: `qa-browser-${stage}-locations@example.test`, legalName: `Synthetic Location ${stage} Dealer`, addressLine: 'Synthetic QA Street', city: 'Katpadi', pincode: '632001', mapsUrl: 'https://www.google.com/maps?q=12.98,79.15', tagline: 'Synthetic location profile for isolated browser testing.' };
    for (const [name, value] of Object.entries(fields)) await page.locator(`[name="${name}"]`).fill(value);
    await page.locator('#assisted-specialities').fill('Hatchbacks'); await page.locator('#assisted-specialities').press('Enter');
    await page.getByRole('button', { name: 'Create dealership' }).click(); await page.waitForURL(/\/sales\/dealers\/[0-9a-f-]+$/);
    const id = page.url().split('/').at(-1); const saved = await context.request.get(`http://127.0.0.1:4001/v1/sales/dealers/${id}`); assert.equal(saved.status(), 200);
    const detail = await saved.json(); const address = detail.dealer?.address ?? detail.profile?.address ?? detail.address;
    assert.equal(address.state, 'Tamil Nadu'); assert.equal(address.district, 'Vellore'); assert.equal(address.city, 'Katpadi');
    results.push({ width, persistedRegistration: true, canonicalAddress: { state: address.state, district: address.district, city: address.city } });
  }
  results.push({ width, permittedStates: ['Tamil Nadu'], districtCount: 38, keyboardSelection: true, firstSelectionVisible: true, overflow });
  await context.close();
  const adminContext = await authenticated('admin', width); const adminPage = await adminContext.newPage();
  const adminResponse = await adminPage.goto('http://127.0.0.1:3001/admin/config', { waitUntil: 'networkidle' }); assert.equal(adminResponse.status(), 200);
  const section = adminPage.getByRole('region', { name: 'Service Locations' });
  await section.getByRole('heading', { name: 'Service Locations' }).scrollIntoViewIfNeeded();
  assert.equal(await adminPage.locator('#configured-state option').count(), 36);
  const bounds = await section.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
  await adminPage.screenshot({ path: `${out}/admin-service-locations-${width}.png`, mask: masks(adminPage), maskColor: '#e5e7eb' });
  if (width === 1280) {
    const row = section.locator('form').filter({ hasText: 'Ariyalur' });
    await row.getByLabel('Photography coverage').uncheck(); await row.getByRole('button', { name: 'Save district' }).click();
    const changed = await checkDistrict(adminContext, 'IN-TN-ARIYALUR', (item) => item.photographyAvailable === false);
    assert.equal(changed.onboardingEnabled, true);
    await row.getByLabel('Photography coverage').waitFor();
    await adminPage.screenshot({ path: `${out}/independent-photography-setting.png`, mask: masks(adminPage), maskColor: '#e5e7eb' });
    await row.getByLabel('Photography coverage').check(); await row.getByRole('button', { name: 'Save district' }).click();
    await checkDistrict(adminContext, 'IN-TN-ARIYALUR', (item) => item.photographyAvailable === true);
    const vellore = section.locator('form').filter({ hasText: 'Vellore' });
    await vellore.getByLabel('New onboarding').uncheck(); await vellore.getByRole('button', { name: 'Save district' }).click();
    await checkDistrict(adminContext, 'IN-TN-VELLORE', (item) => item.onboardingEnabled === false);
    const publicResponse = await adminContext.request.get('http://127.0.0.1:4001/v1/service-locations');
    const publicData = await publicResponse.json(); assert.equal(publicData.data[0].districts.length, 37);
    await vellore.getByLabel('New onboarding').check(); await vellore.getByRole('button', { name: 'Save district' }).click();
    await checkDistrict(adminContext, 'IN-TN-VELLORE', (item) => item.onboardingEnabled === true);
    await adminPage.getByText('Configuration audit history', { exact: true }).click();
    await adminPage.getByText('Configuration audit history', { exact: true }).scrollIntoViewIfNeeded();
    await adminPage.screenshot({ path: `${out}/configuration-audit-history.png`, mask: masks(adminPage), maskColor: '#e5e7eb' });
    results.push({ width, actualConfigurationPersistence: true, photographyIndependent: true, availabilityReflectedImmediately: true });
  }
  results.push({ width, adminConfiguredStates: 36, serviceLocationSectionFitsViewport: true });
  await adminContext.close();
}
const publicContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
for (const route of ['/dealers?district=vellore', '/cars?district=vellore']) {
  const page = await publicContext.newPage(); const response = await page.goto(`http://127.0.0.1:3001${route}`, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.close();
}
assert.equal(errors.length, 0);
await writeFile(`${out}/browser-results.json`, JSON.stringify({ stage, browser: browser.version(), results, runtimeErrors: errors, publicLocationRoutes: 'PASS', privacy: 'Synthetic local fixtures only. OTPs, sessions and personal identifier fields excluded from evidence.' }, null, 2));
await publicContext.close(); await browser.close(); console.log('Canonical onboarding, responsive selectors, saved admin configuration, audit UI and public filter routes passed.');
