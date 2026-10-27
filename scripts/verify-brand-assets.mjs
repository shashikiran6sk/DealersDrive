import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp');
const root = new URL('../', import.meta.url);
const brand = new URL('apps/web/public/brand/', root);

for (const [name, width, height] of [
  ['dd-icon', 651, 424],
  ['dealersdrive-wordmark', 1092, 145],
]) {
  const paths = [];
  const alpha = [];
  for (const color of ['black', 'white']) {
    const svg = await readFile(new URL(`${name}-${color}.svg`, brand), 'utf8');
    assert(svg.includes(`viewBox="0 0 ${width} ${height}"`));
    assert(!/<(?:image|text|rect|foreignObject)\b|data:/i.test(svg));
    paths.push([...svg.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]));
    assert.equal(paths.at(-1).length, 1);
    const vector = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    const png = sharp(await readFile(new URL(`${name}-${color}.png`, brand)));
    const meta = await png.metadata();
    assert.equal(meta.width, width);
    assert.equal(meta.height, height);
    assert.equal(meta.hasAlpha, true);
    assert.deepEqual(await png.raw().toBuffer(), vector);
    alpha.push(Buffer.from(vector.filter((_, index) => index % 4 === 3)));
    assert(alpha.at(-1).includes(0), 'transparent exterior required');
    assert(alpha.at(-1).includes(255), 'opaque artwork required');
  }
  assert.deepEqual(paths[0], paths[1], 'color variants must have identical geometry');
  assert.deepEqual(alpha[0], alpha[1], 'color variants must have identical coverage');
  if (name === 'dd-icon') {
    // Flood-fill foreground: exactly two standalone shapes, with no wordmark.
    const pixels = alpha[0];
    const seen = new Set();
    let components = 0;
    for (let index = 0; index < pixels.length; index++) {
      if (pixels[index] < 128 || seen.has(index)) continue;
      components++;
      const pending = [index];
      seen.add(index);
      while (pending.length) {
        const next = pending.pop();
        const x = next % width;
        for (const neighbor of [
          ...(x > 0 ? [next - 1] : []),
          ...(x < width - 1 ? [next + 1] : []),
          next - width,
          next + width,
        ]) {
          if (
            neighbor < 0 ||
            neighbor >= pixels.length ||
            pixels[neighbor] < 128 ||
            seen.has(neighbor)
          )
            continue;
          seen.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    assert.equal(components, 2, 'icon must contain exactly the two DD shapes');
  }
}

for (const path of [
  ...(await readdir(brand))
    .filter((name) => name.endsWith('.png'))
    .map((name) => `apps/web/public/brand/${name}`),
  'apps/web/public/og/dealersdrive-v2.png',
  'apps/web/public/og/dealers-drive.png',
]) {
  await sharp(await readFile(new URL(path, root)))
    .raw()
    .toBuffer();
}

// Search engines take a favicon only at a multiple of 48px square.
for (const [path, size] of [
  ['apps/web/public/brand/dd-icon-v2-192.png', 192],
  ['apps/web/public/brand/dd-apple-icon-v2-180.png', 180],
]) {
  const meta = await sharp(await readFile(new URL(path, root))).metadata();
  assert.deepEqual([meta.width, meta.height], [size, size], `${path} must be ${size}px square`);
}

const ico = await readFile(new URL('apps/web/public/favicon-v2.ico', root));
assert.deepEqual(
  await readFile(new URL('apps/web/public/favicon.ico', root)),
  ico,
  '/favicon.ico must serve the same mark as /favicon-v2.ico',
);
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 3);
const favicons = [];
for (let index = 0; index < 3; index++) {
  const entry = 6 + index * 16;
  const size = [16, 32, 48][index];
  assert.equal(ico[entry], size);
  favicons.push([
    `favicon-v2.ico ${size}px`,
    size,
    ico.subarray(
      ico.readUInt32LE(entry + 12),
      ico.readUInt32LE(entry + 12) + ico.readUInt32LE(entry + 8),
    ),
  ]);
}
for (const size of [48, 96]) {
  favicons.push([
    `dd-favicon-v2-${size}.png`,
    size,
    await readFile(new URL(`apps/web/public/brand/dd-favicon-v2-${size}.png`, root)),
  ]);
}
for (const [label, size, frame] of favicons) {
  const { data, info } = await sharp(frame)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, size, `${label} width`);
  assert.equal(info.height, size, `${label} height`);
  assert.equal(data[3], 0, 'rounded favicon corners must be transparent');
  const topCenter = Math.floor(size / 2) * 4;
  assert.deepEqual([...data.subarray(topCenter, topCenter + 4)], [0, 0, 0, 255]);
  let left = size,
    right = 0,
    top = size,
    bottom = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4] < 128) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  assert(left > 0 && top > 0 && right < size - 1 && bottom < size - 1, 'favicon must not clip');
  assert(Math.abs(left - (size - right - 1)) <= 1, 'favicon must be horizontally centered');
  assert(Math.abs(top - (size - bottom - 1)) <= 1, 'favicon must be vertically centered');
  assert(
    right - left + 1 <= Math.ceil(size * 0.7),
    'favicon symbol must retain the requested padding',
  );
}

const active = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await active(path);
    else if (/\.(tsx?|css|html)$/.test(entry.name)) {
      assert(
        !/\/brand\/dealers-drive-(?:light|dark)\.(?:png|svg)|\/og\/dealers-drive\.png|\/brand\/icon-(?:192|512|maskable-512)\.png/.test(
          await readFile(path, 'utf8'),
        ),
        `obsolete active asset reference: ${path.pathname}`,
      );
    }
  }
};
await active(new URL('apps/web/src/', root));
await active(new URL('apps/api/src/', root));
process.stdout.write(
  'PASS: SVG geometry, separate icon/wordmark, transparent rasters, ICO frames, centering, decodability and active references.\n',
);
