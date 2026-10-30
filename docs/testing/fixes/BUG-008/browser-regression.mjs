import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '/opt/codex/runtimes/cua/lib/node_modules/playwright-core/index.mjs';

const mode = process.argv[2];
assert.ok(['baseline', 'fixed'].includes(mode));
const root = new URL('./', import.meta.url);
const fixture = JSON.parse(await fs.readFile('/tmp/dd-bug008-browser-private.json', 'utf8'));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const rows = [];
const routes =
  mode === 'baseline'
    ? ['/admin/dealers', '/admin/listings', '/admin/enquiries']
    : [
        '/admin',
        '/admin/dealers',
        '/admin/listings',
        '/admin/enquiries',
        '/admin/support',
        '/admin/config',
      ];
try {
  for (const width of mode === 'baseline' ? [320, 390] : [320, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    await context.addCookies([
      {
        name: 'dd_session',
        value: fixture.adminToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    for (const path of routes) {
      const response = await page.goto(`http://localhost:3009${path}`, {
        waitUntil: 'networkidle',
      });
      await page.getByRole('navigation', { name: 'Admin console', exact: true }).waitFor();
      const geometry = await page.evaluate(() => {
        const box = (element) => {
          const r = element.getBoundingClientRect();
          const css = getComputedStyle(element);
          return {
            tag: element.tagName,
            classes: element.className,
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            scrollWidth: element.scrollWidth,
            overflowX: css.overflowX,
            flexWrap: css.flexWrap,
            minWidth: css.minWidth,
          };
        };
        const header = document.querySelector('header');
        return {
          viewport: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          header: box(header),
          headerChildren: [...header.querySelectorAll('span,a,button,div')].map(box),
          aside: box(document.querySelector('aside')),
          segmentedControls: [...document.querySelectorAll('.seg')].map(box),
          tables: [...document.querySelectorAll('table')].map((element) => ({
            table: box(element),
            container: box(element.parentElement),
          })),
        };
      });
      const passed =
        response.status() === 200 && page.url().endsWith(path) && geometry.documentWidth <= width;
      let screenshot = null;
      if (
        (width === 390 &&
          path !== '/admin' &&
          !['/admin/config', '/admin/support'].includes(path)) ||
        (mode === 'fixed' && path === '/admin/enquiries' && [768, 1440].includes(width))
      ) {
        screenshot = `evidence/screenshots/${mode}-${path.split('/').pop()}-${width}.png`;
        await page.screenshot({ path: new URL(screenshot, root).pathname, fullPage: false });
      }
      rows.push({
        canonical: ['BROWSER-009'],
        path,
        width,
        http: response.status(),
        result: passed ? 'PASS' : 'FAIL',
        geometry,
        screenshot,
        sha,
      });
      console.log(path, width, passed ? 'PASS' : 'FAIL', geometry.documentWidth);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
const report = {
  bug: 'BUG-008',
  mode,
  sha,
  environment:
    'Built Next.js/Chromium; real ADMIN cookie session; isolated PostgreSQL cert fixtures',
  rows,
  counts: {
    pass: rows.filter((row) => row.result === 'PASS').length,
    fail: rows.filter((row) => row.result === 'FAIL').length,
  },
};
await fs.writeFile(
  new URL(`evidence/browser-${mode}.json`, root),
  JSON.stringify(report, null, 2) + '\n',
);
assert.equal(report.counts.fail, 0, 'Admin document exceeds supported viewport');
