import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { PROMO } from './environment.mjs';
const times = [3, 12, 21, 30, 40, 50, 61, 70, 79, 86, 96, 104, 108];
const out = resolve(PROMO, 'scenes/qa');
await mkdir(out, { recursive: true });
for (const name of ['1080p', 'vertical-9x16', 'social-4x5']) {
  const layers = [];
  const width = name === '1080p' ? 480 : 300,
    height = name === '1080p' ? 270 : name === 'vertical-9x16' ? 534 : 375;
  for (const [i, t] of times.entries()) {
    const file = resolve(out, `${name}-${t}.jpg`);
    await new Promise((ok, no) => {
      const p = spawn(ffmpeg, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-ss',
        String(t),
        '-i',
        resolve(PROMO, 'exports', `dealers-drive-promo-${name}.mp4`),
        '-frames:v',
        '1',
        file,
      ]);
      p.on('exit', (c) => (c ? no(Error(String(c))) : ok()));
    });
    layers.push({
      input: await sharp(file).resize(width, height).toBuffer(),
      left: (i % 3) * width,
      top: Math.floor(i / 3) * height,
    });
  }
  await sharp({
    create: {
      width: width * 3,
      height: Math.ceil(times.length / 3) * height,
      channels: 3,
      background: '#eee',
    },
  })
    .composite(layers)
    .png()
    .toFile(resolve(out, `${name}-film-sheet.png`));
}
