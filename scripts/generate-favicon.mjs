import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp');
const root = new URL('../', import.meta.url);
const brand = new URL('apps/web/public/brand/', root);
const icon = await readFile(new URL('dd-icon-white.svg', brand));

// The approved symbol is wide. Preserve its aspect ratio and center it on black.
// Maskable artwork fits wholly inside the central 80% diameter safe circle.
const tile = async (size, maskable = false, rounded = false) => {
  const width = Math.round(size * (rounded ? 0.68 : maskable ? 0.64 : 0.86));
  const glyph = await sharp(icon).resize({ width }).png().toBuffer();
  const background = rounded
    ? sharp(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="112.64" fill="#000000"/></svg>',
        ),
      ).resize(size, size)
    : sharp({ create: { width: size, height: size, channels: 4, background: '#000000' } });
  return background
    .composite([{ input: glyph, gravity: 'center' }])
    .png()
    .toBuffer();
};

for (const [path, size, maskable, rounded] of [
  // Favicon sizes are square multiples of 48, the only ones search engines use.
  ['apps/web/public/brand/dd-favicon-v2-48.png', 48, false, true],
  ['apps/web/public/brand/dd-favicon-v2-96.png', 96, false, true],
  ['apps/web/public/brand/dd-apple-icon-v2-180.png', 180, false],
  ['apps/web/public/brand/dd-icon-v2-192.png', 192, false],
  ['apps/web/public/brand/dd-icon-v2-512.png', 512, false],
  ['apps/web/public/brand/dd-icon-v2-maskable-512.png', 512, true],
  // Compatibility paths can be cached or referenced by installed clients.
  ['apps/web/public/brand/icon-192.png', 192, false],
  ['apps/web/public/brand/icon-512.png', 512, false],
  ['apps/web/public/brand/icon-maskable-512.png', 512, true],
]) {
  await writeFile(new URL(path, root), await tile(size, maskable, rounded));
}

const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map((size) => tile(size, false, true)));
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
// favicon.ico is the address clients request unprompted; the page links only the v2 copy.
for (const path of ['apps/web/public/favicon-v2.ico', 'apps/web/public/favicon.ico']) {
  await writeFile(new URL(path, root), Buffer.concat([header, ...frames]));
}

for (const color of ['black', 'white']) {
  for (const name of ['dd-icon', 'dealersdrive-wordmark']) {
    await sharp(await readFile(new URL(`${name}-${color}.svg`, brand)))
      .png()
      .toFile(new URL(`${name}-${color}.png`, brand).pathname);
  }
  const legacy = color === 'black' ? 'light' : 'dark';
  await writeFile(
    new URL(`dealers-drive-${legacy}.svg`, brand),
    await readFile(new URL(`dd-icon-${color}.svg`, brand)),
  );
  await sharp(await readFile(new URL(`dd-icon-${color}.svg`, brand)))
    .resize({ width: 1024 })
    .png()
    .toFile(new URL(`dealers-drive-${legacy}.png`, brand).pathname);
}

const rendered = async (name, color, width) =>
  sharp(await readFile(new URL(`${name}-${color}.svg`, brand)))
    .resize({ width })
    .png()
    .toBuffer();

const organization = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: '#ffffff' },
})
  .composite([
    { input: await rendered('dd-icon', 'black', 530), left: 247, top: 220 },
    { input: await rendered('dealersdrive-wordmark', 'black', 880), left: 72, top: 610 },
  ])
  .png()
  .toBuffer();
await writeFile(new URL('dealersdrive-organization-v2.png', brand), organization);

// Retain the existing useful social copy; brand lettering comes only from paths.
const copy = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#000000"/><g font-family="Arial, sans-serif" fill="#ffffff"><text x="80" y="398" font-size="76" font-weight="700">Used cars from verified</text><text x="80" y="478" font-size="76" font-weight="700">independent dealers</text><text x="80" y="542" font-size="30">Browse cars and dealerships near you. Enquire directly with the dealer.</text></g></svg>`,
);
const social = await sharp(copy)
  .composite([
    { input: await rendered('dd-icon', 'white', 96), left: 80, top: 96 },
    { input: await rendered('dealersdrive-wordmark', 'white', 330), left: 200, top: 106 },
  ])
  .png()
  .toBuffer();
for (const name of ['dealersdrive-v2.png', 'dealers-drive.png']) {
  await writeFile(new URL(`apps/web/public/og/${name}`, root), social);
}
process.stdout.write(
  'Generated browser, installation, email, compatibility and SEO assets from approved SVG masters.\n',
);
