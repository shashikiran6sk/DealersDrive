import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const [out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const URL_ = 'http://localhost:3000/dealers/sri-balaji-cars-and-credits-katpadi-vellore-tamil-nadu';
const res = {};
const b = await chromium.launch();
for (const [width, mobile] of [[1280, false], [390, true]]) {
  const c = await b.newContext({ viewport: { width, height: 900 }, hasTouch: mobile, isMobile: mobile });
  const p = await c.newPage();
  await p.goto(URL_, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/dealer-hero-${width}.png` });
  const r = {};
  r.photosSection = await p.getByText(/Photos of the dealership/i).count();
  const imgs = await p.evaluate(() => [...document.querySelectorAll('img')].filter((i) => (i.getAttribute('src') ?? '').includes('/media/')).map((i) => ({ ok: i.complete && i.naturalWidth > 0 })));
  r.mediaImagesLoaded = imgs.filter((i) => i.ok).length;
  const tag = p.locator('section [class*="tnum"]').first();
  r.tagBefore = await tag.innerText().catch(() => null);
  const next = p.getByRole('button', { name: 'Next image' });
  r.hasArrows = (await next.count()) > 0;
  if (!mobile && r.hasArrows) { await next.click(); r.tagAfterNext = await tag.innerText(); }
  if (mobile) {
    const stage = p.getByRole('button', { name: /^View all/ }).first();
    const box = await stage.boundingBox();
    const y = box.y + box.height / 2;
    await p.evaluate(async ({ x0, x1, y }) => {
      const el = document.elementFromPoint(x0, y);
      const fire = (type, x) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true, pointerId: 1 }));
      fire('pointerdown', x0); fire('pointermove', (x0 + x1) / 2); fire('pointermove', x1); fire('pointerup', x1);
    }, { x0: box.x + box.width * 0.8, x1: box.x + box.width * 0.2, y });
    await p.waitForTimeout(300);
    r.tagAfterSwipe = await tag.innerText();
    r.viewerOpenAfterSwipe = await p.getByRole('dialog').count();
    await p.waitForTimeout(700);
  }
  await p.getByRole('button', { name: /^View all/ }).first().click();
  await p.getByRole('dialog').waitFor();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/dealer-viewer-${width}.png` });
  r.viewerOpen = await p.getByRole('dialog').count();
  r.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await p.keyboard.press('Escape');
  res[width] = r;
  await c.close();
}
const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await c.newPage();
const resp = await p.goto('http://localhost:3000/buy', { waitUntil: 'networkidle' }).catch(() => null);
const car = await p.locator('a[href^="/car/"]').first().getAttribute('href').catch(() => null);
if (car) {
  await p.goto(`http://localhost:3000${car}`, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/car-gallery-1280.png` });
  res.car = { url: car, tag: await p.locator('section [class*="tnum"]').first().innerText().catch(() => null), strip: await p.getByRole('button', { name: /^Open photo/ }).count() };
}
console.log(JSON.stringify(res, null, 1));
await b.close();
