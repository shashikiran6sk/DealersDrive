// MEDIA-009…012 in a real browser. The inherited listing campaign judged these from the API
// payload only and its notes deferred the interaction to a browser check that did not exist;
// this drives the vehicle page gallery itself (#304 PhotoGallery, R87 hero arrows).
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('gallery-browser');
const admin = await h.admin();
const D = await w.onboard('GalleryMotors');
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
const counter = async (page) =>
  (await page.locator('main').innerText())
    .match(/(\d+)\s*\/\s*(\d+)\s*·\s*view all/)
    ?.slice(1, 3)
    .join('/') ?? null;

await h.check(r, 'MEDIA-009', async () => {
  const primary = await h.one(
    `SELECT "mediaId" FROM vehicle_media WHERE "vehicleId"=$1 AND "isPrimary"`,
    [car.vehicleId],
  );
  const ctx = await b.context();
  const { page } = await b.open(ctx, `/dealers/${D.slug}`);
  // The card's link is a stretched overlay beside the image, so climb to the card itself.
  const cardSrc = await page.evaluate((slug) => {
    let node = document.querySelector(`a[href="/car/${slug}"]`);
    while (node && !node.querySelector('img')) node = node.parentElement;
    return node?.querySelector('img')?.getAttribute('src') ?? null;
  }, car.slug);
  await page.goto(`${b.WEB}/car/${car.slug}`, { waitUntil: 'networkidle' });
  const heroSrc = await page.locator('main section img').first().getAttribute('src');
  await ctx.close();
  r.ev({
    primary: primary.mediaId,
    cardUsesPrimary: cardSrc?.includes(primary.mediaId),
    heroUsesPrimary: heroSrc?.includes(primary.mediaId),
  });
  return cardSrc?.includes(primary.mediaId) && heroSrc?.includes(primary.mediaId)
    ? {
        layers: ['BROWSER', 'DATABASE'],
        note: 'the dealer-page card and the vehicle page hero both show the primary image (vehicle_media.isPrimary)',
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER'],
        note: `card ${cardSrc} hero ${heroSrc} primary ${primary.mediaId}`,
      };
});

await h.check(r, 'MEDIA-010', async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, `/car/${car.slug}`);
  const start = await counter(page);
  await page.getByRole('button', { name: 'Next image' }).click();
  const afterNext = await counter(page);
  await page.getByRole('button', { name: 'Previous image' }).click();
  const afterPrev = await counter(page);
  await page.getByRole('button', { name: 'Previous image' }).click();
  const wrapped = await counter(page);
  await b.shot(page, 'MEDIA-010-hero-arrows');
  await ctx.close();
  r.ev({ start, afterNext, afterPrev, wrapped });
  return start === '1/6' && afterNext === '2/6' && afterPrev === '1/6' && wrapped === '6/6'
    ? {
        layers: ['BROWSER'],
        note: `hero arrows: ${start} → Next ${afterNext} → Previous ${afterPrev} → Previous wraps to ${wrapped}`,
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER'],
        note: JSON.stringify({ start, afterNext, afterPrev, wrapped }),
      };
});

await h.check(r, 'MEDIA-011', async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, `/car/${car.slug}`);
  const trigger = page.getByRole('button', { name: /^View all 6 photos of / });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 5000 });
  const viewerCount = async () => (await dialog.innerText()).match(/(\d+)\s*\/\s*6/)?.[0] ?? null;
  const opened = await viewerCount();
  await page.keyboard.press('ArrowRight');
  const keyed = await viewerCount();
  await b.shot(page, 'MEDIA-011-fullscreen');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  const focusBack = await page.evaluate(
    () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName,
  );
  await ctx.close();
  r.ev({ opened, afterArrowRight: keyed, focusAfterEscape: focusBack });
  return opened && keyed && opened !== keyed && /View all 6 photos/.test(focusBack ?? '')
    ? {
        layers: ['BROWSER', 'A11Y'],
        note: `“view all” opens a full-screen viewer (${opened}); ArrowRight → ${keyed}; Escape closes and focus returns to the trigger`,
      }
    : { status: 'FAIL', layers: ['BROWSER'], note: JSON.stringify({ opened, keyed, focusBack }) };
});

await h.check(r, 'MEDIA-012', async () => {
  const root = process.env.CERT_STORAGE;
  if (!root)
    return { status: 'BLOCKED', note: 'CERT_STORAGE not set; cannot remove stored objects' };
  const broken = await w.published(D, admin);
  const partial = await w.published(D, admin);
  const keys = async (vehicleId, limit) =>
    h.q(
      `SELECT m."storageKey" FROM vehicle_media vm JOIN media m ON m.id=vm."mediaId" WHERE vm."vehicleId"=$1 ORDER BY vm.position LIMIT $2`,
      [vehicleId, limit],
    );
  const drop = (rows) => {
    let removed = 0;
    for (const { storageKey } of rows) {
      const dir = resolve(root, storageKey, '..');
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
        removed += 1;
      }
    }
    return removed;
  };
  const removedAll = drop(await keys(broken.vehicleId, 99));
  const removedTwo = drop(await keys(partial.vehicleId, 2));
  const ctx = await b.context();
  const a = await b.open(ctx, `/car/${broken.slug}`);
  await b.sleep(800);
  const brokenIn = (page, selector) =>
    page.evaluate(
      (sel) =>
        [...document.querySelectorAll(sel)]
          .filter((i) => i.offsetParent && i.complete && i.naturalWidth === 0)
          .map((i) => i.alt),
      selector,
    );
  const allGone = {
    comingSoon: await a.page.getByText('Photographs coming soon').count(),
    brokenInGallery: (await brokenIn(a.page, 'main section[aria-label="Photographs"] img')).length,
    brokenCards: await brokenIn(a.page, 'main img'),
  };
  await b.shot(a.page, 'MEDIA-012-all-images-missing');
  const p = await b.open(ctx, `/car/${partial.slug}`);
  await b.sleep(800);
  const partialCount = await counter(p.page);
  await ctx.close();
  r.ev({ removedAll, removedTwo, allGone, partialCount });
  const galleryOk =
    allGone.comingSoon > 0 && allGone.brokenInGallery === 0 && partialCount === '1/4';
  if (galleryOk && allGone.brokenCards.length > 0)
    return {
      status: 'FAIL',
      layers: ['BROWSER', 'STORAGE'],
      bug: 'BUG-109',
      note: `vehicle-page gallery falls back correctly (all missing → “Photographs coming soon”; two of six missing → ${partialCount}), but a vehicle card whose primary object is missing renders a broken image: ${allGone.brokenCards.length} on the page (${allGone.brokenCards[0]})`,
    };
  return galleryOk
    ? {
        layers: ['BROWSER', 'STORAGE'],
        note: `every stored image removed → “Photographs coming soon”; two of six removed → the gallery skips them (${partialCount}); no broken image anywhere`,
      }
    : {
        status: 'FAIL',
        layers: ['BROWSER', 'STORAGE'],
        note: JSON.stringify({ removedAll, removedTwo, allGone, partialCount }),
      };
});

r.save();
await b.close();
await h.pool.end();
