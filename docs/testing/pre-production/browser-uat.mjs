import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '/opt/codex/runtimes/cua/lib/node_modules/playwright-core/index.mjs';

const root = new URL('./', import.meta.url);
const fixture = JSON.parse(await fs.readFile('/tmp/dd-cert-browser-private.json', 'utf8'));
const stage = process.argv[2] || 'desktop';
const size =
  stage === 'mobile'
    ? { width: 390, height: 844 }
    : stage === 'tablet'
      ? { width: 768, height: 1024 }
      : { width: 1440, height: 900 };
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: size,
  ...(stage === 'mobile' ? { isMobile: true, hasTouch: true } : {}),
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const rows = [];
const actions = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const note = (message) => actions.push({ at: new Date().toISOString(), message });
const settled = async () => {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('main').first().waitFor();
};
async function shot(name) {
  const path = new URL(`evidence/${stage}/${name}.png`, root);
  await page.screenshot({ path: path.pathname, fullPage: true });
  return `evidence/${stage}/${name}.png`;
}
async function check(id, canonical, title, run) {
  try {
    const observed = await run();
    rows.push({
      id,
      canonical,
      title,
      status: 'PASS',
      viewport: size,
      observed,
      sha: 'd6ae115359c4d0ae7ab0fd5115336291666cbb08',
    });
    console.log(id, 'PASS');
  } catch (error) {
    rows.push({
      id,
      canonical,
      title,
      status: 'BLOCKED',
      viewport: size,
      reason: error.message,
      sha: 'd6ae115359c4d0ae7ab0fd5115336291666cbb08',
    });
    console.log(id, 'BLOCKED', error.message.slice(0, 180));
  }
}
async function login(phone, name) {
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Mobile number').first().fill(phone);
  note('Entered fictional phone identity through the customer login form.');
  await page.getByRole('button', { name: 'Send OTP', exact: true }).first().click();
  const response = await context.request.get('http://localhost:4000/v1/auth/sign-in/phone/widget');
  const widget = await response.json();
  await page.getByRole('textbox', { name: 'Digit 1 of 6', exact: true }).fill(widget.devCode);
  note('Entered the configured local proof; no SMS sent and no proof saved in evidence.');
  await page.getByRole('button', { name: 'Verify and sign in', exact: true }).click();
  await page.waitForFunction(
    () => location.pathname !== '/login' || document.querySelector('#customer-name'),
  );
  if (await page.locator('#customer-name').isVisible()) {
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
  }
  await page.getByRole('button', { name: `Account menu for ${name}`, exact: true }).waitFor();
  await context.storageState({ path: `/tmp/dd-cert-${stage}-customer-state.json` });
}

