import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp');
const root = new URL('../', import.meta.url);
const brand = await readFile(new URL('apps/web/public/brand/dealers-drive-dark.svg', root), 'utf8');
const glyph = brand.match(/<path\b[^>]*\/>/)?.[0];
if (!glyph) throw new Error('The existing DD vector contour is missing.');

// The old browser glyph occupied about 76% of the tile. A 25% reduction
// leaves the unchanged contour at 57%, centered independently of its source crop.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="163.84" fill="#000000"/><g transform="translate(256 256) scale(0.444) translate(-736 -752)">${glyph}</g></svg>`;
const source = Buffer.from(svg);
const raster = (size) => sharp(source).resize(size, size).png().toBuffer();
await writeFile(new URL('apps/web/src/app/icon.png', root), await raster(512));

const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(raster));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [index, size] of sizes.entries()) {
  const frame = frames[index];
  const entry = 6 + index * 16;
  header[entry] = size;
  header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
await writeFile(new URL('apps/web/src/app/favicon.ico', root), Buffer.concat([header, ...frames]));
process.stdout.write(
  `Generated browser icons from the existing contour in ${fileURLToPath(root)}\n`,
);
