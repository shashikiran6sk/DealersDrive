import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../api/package.json', import.meta.url));
const sharp = require('sharp');
const root = new URL('../../../', import.meta.url);
const destination = new URL('apps/mobile/src/assets/brand/', root);
const check = process.argv.includes('--check');
const masters = [
  ['dd-icon-black', 'a13e463d5e03a0e43e7701bcc50e9ac32ac32e14271019efadbb15ff9f8af677'],
  ['dd-icon-white', '73fe7172368307e6395e798671a64f47d28464282d8eb9b6d096f08f763aca21'],
  [
    'dealersdrive-wordmark-black',
    '06da86d1e1fbb1bc26394aca2c3906274115cb0546d53e9bd0d4e666ec2b459c',
  ],
  [
    'dealersdrive-wordmark-white',
    '6e88752dec4aee0dac09cabcfa18da2678d2cc4be3b984ceb1ba45158cf7ffe3',
  ],
];
const vectors = {};
const outputs = {};
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

if (!check) await mkdir(destination, { recursive: true });

const output = async (name, buffer) => {
  const path = new URL(name, destination);
  if (check) {
    const actual = await readFile(path);
    if (name.endsWith('.json')) {
      assert.deepEqual(JSON.parse(actual.toString()), JSON.parse(buffer.toString()), name);
    } else {
      assert.deepEqual(actual, buffer, `${name}: regenerate from approved SVG masters`);
    }
  } else {
    await writeFile(path, buffer);
  }
  outputs[name] = sha256(buffer);
};

for (const [name, expectedHash] of masters) {
  const master = await readFile(new URL(`apps/web/public/brand/${name}.svg`, root));
  assert.equal(sha256(master), expectedHash, `${name}: approved PR #311 master changed`);
  const xml = master.toString();
  assert(!/<(?:image|text|rect|foreignObject)\b|data:/i.test(xml));
  assert.equal([...xml.matchAll(/ d="([^"]+)"/g)].length, 1);
  vectors[name] = xml;
  await output(`${name}.svg`, master);
}
await output('vectors.json', Buffer.from(JSON.stringify(vectors, null, 2) + '\n'));

const symbol = Buffer.from(vectors['dd-icon-black']);
const raster = async (width) =>
  sharp(symbol, { density: (width / 651) * 72 })
    .resize({ width })
    .png()
    .toBuffer();
const square = async (size, width, background) => {
  const image = await raster(width);
  const metadata = await sharp(image).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([
      {
        input: image,
        left: Math.floor((size - metadata.width) / 2),
        top: Math.floor((size - metadata.height) / 2),
      },
    ])
    .png()
    .toBuffer();
};

const adaptive = await square(1080, 600, { r: 0, g: 0, b: 0, alpha: 0 });
const { data, info } = await sharp(adaptive).raw().toBuffer({ resolveWithObject: true });
let left = info.width;
let top = info.height;
let right = 0;
let bottom = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    assert(x >= 210 && x < 870 && y >= 210 && y < 870, 'outside 66dp safe zone');
    assert(Math.hypot(x + 0.5 - 540, y + 0.5 - 540) <= 360, 'clipped by 72dp circle');
  }
}
assert.equal(data[3], 0, 'adaptive foreground must have transparent exterior');
assert(Math.abs(left - (1080 - right - 1)) <= 2, 'horizontal centering');
assert(Math.abs(top - (1080 - bottom - 1)) <= 2, 'vertical centering');
await output('adaptive-foreground.png', adaptive);
await output('launcher.png', await square(1024, 640, '#ffffff'));
await output('play-store-icon.png', await square(512, 320, '#ffffff'));
const graphicSymbol = await raster(240);
const graphicWordmark = await sharp(Buffer.from(vectors['dealersdrive-wordmark-black']), {
  density: 144,
})
  .resize({ width: 700 })
  .png()
  .toBuffer();
await output(
  'play-feature-graphic.png',
  await sharp({
    create: { width: 1024, height: 500, channels: 4, background: '#ffffff' },
  })
    .composite([
      { input: graphicSymbol, left: 392, top: 105 },
      { input: graphicWordmark, left: 162, top: 306 },
    ])
    .removeAlpha()
    .png()
    .toBuffer(),
);
await output('splash-symbol.png', await raster(651));
await output(
  'provenance.json',
  Buffer.from(
    JSON.stringify(
      {
        source_pr: 311,
        source_commit: 'a969dc2c5223ddb04c23d720ded6a4daccfe33ab',
        masters: Object.fromEntries(masters),
        output_sha256: outputs,
        adaptive: {
          size: 1080,
          safe_zone: 660,
          artwork_width: 600,
          alpha_bounds: [left, top, right, bottom],
        },
        renderer: `sharp ${sharp.versions.sharp}`,
      },
      null,
      2,
    ) + '\n',
  ),
);
const config = JSON.parse(await readFile(new URL('apps/mobile/app.json', root), 'utf8')).expo;
assert.equal(config.icon, './src/assets/brand/launcher.png');
assert.equal(
  config.android.adaptiveIcon.foregroundImage,
  './src/assets/brand/adaptive-foreground.png',
);
assert.equal(
  config.android.adaptiveIcon.monochromeImage,
  './src/assets/brand/adaptive-foreground.png',
);
assert.equal(config.android.adaptiveIcon.backgroundColor, '#ffffff');
assert.deepEqual(config.android.permissions, []);
const splash = config.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
);
assert.equal(splash[1].image, './src/assets/brand/splash-symbol.png');
assert.equal(splash[1].backgroundColor, '#ffffff');
console.log(
  `PASS: ${check ? 'verified' : 'generated'} approved vectors, independent wordmark, transparent splash/foreground, geometry, centering, safe zone and native configuration.`,
);
