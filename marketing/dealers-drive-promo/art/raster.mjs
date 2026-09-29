import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { chromium } from 'playwright-core';

export const CHROMIUM =
  process.env.PROMO_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export async function openRasterizer() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  });
  const page = await browser.newPage();

  return {
    async render(svg, width, height, path, { quality = 90 } = {}) {
      await mkdir(dirname(path), { recursive: true });
      await page.setViewportSize({ width, height });
      await page.setContent(
        `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:#fff;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`,
      );
      await page.screenshot({ path, type: 'jpeg', quality, clip: { x: 0, y: 0, width, height } });
    },
    async close() {
      await browser.close();
    },
  };
}
