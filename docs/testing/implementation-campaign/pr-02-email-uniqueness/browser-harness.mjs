import { chromium } from '/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture = JSON.parse(await readFile('/tmp/dd-campaign-pr02-private-session.json', 'utf8'));
const stage = process.argv[2] ?? 'pre-pr';
const out = `/tmp/dd-campaign-evidence/docs/testing/implementation-campaign/pr-02-email-uniqueness/${stage}`;
await mkdir(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const results = [];
for (const width of [320, 390, 768, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addCookies([
    {
      name: 'dd_session',
      value: fixture.token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  const response = await page.goto('http://127.0.0.1:3001/sales/dealers/new', {
    waitUntil: 'networkidle',
  });
  assert.equal(response.status(), 200);
  await page.locator('#assisted-phone').fill(fixture.phone);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send OTP', exact: true }).click();
  const digits = page.getByLabel(/^Digit /);
  await digits.first().waitFor();
  const widget = await context.request.get('http://127.0.0.1:4001/v1/sales/phone/widget');
  assert.equal(widget.status(), 200);
  const { devCode } = await widget.json();
  assert.equal(typeof devCode, 'string');
  for (let i = 0; i < devCode.length; i++) await digits.nth(i).fill(devCode[i]);
  await page.getByRole('button', { name: /Verify/, exact: false }).click();
  await page.getByRole('button', { name: 'Continue to dealership details' }).click();
  const fields = {
    contactName: 'Synthetic Representative',
    email: ` ${fixture.existingEmail.toUpperCase()} `,
    legalName: `Synthetic Browser Dealer ${width}`,
    addressLine: '1, Example Street',
    city: 'Katpadi',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632007',
    mapsUrl: 'https://www.google.com/maps?q=12.98,79.15',
    tagline: 'Synthetic dealership registration for isolated QA.',
    gstin: '33ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
  };
  for (const [name, value] of Object.entries(fields))
    await page.locator(`[name="${name}"]`).fill(value);
  const service = page.locator('#assisted-specialities');
  await service.fill('Hatchbacks');
  await service.press('Enter');
  await page.getByRole('button', { name: 'Create dealership' }).click();
  await page
    .getByText(/already associated with a dealer account/)
    .first()
    .waitFor();
  assert.equal(await page.locator('[name=email]').getAttribute('aria-invalid'), 'true');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
  const masks = [
    page.locator('[name=pan]'),
    page.locator('[name=gstin]'),
    page.getByText(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/),
  ];
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `${out}/duplicate-error-${width}.png`,
    fullPage: true,
    mask: masks,
  });
  await page.locator('[name=email]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/duplicate-error-viewport-${width}.png`, mask: masks });
  await page.getByRole('button', { name: 'Verify mobile again' }).click();
  await page.getByRole('button', { name: 'Send OTP', exact: true }).click();
  await digits.first().waitFor();
  for (let i = 0; i < devCode.length; i++) await digits.nth(i).fill(devCode[i]);
  await page.getByRole('button', { name: /Verify/, exact: false }).click();
  await page.getByRole('button', { name: 'Continue to dealership details' }).click();
  assert.equal(await page.locator('[name=legalName]').inputValue(), fields.legalName);
  assert.equal(await page.locator('[name=email]').inputValue(), fields.email.trim());
  results.push({
    width,
    route: '/sales/dealers/new',
    duplicateError: true,
    emailInvalid: true,
    overflow,
    detailsPreservedAfterRenewal: true,
  });
  await context.close();
}
await writeFile(
  `${out}/browser-results.json`,
  JSON.stringify(
    {
      stage,
      browser: browser.version(),
      results,
      privacy:
        'Synthetic database only; government identifier fields/contact text masked; session file and OTP values excluded.',
    },
    null,
    2,
  ),
);
await browser.close();
console.log('Actual API duplicate-email feedback and proof renewal passed across four viewports.');
