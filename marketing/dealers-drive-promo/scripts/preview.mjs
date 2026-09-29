#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright-core';

import { CHROMIUM } from '../art/raster.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const format = arg('format', 'landscape');
const sizes = { landscape: [1920, 1080], square: [1080, 1080], portrait: [1080, 1920] };
const [width, height] = sizes[format];
const out = resolve(arg('out', join(root, 'recordings', 'preview', format)));
const every = Number(arg('every', '0'));

const { buildTimeline } = await import(pathToFileURL(join(root, 'film', 'timeline.mjs')).href);
const timeline = await buildTimeline({
  format,
  root,
  device: format === 'portrait' ? 'mobile' : 'desktop',
});
const times = every
  ? Array.from({ length: Math.floor(timeline.duration / every) }, (_, i) => (i + 0.5) * every)
  : arg('times', '1').split(',').map(Number);

await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--allow-file-access-from-files', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width, height } });
page.on('pageerror', (e) => console.error(`stage error: ${e.message}`));
await page.goto(pathToFileURL(join(root, 'film', 'stage', 'stage.html')).href);
const info = await page.evaluate((cfg) => window.setupFilm(cfg), {
  width,
  height,
  format,
  clips: timeline.clips,
});
if (info.broken.length) console.error('broken:', info.broken);
for (const t of times) {
  await page.evaluate((time) => window.renderAt(time), t);
  await page.screenshot({
    path: join(out, `t${t.toFixed(1).padStart(6, '0')}.jpg`),
    type: 'jpeg',
    quality: 85,
  });
}
await browser.close();
console.log(`${String(times.length)} frames → ${out} (film is ${timeline.duration.toFixed(1)}s)`);