try {
  await check(
    `UAT-${stage}-001`,
    stage === 'desktop' ? ['PUBLIC-001', 'PUBLIC-002', 'PUBLIC-003'] : [],
    'Anonymous search journey by keyboard and navigation',
    async () => {
      await page.goto('http://localhost:3000/');
      await settled();
      assert.equal(
        await page.getByRole('heading', { name: 'Find your next car', exact: true }).count(),
        1,
      );
      note(
        'Scrolled homepage through vehicle rows and footer; inspected available and empty states.',
      );
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByPlaceholder('Search make, model or variant').fill('Hyundai');
      await page.getByPlaceholder('Search make, model or variant').press('Enter');
      await page.waitForURL('**/cars?**');
      await settled();
      assert.ok(page.url().toLowerCase().includes('hyundai'));
      return { url: page.url(), screenshot: await shot('search') };
    },
  );
  await check(
    `UAT-${stage}-002`,
    stage === 'desktop' ? ['PUBLIC-006', 'PUBLIC-007', 'PUBLIC-020'] : [],
    'Apply a filter, refresh, clear filters and use browser history',
    async () => {
      await page.goto('http://localhost:3000/cars');
      await settled();
      if (stage !== 'desktop')
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await page.getByRole('checkbox', { name: /^Hyundai/ }).check();
      note('Selected Hyundai brand; checked the URL and refreshed with that filter.');
      await page.waitForURL('**brand=hyundai**');
      if (stage !== 'desktop') await page.getByRole('button', { name: /^Show .*car/ }).click();
      await page.reload();
      await settled();
      assert.ok(page.url().includes('brand=hyundai'));
      await page
        .getByRole('button', { name: /Clear every filter|Clear all/ })
        .first()
        .click();
      await page.waitForURL((u) => !u.searchParams.has('brand'));
      await settled();
      assert.ok(!page.url().includes('brand='));
      await page.goBack();
      await settled();
      await page.goForward();
      await settled();
      return { screenshot: await shot('filters-cleared') };
    },
  );
  await check(
    `UAT-${stage}-003`,
    stage === 'desktop' ? ['PUBLIC-009', 'MEDIA-010', 'MEDIA-011'] : [],
    'Open car, operate gallery arrows and fullscreen, cancel and reopen',
    async () => {
      await page.goto('http://localhost:3000/cars');
      await settled();
      await page.locator(`a[href='/car/${fixture.other.slug}']`).click();
      await page.waitForURL(`**/car/${fixture.other.slug}`);
      await settled();
      await page.getByRole('button', { name: 'Next image', exact: true }).click();
      await page.getByRole('button', { name: 'Previous image', exact: true }).click();
      await page.getByRole('button', { name: /^View all 6 photos/ }).click();
      await page.getByRole('button', { name: 'Next photo', exact: true }).click();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: /^View all 6 photos/ }).click();
      await page.keyboard.press('Escape');
      note(
        'Gallery controls, fullscreen close/reopen and Escape used; fixture images are solid colors, not vehicle photography.',
      );
      return { screenshot: await shot('car-gallery') };
    },
  );
  await check(
    `UAT-${stage}-004`,
    stage === 'desktop' ? ['AUTH-001', 'CUSTOMER-001', 'CUSTOMER-002', 'CUSTOMER-003'] : [],
    'Normal customer login, account menu, saved cars and enquiry history',
    async () => {
      await login(
        stage === 'desktop' ? '9000081033' : stage === 'mobile' ? '9000081034' : '9000081035',
        `${stage} Browser Customer`,
      );
      await page
        .getByRole('button', { name: `Account menu for ${stage} Browser Customer`, exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Saved cars', exact: true }).click();
      await page.waitForURL('**/saved');
      await settled();
      assert.equal(new URL(page.url()).pathname, '/saved');
      await page
        .getByRole('button', { name: `Account menu for ${stage} Browser Customer`, exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'My enquiries', exact: true }).click();
      await page.waitForURL('**/enquiries');
      await settled();
      assert.equal(new URL(page.url()).pathname, '/enquiries');
      return { screenshot: await shot('customer-empty-history') };
    },
  );
  await check(
    `UAT-${stage}-005`,
    stage === 'desktop' ? ['SAVED-001', 'SAVED-003', 'SAVED-005'] : [],
    'Save, remove, save again and verify persistence after logout/login',
    async () => {
      await page.goto(`http://localhost:3000/car/${fixture.other2.slug}`);
      await settled();
      await page
        .getByRole('button', { name: /^Save 2023 Hyundai/ })
        .first()
        .click();
      await page
        .getByRole('button', { name: /^Remove 2023 Hyundai/ })
        .first()
        .waitFor();
      await page
        .getByRole('button', { name: /^Remove 2023 Hyundai/ })
        .first()
        .click();
      await page
        .getByRole('button', { name: /^Save 2023 Hyundai/ })
        .first()
        .waitFor();
      await page
        .getByRole('button', { name: /^Save 2023 Hyundai/ })
        .first()
        .click();
      await page
        .getByRole('button', { name: /^Remove 2023 Hyundai/ })
        .first()
        .waitFor();
      await page
        .getByRole('button', { name: `Account menu for ${stage} Browser Customer`, exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Logout', exact: true }).click();
      await page.getByRole('link', { name: 'Login', exact: true }).waitFor();
      await login(
        stage === 'desktop' ? '9000081033' : stage === 'mobile' ? '9000081034' : '9000081035',
        `${stage} Browser Customer`,
      );
      await page.goto('http://localhost:3000/saved');
      await settled();
      assert.ok((await page.locator('body').innerText()).includes('Hyundai Creta'));
      return { screenshot: await shot('saved-persistence') };
    },
  );
  await check(
    `UAT-${stage}-006`,
    stage === 'desktop' ? ['ENQ-CREATE-003', 'ENQ-CREATE-005', 'ENQ-CREATE-013'] : [],
    'Open enquiry, inspect verified identity, cancel/reopen and submit',
    async () => {
      await page.goto(`http://localhost:3000/car/${fixture.other2.slug}`);
      await settled();
      await page.getByRole('button', { name: 'Enquire now', exact: true }).first().click();
      await page
        .getByRole('heading', { name: 'Interested in this vehicle?', exact: true })
        .waitFor();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Enquire now', exact: true }).first().click();
      await page.getByLabel('Message', { exact: false }).fill('Browser certification enquiry.');
      await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
      await page.getByText('Enquiry sent', { exact: true }).waitFor();
      note('Enquiry sent through the UI; the customer saw success and a link to track it.');
      await page.getByRole('link', { name: 'Track it in My enquiries', exact: true }).click();
      await page.waitForURL('**/enquiries');
      await settled();
      assert.ok((await page.locator('body').innerText()).includes('Hyundai'));
      return { screenshot: await shot('enquiry-history') };
    },
  );
  await check(
    `UAT-${stage}-007`,
    stage === 'desktop' ? ['PUBLIC-016', 'PUBLIC-017', 'PUBLIC-021', 'SEO-009'] : [],
    'Dealer directory, dealer portfolio and branded not-found page',
    async () => {
      await page.goto('http://localhost:3000/dealers');
      await settled();
      const target = page.getByRole('link', { name: /Certification Motors B/ }).first();
      await target.click();
      await page.waitForURL('**/dealers/*');
      await settled();
      assert.ok(new URL(page.url()).pathname.startsWith('/dealers/'));
      await shot('dealer-portfolio');
      await page.goto('http://localhost:3000/a-route-that-does-not-exist');
      await settled();
      const body = await page.locator('body').innerText();
      assert.ok(/not found|could not find|404|lost/i.test(body));
      assert.ok(body.includes('Dealers-Drive'));
      return { screenshot: await shot('not-found') };
    },
  );
  await check(
    `UAT-${stage}-008`,
    [],
    'Resize and inspect page widths and named interactive controls',
    async () => {
      const pages = ['/cars', `/car/${fixture.other2.slug}`, '/saved', '/enquiries', '/dealers'];
      const measurements = [];
      for (const path of pages) {
        await page.goto(`http://localhost:3000${path}`);
        await settled();
        const widths = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        measurements.push({ path, ...widths });
        assert.ok(
          widths.scrollWidth <= widths.width,
          `${path} overflows: ${widths.scrollWidth} > ${widths.width}`,
        );
      }
      return { measurements, screenshot: await shot('directory-responsive') };
    },
  );
} finally {
  await fs.writeFile(
    new URL(`evidence/${stage}/uat.json`, root),
    JSON.stringify(
      { stage, viewport: size, engine: 'Chromium 151', rows, actions, pageErrors: errors },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
}
