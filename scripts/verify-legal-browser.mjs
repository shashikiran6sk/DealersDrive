import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modules =
  process.env.LEGAL_BROWSER_MODULES ?? '/private/tmp/dealersdrive-legal-browser/node_modules';
const { chromium } = await import(pathToFileURL(resolve(modules, 'playwright/index.mjs')).href);
const axe = await readFile(resolve(modules, 'axe-core/axe.min.js'), 'utf8');
const preview = process.env.LEGAL_PREVIEW_URL ?? 'http://127.0.0.1:3120';
const production = process.env.LEGAL_PRODUCTION_URL ?? 'http://127.0.0.1:3121';
const sandbox = process.env.LEGAL_SANDBOX_URL ?? 'http://127.0.0.1:6006';
for (const value of [preview, production, sandbox]) {
  assert.ok(
    ['127.0.0.1', 'localhost'].includes(new URL(value).hostname),
    'Only local test servers are permitted.',
  );
}
const output = resolve('docs/testing/legal-consent/2026-10-13');
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  bypassCSP: true,
});
const external = [];
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    external.push(url.origin);
    await route.abort();
  } else await route.continue();
});
const page = await context.newPage();
async function check(name, test) {
  try {
    await test();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({ name, status: 'failed', error: error.message });
  }
}
async function accessibility(selector) {
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async (selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing accessibility root: ${selector}`);
    const result = await globalThis.axe.run(element, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    });
    return result.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((node) => node.target),
    }));
  }, selector);
  assert.deepEqual(violations, []);
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
}
try {
  for (const [route, title] of [
    ['/terms', 'Terms & Conditions'],
    ['/privacy', 'Privacy Policy'],
  ]) {
    for (const width of [375, 768, 1024, 1280]) {
      await check(
        `${route}: anonymous content, anchors, layout and WCAG at ${width}px`,
        async () => {
          await page.setViewportSize({ width, height: 900 });
          const response = await page.goto(preview + route, { waitUntil: 'networkidle' });
          assert.equal(response.status(), 200);
          assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), title);
          assert.match(await page.locator('article').textContent(), /Draft for review/);
          assert.equal(
            await page
              .locator('article')
              .evaluate((article) =>
                Array.from(article.querySelectorAll('a[href^="#"]')).every(
                  (anchor) => article.querySelector(anchor.getAttribute('href')) !== null,
                ),
              ),
            true,
          );
          await noOverflow();
          await accessibility('article');
          if (width === 375 || width === 1280)
            await page.screenshot({
              path: resolve(output, `${route.slice(1)}-${width}.png`),
              fullPage: true,
            });
        },
      );
    }
  }
  for (const [route, target] of [
    ['/dealer-terms', '/terms#dealer-agreement'],
    ['/listing-policy', '/terms#listing-policy'],
    ['/grievance', '/terms#grievance'],
  ]) {
    await check(`${route}: permanent anchored redirect`, async () => {
      const response = await fetch(preview + route, { redirect: 'manual' });
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), target);
    });
  }
  for (const route of [
    '/legal/dealer/1.0-draft.1',
    '/legal/listing/1.0-draft.1',
    '/legal/terms/1.0-draft.1',
    '/legal/notices/certification/2.0-draft.1',
  ]) {
    await check(`${route}: historical content and valid policy link`, async () => {
      const response = await page.goto(preview + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      assert.match(await page.locator('article').textContent(), /Archived snapshot/);
      const link = page.getByRole('link', { name: 'Read the associated policy snapshot' });
      if (await link.count()) {
        const href = await link.getAttribute('href');
        assert.equal((await fetch(preview + href)).status, 200);
      }
    });
  }
  for (const route of [
    '/terms',
    '/privacy',
    '/legal/dealer/1.0-draft.1',
    '/legal/notices/enquiry/2.0-draft.1',
  ]) {
    await check(`${route}: production rejects unapproved draft`, async () =>
      assert.equal((await fetch(production + route)).status, 404),
    );
  }
  for (const [kind, prefix] of [
    ['account', 'I agree to the'],
    ['dealer', 'I am authorized to represent this dealership'],
  ]) {
    for (const width of [375, 1280]) {
      await check(
        `${kind}: one unticked sentence, keyboard, independent links and WCAG at ${width}px`,
        async () => {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`${sandbox}/iframe.html?id=forms-legalcheck--${kind}&viewMode=story`, {
            waitUntil: 'networkidle',
          });
          const box = page.getByRole('checkbox');
          await box.waitFor();
          assert.equal(await box.count(), 1);
          assert.equal(await box.isChecked(), false);
          assert.match(await box.getAttribute('aria-labelledby'), /label/);
          assert.match(
            await page.locator(`#${await box.getAttribute('aria-labelledby')}`).textContent(),
            new RegExp(prefix),
          );
          await box.focus();
          await page.keyboard.press('Space');
          assert.equal(await box.isChecked(), true);
          await page.getByRole('link', { name: 'Terms & Conditions' }).click();
          assert.equal(await box.isChecked(), true);
          assert.equal(
            await page.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href'),
            '/privacy',
          );
          await noOverflow();
          await accessibility('#storybook-root');
          if (width === 375)
            await page.screenshot({
              path: resolve(output, `${kind}-acceptance-mobile.png`),
              fullPage: true,
            });
        },
      );
    }
  }
  await check('reused permission: fresh submit without duplicate checkbox', async () => {
    await page.goto(
      `${sandbox}/iframe.html?id=vehicle-enquirypanel--reused-dealership-permission&viewMode=story`,
      { waitUntil: 'networkidle' },
    );
    await page.getByRole('button', { name: 'Send enquiry' }).waitFor();
    assert.equal(await page.getByRole('checkbox').count(), 0);
    assert.equal(await page.getByText('Fixture submission recorded.').count(), 0);
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await page.getByText('Fixture submission recorded.').waitFor();
    await noOverflow();
  });
  await check('owner review: exactly one dealership-binding control', async () => {
    await page.goto(
      `${sandbox}/iframe.html?id=auth-onboardingwizard--owner-legal-review&viewMode=story`,
      { waitUntil: 'networkidle' },
    );
    await page.getByRole('checkbox', { name: /authorized to represent/ }).waitFor();
    assert.equal(await page.locator('input[name="termsAccepted"]').count(), 1);
    assert.equal(await page.getByRole('checkbox').isChecked(), false);
    await noOverflow();
  });
  for (const width of [375, 1280]) {
    await check(
      `location: address, safe encoded directions, no iframe or Load Map at ${width}px`,
      async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${sandbox}/iframe.html?id=dealers-locationcard--default&viewMode=story`, {
          waitUntil: 'networkidle',
        });
        const link = page.getByRole('link', { name: 'Get Directions' });
        await link.waitFor();
        const url = new URL(await link.getAttribute('href'));
        assert.equal(url.searchParams.get('destination'), '12.9165,79.1325');
        assert.match(await link.getAttribute('rel'), /noopener/);
        assert.equal(await page.locator('iframe').count(), 0);
        assert.equal(await page.getByRole('button', { name: /Load.*Map/ }).count(), 0);
        assert.match(await page.locator('address').textContent(), /Katpadi Main Road/);
        await noOverflow();
        await accessibility('#storybook-root');
        if (width === 375)
          await page.screenshot({ path: resolve(output, 'directions-mobile.png') });
      },
    );
  }
  await check('no automatic third-party request', async () => assert.deepEqual(external, []));
} finally {
  await browser.close();
  const summary = {
    passed: results.filter((test) => test.status === 'passed').length,
    failed: results.filter((test) => test.status === 'failed').length,
    skipped: 0,
    browser: 'Chromium',
    tests: results,
  };
  await writeFile(resolve(output, 'BROWSER_RESULTS.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed) process.exitCode = 1;
}
