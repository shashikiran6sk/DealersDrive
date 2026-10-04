import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WEB, API, PROMO } from './environment.mjs';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
if (process.argv[3]) {
  const response = await context.request.post(
    `${API}/v1/auth/sign-in/phone/${process.argv[3] === 'customer' ? 'customer' : 'dealer'}`,
    {
      data: {
        phone: process.argv[4],
        accessToken: `dev-otp:91${process.argv[4]}:123456:${Date.now()}`,
      },
    },
  );
  if (!response.ok()) throw new Error(`Login failed ${response.status()} ${await response.text()}`);
}
const page = await context.newPage();
await page.goto(`${WEB}${process.argv[2] || '/'}`);
await page.waitForTimeout(1500);
console.log((await page.locator('body').innerText()).slice(0, 15000));
console.log(
  await page.locator('input,button,select,textarea').evaluateAll((nodes) =>
    nodes.map((n) => ({
      tag: n.tagName,
      id: n.id,
      type: n.type,
      text: n.textContent?.slice(0, 100),
      aria: n.getAttribute('aria-label'),
    })),
  ),
);
await mkdir(resolve(PROMO, 'scenes'), { recursive: true });
await page.screenshot({ path: resolve(PROMO, 'scenes/probe.png') });
await browser.close();
