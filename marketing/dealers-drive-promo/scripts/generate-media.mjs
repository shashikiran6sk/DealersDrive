#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHOT_LABELS, renderShot, shotsFor } from '../art/gallery.mjs';
import { DOC_H, DOC_W, documentPage } from '../art/document.mjs';
import { openRasterizer } from '../art/raster.mjs';
import { YARD_H, YARD_W, yardScene } from '../art/yard.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(process.env.PROMO_ASSETS_DIR ?? join(root, 'assets'));
const generated = join(assets, 'generated');
const force = process.argv.includes('--force');
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const workers = Number(process.env.PROMO_WORKERS ?? 3);

const catalogPath = join(assets, 'catalog.json');
if (!existsSync(catalogPath)) {
  console.error(
    `No catalogue at ${catalogPath}.\nRun the promo seed first: pnpm --filter @dealers-drive/api db:seed:promo --catalog-only`,
  );
  process.exit(1);
}
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

const jobs = [];
const manifest = { generatedAt: null, vehicles: {}, yards: {} };

for (const vehicle of catalog.vehicles) {
  if (only && only !== 'cars') continue;
  manifest.vehicles[vehicle.id] = shotsFor(vehicle).map((shot, index) => {
    const file = `cars/${vehicle.id}/${String(index + 1).padStart(2, '0')}-${shot}.jpg`;
    jobs.push({ file, width: 0, height: 0, build: () => renderShot(vehicle, shot) });
    return { shot, label: SHOT_LABELS[shot], file };
  });
}

for (const yard of catalog.yards) {
  if (only && only !== 'yards') continue;
  const file = `dealers/${yard.key}/yard.jpg`;
  manifest.yards[yard.key] = { file, name: yard.name };
  jobs.push({
    file,
    build: () => ({
      svg: yardScene({ key: yard.key, state: yard.state }).svg,
      width: YARD_W,
      height: YARD_H,
    }),
  });
}

for (const kind of ['gst', 'pan', 'address']) {
  jobs.push({
    file: `documents/${kind}.jpg`,
    build: () => ({ svg: documentPage(kind), width: DOC_W, height: DOC_H }),
  });
}

const pending = jobs.filter((job) => force || !existsSync(join(generated, job.file)));
console.log(
  `Promo media: ${String(jobs.length)} images in the manifest, ${String(pending.length)} to render.`,
);

let done = 0;
const started = Date.now();
async function worker() {
  const raster = await openRasterizer();
  try {
    for (;;) {
      const job = pending.shift();
      if (!job) return;
      const { svg, width, height } = job.build();
      await raster.render(svg, width, height, join(generated, job.file), { quality: 92 });
      done += 1;
      if (done % 50 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`  ${String(done)} rendered (${rate.toFixed(1)}/s)`);
      }
    }
  } finally {
    await raster.close();
  }
}
await Promise.all(Array.from({ length: Math.max(1, workers) }, () => worker()));

manifest.generatedAt = new Date().toISOString();
await mkdir(generated, { recursive: true });
if (only && existsSync(join(generated, 'manifest.json'))) {
  const previous = JSON.parse(await readFile(join(generated, 'manifest.json'), 'utf8'));
  manifest.vehicles = only === 'cars' ? manifest.vehicles : previous.vehicles;
  manifest.yards = only === 'yards' ? manifest.yards : previous.yards;
}
await writeFile(join(generated, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Done — ${String(done)} rendered. Manifest: ${join(generated, 'manifest.json')}`);
