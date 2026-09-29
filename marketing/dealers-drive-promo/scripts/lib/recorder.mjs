import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

import { CHROMIUM } from '../../art/raster.mjs';

export const DEVICES = {
  desktop: {
    viewport: { width: 1440, height: 810 },
    deviceScaleFactor: 8 / 3,
    isMobile: false,
    hasTouch: false,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};

/**
 * Presentation-only CSS for the recording. It changes nothing the app does:
 * it hides the non-production environment banner and the "no SMS is sent in
 * this environment" hint (both exist only because this is a local build),
 * hides scrollbars, and stops the caret blinking so consecutive frames agree.
 */
const RECORDING_SCRIPT = `
(() => {
  const css = \`
    ::-webkit-scrollbar { display: none !important; }
    html { scrollbar-width: none !important; }
    * { caret-color: transparent !important; }
    [data-promo-hidden] { display: none !important; }
  \`;
  let queued = false;
  const hide = () => {
    queued = false;
    const banner = document.body.firstElementChild;
    if (banner && banner.tagName === 'DIV' && /not real data\s*$/i.test(banner.textContent || '')) banner.dataset.promoHidden = '1';
    for (const p of document.querySelectorAll('p:not([data-promo-hidden])')) {
      if (/^\s*No SMS is sent in this environment/.test(p.textContent || '')) p.dataset.promoHidden = '1';
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(hide);
  };
  const install = () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    hide();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
`;

export async function openRecorder({ device = 'desktop', baseUrl, outDir }) {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--hide-scrollbars',
    ],
  });
  const context = await browser.newContext({
    ...DEVICES[device],
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    colorScheme: 'light',
  });
  await context.addInitScript(RECORDING_SCRIPT);
  const localHosts = new Set([new URL(baseUrl).host, 'localhost:4000', '127.0.0.1:4000']);
  const blocked = new Set();
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === 'data:' || url.protocol === 'blob:' || localHosts.has(url.host))
      return route.continue();
    blocked.add(url.host);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('crash', () => problems.push('renderer crashed'));
  page.on('response', (response) => {
    const url = response.url();
    if (response.status() >= 400 && !url.includes('favicon'))
      problems.push(`http ${String(response.status())}: ${url}`);
  });

  const meta = {
    device,
    viewport: DEVICES[device].viewport,
    dpr: DEVICES[device].deviceScaleFactor,
    scenes: {},
  };
  let scene = null;
  let counter = 0;

  async function settle(extra = 350) {
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const ready = page
      .evaluate(async () => {
        await document.fonts.ready;
        const visible = [...document.images].filter((img) => {
          const rect = img.getBoundingClientRect();
          return (
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth &&
            rect.width > 0
          );
        });
        const waits = visible.map((img) =>
          img.complete
            ? null
            : new Promise((r) => {
                img.addEventListener('load', r, { once: true });
                img.addEventListener('error', r, { once: true });
              }),
        );
        await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 6000))]);
      })
      .catch(() => {});
    await Promise.race([ready, new Promise((r) => setTimeout(r, 10000))]);
    await page.waitForTimeout(extra);
  }

  async function assertNoBrokenImages(label) {
    const broken = await page.evaluate(() =>
      [...document.images]
        .filter(
          (img) => img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().height > 0,
        )
        .map((img) => img.currentSrc || img.src),
    );
    if (broken.length) problems.push(`broken images at ${label}: ${broken.join(', ')}`);
  }

  return {
    page,
    context,
    problems,
    meta,
    async scene(name, fn) {
      await context.clearCookies();
      scene = { name, shots: {}, targets: {} };
      counter = 0;
      meta.scenes[name] = scene;
      await mkdir(join(outDir, name), { recursive: true });
      await fn();
      scene = null;
    },
    settle,
    async goto(path) {
      await page.goto(new URL(path, baseUrl).toString(), { waitUntil: 'load' });
      await settle();
    },
    async snap(name, { fullPage = false, pinHeader = null, wait = 350 } = {}) {
      if (process.env.PROMO_DEBUG) console.log(`  snap ${scene.name}/${name}`);
      await settle(wait);
      await assertNoBrokenImages(`${scene.name}/${name}`);
      counter += 1;
      const file = `${scene.name}/${String(counter).padStart(2, '0')}-${name}.png`;
      const entry = { file, url: page.url().replace(baseUrl, ''), fullPage };
      if (fullPage) {
        const maxY = typeof fullPage === 'number' ? fullPage : Infinity;
        const vh = meta.viewport.height;
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);
        if (pinHeader) {
          const header = await page.locator(pinHeader).first().boundingBox();
          if (header) {
            const headerFile = file.replace(/\.png$/, '-header.png');
            await page.screenshot({
              path: join(outDir, headerFile),
              clip: {
                x: 0,
                y: 0,
                width: meta.viewport.width,
                height: Math.ceil(header.y + header.height),
              },
              animations: 'disabled',
            });
            entry.pinned = { file: headerFile, height: Math.ceil(header.y + header.height) };
          }
        }
        await page.evaluate(() => {
          for (const node of document.querySelectorAll('body *')) {
            const position = getComputedStyle(node).position;
            if ((position === 'sticky' || position === 'fixed') && !node.closest('[role=dialog]'))
              node.setAttribute('data-promo-unstick', '');
          }
          const style = document.createElement('style');
          style.id = 'promo-unstick';
          style.textContent = '[data-promo-unstick]{position:static !important}';
          document.head.appendChild(style);
        });
        const height = Math.min(
          maxY + vh,
          await page.evaluate(() => document.documentElement.scrollHeight),
        );
        entry.pageHeight = height;
        entry.tiles = [];
        for (let y = 0, i = 0; ; i += 1) {
          const target = Math.min(y, height - vh);
          await page.evaluate((top) => window.scrollTo(0, top), target);
          await settle(250);
          const actual = await page.evaluate(() => window.scrollY);
          const tileFile = file.replace(/\.png$/, `-t${String(i)}.png`);
          await page.screenshot({ path: join(outDir, tileFile), animations: 'disabled' });
          entry.tiles.push({ file: tileFile, y: actual });
          if (target >= height - vh) break;
          y += vh;
        }
        await assertNoBrokenImages(`${scene.name}/${name} (scrolled)`);
        await page.evaluate(() => {
          document.getElementById('promo-unstick')?.remove();
          for (const node of document.querySelectorAll('[data-promo-unstick]'))
            node.removeAttribute('data-promo-unstick');
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(150);
      } else {
        entry.scrollY = await page.evaluate(() => window.scrollY);
        await page.screenshot({ path: join(outDir, file), animations: 'disabled' });
      }
      scene.shots[name] = entry;
      return entry;
    },
    async target(name, locator) {
      const box = await locator.boundingBox();
      if (!box) throw new Error(`target ${name}: element not visible`);
      const scrollY = await page.evaluate(() => window.scrollY);
      scene.targets[name] = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        w: box.width,
        h: box.height,
        pageY: box.y + scrollY + box.height / 2,
      };
      return scene.targets[name];
    },
    async save() {
      await writeFile(
        join(outDir, 'capture.json'),
        `${JSON.stringify({ ...meta, problems, blockedHosts: [...blocked] }, null, 2)}\n`,
      );
    },
    async close() {
      await browser.close();
    },
  };
}
