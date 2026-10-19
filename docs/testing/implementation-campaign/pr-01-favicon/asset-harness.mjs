import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const root = '/Users/shashikiran/Development/dealers-drive';
const sharp = createRequire(`${root}/apps/api/package.json`)('sharp');
const before = await sharp('/tmp/dd-campaign-before-icon.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const after = await sharp(`${root}/apps/web/src/app/icon.png`)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
assert.equal(after.info.width, 512);
assert.equal(after.info.height, 512);
function bounds({ data, info }) {
  let minX = info.width,
    maxX = -1,
    minY = info.height,
    maxY = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const p = (y * info.width + x) * 4;
      if (data[p] > 127 && data[p + 3] > 127) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centerX: (maxX + minX) / 2,
    centerY: (maxY + minY) / 2,
  };
}
for (let i = 3; i < before.data.length; i += 4)
  assert.equal(after.data[i], before.data[i], `Rounded tile alpha at ${i}`);
const oldBounds = bounds(before),
  newBounds = bounds(after);
assert(Math.abs(newBounds.width / oldBounds.width - 0.75) < 0.015);
assert(Math.abs(newBounds.height / oldBounds.height - 0.75) < 0.015);
assert(Math.abs(newBounds.centerX - 255.5) <= 1);
assert(Math.abs(newBounds.centerY - 255.5) <= 1);
const ico = await readFile(`${root}/apps/web/src/app/favicon.ico`);
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 3);
const sizes = [16, 32, 48];
for (const [i, size] of sizes.entries()) {
  const entry = 6 + 16 * i;
  assert.equal(ico[entry], size);
  assert.equal(ico[entry + 1], size);
  const frame = ico.subarray(
    ico.readUInt32LE(entry + 12),
    ico.readUInt32LE(entry + 12) + ico.readUInt32LE(entry + 8),
  );
  const m = await sharp(frame).metadata();
  assert.equal(m.width, size);
  assert.equal(m.height, size);
  assert.equal(m.hasAlpha, true);
}
const unchanged = [
  'apps/web/public/brand/dealers-drive-dark.png',
  'apps/web/public/brand/dealers-drive-light.png',
  'apps/web/public/brand/dealers-drive-dark.svg',
  'apps/web/public/brand/dealers-drive-light.svg',
  'apps/web/src/app/apple-icon.png',
  'apps/web/src/app/manifest.ts',
  'apps/web/public/brand/icon-192.png',
  'apps/web/public/brand/icon-512.png',
  'apps/web/public/brand/icon-maskable-512.png',
];
for (const file of unchanged)
  assert(
    (await readFile(`${root}/${file}`)).equals(
      execFileSync('git', ['show', `main:${file}`], { cwd: root }),
    ),
    `${file} unchanged`,
  );
const report = {
  oldBounds,
  newBounds,
  widthRatio: newBounds.width / oldBounds.width,
  heightRatio: newBounds.height / oldBounds.height,
  alphaPixelsChanged: 0,
  sizes,
  unchanged,
  result: 'PASS',
};
const out = '/tmp/dd-campaign-evidence/docs/testing/implementation-campaign/pr-01-favicon';
await mkdir(out, { recursive: true });
await writeFile(`${out}/asset-verification.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
