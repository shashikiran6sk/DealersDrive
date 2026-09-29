import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROMO } from './environment.mjs';
const format = process.argv[2] || 'landscape';
const dir = resolve(PROMO, 'recordings', format);
const names = (await readdir(dir, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
const width = 480,
  height = 300;
const layers = [];
for (const [i, name] of names.entries()) {
  const image = await sharp(resolve(dir, name, 'end.png'))
    .resize(width, height, { fit: 'contain', background: '#eee' })
    .png()
    .toBuffer();
  layers.push({ input: image, left: (i % 3) * width, top: Math.floor(i / 3) * (height + 30) });
  const label = Buffer.from(
    `<svg width="480" height="30"><rect width="100%" height="100%" fill="white"/><text x="10" y="22" font-family="Arial" font-size="18">${name}</text></svg>`,
  );
  layers.push({
    input: label,
    left: (i % 3) * width,
    top: Math.floor(i / 3) * (height + 30) + height,
  });
}
await sharp({
  create: {
    width: width * 3,
    height: Math.ceil(names.length / 3) * (height + 30),
    channels: 3,
    background: '#ddd',
  },
})
  .composite(layers)
  .png()
  .toFile(resolve(PROMO, 'scenes', format + '-contact.png'));
