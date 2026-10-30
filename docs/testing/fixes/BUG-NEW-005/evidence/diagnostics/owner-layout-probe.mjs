import fs from 'node:fs/promises';
const { chromium } =
  await import('/opt/codex/runtimes/cua/lib/node_modules/playwright-core/index.mjs');
const fixtures = JSON.parse(await fs.readFile('/tmp/dd-new005-browser-private.json', 'utf8'));
const fixture = fixtures.cases.find((row) => row.width === 390);
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await context.addCookies([
    {
      name: 'dd_session',
      value: fixture.ownerToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  await page.goto('http://localhost:3008/dealer/onboarding', { waitUntil: 'networkidle' });
  const result = await page.evaluate(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    path: location.pathname,
    overflowingElements: Array.from(document.querySelectorAll('main,form,input,section,header'))
      .map((element) => ({
        tag: element.tagName,
        id: element.id,
        classes: element.className,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        width: Math.round(element.getBoundingClientRect().width),
      }))
      .filter((element) => element.right > innerWidth),
  }));
  await fs.writeFile(
    '/workspace/DealersDrive-fixes/docs/testing/fixes/BUG-NEW-005/evidence/owner-layout-finding.json',
    JSON.stringify(
      {
        sourceSha: process.env.TESTED_SHA,
        finding: 'BUG-NEW-006',
        severity: 'P2',
        scenario: '390-pixel re-onboarding account view with a valid inert email address',
        ...result,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
